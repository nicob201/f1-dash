import calendar from './__fixtures__/calendar-2026.json'
import { parseCircuits, SOURCE_ID, trackPath } from './circuits'

type Coords = [number, number][]
const SQUARE: Coords = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
const feature = (id: string, extra: object = {}, coordinates: Coords = SQUARE) => ({
  type: 'Feature',
  properties: { id, Name: 'x', Location: 'x', length: 1000, altitude: 0, opened: 2000, firstgp: 2000, ...extra },
  geometry: { type: 'LineString', coordinates },
})
const source = (features: object[]) => ({ type: 'FeatureCollection', features })
const everyMapped = () => Object.values(SOURCE_ID).map((id) => feature(id))

describe('trackPath', () => {
  it('corrige la longitud por la latitud: a 60° un grado de longitud mide la mitad', () => {
    expect(trackPath([[0, 59.5], [2, 59.5], [2, 60.5], [0, 60.5], [0, 59.5]])).toBe('M2,98L98,98L98,2L2,2Z')
  })
  it('un trazado más ancho que alto queda centrado en el cuadro', () => {
    expect(trackPath([[0, 0], [2, 0], [2, 1], [0, 1]])).toBe('M2,74L98,74L98,26L2,26Z')
  })
})

describe('parseCircuits', () => {
  it('cada circuito del calendario 2026 tiene su clave en la fuente', () => {
    const ids = calendar.MRData.RaceTable.Races.map((r) => r.Circuit.circuitId)
    expect(ids.filter((id) => !(id in SOURCE_ID))).toEqual([])
  })
  it('guarda los datos con la clave de Jolpica e ignora los circuitos sin cruce', () => {
    const rows = parseCircuits(source([
      ...everyMapped().filter((f) => f.properties.id !== 'qa-2004'),
      feature('qa-2004', { length: 5380, altitude: 5, opened: 2004, firstgp: 2021 }),
      feature('xx-1900'),
    ]))
    expect(rows).toHaveLength(Object.keys(SOURCE_ID).length)
    expect(rows.find((r) => r.id === 'losail')).toEqual({
      id: 'losail', length: 5380, altitude: 5, opened: 2004, firstGp: 2021, path: 'M2,98L98,98L98,2L2,2Z',
    })
  })
  it('si a la fuente le falta un circuito del cruce, falla y dice cuál', () => {
    expect(() => parseCircuits(source(everyMapped().filter((f) => f.properties.id !== 'qa-2004')))).toThrow(/qa-2004/)
  })
})
