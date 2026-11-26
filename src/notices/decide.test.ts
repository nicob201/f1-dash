import calendar from '../sources/__fixtures__/calendar-2026.json'
import { parseCalendar } from '../sources/jolpica'
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
it('la carrera necesita las dos tablas', () => {
  const d = season2026()
  expect(readyResults(d).has('2026:21:race')).toBe(true)
  for (const kind of ['drivers', 'constructors']) {
    expect(readyResults({ ...d, standings: d.standings.filter((s) => s.kind !== kind) }).has('2026:21:race')).toBe(false)
  }
  expect(readyResults(d).has('2026:21:quali')).toBe(true)
  expect(readyResults(d).has('2026:22:quali')).toBe(false)
})
