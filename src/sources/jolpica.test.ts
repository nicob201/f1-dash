import calendar from './__fixtures__/calendar-2026.json'
import { parseCalendar } from './jolpica'

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
