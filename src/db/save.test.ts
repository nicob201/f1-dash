import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import calendar from '../sources/__fixtures__/calendar-2026.json'
import drivers1 from '../sources/__fixtures__/driverstandings-2026-1.json'
import drivers21 from '../sources/__fixtures__/driverstandings-2026-21.json'
import of1Grid from '../sources/__fixtures__/of1-grid-11379.json'
import of1Sessions from '../sources/__fixtures__/of1-sessions-2026.json'
import pits17 from '../sources/__fixtures__/pitstops-2026-17.json'
import quali21 from '../sources/__fixtures__/qualifying-2026-21.json'
import results21 from '../sources/__fixtures__/results-2026-21.json'
import { parseCalendar, parsePitStops, parseQualifying, parseResults, parseStandings } from '../sources/jolpica'
import { matchSessionKeys, parseGrid, parseSessions } from '../sources/openf1'
import { saveCalendar, saveGrid, savePitStops, saveResults, saveStandings } from './save'

const db = drizzle(env.DB)
const TABLES = ['races', 'sessions', 'drivers', 'constructors', 'results', 'standings', 'pit_stops', 'grids']
beforeEach(async () => {
  await env.DB.batch(TABLES.map((t) => env.DB.prepare(`delete from ${t}`)))
})
const count = async (table: string, where = '1') =>
  (await env.DB.prepare(`select count(*) as n from ${table} where ${where}`).first<{ n: number }>())!.n
const NOTHING = { drivers: [], constructors: [], results: [] }

it('guardar dos veces no duplica', async () => {
  await saveResults(db, parseResults(results21, 'race'))
  await saveResults(db, parseResults(results21, 'race'))
  expect([await count('results'), await count('drivers'), await count('constructors')]).toEqual([22, 22, 11])
})
it('una corrección reemplaza la ronda', async () => {
  const p = parseResults(results21, 'race')
  await saveResults(db, p)
  await saveResults(db, { ...p, results: p.results.slice(1) })
  expect(await count('results')).toBe(21)
})
it('vacío no borra', async () => {
  await saveResults(db, parseResults(results21, 'race'))
  await saveStandings(db, parseStandings(drivers21, 'drivers'))
  await saveResults(db, NOTHING)
  await saveStandings(db, [])
  await savePitStops(db, [])
  await saveGrid(db, [])
  await saveCalendar(db, [], [])
  expect([await count('results'), await count('standings')]).toEqual([22, 25])
})
it('reemplazar la carrera no toca la quali ni otra temporada', async () => {
  const race = parseResults(results21, 'race')
  await saveResults(db, parseQualifying(quali21))
  await saveResults(db, { ...NOTHING, results: race.results.map((r) => ({ ...r, season: 2025 })) })
  await saveResults(db, race)
  expect(await count('results')).toBe(66)
})
it('si una fila es inválida no se guarda ni se borra nada', async () => {
  const p = parseResults(results21, 'race')
  await saveResults(db, p)
  await expect(saveResults(db, { ...NOTHING, results: [...p.results, p.results[0]!] })).rejects.toThrow()
  expect(await count('results')).toBe(22)
})
it('gana el último valor del piloto', async () => {
  const p = parseResults(results21, 'race')
  await saveResults(db, p)
  await saveResults(db, { ...NOTHING, drivers: [{ ...p.drivers[0]!, constructorId: 'rb' }] })
  expect(await count('drivers', `driver_id = '${p.drivers[0]!.driverId}' and constructor_id = 'rb'`)).toBe(1)
})
it('el calendario sin keys no borra los keys', async () => {
  const cal = parseCalendar(calendar)
  await saveCalendar(db, cal.races, matchSessionKeys(cal.sessions, parseSessions(of1Sessions)))
  await saveCalendar(db, cal.races, cal.sessions)
  expect([await count('races'), await count('sessions'), await count('sessions', 'openf1_key is null')]).toEqual([23, 115, 0])
})
it('el calendario actualiza un horario cambiado y guarda UTC en milisegundos', async () => {
  const cal = parseCalendar(calendar)
  await saveCalendar(db, cal.races, cal.sessions)
  const moved = new Date('2026-11-29T17:00:00Z')
  await saveCalendar(db, cal.races, cal.sessions.map((s) => (s.round === 22 && s.kind === 'race' ? { ...s, startsAt: moved } : s)))
  expect(await count('sessions', `round = 22 and kind = 'race' and starts_at = ${moved.getTime()}`)).toBe(1)
})
it('guarda una tabla con un piloto sin puesto', async () => {
  await saveStandings(db, parseStandings(drivers1, 'drivers'))
  expect([await count('standings'), await count('standings', 'position is null')]).toEqual([22, 1])
})
it('tablas, paradas y grilla', async () => {
  const grid = parseGrid(of1Grid).map((g) => ({ ...g, season: 2026, round: 17, kind: 'sprint' as const, source: 'openf1' as const }))
  for (let i = 0; i < 2; i++) {
    await saveStandings(db, parseStandings(drivers21, 'drivers'))
    await savePitStops(db, parsePitStops(pits17))
    await saveGrid(db, grid)
  }
  expect([await count('standings'), await count('pit_stops'), await count('grids')]).toEqual([25, 25, 22])
})
