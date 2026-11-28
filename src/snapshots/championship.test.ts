import { season2026 } from '../notices/__fixtures__/season'
import constructors20 from '../sources/__fixtures__/constructorstandings-2026-20.json'
import drivers1 from '../sources/__fixtures__/driverstandings-2026-1.json'
import drivers20 from '../sources/__fixtures__/driverstandings-2026-20.json'
import { parseStandings } from '../sources/jolpica'
import { championshipSnapshot } from './championship'

const base = season2026()
const d = {
  ...base,
  standings: [
    ...parseStandings(drivers1, 'drivers'),
    ...parseStandings(drivers20, 'drivers'),
    ...parseStandings(constructors20, 'constructors'),
    ...base.standings,
  ],
}
const c = championshipSnapshot(d)!
const line = (code: string) => c.chart.lines.find((l) => l.code === code)!

it('las dos tablas completas de la última ronda con las dos', () => {
  expect(c.round).toBe(21)
  expect(c.drivers[0]).toMatchObject({ code: 'ANT', points: 402, wins: 9, team: 'Mercedes' })
  expect(c.constructors[0]).toMatchObject({ team: 'Mercedes', points: 666, wins: 12 })
  expect(c.drivers).toHaveLength(base.standings.filter((s) => s.kind === 'drivers').length)
})

it('los puntos de cada piloto ronda a ronda, con null donde no figuraba', () => {
  expect(c.chart.rounds).toEqual([1, 20, 21])
  expect(line('ANT').points).toEqual([18, 390, 402])
  expect(line('CAM').points).toEqual([null, 0, 0])
  expect(c.chart.lines).toHaveLength(c.drivers.length)
})

it('resalta a los cinco primeros y puntea al compañero peor ubicado', () => {
  expect(c.chart.lines.filter((l) => l.highlight).map((l) => l.code)).toEqual(['ANT', 'VER', 'HAM', 'RUS', 'NOR'])
  expect(c.chart.lines.filter((l) => l.dashed).map((l) => l.code)).toEqual(['RUS'])
})

it('sin tablas no hay campeonato', () => {
  expect(championshipSnapshot({ ...d, standings: [] })).toBeNull()
})
