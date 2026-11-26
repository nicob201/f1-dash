import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { season2026 } from '../notices/__fixtures__/season'
import { raceResultMessage } from '../notices/messages'
import { loadSeason } from './queries'
import { saveCalendar, saveGrid, saveResults, saveStandings } from './save'

const db = drizzle(env.DB)
beforeEach(async () => {
  const tables = ['races', 'sessions', 'drivers', 'constructors', 'results', 'standings', 'pit_stops', 'grids']
  await env.DB.batch(tables.map((t) => env.DB.prepare(`delete from ${t}`)))
})

async function save(season: number) {
  const d = season2026()
  const as = <T extends { season: number }>(rows: T[]) => rows.map((r) => ({ ...r, season }))
  await saveCalendar(db, as(d.races), as(d.sessions))
  await saveResults(db, { drivers: as(d.drivers), constructors: as(d.constructors), results: as(d.results) })
  await saveStandings(db, as(d.standings))
  await saveGrid(db, [{ season, round: 21, kind: 'race', carNumber: 3, position: 1, source: 'openf1' }])
}

it('trae solo la temporada pedida', async () => {
  await save(2025)
  await save(2026)
  const d = await loadSeason(db, 2026)
  expect([d.season, d.races.length, d.sessions.length, d.drivers.length, d.constructors.length]).toEqual([2026, 23, 115, 22, 11])
  expect([d.results.length, d.standings.length, d.grids.length]).toEqual([44, 36, 1])
  const all = [...d.races, ...d.sessions, ...d.drivers, ...d.constructors, ...d.results, ...d.standings, ...d.grids]
  expect(all.every((r) => r.season === 2026)).toBe(true)
})
it('lo leído arma el mismo mensaje que los datos originales', async () => {
  await save(2026)
  const d = await loadSeason(db, 2026)
  expect(d.sessions[0]!.startsAt).toBeInstanceOf(Date)
  expect(raceResultMessage(d, 21, null)).toBe(raceResultMessage({ ...season2026(), grids: d.grids }, 21, null))
})
it('una temporada sin datos viene vacía', async () => {
  const d = await loadSeason(db, 2030)
  expect([d.races, d.sessions, d.results, d.standings]).toEqual([[], [], [], []])
})
