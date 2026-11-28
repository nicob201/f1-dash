// Uso: npm run circuits              carga los circuitos en la D1 local y rearma los snapshots
//      npm run circuits -- --remote  en la D1 de Cloudflare
// Se corre una vez, o cuando se sume un circuito al cruce de src/sources/circuits.ts.
import { saveCircuits } from '../src/db/save'
import { CIRCUITS_URL, parseCircuits } from '../src/sources/circuits'
import { fetchJson } from '../src/sources/http'
import { buildSnapshots } from '../src/snapshots/refresh'
import { openDb } from './db'

const res = await fetchJson(CIRCUITS_URL)
if (res.kind !== 'ok') throw new Error(`${res.kind} en ${CIRCUITS_URL}`)
const rows = parseCircuits(res.body)

const remote = process.argv.includes('--remote')
const { db, dispose } = await openDb(remote)
try {
  await saveCircuits(db, rows)
  console.log(`Circuitos en la base ${remote ? 'remota' : 'local'}: ${rows.length}`)
  console.log(`Snapshots de la web: ${await buildSnapshots(db)}`)
} finally {
  await dispose()
}
