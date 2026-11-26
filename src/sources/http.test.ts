import { fetchAllPages, fetchJson } from './http'

const reply = (status: number, body: string) => async () => new Response(body, { status })

describe('fetchJson', () => {
  it('200 con JSON', async () => {
    expect(await fetchJson('https://x', reply(200, '{"a":1}'))).toEqual({ kind: 'ok', body: { a: 1 } })
  })
  it('404 es "todavía no está"', async () => {
    expect(await fetchJson('https://x', reply(404, '{"detail":"No results found."}'))).toEqual({ kind: 'missing' })
  })
  it('429 no lanza', async () => {
    expect(await fetchJson('https://x', reply(429, ''))).toEqual({ kind: 'rate_limited' })
  })
  it.each([403, 500])('%i lanza con el status en el mensaje', async (s) => {
    await expect(fetchJson('https://x', reply(s, ''))).rejects.toThrow(String(s))
  })
  it('200 con HTML lanza', async () => {
    await expect(fetchJson('https://x', reply(200, '<!doctype html>'))).rejects.toThrow()
  })
  it('manda el user-agent', async () => {
    let ua: string | null = null
    await fetchJson('https://x', async (_u, init) => {
      ua = new Headers(init?.headers).get('user-agent')
      return new Response('{}')
    })
    expect(ua).toBe('generic-client/1.0')
  })
})

describe('fetchAllPages', () => {
  it('recorre todas las páginas', async () => {
    const offsets: string[] = []
    const pages = await fetchAllPages('https://x/results.json', async () => {}, async (u) => {
      offsets.push(new URL(String(u)).searchParams.get('offset')!)
      return Response.json({ MRData: { total: '250' } })
    })
    expect(offsets).toEqual(['0', '100', '200'])
    expect(pages).toHaveLength(3)
  })
  it('una página que no es ok lanza con la URL', async () => {
    await expect(fetchAllPages('https://x/results.json', async () => {}, reply(429, ''))).rejects.toThrow('x/results.json')
  })
})
