import calendar from '../sources/__fixtures__/calendar-2026.json'
import constructors20 from '../sources/__fixtures__/constructorstandings-2026-20.json'
import drivers20 from '../sources/__fixtures__/driverstandings-2026-20.json'
import { parseCalendar, parseStandings } from '../sources/jolpica'
import type { ResultRow, StandingRow } from '../types'
import type { SeasonData } from './data'
import { season2026 } from './__fixtures__/season'
import { decideNotices, readyResults } from './decide'

const { sessions } = parseCalendar(calendar)
type Input = Parameters<typeof decideNotices>[0]
const keys = (now: string, o: Partial<Input> = {}) =>
  decideNotices({
    sessions, ready: new Set(), sent: new Set(), now: new Date(now), notifyFrom: new Date('2026-11-26T00:00:00Z'), ...o,
  }).map((n) => n.key)

it('previa de Qatar: ventana de 30 minutos', () => {
  expect(keys('2026-11-26T12:59:59Z')).toEqual([])
  expect(keys('2026-11-26T13:00:00Z')).toEqual(['2026:22:preview'])
  expect(keys('2026-11-26T13:30:00Z')).toEqual(['2026:22:preview'])
  expect(keys('2026-11-26T13:30:01Z')).toEqual([])
})
it('previa de Las Vegas: FP1 cae el día anterior en Argentina', () => {
  const from = new Date('2026-11-01T00:00:00Z')
  expect(keys('2026-11-18T13:00:00Z', { notifyFrom: from })).toEqual(['2026:21:preview'])
  expect(keys('2026-11-19T13:00:00Z', { notifyFrom: from })).toEqual([])
})
it('largada: a la hora y hasta 30 minutos', () => {
  expect(keys('2026-11-29T15:59:59Z')).toEqual([])
  expect(keys('2026-11-29T16:00:00Z')).toEqual(['2026:22:race-start'])
  expect(keys('2026-11-29T16:30:00Z')).toEqual(['2026:22:race-start'])
  expect(keys('2026-11-29T16:31:00Z')).toEqual([])
})
it('si cambia el horario, el aviso usa el nuevo', () => {
  const moved = sessions.map((s) => (s.round === 22 && s.kind === 'race' ? { ...s, startsAt: new Date('2026-11-29T17:00:00Z') } : s))
  expect(keys('2026-11-29T16:00:00Z', { sessions: moved })).toEqual([])
  expect(keys('2026-11-29T17:00:00Z', { sessions: moved })).toEqual(['2026:22:race-start'])
})
it('lo ya enviado no se repite', () => {
  expect(keys('2026-11-29T16:00:00Z', { sent: new Set(['2026:22:race-start']) })).toEqual([])
})
it('el resultado no vence', () => {
  expect(keys('2026-12-01T00:00:00Z', { ready: new Set(['2026:22:race']) })).toEqual(['2026:22:race-result'])
})
it('primer arranque con la temporada cargada: nada anterior a notifyFrom', () => {
  const all = new Set(sessions.map((s) => `2026:${s.round}:${s.kind}`))
  expect(keys('2026-11-26T20:00:00Z', { ready: all })).toEqual([])
})
it('un resultado de una sesión que no empezó no sale', () => {
  expect(keys('2026-11-27T00:00:00Z', { ready: new Set(['2026:22:race']) })).toEqual([])
})
it('fin de semana con sprint: en el orden de las sesiones', () => {
  const ready = new Set(['2026:17:quali', '2026:17:sprint', '2026:17:sprint_quali'])
  expect(keys('2026-10-10T15:00:00Z', { ready, notifyFrom: new Date('2026-10-09T00:00:00Z') })).toEqual([
    '2026:17:sprint-quali', '2026:17:sprint-result', '2026:17:quali',
  ])
  expect(keys('2026-10-10T09:00:00Z', { notifyFrom: new Date('2026-10-09T00:00:00Z') })).toEqual(['2026:17:sprint-start'])
})
it('cada aviso dice su tipo y su ronda', () => {
  const [n] = decideNotices({ sessions, ready: new Set(), sent: new Set(), now: new Date('2026-11-29T16:00:00Z'), notifyFrom: new Date(0) })
  expect(n).toEqual({ key: '2026:22:race-start', type: 'race-start', season: 2026, round: 22 })
})
describe('qué resultado está listo', () => {
  // Las Vegas con las tablas reales de la ronda anterior (sin sprint en la 21).
  const d = season2026()
  const previous = [...parseStandings(drivers20, 'drivers'), ...parseStandings(constructors20, 'constructors')]
  const full: SeasonData = { ...d, standings: [...d.standings, ...previous] }
  const raceReady = (data: SeasonData, round = 21) => readyResults(data).has(`2026:${round}:race`)

  it('carrera con las dos tablas al día, y clasificación', () => {
    expect(raceReady(full)).toBe(true)
    expect(readyResults(full).has('2026:21:quali')).toBe(true)
    expect(readyResults(full).has('2026:22:quali')).toBe(false)
  })
  it.each(['drivers', 'constructors'] as const)('sin la tabla de %s de la ronda no sale', (kind) => {
    expect(raceReady({ ...full, standings: full.standings.filter((s) => !(s.round === 21 && s.kind === kind)) })).toBe(false)
  })
  it.each(['drivers', 'constructors'] as const)('con la tabla de %s todavía sin la carrera no sale', (kind) => {
    const stale = previous.filter((s) => s.kind === kind).map((s) => ({ ...s, round: 21 }))
    const standings = [...full.standings.filter((s) => !(s.round === 21 && s.kind === kind)), ...stale]
    expect(raceReady({ ...full, standings })).toBe(false)
  })
  it('sin la tabla anterior no se puede comprobar: no sale', () => {
    expect(raceReady(d)).toBe(false)
  })

  // Datos mínimos: un piloto y su equipo.
  const result = (round: number, kind: 'race' | 'sprint', points: number): ResultRow => ({
    season: 2026, round, kind, driverId: 'a', constructorId: 'x', carNumber: 1, position: 1, positionText: '1', grid: 1,
    points, status: 'Finished', time: null, q1: null, q2: null, q3: null, fastestLapRank: null, fastestLapTime: null,
  })
  const tables = (round: number, points: number): StandingRow[] =>
    (['drivers', 'constructors'] as const).map((kind) => (
      { season: 2026, round, kind, entityId: kind === 'drivers' ? 'a' : 'x', position: 1, points, wins: 0 }
    ))
  const small = (results: ResultRow[], standings: StandingRow[]) => ({ ...d, results, standings })

  it('en la ronda 1 las tablas son los puntos de la fecha', () => {
    expect(raceReady(small([result(1, 'race', 25)], tables(1, 25)), 1)).toBe(true)
    expect(raceReady(small([result(1, 'race', 25)], tables(1, 8)), 1)).toBe(false)
  })
  it('con sprint, una tabla que solo suma la sprint no alcanza', () => {
    const results = [result(2, 'sprint', 8), result(2, 'race', 25)]
    expect(raceReady(small(results, [...tables(1, 25), ...tables(2, 33)]), 2)).toBe(false)
    expect(raceReady(small(results, [...tables(1, 25), ...tables(2, 58)]), 2)).toBe(true)
  })
  it('si falta guardar la sprint, tampoco cierra', () => {
    expect(raceReady(small([result(2, 'race', 25)], [...tables(1, 25), ...tables(2, 58)]), 2)).toBe(false)
  })
})
