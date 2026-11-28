// Rutas del Worker: la API de la web y el webhook del bot. El resto son archivos estáticos.
import { drizzle } from 'drizzle-orm/d1'
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { loadForCommand } from './db/queries'
import { commandReply, parseCommand } from './notices/commands'
import { sendMessage } from './telegram'

export type Bindings = {
  DB: D1Database
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_WEBHOOK_SECRET: string
  /** Sin configurar mientras el canal no esté abierto. */
  CHANNEL_LINK?: string
  WEB_URL?: string
}

// Solo lo que se lee. Cualquier otra cosa se ignora: un error haría que Telegram reintente.
const Update = z.object({
  message: z.object({ chat: z.object({ id: z.number(), type: z.string() }), text: z.string().optional() }),
})

/** En tiempo constante: se comparan los hashes, que siempre miden lo mismo. */
async function sameSecret(received: string, expected: string): Promise<boolean> {
  const hash = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  const [a, b] = await Promise.all([hash(received), hash(expected)])
  // timingSafeEqual es de Workers; los tipos de Node (los usan los scripts) tapan los de Cloudflare.
  const subtle = crypto.subtle as typeof crypto.subtle & { timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean }
  return subtle.timingSafeEqual(a, b)
}

/** La causa en una línea. Drizzle envuelve las fallas de D1: su mensaje es el SQL y el motivo queda en `cause`. */
function cause(e: unknown): string {
  const root = e instanceof Error && e.cause instanceof Error ? e.cause : e
  return (root instanceof Error ? root.message : String(root)).replace(/\s+/g, ' ')
}

/**
 * Devuelve un snapshot como está guardado, sin interpretarlo: hay 10 ms de CPU por pedido.
 * `wrap` le agrega texto alrededor.
 */
async function snapshot(c: Context<{ Bindings: Bindings }>, key: string, wrap = (json: string) => json) {
  try {
    const value = await c.env.DB.prepare('select value from kv where key = ?').bind(key).first<string>('value')
    if (value === null) return c.json({ error: 'not_found' }, 404)
    return c.body(wrap(value), 200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' })
  } catch (e) {
    console.error(`api ${c.req.path}: ${cause(e)}`)
    return c.json({ error: 'unavailable' }, 500)
  }
}

export function createApp(fetcher: typeof fetch = fetch) {
  const app = new Hono<{ Bindings: Bindings }>()

  app.post('/telegram/webhook', async (c) => {
    const expected = c.env.TELEGRAM_WEBHOOK_SECRET
    const received = c.req.header('x-telegram-bot-api-secret-token')
    // Sin secreto configurado se rechaza todo.
    if (!expected || !received || !(await sameSecret(received, expected))) return c.body(null, 401)

    const update = Update.safeParse(await c.req.json().catch(() => null))
    if (!update.success) return c.body(null, 200)
    const { chat, text } = update.data.message
    if (chat.type !== 'private') return c.body(null, 200)

    const command = parseCommand(text ?? '')
    // Con wrangler tail, atribuye la CPU de cada pedido. Solo el comando: nunca el chat ni el texto.
    console.log(`bot ${command}`)
    try {
      const now = new Date()
      const data = await loadForCommand(drizzle(c.env.DB), command, now)
      const reply = commandReply(command, data, now, {
        channel: c.env.CHANNEL_LINK || null,
        webUrl: c.env.WEB_URL || null,
      })
      const result = await sendMessage(c.env.TELEGRAM_BOT_TOKEN, String(chat.id), reply, fetcher)
      if (!result.ok) console.error(`bot ${command}: Telegram ${result.status ?? 'sin respuesta'} ${result.description}`)
    } catch (e) {
      console.error(`bot ${command}: ${cause(e)}`)
    }
    return c.body(null, 200)
  })

  // El canal sale de la misma variable que usa el bot: el snapshot se arma sin las variables del Worker.
  app.get('/api/home', (c) =>
    snapshot(c, 'home', (json) => `{"channel":${JSON.stringify(c.env.CHANNEL_LINK || null)},"snapshot":${json}}`),
  )
  app.get('/api/races/:season{[0-9]+}/:round{[0-9]+}', (c) =>
    snapshot(c, `race:${c.req.param('season')}:${c.req.param('round')}`),
  )
  app.get('/api/championship', (c) => snapshot(c, 'championship'))
  app.get('/api/stats', (c) => snapshot(c, 'stats'))
  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404))

  return app
}
