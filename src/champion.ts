// Quién puede ser campeón. La usan el mensaje de la carrera y la web.
import type { SessionRow, StandingRow } from './types'

export type Remaining = { races: number; sprints: number }

export function remainingAfter(sessions: SessionRow[], round: number): Remaining {
  const ahead = sessions.filter((s) => s.round > round)
  return { races: ahead.filter((s) => s.kind === 'race').length, sprints: ahead.filter((s) => s.kind === 'sprint').length }
}

// El máximo que suma un piloto, o un equipo con sus dos autos adelante. En 2026 no hay punto por vuelta rápida.
const PER_ROUND = { drivers: { race: 25, sprint: 8 }, constructors: { race: 43, sprint: 15 } }

export const maxPoints = (r: Remaining, kind: StandingRow['kind']): number =>
  r.races * PER_ROUND[kind].race + r.sprints * PER_ROUND[kind].sprint

/** `table` es de una sola ronda y un solo tipo. */
export function contenders(table: StandingRow[], r: Remaining): StandingRow[] {
  // Sin fechas por delante manda la tabla: Jolpica ya aplicó el desempate.
  if (r.races === 0 && r.sprints === 0) return table.filter((x) => x.position === 1)
  const leader = Math.max(...table.map((x) => x.points))
  // ponytail: empatar al líder alcanza para seguir; no se evalúa el desempate por victorias.
  return table.filter((x) => x.points + maxPoints(r, x.kind) >= leader)
}

/** El campeón, solo si el título quedó definido justo en `round`. */
export function decidedAt(standings: StandingRow[], sessions: SessionRow[], round: number, kind: StandingRow['kind']): string | null {
  const left = (n: number) =>
    contenders(standings.filter((s) => s.round === n && s.kind === kind), remainingAfter(sessions, n))
  const now = left(round)
  if (now.length !== 1) return null
  // Sin la tabla anterior no se sabe si se definió ahora o antes.
  if (round > 1 && left(round - 1).length <= 1) return null
  return now[0]!.entityId
}
