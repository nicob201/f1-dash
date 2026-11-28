// Traduce el JSON de Jolpica a nuestras filas. Si la forma no es la esperada, zod lanza.
import { z } from 'zod'
import { teamColor } from '../colors'
import type { ConstructorRow, DriverRow, ParsedResults, PitStopRow, RaceRow, ResultKind, ResultRow, SessionKind, SessionRow, StandingRow } from '../types'

// Jolpica manda los números como texto.
const num = z.string().regex(/^\d+(\.\d+)?$/).transform(Number)
// Un tiempo que no hubo puede faltar o venir como "".
const optionalText = z.string().optional().transform((v) => v || null)
const timed = z.object({ time: optionalText })
const when = z.object({ date: z.iso.date(), time: z.string() })
// iso.datetime exige la zona: sin ella, la hora se leería en la zona de la máquina.
const utc = (w: z.infer<typeof when>) => new Date(z.iso.datetime().parse(`${w.date}T${w.time}`))

const calendarSchema = z.object({
  MRData: z.object({
    RaceTable: z.object({
      Races: z.array(
        when.extend({
          season: num,
          round: num,
          raceName: z.string(),
          Circuit: z.object({ circuitId: z.string(), circuitName: z.string(), Location: z.object({ locality: z.string(), country: z.string() }) }),
          FirstPractice: when.optional(),
          SecondPractice: when.optional(),
          ThirdPractice: when.optional(),
          Qualifying: when.optional(),
          SprintQualifying: when.optional(),
          Sprint: when.optional(),
        }),
      ),
    }),
  }),
})

const SESSION_KEYS = [
  ['FirstPractice', 'fp1'],
  ['SecondPractice', 'fp2'],
  ['ThirdPractice', 'fp3'],
  ['Qualifying', 'quali'],
  ['SprintQualifying', 'sprint_quali'],
  ['Sprint', 'sprint'],
] as const

export function parseCalendar(body: unknown): { races: RaceRow[]; sessions: SessionRow[] } {
  const races: RaceRow[] = []
  const sessions: SessionRow[] = []
  for (const r of calendarSchema.parse(body).MRData.RaceTable.Races) {
    const { season, round } = r
    const { locality, country } = r.Circuit.Location
    races.push({ season, round, name: r.raceName, circuit: r.Circuit.circuitName, circuitId: r.Circuit.circuitId, locality, country })
    const add = (kind: SessionKind, w: z.infer<typeof when>) =>
      sessions.push({ season, round, kind, startsAt: utc(w), openf1Key: null })
    for (const [key, kind] of SESSION_KEYS) if (r[key]) add(kind, r[key])
    add('race', r)
  }
  return { races, sessions }
}

const entry = z.object({
  number: num,
  position: num,
  Driver: z.object({ driverId: z.string(), code: z.string(), givenName: z.string(), familyName: z.string() }),
  Constructor: z.object({ constructorId: z.string(), name: z.string() }),
})
const finish = entry.extend({
  positionText: z.string(),
  points: num,
  grid: num,
  status: z.string(),
  Time: timed.optional(),
  FastestLap: z.object({ rank: num.optional(), Time: timed.optional() }).optional(),
})
const qualifying = entry.extend({ Q1: optionalText, Q2: optionalText, Q3: optionalText })

const raceTable = <T extends z.ZodType>(races: T) =>
  z.object({ MRData: z.object({ RaceTable: z.object({ Races: z.array(races) }) }) })
const head = z.object({ season: num, round: num })
const raceResults = raceTable(head.extend({ Results: z.array(finish) }))
const sprintResults = raceTable(head.extend({ SprintResults: z.array(finish) }))
const qualifyingResults = raceTable(head.extend({ QualifyingResults: z.array(qualifying) }))

const EMPTY = {
  positionText: null, grid: null, points: null, status: null, time: null,
  q1: null, q2: null, q3: null, fastestLapRank: null, fastestLapTime: null,
}

/** Sin repetidos; gana el último, que es el de la ronda o página posterior. */
const unique = <T>(rows: T[], id: (row: T) => string): T[] => [...new Map(rows.map((r) => [id(r), r])).values()]

export function mergeResults(pages: ParsedResults[]): ParsedResults {
  return {
    drivers: unique(pages.flatMap((p) => p.drivers), (d) => `${d.season} ${d.driverId}`),
    constructors: unique(pages.flatMap((p) => p.constructors), (c) => `${c.season} ${c.constructorId}`),
    results: pages.flatMap((p) => p.results),
  }
}

function toRows<E extends z.infer<typeof entry>>(
  races: { season: number; round: number; entries: E[] }[],
  kind: ResultKind,
  extra: (e: E) => Partial<ResultRow>,
): ParsedResults {
  return mergeResults(
    races.map(({ season, round, entries }) => ({
      drivers: entries.map((e): DriverRow => ({
        season,
        driverId: e.Driver.driverId,
        code: e.Driver.code,
        carNumber: e.number, // el del auto en esa carrera, no Driver.permanentNumber
        givenName: e.Driver.givenName,
        familyName: e.Driver.familyName,
        constructorId: e.Constructor.constructorId,
      })),
      constructors: entries.map((e): ConstructorRow => ({
        season,
        constructorId: e.Constructor.constructorId,
        name: e.Constructor.name,
        color: teamColor(e.Constructor.constructorId),
      })),
      results: entries.map((e): ResultRow => ({
        ...EMPTY,
        season,
        round,
        kind,
        driverId: e.Driver.driverId,
        constructorId: e.Constructor.constructorId,
        carNumber: e.number,
        position: e.position,
        ...extra(e),
      })),
    })),
  )
}

const fromFinish = (e: z.infer<typeof finish>): Partial<ResultRow> => ({
  positionText: e.positionText,
  grid: e.grid,
  points: e.points,
  status: e.status,
  time: e.Time?.time ?? null,
  fastestLapRank: e.FastestLap?.rank ?? null,
  fastestLapTime: e.FastestLap?.Time?.time ?? null,
})

export function parseResults(body: unknown, kind: 'race' | 'sprint'): ParsedResults {
  const races =
    kind === 'race'
      ? raceResults.parse(body).MRData.RaceTable.Races.map((r) => ({ ...r, entries: r.Results }))
      : sprintResults.parse(body).MRData.RaceTable.Races.map((r) => ({ ...r, entries: r.SprintResults }))
  return toRows(races, kind, fromFinish)
}

export function parseQualifying(body: unknown): ParsedResults {
  const races = qualifyingResults.parse(body).MRData.RaceTable.Races.map((r) => ({ ...r, entries: r.QualifyingResults }))
  return toRows(races, 'quali', (e) => ({ q1: e.Q1, q2: e.Q2, q3: e.Q3 }))
}

// Sin puesto (positionText "-") Jolpica no manda position.
const standing = z.object({ position: num.optional(), points: num, wins: num })
const standingsTable = <T extends z.ZodType>(list: T) =>
  z.object({ MRData: z.object({ StandingsTable: z.object({ StandingsLists: z.array(list) }) }) })
const driverStandings = standingsTable(
  head.extend({ DriverStandings: z.array(standing.extend({ Driver: z.object({ driverId: z.string() }) })) }),
)
const constructorStandings = standingsTable(
  head.extend({ ConstructorStandings: z.array(standing.extend({ Constructor: z.object({ constructorId: z.string() }) })) }),
)

export function parseStandings(body: unknown, kind: StandingRow['kind']): StandingRow[] {
  const lists =
    kind === 'drivers'
      ? driverStandings.parse(body).MRData.StandingsTable.StandingsLists.map((l) => ({
          ...l,
          entries: l.DriverStandings.map((e) => ({ ...e, entityId: e.Driver.driverId })),
        }))
      : constructorStandings.parse(body).MRData.StandingsTable.StandingsLists.map((l) => ({
          ...l,
          entries: l.ConstructorStandings.map((e) => ({ ...e, entityId: e.Constructor.constructorId })),
        }))
  return lists.flatMap(({ season, round, entries }) =>
    entries.map(({ entityId, position = null, points, wins }) => ({ season, round, kind, entityId, position, points, wins })),
  )
}

const pitStops = raceTable(
  head.extend({
    PitStops: z.array(z.object({ driverId: z.string(), stop: num, lap: num, duration: optionalText })),
  }),
)

export function parsePitStops(body: unknown): PitStopRow[] {
  return pitStops.parse(body).MRData.RaceTable.Races.flatMap(({ season, round, PitStops }) =>
    PitStops.map((p) => ({ season, round, driverId: p.driverId, stop: p.stop, lap: p.lap, duration: p.duration })),
  )
}
