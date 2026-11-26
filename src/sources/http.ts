export type FetchResult = { kind: 'ok'; body: unknown } | { kind: 'missing' } | { kind: 'rate_limited' }

// El Cloudflare de Jolpica responde 403 al User-Agent por defecto de Node.
export const USER_AGENT = 'generic-client/1.0'
const TIMEOUT_MS = 20_000

export async function fetchJson(url: string, fetcher: typeof fetch = fetch): Promise<FetchResult> {
  const res = await fetcher(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (res.status === 404) return { kind: 'missing' }
  if (res.status === 429) return { kind: 'rate_limited' }
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
  return { kind: 'ok', body: await res.json() }
}

/** Todas las páginas de una respuesta de Jolpica. */
export async function fetchAllPages(url: string, pause: () => Promise<void>, fetcher: typeof fetch = fetch): Promise<unknown[]> {
  const pages: unknown[] = []
  for (let offset = 0, total = 1; offset < total; offset += 100) {
    if (offset > 0) await pause()
    const page = new URL(url)
    page.searchParams.set('limit', '100')
    page.searchParams.set('offset', String(offset))
    const res = await fetchJson(page.href, fetcher)
    if (res.kind !== 'ok') throw new Error(`${res.kind} en ${page.href}`)
    total = Number((res.body as { MRData: { total: string } }).MRData.total)
    // Sin un total válido no se sabe cuántas páginas faltan: mejor cortar que guardar de menos.
    if (!Number.isInteger(total)) throw new Error(`total inválido en ${page.href}`)
    pages.push(res.body)
  }
  return pages
}

/** Para scripts: ante un 429 espera y repite. El reloj no la usa; reintenta en su próxima corrida. */
export function retrying429(fetcher: typeof fetch, wait: () => Promise<void>, retries: number): typeof fetch {
  return async (url, init) => {
    for (let attempt = 0; ; attempt++) {
      // El timeout del primer intento ya habría vencido después de esperar.
      const res = await fetcher(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (res.status !== 429 || attempt >= retries) return res
      await wait()
    }
  }
}
