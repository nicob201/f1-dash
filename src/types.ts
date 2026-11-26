export type SessionKind = 'fp1' | 'fp2' | 'fp3' | 'quali' | 'sprint_quali' | 'sprint' | 'race'
export type ResultKind = 'quali' | 'sprint_quali' | 'sprint' | 'race'

export type RaceRow = { season: number; round: number; name: string; circuit: string; locality: string; country: string }
export type SessionRow = { season: number; round: number; kind: SessionKind; startsAt: Date; openf1Key: number | null }
