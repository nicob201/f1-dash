// Datos y trazados de los circuitos, de bacinger/f1-circuits (MIT, © Tomislav Bacinger). Se cargan una vez.
import { z } from 'zod'
import type { CircuitRow } from '../types'

// Un commit fijo: volver a cargar no cambia los datos sin que nadie se entere.
export const CIRCUITS_URL =
  'https://raw.githubusercontent.com/bacinger/f1-circuits/fda4a2f74728fa033c81ba8d3b628966a4a095d2/f1-circuits.geojson'

/** Clave de Jolpica → clave de la fuente. Los 23 de 2026, más Bahréin y Yeda, que vuelven en 2027. */
export const SOURCE_ID: Record<string, string> = {
  albert_park: 'au-1953',
  shanghai: 'cn-2004',
  suzuka: 'jp-1962',
  miami: 'us-2022',
  villeneuve: 'ca-1978',
  monaco: 'mc-1929',
  catalunya: 'es-1991',
  red_bull_ring: 'at-1969',
  silverstone: 'gb-1948',
  spa: 'be-1925',
  hungaroring: 'hu-1986',
  zandvoort: 'nl-1948',
  monza: 'it-1922',
  madring: 'es-2026',
  baku: 'az-2016',
  sepang: 'my-1999',
  marina_bay: 'sg-2008',
  americas: 'us-2012',
  rodriguez: 'mx-1962',
  interlagos: 'br-1940',
  vegas: 'us-2023',
  losail: 'qa-2004',
  yas_marina: 'ae-2009',
  bahrain: 'bh-2002',
  jeddah: 'sa-2021',
}

type Point = [lon: number, lat: number]
const sourceSchema = z.object({
  features: z.array(z.object({
    properties: z.object({ id: z.string(), length: z.number(), altitude: z.number(), opened: z.number(), firstgp: z.number() }),
    geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(z.tuple([z.number(), z.number()])).min(2) }),
  })),
})

const BOX = 100
const MARGIN = 2 // que el trazo no se corte en el borde
const round1 = (v: number) => String(Math.round(v * 10) / 10)

/** Pasa [longitud, latitud] a un path SVG en un cuadro de 100 × 100, centrado y con el norte arriba. */
export function trackPath(coords: Point[]): string {
  const lons = coords.map(([lon]) => lon)
  const lats = coords.map(([, lat]) => lat)
  const [west, east, south, north] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
  // Para unos pocos kilómetros alcanza con achicar la longitud por el coseno de la latitud.
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180)
  const [width, height] = [(east - west) * k, north - south]
  const inner = BOX - 2 * MARGIN
  const scale = inner / Math.max(width, height)
  const left = MARGIN + (inner - width * scale) / 2
  const top = MARGIN + (inner - height * scale) / 2
  const xy = ([lon, lat]: Point) => `${round1(left + (lon - west) * k * scale)},${round1(top + (north - lat) * scale)}`

  const first = coords[0]!
  const last = coords.at(-1)!
  // La fuente repite el primer punto al final; Z ya cierra la vuelta.
  const points = last[0] === first[0] && last[1] === first[1] ? coords.slice(0, -1) : coords
  return `M${points.map(xy).join('L')}Z`
}

export function parseCircuits(body: unknown): CircuitRow[] {
  const byId = new Map(sourceSchema.parse(body).features.map((f) => [f.properties.id, f]))
  const missing = Object.values(SOURCE_ID).filter((id) => !byId.has(id))
  if (missing.length > 0) throw new Error(`La fuente de circuitos no trae: ${missing.join(', ')}`)
  return Object.entries(SOURCE_ID).map(([id, sourceId]) => {
    const { properties: p, geometry } = byId.get(sourceId)!
    return { id, length: p.length, altitude: p.altitude, opened: p.opened, firstGp: p.firstgp, path: trackPath(geometry.coordinates) }
  })
}
