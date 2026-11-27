// Uso: npm run snapshots              rearma los JSON de la web en la D1 local, sin descargar nada
//      npm run snapshots -- --remote  en la D1 de Cloudflare
import { buildSnapshots } from '../src/snapshots/refresh'
import { openDb } from './db'

const remote = process.argv.includes('--remote')
const { db, dispose } = await openDb(remote)
try {
  console.log(`Snapshots en la base ${remote ? 'remota' : 'local'}: ${await buildSnapshots(db)}`)
} finally {
  await dispose()
}
