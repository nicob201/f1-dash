import quali4 from '../sources/__fixtures__/qualifying-2026-4.json'
import sprint17 from '../sources/__fixtures__/sprint-2026-17.json'
import of1Result from '../sources/__fixtures__/of1-result-11379.json'
import { mergeResults, parseQualifying, parseResults } from '../sources/jolpica'
import { parseSessionResult, sprintQualiRows } from '../sources/openf1'
import type { GridRow, StandingRow } from '../types'
import { season2026 } from './__fixtures__/season'
import type { SeasonData } from './data'
import { previewMessage, qualiMessage, raceResultMessage, sprintResultMessage, startMessage } from './messages'

const d = season2026()
const pre = (m: string) => [...m.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].flatMap((x) => x[1]!.split('\n'))
const top = (data: SeasonData, n: number): SeasonData => ({
  ...data,
  results: data.results.filter((r) => r.position !== null && r.position <= n),
  standings: data.standings.filter((s) => s.position !== null && s.position <= n),
})
const grid = (carNumber: number, position: number): GridRow =>
  ({ season: 2026, round: 21, kind: 'race', carNumber, position, source: 'openf1' })

function withSprint17(): SeasonData {
  const sprint = parseResults(sprint17, 'sprint')
  const merged = mergeResults([sprint])
  const sq = sprintQualiRows(parseSessionResult(of1Result), 2026, 17, sprint.drivers)
  return { ...d, drivers: merged.drivers, constructors: merged.constructors, results: [...sprint.results, ...sq] }
}

const standing = (round: number, kind: StandingRow['kind'], entityId: string, points: number, position: number): StandingRow =>
  ({ season: 2026, round, kind, entityId, points, position, wins: 0 })

// El título de pilotos se define en la 21: después de la 20 (quedan 3 fechas) todavía eran dos.
const withTitleDecidedAt21 = (data: SeasonData): SeasonData => ({
  ...data,
  standings: [
    standing(20, 'drivers', 'antonelli', 390, 1), standing(20, 'drivers', 'max_verstappen', 340, 2),
    standing(21, 'drivers', 'antonelli', 402, 1), standing(21, 'drivers', 'max_verstappen', 304, 2),
    ...data.standings.filter((s) => s.kind === 'constructors'),
  ],
})

describe('previa', () => {
  it('Qatar', () => {
    expect(previewMessage(d, 22)).toBe(
      '🗓️ <b>Se viene el GP de Qatar</b> (ronda 22 de 23)\nCircuito Internacional de Lusail\n\n<pre>' +
        'Vie 27  Práctica libre 1  10:30\nVie 27  Práctica libre 2  14:00\nSáb 28  Práctica libre 3  11:30\n' +
        'Sáb 28  Clasificación     15:00\nDom 29  Carrera           13:00</pre>\nHorarios de Argentina.',
    )
  })
  it('un día de una sola cifra no desalinea', () => {
    expect(pre(previewMessage(d, 23))[0]).toBe('Vie 4   Práctica libre 1  06:30')
  })
  it('una ronda que no existe lanza', () => {
    expect(() => previewMessage(d, 99)).toThrow('99')
  })
})

describe('clasificación', () => {
  it('texto completo', () => {
    expect(qualiMessage(top(d, 3), 21, 'quali')).toBe(
      '⏱️ <b>GP de Las Vegas: clasificación</b>\n\n<pre> 1 ANT  Mercedes      1:33.893\n' +
        ' 2 VER  Red Bull      1:34.151\n 3 RUS  Mercedes      1:34.224</pre>',
    )
  })
  it('completa, con el tiempo de la última tanda que corrió cada uno', () => {
    const lines = pre(qualiMessage(d, 21, 'quali'))
    expect(lines).toHaveLength(22)
    expect(lines[21]).toBe('22 BEA  Haas          1:48.005')
  })
  it('datos reales de Miami: quien no marcó en su última tanda muestra el anterior, y sin ninguno, raya', () => {
    const q = parseQualifying(quali4)
    const lines = pre(qualiMessage({ ...d, ...q }, 4, 'quali'))
    expect(lines[9]).toBe('10 HUL  Audi          1:29.439')
    expect(lines[15]).toMatch(/^16 LIN .+ 1:30\.133$/)
    expect(lines[21]).toMatch(/^22 HAD .+ —$/)
  })
  it('sprint: sin puesto va al final y sin tiempo lleva raya', () => {
    const data = withSprint17()
    data.results = data.results.map((r) =>
      r.kind === 'sprint_quali' && r.position === 1 ? { ...r, position: null, q1: null, q2: null, q3: null } : r,
    )
    const m = qualiMessage(data, 17, 'sprint_quali')
    expect(m).toContain('<b>GP de Singapur: clasificación sprint</b>')
    expect(pre(m)).toHaveLength(22)
    expect(pre(m)[0]).toMatch(/^ 2 /)
    expect(pre(m)[21]).toMatch(/^ — VER {2}Red Bull +—$/)
  })
})

describe('largada', () => {
  it('grilla de OpenF1, con un número sin piloto', () => {
    expect(startMessage({ ...d, grids: [grid(99, 2), grid(3, 1)] }, 21, 'race')).toBe(
      '🚦 <b>Hora de largada en Las Vegas</b>\n\nGrilla de salida\n<pre> 1 VER  Red Bull\n 2 #99</pre>',
    )
  })
  it('plan B: orden de la clasificación, con la aclaración', () => {
    const m = startMessage(top(d, 3), 21, 'race')
    expect(m).toBe(
      '🚦 <b>Hora de largada en Las Vegas</b>\n\nGrilla de salida\n<pre> 1 ANT  Mercedes\n 2 VER  Red Bull\n 3 RUS  Mercedes</pre>\n' +
        'Orden según la clasificación; puede cambiar por penalizaciones.',
    )
  })
  it('sin datos sale solo el título, y nunca dice "largó"', () => {
    expect(startMessage(d, 22, 'race')).toBe('🚦 <b>Hora de largada en Qatar</b>')
    expect(startMessage(d, 21, 'race')).not.toMatch(/largó/i)
  })
  it('sprint', () => {
    const m = startMessage(withSprint17(), 17, 'sprint')
    expect(m).toContain('🚦 <b>Hora de la sprint en Singapur</b>')
    expect(pre(m)).toHaveLength(22)
  })
})

describe('resultado de la sprint', () => {
  it('lista completa, con puntos solo para quienes sumaron', () => {
    const lines = pre(sprintResultMessage(withSprint17(), 17))
    expect(sprintResultMessage(withSprint17(), 17).startsWith('⚡ <b>GP de Singapur: resultado de la sprint</b>\n\n<pre>')).toBe(true)
    expect(lines).toHaveLength(22)
    expect(lines[0]).toBe(' 1 VER  Red Bull       8')
    expect(lines[8]).toMatch(/^ 9 [A-Z]{3} {2}\D+$/)
  })
  it('NC para quien no clasificó y NL para quien no largó', () => {
    const data = withSprint17()
    data.results = data.results.map((r) =>
      r.kind !== 'sprint' ? r : r.position === 21 ? { ...r, positionText: 'R' } : r.position === 22 ? { ...r, positionText: 'W' } : r,
    )
    const lines = pre(sprintResultMessage(data, 17))
    expect([lines[20]!.slice(0, 2), lines[21]!.slice(0, 2)]).toEqual(['NC', 'NL'])
  })
})

describe('resultado de la carrera', () => {
  it('texto completo', () => {
    expect(raceResultMessage(top(d, 3), 21, 'https://example.test')).toBe(
      '🏁 <b>GP de Las Vegas: resultado</b>\n\n<pre> 1 VER  Red Bull      25\n 2 NOR  McLaren       18\n 3 PIA  McLaren       15</pre>\n\n' +
        '🏆 <b>Pilotos</b>\n<pre> 1 ANT  402\n 2 VER  304\n 3 HAM  267</pre>\n\n' +
        '🔧 <b>Constructores</b>\n<pre> 1 Mercedes      666\n 2 Ferrari       517\n 3 Red Bull      440</pre>\n\n' +
        'Todo el detalle en <a href="https://example.test/carreras/2026/21">la web</a>',
    )
  })
  it('top 10 y vuelta rápida, aunque la haya hecho alguien de más atrás', () => {
    const m = raceResultMessage(d, 21, null)
    expect(m).toContain('</pre>\nVuelta rápida: LAW, 1:35.591\n\n🏆')
    expect(pre(m)).toHaveLength(10 + 10 + 11)
    expect(pre(m)[9]).toBe('10 LEC  Ferrari        1')
    expect(m).not.toContain('Todo el detalle')
  })
  it('+N son los puntos de la fecha; sin la tabla anterior no aparece', () => {
    expect(raceResultMessage(d, 21, null)).not.toContain('+')
    const prev = [standing(20, 'drivers', 'max_verstappen', 279, 2), standing(20, 'drivers', 'antonelli', 402, 1)]
    const lines = pre(raceResultMessage({ ...d, standings: [...d.standings, ...prev] }, 21, null))
    expect(lines).toContain(' 2 VER  304  +25')
    expect(lines).toContain(' 4 RUS  264  +264')
    expect(lines).toContain(' 1 ANT  402')
    expect(lines).toContain(' 3 HAM  267  +267') // no estaba en la tabla anterior: sumó todo ahora
  })
  it('los +N quedan alineados como en el ejemplo aprobado', () => {
    const prev = [standing(20, 'drivers', 'antonelli', 390, 1), standing(20, 'drivers', 'hamilton', 261, 3)]
    const lines = pre(raceResultMessage({ ...d, standings: [...d.standings, ...prev] }, 21, null))
    expect(lines).toContain(' 1 ANT  402  +12')
    expect(lines).toContain(' 3 HAM  267   +6')
  })
  it('la línea de campeón aparece solo en la fecha que define', () => {
    expect(raceResultMessage(d, 21, null)).not.toContain('👑')
    expect(raceResultMessage(withTitleDecidedAt21(d), 21, null)).toContain(
      'resultado</b>\n👑 <b>Andrea Kimi Antonelli es campeón del mundo</b>\n\n<pre>',
    )
  })
  it('campeón de constructores', () => {
    const data = {
      ...d,
      standings: [
        ...d.standings,
        standing(20, 'constructors', 'mercedes', 600, 1), standing(20, 'constructors', 'ferrari', 560, 2),
      ],
    }
    expect(raceResultMessage(data, 21, null)).toContain('👑 <b>Mercedes es campeón del mundo de constructores</b>')
  })
})

it('ancho, tamaño y escape', () => {
  const sprint = withSprint17()
  const all = [
    previewMessage(d, 22), qualiMessage(d, 21, 'quali'), startMessage(d, 21, 'race'),
    raceResultMessage(withTitleDecidedAt21(d), 21, 'https://example.test'),
    sprintResultMessage(sprint, 17), qualiMessage(sprint, 17, 'sprint_quali'),
  ]
  for (const m of all) {
    expect(m.length).toBeLessThanOrEqual(4096)
    for (const line of pre(m)) expect(line.length).toBeLessThanOrEqual(32)
  }
  const evil = { ...d, constructors: d.constructors.map((c) => ({ ...c, name: '<x>&' })) }
  expect(qualiMessage(evil, 21, 'quali')).toContain('&lt;x&gt;&amp;')
  expect(raceResultMessage(evil, 21, null)).not.toContain('<x>')
})
