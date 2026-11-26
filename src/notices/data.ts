// La temporada tal como sale de la base, y las búsquedas que comparten los mensajes.
import type { ConstructorRow, DriverRow, GridRow, RaceRow, ResultKind, ResultRow, SessionRow, StandingRow } from '../types'

export type SeasonData = {
  season: number
  races: RaceRow[]
  sessions: SessionRow[]
  drivers: DriverRow[]
  constructors: ConstructorRow[]
  results: ResultRow[]
  standings: StandingRow[]
  grids: GridRow[]
}

const byPosition = <T extends { position: number | null }>(a: T, b: T) => (a.position ?? Infinity) - (b.position ?? Infinity)

export function raceOf(d: SeasonData, round: number): RaceRow {
  const race = d.races.find((r) => r.round === round)
  if (!race) throw new Error(`No existe la ronda ${round} en ${d.season}`)
  return race
}

export const resultsOf = (d: SeasonData, round: number, kind: ResultKind): ResultRow[] =>
  d.results.filter((r) => r.round === round && r.kind === kind).sort(byPosition)

export const standingsOf = (d: SeasonData, round: number, kind: StandingRow['kind']): StandingRow[] =>
  d.standings.filter((s) => s.round === round && s.kind === kind).sort(byPosition)
