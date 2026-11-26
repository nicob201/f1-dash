import { isPrivateChat, registerBot, sendMessage } from './telegram'

const TOKEN = '123456:SECRETO-del-bot'

it('manda HTML sin vista previa de links', async () => {
  let url = ''
  let body: unknown
  const r = await sendMessage(TOKEN, '42', '<b>hola</b>', async (u, init) => {
    url = String(u)
    body = JSON.parse(String(init?.body))
    return Response.json({ ok: true })
  })
  expect(r).toEqual({ ok: true })
  expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`)
  expect(body).toEqual({ chat_id: '42', text: '<b>hola</b>', parse_mode: 'HTML', link_preview_options: { is_disabled: true } })
})
it('un rechazo devuelve la descripción de Telegram', async () => {
  const r = await sendMessage(TOKEN, '42', 'x', async () =>
    Response.json({ ok: false, description: "Bad Request: can't parse entities" }, { status: 400 }),
  )
  expect(r).toEqual({ ok: false, status: 400, description: "Bad Request: can't parse entities" })
})
it('una respuesta ilegible no lanza', async () => {
  const r = await sendMessage(TOKEN, '42', 'x', async () => new Response('<html>', { status: 502 }))
  expect(r).toMatchObject({ ok: false, status: 502 })
})
it('un error de red nunca filtra el token', async () => {
  const r = await sendMessage(TOKEN, '42', 'x', async (u) => {
    throw new TypeError(`fetch failed: ${String(u)}`)
  })
  expect(r).toEqual({ ok: false, status: null, description: 'TypeError' })
  expect(JSON.stringify(r)).not.toContain('SECRETO')
})
it('solo un id numérico positivo es un chat privado', () => {
  expect(isPrivateChat('123456')).toBe(true)
  expect(['@F1DashAr', '-1001234567890', '-42', '', ' 42', '42a'].filter(isPrivateChat)).toEqual([])
})

describe('registerBot', () => {
  it('registra el webhook y después el menú de comandos', async () => {
    const calls: [string, unknown][] = []
    await registerBot(TOKEN, 'https://x.test/telegram/webhook', 's3', async (u, init) => {
      calls.push([String(u).split('/').pop()!, JSON.parse(String(init?.body))])
      return Response.json({ ok: true, result: true })
    })
    expect(calls).toEqual([
      ['setWebhook', {
        url: 'https://x.test/telegram/webhook', secret_token: 's3', allowed_updates: ['message'], drop_pending_updates: true,
      }],
      ['setMyCommands', { commands: [
        { command: 'proxima', description: 'Próxima carrera' },
        { command: 'ultima', description: 'Última carrera' },
        { command: 'campeonato', description: 'Las dos tablas' },
      ] }],
    ])
  })
  it('si Telegram rechaza, lanza con su descripción y no sigue', async () => {
    let calls = 0
    const rejected = registerBot(TOKEN, 'https://x.test', 's3', async () => {
      calls++
      return Response.json({ ok: false, description: 'Bad Request: bad webhook' }, { status: 400 })
    })
    await expect(rejected).rejects.toThrow('setWebhook: 400 Bad Request: bad webhook')
    expect(calls).toBe(1)
  })
  it('un error de red lanza sin el token', async () => {
    const err = await registerBot(TOKEN, 'https://x.test', 's3', async (u) => {
      throw new TypeError(`fetch failed: ${String(u)}`)
    }).catch((e: Error) => e)
    expect((err as Error).message).toContain('TypeError')
    expect(`${(err as Error).message} ${String((err as Error).cause ?? '')}`).not.toContain('SECRETO')
  })
})
