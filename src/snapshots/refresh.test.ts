import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { loadSeason } from '../db/queries'
import { saveCalendar, saveCircuits, savePitStops, saveResults, saveStandings } from '../db/save'
import { season2026 } from '../notices/__fixtures__/season'
import { homeSnapshot, raceSnapshot } from './build'
import { buildSnapshots } from './refresh'
import type { HomeSnapshot, RaceSnapshot } from './types'

const db = drizzle(env.DB)
beforeEach(async () => {
  const tables = ['races', 'sessions', 'drivers', 'constructors', 'results', 'standings', 'pit_stops', 'grids', 'kv', 'circuits']
  await env.DB.batch(tables.map((t) => env.DB.prepare(`delete from ${t}`)))
})

async function save2026() {
  const d = season2026()
  await saveCalendar(db, d.races, d.sessions)
  await saveResults(db, d)
  await saveStandings(db, d.standings)
}
async function saveCalendar2027() {
  const d = season2026()
  const as = <T extends { season: number }>(rows: T[]) => rows.map((r) => ({ ...r, season: 2027 }))
  await saveCalendar(db, as(d.races), as(d.sessions))
}
const read = async <T>(key: string) =>
  JSON.parse((await env.DB.prepare('select value from kv where key = ?').bind(key).first<string>('value'))!) as T
const count = async () => env.DB.prepare('select count(*) n from kv').first<number>('n')

it('cada carrera trae su circuito de la base', async () => {
  await save2026()
  await saveCircuits(db, [{ id: 'losail', length: 5380, altitude: 5, opened: 2004, firstGp: 2021, path: 'M2,98L98,98Z' }])
  await buildSnapshots(db)
  expect((await read<RaceSnapshot>('race:2026:22')).track).toMatchObject({ length: 5380, firstGp: 2021 })
  expect((await read<RaceSnapshot>('race:2026:21')).track).toBeNull()
})
it('guarda el inicio y una fila por carrera', async () => {
  await save2026()
  await savePitStops(db, [{ season: 2026, round: 21, driverId: 'max_verstappen', stop: 1, lap: 20, duration: '2.4' }])
  expect(await buildSnapshots(db)).toBe(24)
  expect(await count()).toBe(24)
  const season = await loadSeason(db, 2026)
  expect(await read('home')).toEqual(homeSnapshot(season, { season: 2027, races: [], sessions: [] }))
  expect((await read<RaceSnapshot>('race:2026:21')).pits).toMatchObject([{ code: 'VER', lap: 20 }])
  expect(await read('race:2026:1')).toEqual(raceSnapshot(season, [], 1))
  expect((await read<RaceSnapshot>('race:2026:23')).round).toBe(23)
})
it('se puede volver a correr y actualiza lo que cambió', async () => {
  await save2026()
  await buildSnapshots(db)
  await env.DB.prepare("update results set time = '1:00:00.000' where kind = 'race' and position = 1").run()
  await buildSnapshots(db)
  expect(await count()).toBe(24)
  expect((await read<RaceSnapshot>('race:2026:21')).race[0]!.time).toBe('1:00:00.000')
})
it('con el calendario siguiente sin resultados, muestra la temporada corrida', async () => {
  await save2026()
  await saveCalendar2027()
  await buildSnapshots(db)
  const home = await read<HomeSnapshot>('home')
  expect([home.season, home.upcoming.season, home.upcoming.races.length]).toEqual([2026, 2027, 23])
})
it('pasa a la temporada siguiente con su primera carrera corrida', async () => {
  await save2026()
  await saveCalendar2027()
  const d = season2026()
  const results = d.results.filter((r) => r.kind === 'race').map((r) => ({ ...r, season: 2027, round: 1 }))
  await saveResults(db, { drivers: [], constructors: [], results })
  await buildSnapshots(db)
  expect((await read<HomeSnapshot>('home')).season).toBe(2027)
})
it('sin carreras corridas usa el calendario más nuevo', async () => {
  await saveCalendar2027()
  await buildSnapshots(db)
  expect((await read<HomeSnapshot>('home')).season).toBe(2027)
})
it('rearma también las temporadas que ya tenían páginas', async () => {
  await save2026()
  await buildSnapshots(db)
  await env.DB.prepare("update kv set value = '{}' where key = 'race:2026:1'").run()
  await saveCalendar2027()
  const results = season2026().results.filter((r) => r.kind === 'race').map((r) => ({ ...r, season: 2027, round: 1 }))
  await saveResults(db, { drivers: [], constructors: [], results })
  expect(await buildSnapshots(db)).toBe(47)
  expect((await read<RaceSnapshot>('race:2026:1')).round).toBe(1)
  expect((await read<HomeSnapshot>('home')).season).toBe(2027)
})
it('borra la página de una carrera que salió del calendario', async () => {
  await save2026()
  await buildSnapshots(db)
  const d = season2026()
  await saveCalendar(db, d.races.filter((r) => r.round !== 23), d.sessions.filter((s) => s.round !== 23))
  expect(await buildSnapshots(db)).toBe(23)
  expect([await count(), await env.DB.prepare("select count(*) n from kv where key = 'race:2026:23'").first('n')]).toEqual([23, 0])
})
it('con la base vacía no escribe ni borra nada', async () => {
  await env.DB.prepare("insert into kv (key, value) values ('home', '{}')").run()
  expect(await buildSnapshots(db)).toBe(0)
  expect(await count()).toBe(1)
})
