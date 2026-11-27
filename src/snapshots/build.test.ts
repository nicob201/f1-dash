import { season2026 } from '../notices/__fixtures__/season'
import type { SeasonData } from '../notices/data'
import pits17 from '../sources/__fixtures__/pitstops-2026-17.json'
import { parsePitStops } from '../sources/jolpica'
import { homeSnapshot, placesGained, raceSnapshot } from './build'

const d = season2026()
const NONE = { season: 2027, races: [], sessions: [] }
const home = (data: SeasonData = d, upcoming: Parameters<typeof homeSnapshot>[1] = NONE) => homeSnapshot(data, upcoming)
const codes = (lines: { code: string }[]) => lines.map((l) => l.code)
/** Las filas de Las Vegas de un tipo, pasadas a la ronda 22. */
const asRound22 = (kind: 'quali' | 'race') =>
  d.results.filter((r) => r.kind === kind).map((r) => ({ ...r, round: 22 }))

describe('homeSnapshot', () => {
  it('lista la temporada en orden, con horarios en UTC y ganadores', () => {
    const h = home()
    expect(h.season).toBe(2026)
    expect(h.races.map((r) => r.round)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1))
    expect(h.races.every((r) => r.rounds === 23)).toBe(true)
    const qatar = h.races[21]!
    expect(qatar).toMatchObject({ gp: 'GP de Qatar', circuit: 'Circuito Internacional de Lusail', winner: null })
    expect(qatar.sessions.find((s) => s.kind === 'race')!.startsAt).toBe('2026-11-29T16:00:00.000Z')
    expect(qatar.sessions.map((s) => s.startsAt)).toEqual(qatar.sessions.map((s) => s.startsAt).toSorted())
    expect(h.races[20]!.winner!.code).toBe('VER')
  })
  it('trae la última carrera y las puntas de los campeonatos', () => {
    const h = home()
    expect(h.last).toMatchObject({ round: 21, gp: 'GP de Las Vegas', fastest: { code: 'LAW', lap: '1:35.591' } })
    expect(codes(h.last!.top)).toEqual(['VER', 'NOR', 'PIA', 'ANT', 'GAS'])
    expect(h.last!.top[0]).toMatchObject({ time: '1:27:39.624', team: 'Red Bull', color: '#4781D7' })
    expect(h.drivers.map((x) => [x.code, x.points])).toEqual([['ANT', 402], ['VER', 304], ['HAM', 267], ['RUS', 264]])
    expect(h.constructors.map((x) => [x.team, x.points])).toEqual([['Mercedes', 666], ['Ferrari', 517], ['Red Bull', 440]])
  })
  it('sin carreras corridas no hay última ni tablas', () => {
    const h = home({ ...d, results: [], standings: [] })
    expect([h.last, h.drivers, h.constructors, h.standingsRound]).toEqual([null, [], [], null])
  })
  it('incluye las carreras de la temporada siguiente', () => {
    const race = { ...d.races[0]!, season: 2027 }
    const session = { ...d.sessions.find((s) => s.round === 1 && s.kind === 'race')!, season: 2027 }
    const h = home(d, { season: 2027, races: [race], sessions: [session] })
    expect(h.upcoming.season).toBe(2027)
    expect(h.upcoming.races).toMatchObject([{ season: 2027, round: 1, rounds: 1 }])
  })
  it('con solo la clasificación de la ronda 22, la última sigue siendo la 21', () => {
    const h = home({ ...d, results: [...d.results, ...asRound22('quali')] })
    expect(h.races[21]!.winner).toBeNull()
    expect(h.last!.round).toBe(21)
  })
  it('con una sola tabla de la ronda 22, el campeonato sigue en la 21', () => {
    const extra = d.standings.filter((s) => s.kind === 'drivers').map((s) => ({ ...s, round: 22, points: s.points + 25 }))
    const h = home({ ...d, standings: [...d.standings, ...extra] })
    expect([h.drivers[0]!.points, h.standingsRound]).toEqual([402, 21])
  })
})

describe('raceSnapshot', () => {
  const vegas = raceSnapshot(d, [], 21)
  const line = (code: string) => vegas.race.find((l) => l.code === code)!

  it('resultado con posiciones ganadas y vuelta rápida', () => {
    expect(vegas.race).toHaveLength(22)
    expect(['VER', 'NOR', 'PIA'].map((c) => line(c).gained)).toEqual([0, 1, 14])
    expect(line('ALB')).toMatchObject({ finish: 'NL', gained: null })
    expect(line('LIN').finish).toBe('NC')
    expect(line('ALO')).toMatchObject({ finish: '19', time: null })
    expect(codes(vegas.race.filter((l) => l.fastest))).toEqual(['LAW'])
    expect(vegas.fastest).toMatchObject({ code: 'LAW', lap: '1:35.591' })
  })
  it('quien no tiene tiempo lleva el motivo en castellano', () => {
    expect(['ALO', 'LIN', 'ALB'].map((c) => line(c).note)).toEqual(['Abandono', 'Abandono', 'No largó'])
    expect(line('VER').note).toBeNull()
  })
  it('clasificación, navegación y secciones vacías', () => {
    expect(vegas.quali).toHaveLength(22)
    expect(vegas.quali[0]).toMatchObject({ code: 'ANT', finish: '1', q3: '1:33.893' })
    expect(vegas).toMatchObject({ round: 21, rounds: 23, prev: 20, next: 22, sprint: [], pits: [] })
    expect(raceSnapshot(d, [], 1).prev).toBeNull()
    expect(raceSnapshot(d, [], 23).next).toBeNull()
  })
  it('la sprint no calcula posiciones ni marca vuelta rápida', () => {
    const sprint = d.results.filter((r) => r.kind === 'race').map((r) => ({ ...r, kind: 'sprint' as const }))
    const s = raceSnapshot({ ...d, results: [...d.results, ...sprint] }, [], 21)
    expect(s.sprint).toHaveLength(22)
    expect(s.sprint.every((l) => l.gained === null && !l.fastest)).toBe(true)
  })
  it('paradas de la ronda pedida, ordenadas por vuelta', () => {
    const pits = parsePitStops(pits17)
    const s = raceSnapshot(d, pits, 17)
    expect(s.pits).toHaveLength(25)
    expect(s.pits[0]).toMatchObject({ lap: 18, stop: 1, duration: '24.048' })
    expect(s.pits.map((p) => p.lap)).toEqual(s.pits.map((p) => p.lap).toSorted((a, b) => a - b))
    expect(raceSnapshot(d, pits, 21).pits).toEqual([])
  })
  it('con solo la clasificación cargada', () => {
    const s = raceSnapshot({ ...d, results: [...d.results, ...asRound22('quali')] }, [], 22)
    expect([s.quali.length, s.race, s.fastest]).toEqual([22, [], null])
  })
  it('un piloto y un equipo que no están en sus tablas salen con respaldo', () => {
    const stranger = { ...d.results.find((r) => r.kind === 'race')!, round: 22, driverId: 'nuevo', constructorId: 'otro' }
    const s = raceSnapshot({ ...d, results: [...d.results, stranger] }, [], 22)
    expect(s.race[0]).toMatchObject({ code: 'NUE', name: 'nuevo', team: 'otro', color: '#9C9CB0' })
  })
})

it('placesGained no se calcula desde boxes ni para no clasificados', () => {
  expect(placesGained(0, 5, '5')).toBeNull()
  expect(placesGained(null, 5, '5')).toBeNull()
  expect(placesGained(3, 20, 'R')).toBeNull()
  expect(placesGained(2, 9, '9')).toBe(-7)
})
