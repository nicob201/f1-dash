import calendar from '../sources/__fixtures__/calendar-2026.json'
import { parseCalendar } from '../sources/jolpica'
import { arDate, arDay, arTime, escapeHtml, gpName, previewAt, sessionLabel, statusLabel, teamName } from './es'

const { races } = parseCalendar(calendar)

it('GP y lugar', () => {
  expect(gpName('Qatar Grand Prix')).toMatchObject({ gp: 'GP de Qatar', place: 'en Qatar' })
  expect(gpName('Dutch Grand Prix').place).toBe('en los Países Bajos')
  expect(gpName('Mexico City Grand Prix').gp).toBe('GP de la Ciudad de México')
  expect(gpName('Bahrain Grand Prix in Malaysia')).toMatchObject({ gp: 'GP de Baréin en Malasia', place: 'en Malasia' })
  expect(gpName('Qatar Grand Prix').circuit('Lusail International Circuit')).toBe('Circuito Internacional de Lusail')
})
it('las 23 carreras de 2026 están traducidas, con su circuito', () => {
  for (const r of races) {
    expect(gpName(r.name).gp).toMatch(/^GP de /)
    expect(gpName(r.name).circuit(r.circuit)).not.toMatch(/\b(Circuit$|International|Street|Grand Prix)/)
  }
})
it('un GP desconocido sale como viene', () => {
  expect(gpName('Moon Grand Prix')).toMatchObject({ gp: 'Moon Grand Prix', place: 'en Moon Grand Prix' })
  expect(gpName('Moon Grand Prix').circuit('Crater Ring')).toBe('Crater Ring')
})
it('equipos acortados', () => {
  expect(['Alpine F1 Team', 'RB F1 Team', 'Haas F1 Team', 'Cadillac F1 Team', 'Ferrari'].map(teamName)).toEqual([
    'Alpine', 'Racing Bulls', 'Haas', 'Cadillac', 'Ferrari',
  ])
})
it('nombres de sesión', () => {
  expect((['fp1', 'quali', 'sprint_quali', 'sprint', 'race'] as const).map(sessionLabel)).toEqual([
    'Práctica libre 1', 'Clasificación', 'Clasif. sprint', 'Sprint', 'Carrera',
  ])
})
it('hora argentina, cruzando el día', () => {
  const d = new Date('2026-11-20T00:30:00Z')
  expect([arDay(d), arTime(d)]).toEqual(['Jue 19', '21:30'])
  expect(arTime(new Date('2026-11-20T03:00:00Z'))).toBe('00:00')
})
it('previa: 10:00 del día argentino anterior a FP1', () => {
  expect(previewAt(new Date('2026-11-27T13:30:00Z')).toISOString()).toBe('2026-11-26T13:00:00.000Z')
  expect(previewAt(new Date('2026-11-20T00:30:00Z')).toISOString()).toBe('2026-11-18T13:00:00.000Z')
  expect(previewAt(new Date('2026-12-01T12:00:00Z')).toISOString()).toBe('2026-11-30T13:00:00.000Z')
})
it('escapa HTML', () => {
  expect(escapeHtml('a<b>&c')).toBe('a&lt;b&gt;&amp;c')
})

it('arDate: día y mes en hora argentina', () => {
  expect(arDate(new Date('2026-11-29T16:00:00Z'))).toBe('29 nov')
  expect(arDate(new Date('2026-12-01T01:00:00Z'))).toBe('30 nov')
})

it('statusLabel: los estados de Jolpica que dejan sin tiempo; los demás, nada', () => {
  expect(['Retired', 'Did not start', 'Disqualified', 'Lapped'].map(statusLabel)).toEqual([
    'Abandono', 'No largó', 'Descalificado', 'Doblado',
  ])
  expect(['Finished', 'Something new', 'constructor', null].map(statusLabel)).toEqual([null, null, null, null])
})
