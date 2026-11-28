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

describe('log', () => {
  // wrangler tail da la CPU de cada pedido; esta línea dice de qué comando es.
  it('anota el comando y nada de lo que escribió el usuario', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await post(message('/Ultima@F1DashArBot dato privado'))
    await post(message('texto privado'))
    expect(log.mock.calls).toEqual([['bot /ultima'], ['bot help']])
  })
})

describe('fallas', () => {
  // Falla al ejecutar, como una caída real: ahí Drizzle envuelve el error y su mensaje es el SQL.
  const down = async () => { throw new Error('D1_ERROR: D1 caída') }
  const statement = { bind: () => statement, all: down, raw: down, first: down, run: down }
  const brokenDb = { prepare: () => statement, batch: down }
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
    const text = assertNoSecrets(log)
    expect(text).toBe('bot /ultima: D1_ERROR: D1 caída')
  })
  it('un error de varias líneas queda en una', async () => {
    const log = logged()
    const multi = { prepare: () => { throw new Error('uno\ndos') } }
    await post(message('/ultima'), { env: bindings({ DB: multi as unknown as D1Database }) })
    expect(assertNoSecrets(log)).not.toContain('\n')
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

describe('api de la web', () => {
  const HOME = '{"season":2026,"races":[]}'
  const RACE = '{"season":2026,"round":21}'
  const CHAMPIONSHIP = '{"season":2026,"round":21,"drivers":[]}'
  const STATS = '{"season":2026,"round":21,"duels":[]}'
  beforeAll(async () => {
    const put = env.DB.prepare('insert or replace into kv (key, value) values (?, ?)')
    await env.DB.batch([
      put.bind('home', HOME), put.bind('race:2026:21', RACE), put.bind('championship', CHAMPIONSHIP), put.bind('stats', STATS),
    ])
  })
  const get = (path: string, e = bindings()) => app.request(path, {}, e)
  const headers = (res: Response) => [res.headers.get('content-type'), res.headers.get('cache-control')]

  it('devuelve los snapshots guardados', async () => {
    const home = await get('/api/home')
    expect(home.status).toBe(200)
    expect(await home.text()).toBe(`{"channel":null,"snapshot":${HOME}}`)
    expect(headers(home)).toEqual(['application/json', 'public, max-age=60'])
    const race = await get('/api/races/2026/21')
    expect([race.status, await race.text()]).toEqual([200, RACE])
    expect(headers(race)).toEqual(['application/json', 'public, max-age=60'])
  })
  it('devuelve el campeonato y las stats guardados', async () => {
    for (const [path, body] of [['/api/championship', CHAMPIONSHIP], ['/api/stats', STATS]] as const) {
      const res = await get(path)
      expect([res.status, await res.text(), ...headers(res)]).toEqual([200, body, 'application/json', 'public, max-age=60'])
    }
  })
  it.each([
    [undefined, null], ['', null], ['@canal', '@canal'], ['a"b\\c', 'a"b\\c'],
  ])('con CHANNEL_LINK %j el canal es %j', async (value, channel) => {
    const res = await get('/api/home', bindings({ CHANNEL_LINK: value }))
    expect(await res.json()).toEqual({ channel, snapshot: JSON.parse(HOME) })
  })
  it.each([
    '/api/races/2026/22', '/api/races/2026/0', '/api/races/2026/999', '/api/races/abc/1', '/api/races/2026', '/api/nada', '/api', '/api/stats/x', '/api/championship/2026',
  ])('%s → 404 en JSON, sin caché', async (path) => {
    const res = await get(path)
    expect([res.status, await res.json(), res.headers.get('cache-control')]).toEqual([404, { error: 'not_found' }, null])
  })
  it('base caída: 500 y la causa en el log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const down = async () => { throw new Error('D1_ERROR: D1 caída') }
    const statement = { bind: () => statement, first: down }
    const res = await get('/api/home', bindings({ DB: { prepare: () => statement } as unknown as D1Database }))
    expect([res.status, await res.json()]).toEqual([500, { error: 'unavailable' }])
    expect(log.mock.calls).toEqual([['api /api/home: D1_ERROR: D1 caída']])
  })
})

it('no hay más rutas', async () => {
  for (const [path, method] of [['/', 'GET'], ['/telegram/webhook', 'GET'], ['/api/nada', 'GET'], ['/', 'POST']] as const) {
    expect((await app.request(path, { method }, bindings())).status).toBe(404)
  }
})
