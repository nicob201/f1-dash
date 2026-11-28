import { season2026 } from '../notices/__fixtures__/season'
import type { SeasonData } from '../notices/data'
import { statsSnapshot } from './stats'

const d = season2026()
const stats = (data: SeasonData = d) => statsSnapshot(data)!
const s = stats()
const driver = (code: string) => s.drivers.find((x) => x.code === code)!
const team = (name: string) => s.teams.find((x) => x.team === name)!
const duelsOf = (snapshot: ReturnType<typeof stats>, name: string) => snapshot.duels.filter((x) => x.team === name)

describe('KPIs por piloto', () => {
  it('victorias, podios, poles, posiciones ganadas y promedio', () => {
    expect(driver('VER')).toMatchObject({ wins: 1, podiums: 1, gained: 0, average: 1 })
    expect(driver('NOR')).toMatchObject({ podiums: 1, average: 2 })
    expect(driver('PIA').gained).toBe(14)
    expect(driver('ANT').poles).toBe(1)
  })
  it('abandono es no clasificado tras largar: no cuenta el que no largó ni el clasificado que abandonó', () => {
    expect(driver('LIN')).toMatchObject({ dnfs: 1, average: null })
    expect(driver('PER')).toMatchObject({ dnfs: 1, average: null })
    expect(driver('ALB')).toMatchObject({ dnfs: 0, average: null })
    expect(driver('ALO')).toMatchObject({ dnfs: 0, average: 19 })
  })
  it('van en el orden del campeonato', () => {
    expect(s.drivers.slice(0, 3).map((x) => x.code)).toEqual(['ANT', 'VER', 'HAM'])
  })
})

describe('KPIs por equipo', () => {
  it('suman los dos autos', () => {
    expect(team('Red Bull')).toMatchObject({ wins: 1, average: 8 })
    expect(team('McLaren')).toMatchObject({ podiums: 2, average: 2.5 })
    expect(team('Mercedes').poles).toBe(1)
    expect(team('Racing Bulls').dnfs).toBe(1)
    expect(s.teams[0]!.team).toBe('Mercedes')
  })
})

describe('¿Quién puede ser campeón?', () => {
  it('con un solo candidato, ese es el campeón', () => {
    expect(s.titles.drivers.contenders.map((x) => x.code)).toEqual(['ANT'])
    expect(s.titles.drivers.pointsLeft).toBe(50)
    expect(s.titles.constructors.contenders.map((x) => x.team)).toEqual(['Mercedes'])
    expect(s.titles.constructors.pointsLeft).toBe(86)
  })
  it('con más de uno, todos los que todavía llegan', () => {
    const standings = d.standings.map((x) => (x.kind === 'drivers' && x.entityId === 'max_verstappen' ? { ...x, points: 360 } : x))
    expect(stats({ ...d, standings }).titles.drivers.contenders.map((x) => x.code)).toEqual(['ANT', 'VER'])
  })
})

describe('duelos de compañeros', () => {
  it('cuenta clasificación y carrera, con el mejor ubicado en el campeonato primero', () => {
    expect(duelsOf(s, 'Red Bull')).toMatchObject([{ a: { code: 'VER' }, b: { code: 'HAD' }, quali: [1, 0], race: [1, 0] }])
    expect(duelsOf(s, 'Ferrari')).toMatchObject([{ a: { code: 'HAM' }, b: { code: 'LEC' }, quali: [0, 1], race: [1, 0] }])
  })
  it('en carrera solo cuenta si los dos terminaron clasificados', () => {
    expect(duelsOf(s, 'Williams')).toMatchObject([{ a: { code: 'SAI' }, b: { code: 'ALB' }, quali: [1, 0], race: [0, 0] }])
  })
  it('un cambio de piloto a mitad de año forma otra pareja', () => {
    const round20 = d.results
      .filter((r) => r.round === 21 && r.constructorId === 'red_bull')
      .map((r) => ({ ...r, round: 20, driverId: r.driverId === 'hadjar' ? 'lawson' : r.driverId }))
    const pairs = duelsOf(stats({ ...d, results: [...d.results, ...round20] }), 'Red Bull').map((x) => `${x.a.code}/${x.b.code}`)
    expect(pairs.toSorted()).toEqual(['VER/HAD', 'VER/LAW'])
  })
})

it('solo cuenta hasta la ronda de las tablas', () => {
  const ahead = d.results.filter((r) => r.round === 21 && r.kind === 'race').map((r) => ({ ...r, round: 22 }))
  expect(stats({ ...d, results: [...d.results, ...ahead] }).drivers.find((x) => x.code === 'VER')!.wins).toBe(1)
})

it('sin tablas no hay stats', () => {
  expect(statsSnapshot({ ...d, standings: [] })).toBeNull()
})
