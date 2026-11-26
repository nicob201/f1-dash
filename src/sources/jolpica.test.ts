import calendar from './__fixtures__/calendar-2026.json'
import constructors21 from './__fixtures__/constructorstandings-2026-21.json'
import drivers1 from './__fixtures__/driverstandings-2026-1.json'
import drivers21 from './__fixtures__/driverstandings-2026-21.json'
import pits17 from './__fixtures__/pitstops-2026-17.json'
import quali21 from './__fixtures__/qualifying-2026-21.json'
import results21 from './__fixtures__/results-2026-21.json'
import sprint17 from './__fixtures__/sprint-2026-17.json'
import { mergeResults, parseCalendar, parsePitStops, parseQualifying, parseResults, parseStandings } from './jolpica'

describe('parseCalendar', () => {
  const { races, sessions } = parseCalendar(calendar)
  const of = (round: number) => sessions.filter((s) => s.round === round)

  it('23 carreras y 6 sprints', () => {
    expect(races).toHaveLength(23)
    expect(sessions.filter((s) => s.kind === 'sprint')).toHaveLength(6)
    expect(sessions.filter((s) => s.kind === 'sprint_quali')).toHaveLength(6)
  })
  it('Qatar, en UTC', () => {
    expect(races[21]).toMatchObject({ season: 2026, round: 22, name: 'Qatar Grand Prix', circuit: 'Lusail International Circuit' })
    expect(of(22).map((s) => s.kind).sort()).toEqual(['fp1', 'fp2', 'fp3', 'quali', 'race'])
    expect(of(22).find((s) => s.kind === 'quali')!.startsAt.toISOString()).toBe('2026-11-28T18:00:00.000Z')
    expect(of(22).find((s) => s.kind === 'race')!.startsAt.toISOString()).toBe('2026-11-29T16:00:00.000Z')
  })
  it('otra forma lanza', () => {
    expect(() => parseCalendar({ MRData: {} })).toThrow()
  })
})

describe('resultados', () => {
  const race = parseResults(results21, 'race')
  const by = (code: string) => {
    const d = race.drivers.find((d) => d.code === code)!
    return race.results.find((r) => r.driverId === d.driverId)!
  }

  it('Las Vegas', () => {
    expect(race.results).toHaveLength(22)
    expect(by('VER')).toMatchObject({ round: 21, kind: 'race', position: 1, grid: 1, points: 25, carNumber: 3, constructorId: 'red_bull' })
    expect(by('NOR')).toMatchObject({ position: 2, grid: 3, points: 18, time: '+0.639', fastestLapRank: 4, fastestLapTime: '1:36.182' })
  })
  it('abandono y no largó se distinguen', () => {
    expect(by('LIN').positionText).toBe('R')
    expect(by('ALB').positionText).toBe('W')
  })
  it('sprint lee SprintResults', () => {
    const s = parseResults(sprint17, 'sprint').results
    expect(s).toHaveLength(22)
    expect(s[0]).toMatchObject({ kind: 'sprint', position: 1, points: 8 })
  })
  it('quali: Q2 y Q3 faltan para los eliminados', () => {
    const q = parseQualifying(quali21).results
    expect(q[0]).toMatchObject({ kind: 'quali', position: 1, carNumber: 12 })
    expect(q[0]!.q3).not.toBeNull()
    expect(q[21]).toMatchObject({ position: 22, carNumber: 87, q1: '1:48.005', q2: null, q3: null })
  })
  it('sin resultados todavía', () => {
    expect(parseResults({ MRData: { RaceTable: { Races: [] } } }, 'race').results).toEqual([])
    expect(parseQualifying({ MRData: { RaceTable: { Races: [] } } }).results).toEqual([])
  })
  it('una carrera sin la lista de resultados lanza', () => {
    expect(() => parseResults(quali21, 'race')).toThrow()
  })
  it('junta una ronda partida entre dos páginas', () => {
    const page = (from: number, to: number) => ({ ...race, results: race.results.slice(from, to) })
    const m = mergeResults([page(0, 12), page(12, 22)])
    expect(m.results).toHaveLength(22)
    expect(m.drivers).toHaveLength(22)
    expect(m.constructors).toHaveLength(11)
  })
  it('al juntar, gana el equipo de la página posterior', () => {
    const ver = race.drivers.find((d) => d.code === 'VER')!
    const m = mergeResults([race, { drivers: [{ ...ver, constructorId: 'rb' }], constructors: [], results: [] }])
    expect(m.drivers.find((d) => d.code === 'VER')!.constructorId).toBe('rb')
  })
  it('cada equipo de 2026 tiene color propio', () => {
    expect(race.constructors).toHaveLength(11)
    for (const c of race.constructors) expect(c.color).not.toBe('#9C9CB0')
  })
})

describe('tablas y paradas', () => {
  it('pilotos', () => {
    const s = parseStandings(drivers21, 'drivers')
    expect(s).toHaveLength(25)
    expect(s[0]).toEqual({ season: 2026, round: 21, kind: 'drivers', entityId: 'antonelli', position: 1, points: 402, wins: 9 })
    expect(s[1]).toMatchObject({ entityId: 'max_verstappen', points: 304 })
  })
  it('un piloto sin puesto en la tabla queda con position null', () => {
    const s = parseStandings(drivers1, 'drivers')
    expect(s).toHaveLength(22)
    expect(s[21]).toEqual({ season: 2026, round: 1, kind: 'drivers', entityId: 'stroll', position: null, points: 0, wins: 0 })
  })
  it('constructores', () => {
    const s = parseStandings(constructors21, 'constructors')
    expect(s).toHaveLength(11)
    expect(s[0]).toMatchObject({ entityId: 'mercedes', points: 666, wins: 12 })
  })
  it('paradas', () => {
    const p = parsePitStops(pits17)
    expect(p).toHaveLength(25)
    expect(p[0]).toEqual({ season: 2026, round: 17, driverId: 'hamilton', stop: 1, lap: 18, duration: '24.048' })
  })
  it('todavía sin publicar', () => {
    expect(parseStandings({ MRData: { StandingsTable: { StandingsLists: [] } } }, 'drivers')).toEqual([])
    expect(parsePitStops({ MRData: { RaceTable: { Races: [] } } })).toEqual([])
  })
  it('la tabla equivocada lanza', () => {
    expect(() => parseStandings(drivers21, 'constructors')).toThrow()
  })
})
