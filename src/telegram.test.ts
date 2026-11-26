import { isPrivateChat, sendMessage } from './telegram'

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
