export type FetchResult = { kind: 'ok'; body: unknown } | { kind: 'missing' } | { kind: 'rate_limited' }

// El Cloudflare de Jolpica responde 403 al User-Agent por defecto de Node.
export const USER_AGENT = 'generic-client/1.0'
const TIMEOUT_MS = 20_000

export async function fetchJson(url: string, fetcher: typeof fetch = fetch): Promise<FetchResult> {
  const res = await fetcher(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) {
    await res.body?.cancel() // en Workers, un cuerpo sin leer retiene la conexión
    if (res.status === 404) return { kind: 'missing' }
    if (res.status === 429) return { kind: 'rate_limited' }
    throw new Error(`HTTP ${res.status} en ${url}`)
  }
  try {
    return { kind: 'ok', body: await res.json() }
  } catch (cause) {
    throw new Error(`Respuesta ilegible en ${url}`, { cause })
  }
}

/** Todas las páginas de una respuesta de Jolpica. */
export async function fetchAllPages(url: string, pause: () => Promise<void>, fetcher: typeof fetch = fetch): Promise<unknown[]> {
  const pages: unknown[] = []
  for (let offset = 0, total = 1, size = 0; offset < total; offset += size) {
    if (offset > 0) await pause()
    const page = new URL(url)
    page.searchParams.set('limit', '100')
    page.searchParams.set('offset', String(offset))
    const res = await fetchJson(page.href, fetcher)
    if (res.kind !== 'ok') throw new Error(`${res.kind} en ${page.href}`)
    const meta = (res.body as { MRData: { total: string; limit: string } }).MRData
    total = Number(meta.total)
    size = Number(meta.limit) // el que aplicó la fuente, que puede ser menor al pedido
    // Sin esos dos datos no se sabe qué páginas faltan: mejor cortar que guardar de menos.
    if (!Number.isInteger(total) || !Number.isInteger(size) || size < 1) throw new Error(`paginación inválida en ${page.href}`)
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
      await res.body?.cancel()
      await wait()
    }
  }
}
