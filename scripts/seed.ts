// Uso: npm run seed            carga la temporada en la D1 local
//      npm run seed -- --remote  en la D1 de Cloudflare
// Se puede volver a correr. Son unos 80 pedidos a Jolpica; si responde 429, espera y sigue.
import { setTimeout as sleep } from 'node:timers/promises'
import { saveCalendar, savePitStops, saveResults, saveStandings } from '../src/db/save'
import { fetchAllPages, fetchJson, retrying429 } from '../src/sources/http'
import { mergeResults, parseCalendar, parsePitStops, parseQualifying, parseResults, parseStandings } from '../src/sources/jolpica'
import { matchSessionKeys, parseSessionResult, parseSessions, sprintQualiRows } from '../src/sources/openf1'
import { buildSnapshots } from '../src/snapshots/refresh'
import type { ParsedResults } from '../src/types'
import { openDb } from './db'

const SEASON = 2026
const JOLPICA = `https://api.jolpi.ca/ergast/f1/${SEASON}`
const OPENF1 = 'https://api.openf1.org/v1'
const jolpicaPause = () => sleep(2000)
// Jolpica corta antes de lo documentado: esperar un minuto y seguir, hasta 20 veces por pedido.
const patient = retrying429(fetch, async () => {
  console.log('  429: espero 60 s')
  await sleep(60_000)
}, 20)

async function pages(path: string): Promise<unknown[]> {
  await jolpicaPause()
  return fetchAllPages(`${JOLPICA}${path}.json`, jolpicaPause, patient)
}

async function openf1(path: string): Promise<unknown> {
  await sleep(2100)
  const url = `${OPENF1}/${path}`
  const res = await fetchJson(url, patient)
  if (res.kind !== 'ok') throw new Error(`${res.kind} en ${url}`)
  return res.body
}

// Todas las páginas juntas antes de guardar: una ronda viene partida entre dos.
const season = async (path: string, parse: (body: unknown) => ParsedResults) => mergeResults((await pages(path)).map(parse))

const remote = process.argv.includes('--remote')
const { db, dispose } = await openDb(remote)

try {
  console.log(`Cargando ${SEASON} en la base ${remote ? 'remota' : 'local'}`)

  const [calendarBody] = await pages('')
  const calendar = parseCalendar(calendarBody)
  const sessions = matchSessionKeys(calendar.sessions, parseSessions(await openf1(`sessions?year=${SEASON}`)))
  await saveCalendar(db, calendar.races, sessions)
  console.log(`Calendario: ${calendar.races.length} carreras, ${sessions.length} sesiones`)

  const quali = await season('/qualifying', parseQualifying)
  const sprint = await season('/sprint', (b) => parseResults(b, 'sprint'))
  const race = await season('/results', (b) => parseResults(b, 'race'))
  await saveResults(db, quali)
  await saveResults(db, sprint)

  const roundsOf = (p: ParsedResults) => [...new Set(p.results.map((r) => r.round))]

  for (const round of roundsOf(sprint)) {
    const key = sessions.find((s) => s.round === round && s.kind === 'sprint_quali')?.openf1Key
    if (!key) throw new Error(`Sin session_key de la clasificación sprint, ronda ${round}`)
    // Número y equipo tal como corrieron esa sprint.
    const entrants = sprint.results
      .filter((r) => r.round === round)
      .map((r) => ({ ...sprint.drivers.find((d) => d.driverId === r.driverId)!, carNumber: r.carNumber, constructorId: r.constructorId }))
    const result = parseSessionResult(await openf1(`session_result?session_key=${key}`))
    await saveResults(db, { drivers: [], constructors: [], results: sprintQualiRows(result, SEASON, round, entrants) })
    console.log(`Clasificación sprint, ronda ${round}`)
  }

  // La carrera va al final: cada piloto queda con su equipo más reciente.
  await saveResults(db, race)
  console.log(`Resultados: ${race.results.length} de carrera, ${quali.results.length} de clasificación, ${sprint.results.length} de sprint`)

  for (const round of roundsOf(race)) {
    for (const kind of ['drivers', 'constructors'] as const) {
      const bodies = await pages(`/${round}/${kind === 'drivers' ? 'driver' : 'constructor'}standings`)
      const rows = bodies.flatMap((b) => parseStandings(b, kind))
      if (rows.length === 0) console.warn(`Aviso: la ronda ${round} no tiene tabla de ${kind}`)
      await saveStandings(db, rows)
    }
    await savePitStops(db, (await pages(`/${round}/pitstops`)).flatMap(parsePitStops))
    console.log(`Tablas y paradas, ronda ${round}`)
  }
  console.log(`Snapshots de la web: ${await buildSnapshots(db)}`)
  console.log('Listo')
} finally {
  await dispose()
}
