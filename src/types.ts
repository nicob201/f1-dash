export type SessionKind = 'fp1' | 'fp2' | 'fp3' | 'quali' | 'sprint_quali' | 'sprint' | 'race'
export type ResultKind = 'quali' | 'sprint_quali' | 'sprint' | 'race'

export type RaceRow = { season: number; round: number; name: string; circuit: string; locality: string; country: string }
export type SessionRow = { season: number; round: number; kind: SessionKind; startsAt: Date; openf1Key: number | null }

export type DriverRow = {
  season: number; driverId: string; code: string; carNumber: number
  givenName: string; familyName: string; constructorId: string
}
export type ConstructorRow = { season: number; constructorId: string; name: string; color: string }
export type ResultRow = {
  season: number; round: number; kind: ResultKind; driverId: string; constructorId: string; carNumber: number
  position: number | null; positionText: string | null; grid: number | null; points: number | null
  status: string | null; time: string | null; q1: string | null; q2: string | null; q3: string | null
  fastestLapRank: number | null; fastestLapTime: string | null
}
export type ParsedResults = { drivers: DriverRow[]; constructors: ConstructorRow[]; results: ResultRow[] }
export type StandingRow = {
  season: number; round: number; kind: 'drivers' | 'constructors'
  entityId: string; position: number; points: number; wins: number
}
export type PitStopRow = { season: number; round: number; driverId: string; stop: number; lap: number; duration: string | null }
