import { fetchAllPages, fetchJson, retrying429 } from './http'

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

describe('retrying429', () => {
  const sequence = (...statuses: number[]) => {
    const signals: unknown[] = []
    const fetcher: typeof fetch = async (_u, init) => {
      signals.push(init?.signal)
      return new Response('{}', { status: statuses[signals.length - 1] })
    }
    return { signals, fetcher }
  }

  it('espera y reintenta hasta que deja de haber 429, con un timeout nuevo cada vez', async () => {
    const { signals, fetcher } = sequence(429, 429, 200)
    let waits = 0
    const res = await fetchJson('https://x', retrying429(fetcher, async () => { waits++ }, 5))
    expect([res.kind, waits, signals.length]).toEqual(['ok', 2, 3])
    expect(new Set(signals).size).toBe(3)
  })
  it('se rinde después de los reintentos', async () => {
    const { signals, fetcher } = sequence(429, 429, 429)
    const res = await fetchJson('https://x', retrying429(fetcher, async () => {}, 2))
    expect([res.kind, signals.length]).toEqual(['rate_limited', 3])
  })
})
