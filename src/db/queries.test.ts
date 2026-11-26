import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { season2026 } from '../notices/__fixtures__/season'
import { raceResultMessage } from '../notices/messages'
import { commandReply, parseCommand, type Command } from '../notices/commands'
import type { Db } from './save'
import { loadForCommand, loadSeason } from './queries'
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

describe('loadForCommand', () => {
  const NOW = new Date('2026-11-26T20:00:00Z')
  const LINKS = { channel: null, webUrl: null }
  const reply = async (command: Command, now = NOW) =>
    commandReply(command, await loadForCommand(db, command, now), now, LINKS)

  it('parseCommand', () => {
    expect(['/start', '/Proxima@F1DashArBot ya', ' /ULTIMA ', '/campeonato', '/stop', 'proxima', ''].map(parseCommand)).toEqual([
      '/start', '/proxima', '/ultima', '/campeonato', 'help', 'help', 'help',
    ])
  })
  it.each(['/proxima', '/ultima', '/campeonato'] as const)('%s responde igual que con la temporada entera', async (c) => {
    await save(2025)
    await save(2026)
    expect(await reply(c)).toBe(commandReply(c, await loadSeason(db, 2026), NOW, LINKS))
  })
  it('lee solo lo que usa', async () => {
    await save(2026)
    const sizes = async (c: Command) => {
      const d = await loadForCommand(db, c, NOW)
      return { sessions: d.sessions.length, results: d.results.length, standings: d.standings.length, drivers: d.drivers.length }
    }
    expect(await sizes('/proxima')).toEqual({ sessions: 5, results: 0, standings: 0, drivers: 0 })
    expect(await sizes('/ultima')).toEqual({ sessions: 0, results: 22, standings: 0, drivers: 22 })
    expect(await sizes('/campeonato')).toEqual({ sessions: 0, results: 0, standings: 36, drivers: 22 })
  })
  it('/start y la ayuda no tocan la base', async () => {
    const broken = {} as Db
    for (const c of ['/start', 'help'] as const) await expect(loadForCommand(broken, c, NOW)).resolves.toBeDefined()
  })
  it('/campeonato se queda en la última ronda con las dos tablas', async () => {
    await save(2026)
    const only = season2026().standings.filter((s) => s.kind === 'drivers').map((s) => ({ ...s, round: 22 }))
    await saveStandings(db, only)
    expect(new Set((await loadForCommand(db, '/campeonato', NOW)).standings.map((s) => s.round))).toEqual(new Set([21]))
    expect(await reply('/campeonato')).toContain('ANT')
  })
  it('entre temporadas: la próxima es la nueva; lo corrido, la anterior', async () => {
    await save(2026)
    const d = season2026()
    await saveCalendar(db, [{ ...d.races[0]!, season: 2027 }], [
      { season: 2027, round: 1, kind: 'race', startsAt: new Date('2027-03-07T04:00:00Z'), openf1Key: null },
    ])
    const december = new Date('2026-12-10T12:00:00Z')
    expect(await reply('/proxima', december)).toContain('(ronda 1 de 1)')
    expect(await reply('/ultima', december)).toContain('GP de Las Vegas')
    expect(await reply('/campeonato', december)).toContain('ANT')
  })
  it('base vacía', async () => {
    expect(await reply('/ultima')).toBe('Todavía no se corrió ninguna carrera.')
    expect(await reply('/campeonato')).toBe('Todavía no se corrió ninguna carrera.')
    expect(await reply('/proxima')).toBe('La temporada terminó. ¡Nos vemos el año que viene! 👋')
  })
})
