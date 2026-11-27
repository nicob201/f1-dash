// La D1 para los scripts: la local de desarrollo o, con --remote, la de Cloudflare.
import { drizzle } from 'drizzle-orm/d1'
import { getPlatformProxy } from 'wrangler'

export async function openDb(remote: boolean) {
  const platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: remote ? 'wrangler.seed.jsonc' : 'wrangler.jsonc',
    remoteBindings: remote,
  })
  return { db: drizzle(platform.env.DB), dispose: () => platform.dispose() }
}
