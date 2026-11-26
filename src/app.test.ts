import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { createApp, type Bindings } from './app'
import { saveCalendar, saveResults, saveStandings } from './db/save'
import { season2026 } from './notices/__fixtures__/season'
import { commandReply } from './notices/commands'

// cloudflareTest carga .dev.vars: los tests usan sus propios valores y nunca llaman a Telegram.
const TOKEN = '111:token-de-prueba'
const SECRET = 'secreto-de-prueba'
const bindings = (o: Partial<Bindings> = {}): Bindings => ({
  DB: env.DB, TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_WEBHOOK_SECRET: SECRET, ...o,
})

type Sent = { url: string; body: { chat_id: string; text: string; parse_mode: string } }
let sent: Sent[]
let telegramReply: () => Response
const app = createApp(async (url, init) => {
  sent.push({ url: String(url), body: JSON.parse(String(init?.body)) })
  return telegramReply()
})

beforeAll(async () => {
  const d = season2026()
  const db = drizzle(env.DB)
  await saveCalendar(db, d.races, d.sessions)
  await saveResults(db, d)
  await saveStandings(db, d.standings)
})
beforeEach(() => {
  sent = []
  telegramReply = () => Response.json({ ok: true })
})
afterEach(() => vi.restoreAllMocks())

const message = (text: string | undefined, type = 'private') =>
  JSON.stringify({ update_id: 1, message: { chat: { id: 987654, type }, text, ...(text === undefined ? { sticker: {} } : {}) } })
const post = (body: string, o: { secret?: string | null; env?: Bindings } = {}) => {
  const secret = o.secret === undefined ? SECRET : o.secret
  const headers: Record<string, string> = secret === null ? {} : { 'x-telegram-bot-api-secret-token': secret }
  return app.request('/telegram/webhook', { method: 'POST', body, headers }, o.env ?? bindings())
}
const HELP = 'Comandos:\n/proxima · próxima carrera\n/ultima · última carrera\n/campeonato · las dos tablas'

describe('secreto', () => {
  it.each([null, '', 'otro', `${SECRET}x`])('header %j → 401 y no manda nada', async (secret) => {
    expect((await post(message('/ultima'), { secret })).status).toBe(401)
    expect(sent).toEqual([])
  })
  it.each(['', undefined])('con el secreto del servidor en %j se rechaza todo', async (value) => {
    const e = bindings({ TELEGRAM_WEBHOOK_SECRET: value as unknown as string })
    for (const secret of [null, '', 'undefined', SECRET]) {
      expect((await post(message('/ultima'), { secret, env: e })).status).toBe(401)
    }
    expect(sent).toEqual([])
  })
})

describe('respuestas', () => {
  it('/ultima en privado', async () => {
    expect((await post(message('/ultima'))).status).toBe(200)
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`)
    expect(sent[0]!.body).toMatchObject({
      chat_id: '987654',
      parse_mode: 'HTML',
      text: commandReply('/ultima', season2026(), new Date(), { channel: null, webUrl: null }),
    })
  })
  it('un sticker recibe la lista de comandos', async () => {
    await post(message(undefined))
    expect(sent[0]!.body.text).toBe(HELP)
  })
  it.each(['group', 'supergroup', 'channel'])('en %s no contesta', async (type) => {
    expect((await post(message('/ultima', type))).status).toBe(200)
    expect(sent).toEqual([])
  })
  it.each([
    'no es json', '', 'null', '{"edited_message":{"chat":{"id":1,"type":"private"},"text":"/start"}}',
    '{"my_chat_member":{}}', '{"message":{"text":"sin chat"}}',
  ])('%j → 200 sin mandar nada', async (body) => {
    expect((await post(body)).status).toBe(200)
    expect(sent).toEqual([])
  })
  it('/start muestra el canal y la web cuando están configurados', async () => {
    await post(message('/start'))
    await post(message('/start'), { env: bindings({ CHANNEL_LINK: '@canal', WEB_URL: 'https://example.test' }) })
    expect(sent[0]!.body.text).toContain('El canal con los avisos está por abrir.')
    expect(sent[1]!.body.text).toContain('en el canal @canal.')
    expect(sent[1]!.body.text).toContain('https://example.test')
  })
})

describe('fallas', () => {
  const brokenDb = { prepare: () => { throw new Error('D1 caída') }, batch: () => { throw new Error('D1 caída') } }
  const logged = () => vi.spyOn(console, 'error').mockImplementation(() => {})
  const assertNoSecrets = (log: ReturnType<typeof logged>) => {
    const text = log.mock.calls.flat().map(String).join(' ')
    for (const secret of [TOKEN, SECRET, '987654']) expect(text).not.toContain(secret)
    return text
  }

  it('base caída: 200, sin envío y con el error en el log', async () => {
    const log = logged()
    const res = await post(message('/ultima'), { env: bindings({ DB: brokenDb as unknown as D1Database }) })
    expect(res.status).toBe(200)
    expect(sent).toEqual([])
    expect(assertNoSecrets(log)).toContain('/ultima')
  })
  it('con la base caída, /start igual contesta', async () => {
    await post(message('/start'), { env: bindings({ DB: brokenDb as unknown as D1Database }) })
    expect(sent).toHaveLength(1)
  })
  it('un rechazo de Telegram queda en el log', async () => {
    const log = logged()
    telegramReply = () => Response.json({ ok: false, description: 'Bad Request: x' }, { status: 400 })
    expect((await post(message('/start'))).status).toBe(200)
    expect(assertNoSecrets(log)).toContain('Bad Request: x')
  })
})

it('no hay más rutas', async () => {
  for (const [path, method] of [['/', 'GET'], ['/telegram/webhook', 'GET'], ['/api/home', 'GET'], ['/', 'POST']] as const) {
    expect((await app.request(path, { method }, bindings())).status).toBe(404)
  }
})
