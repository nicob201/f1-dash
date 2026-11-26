// Telegram Bot API con fetch directo.
export type SendResult = { ok: true } | { ok: false; status: number | null; description: string }

async function call(token: string, method: string, body: object, fetcher: typeof fetch): Promise<SendResult> {
  let status: number | null = null
  try {
    const res = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    status = res.status
    const data = (await res.json()) as { ok: boolean; description?: string }
    return data.ok ? { ok: true } : { ok: false, status, description: data.description ?? 'sin descripción' }
  } catch (e) {
    // Solo el nombre: el mensaje del error puede traer la URL, que contiene el token.
    return { ok: false, status, description: e instanceof Error ? e.name : 'error' }
  }
}

export const sendMessage = (token: string, chatId: string, html: string, fetcher: typeof fetch = fetch): Promise<SendResult> =>
  call(token, 'sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }, fetcher)

const MENU = [
  { command: 'proxima', description: 'Próxima carrera' },
  { command: 'ultima', description: 'Última carrera' },
  { command: 'campeonato', description: 'Las dos tablas' },
]

/** Le dice a Telegram dónde mandar los mensajes (con qué secreto) y qué comandos mostrar en el menú. */
export async function registerBot(token: string, url: string, secret: string, fetcher: typeof fetch = fetch): Promise<void> {
  const steps: [string, object][] = [
    ['setWebhook', { url, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true }],
    ['setMyCommands', { commands: MENU }],
  ]
  for (const [method, body] of steps) {
    const r = await call(token, method, body, fetcher)
    if (!r.ok) throw new Error(`${method}: ${r.status ?? 'sin respuesta'} ${r.description}`)
  }
}

/** Un chat privado es un id positivo. Los canales y grupos son `@nombre` o un id negativo. */
export const isPrivateChat = (chatId: string): boolean => /^\d+$/.test(chatId)
