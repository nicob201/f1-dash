import { contenders, decidedAt, maxPoints, remainingAfter } from './champion'
import type { SessionKind, SessionRow, StandingRow } from './types'

const row = (round: number, entityId: string, points: number, position: number | null): StandingRow =>
  ({ season: 2026, round, kind: 'drivers', entityId, points, position, wins: 0 })
// calendario: rondas 1 a 3; la 3 tiene sprint
const s = (round: number, kind: SessionKind): SessionRow =>
  ({ season: 2026, round, kind, startsAt: new Date(0), openf1Key: null })
const cal = [s(1, 'quali'), s(1, 'race'), s(2, 'race'), s(3, 'sprint'), s(3, 'race')]

it('lo que queda en juego', () => {
  expect(remainingAfter(cal, 1)).toEqual({ races: 2, sprints: 1 })
  expect(maxPoints({ races: 2, sprints: 1 }, 'drivers')).toBe(58)
  expect(maxPoints({ races: 2, sprints: 1 }, 'constructors')).toBe(101)
})
it('empatar alcanza para seguir en carrera', () => {
  const t = [row(2, 'a', 100, 1), row(2, 'b', 67, 2), row(2, 'c', 66, 3)]
  expect(contenders(t, { races: 1, sprints: 1 }).map((x) => x.entityId)).toEqual(['a', 'b'])
})
it('sin fechas por delante gana el P1 aunque haya empate', () => {
  const t = [row(3, 'a', 100, 1), row(3, 'b', 100, 2)]
  expect(contenders(t, { races: 0, sprints: 0 }).map((x) => x.entityId)).toEqual(['a'])
})
it('se anuncia solo en la fecha en que se define', () => {
  const st = [row(1, 'a', 25, 1), row(1, 'b', 18, 2), row(2, 'a', 100, 1), row(2, 'b', 36, 2), row(3, 'a', 125, 1), row(3, 'b', 54, 2)]
  expect([1, 2, 3].map((r) => decidedAt(st, cal, r, 'drivers'))).toEqual([null, 'a', null])
})
it('no mezcla pilotos con constructores', () => {
  const other: StandingRow = { ...row(2, 'equipo', 999, 1), kind: 'constructors' }
  const st = [row(1, 'a', 25, 1), row(1, 'b', 18, 2), row(2, 'a', 100, 1), row(2, 'b', 36, 2), other]
  expect(decidedAt(st, cal, 2, 'drivers')).toBe('a')
})
it('sin tabla no afirma nada', () => {
  expect(contenders([], { races: 1, sprints: 0 })).toEqual([])
  expect(contenders([], { races: 0, sprints: 0 })).toEqual([])
  expect(decidedAt([row(2, 'a', 100, 1)], cal, 2, 'drivers')).toBeNull()
})
