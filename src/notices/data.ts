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

export const driverCode = (d: SeasonData, driverId: string): string =>
  d.drivers.find((x) => x.driverId === driverId)?.code ?? driverId.slice(0, 3).toUpperCase()

/** La última ronda con las dos tablas: con una sola, la otra saldría vacía. */
export function lastCompleteStandingsRound(d: SeasonData): number | null {
  const has = (round: number, kind: StandingRow['kind']) => d.standings.some((s) => s.round === round && s.kind === kind)
  const rounds = d.standings.map((s) => s.round).filter((r) => has(r, 'drivers') && has(r, 'constructors'))
  return rounds.length ? Math.max(...rounds) : null
}
