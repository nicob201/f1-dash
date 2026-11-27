// La forma de los JSON de la web. La comparten el Worker, que los arma, y el front.
import type { SessionKind } from '../types'

export type DriverRef = { code: string; name: string; team: string; color: string }
export type SessionTime = { kind: SessionKind; startsAt: string } // ISO, UTC
export type RaceInfo = { season: number; round: number; rounds: number; gp: string; circuit: string; sessions: SessionTime[] }

export type FastestLap = DriverRef & { lap: string }
export type ResultLine = DriverRef & {
  finish: string
  time: string | null
  /** Se muestra cuando no hay tiempo. */
  note: string | null
  points: number
  gained: number | null
  fastest: boolean
}
export type QualiLine = DriverRef & { finish: string; q1: string | null; q2: string | null; q3: string | null }
export type PitLine = DriverRef & { stop: number; lap: number; duration: string | null }
export type DriverStanding = DriverRef & { position: number | null; points: number }
export type TeamStanding = { team: string; color: string; position: number | null; points: number }

export type HomeSnapshot = {
  season: number
  races: (RaceInfo & { winner: DriverRef | null })[]
  last: { round: number; gp: string; top: ResultLine[]; fastest: FastestLap | null } | null
  /** La ronda tras la que quedaron las dos tablas. */
  standingsRound: number | null
  drivers: DriverStanding[]
  constructors: TeamStanding[]
  /** La temporada siguiente, para la cuenta regresiva cuando termina la actual. Puede venir vacía. */
  upcoming: { season: number; races: RaceInfo[] }
}

export type RaceSnapshot = RaceInfo & {
  prev: number | null
  next: number | null
  race: ResultLine[]
  fastest: FastestLap | null
  sprint: ResultLine[]
  quali: QualiLine[]
  pits: PitLine[]
}

export type HomeResponse = { channel: string | null; snapshot: HomeSnapshot }
