import calendar from './__fixtures__/calendar-2026.json'
import of1Grid from './__fixtures__/of1-grid-11379.json'
import of1Result from './__fixtures__/of1-result-11379.json'
import of1Sessions from './__fixtures__/of1-sessions-2026.json'
import sprint17 from './__fixtures__/sprint-2026-17.json'
import { parseCalendar, parseResults } from './jolpica'
import { formatLap, matchSessionKeys, parseGrid, parseSessionResult, parseSessions, sprintQualiRows } from './openf1'

describe('cruce de sesiones', () => {
  const matched = matchSessionKeys(parseCalendar(calendar).sessions, parseSessions(of1Sessions))
  const key = (round: number, kind: string) => matched.find((s) => s.round === round && s.kind === kind)!.openf1Key

  it('las 115 sesiones consiguen key', () => {
    expect(matched).toHaveLength(115)
    expect(matched.filter((s) => s.openf1Key === null)).toEqual([])
    expect(key(22, 'quali')).toBe(11424)
    expect(key(17, 'sprint_quali')).toBe(11379)
  })
  it('Miami: 3 h de diferencia y cruza igual', () => {
    expect(key(4, 'race')).not.toBeNull()
  })
  it('una cancelada o lejana no cruza', () => {
    const s = [{ season: 2026, round: 1, kind: 'race' as const, startsAt: new Date('2026-01-01T12:00:00Z'), openf1Key: null }]
    const of1 = [
      { key: 1, name: 'Race', startsAt: new Date('2026-01-01T12:00:00Z'), cancelled: true },
      { key: 2, name: 'Race', startsAt: new Date('2026-01-02T12:00:00Z'), cancelled: false },
    ]
    expect(matchSessionKeys(s, of1)[0]!.openf1Key).toBeNull()
  })
  it('entre dos candidatas gana la más cercana', () => {
    const s = [{ season: 2026, round: 1, kind: 'race' as const, startsAt: new Date('2026-01-01T12:00:00Z'), openf1Key: null }]
    const of1 = [
      { key: 1, name: 'Race', startsAt: new Date('2026-01-01T20:00:00Z'), cancelled: false },
      { key: 2, name: 'Race', startsAt: new Date('2026-01-01T11:00:00Z'), cancelled: false },
    ]
    expect(matchSessionKeys(s, of1)[0]!.openf1Key).toBe(2)
  })
})

describe('datos de OpenF1', () => {
  it('grilla de la sprint', () => {
    const g = parseGrid(of1Grid)
    expect(g).toHaveLength(22)
    expect(g[0]).toEqual({ carNumber: 3, position: 1 })
  })
  it('formatLap', () => {
    expect(formatLap(93.477)).toBe('1:33.477')
    expect(formatLap(60.005)).toBe('1:00.005')
    expect(formatLap(119.9996)).toBe('2:00.000')
    expect(formatLap(null)).toBeNull()
  })
  it('clasificación sprint cruzada por número', () => {
    const drivers = parseResults(sprint17, 'sprint').drivers
    const rows = sprintQualiRows(parseSessionResult(of1Result), 2026, 17, drivers)
    expect(rows).toHaveLength(22)
    expect(rows[0]).toMatchObject({ kind: 'sprint_quali', driverId: 'max_verstappen', position: 1, q1: '1:33.477', q3: '1:31.156', points: null })
  })
  it('número desconocido lanza', () => {
    expect(() => sprintQualiRows(parseSessionResult(of1Result), 2026, 17, [])).toThrow()
  })
})
