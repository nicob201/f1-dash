// El JSON de la página Stats. Función pura; las definiciones están en el spec de la entrega 2, §6.
import { contenders, maxPoints, remainingAfter } from '../champion'
import { lastCompleteStandingsRound, standingsOf, type SeasonData } from '../notices/data'
import type { ResultRow, StandingRow } from '../types'
import { currentTeam, driverRef, placesGained, teamRef } from './build'
import type { Duel, Kpis, StatsSnapshot, TitleRace } from './types'

// Como placesGained: sin positionText se toma la posición tal cual.
const classified = (r: ResultRow) => r.position !== null && (r.positionText === null || /^\d+$/.test(r.positionText))

function kpis(rows: ResultRow[]): Kpis {
  const race = rows.filter((r) => r.kind === 'race')
  const finishes = race.filter(classified).map((r) => r.position!)
  const upTo = (n: number) => finishes.filter((p) => p <= n).length
  return {
    wins: upTo(1),
    podiums: upTo(3),
    poles: rows.filter((r) => r.kind === 'quali' && r.position === 1).length,
    // "R": largó y no quedó clasificado. "W" (no largó) y "D" (descalificado) no son abandonos.
    dnfs: race.filter((r) => r.positionText === 'R').length,
    gained: race.reduce((sum, r) => sum + (placesGained(r.grid, r.position, r.positionText) ?? 0), 0),
    average: finishes.length ? Math.round((finishes.reduce((a, b) => a + b, 0) / finishes.length) * 10) / 10 : null,
  }
}

type Pair = Duel & { counted: number }

/** Por ronda, los dos autos de cada equipo. `rank` ordena a los dos: primero el mejor ubicado en el campeonato. */
function duels(d: SeasonData, results: ResultRow[], rank: (driverId: string) => number, teamOrder: string[]): Duel[] {
  const groups = new Map<string, ResultRow[]>()
  for (const r of results) {
    if (r.kind !== 'quali' && r.kind !== 'race') continue
    const key = `${r.round}:${r.kind}:${r.constructorId}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  const pairs = new Map<string, Pair>()
  for (const rows of groups.values()) {
    if (rows.length !== 2) continue
    const [a, b] = rows.toSorted((x, y) => rank(x.driverId) - rank(y.driverId) || x.driverId.localeCompare(y.driverId)) as [ResultRow, ResultRow]
    const kind = a.kind as 'quali' | 'race'
    const counts = kind === 'quali' ? a.q1 !== null && b.q1 !== null : classified(a) && classified(b)
    if (!counts) continue
    const key = `${a.constructorId}:${a.driverId}:${b.driverId}`
    const pair = pairs.get(key) ?? {
      ...teamRef(d, a.constructorId),
      a: driverRef(d, a.driverId, a.constructorId),
      b: driverRef(d, b.driverId, b.constructorId),
      quali: [0, 0],
      race: [0, 0],
      counted: 0,
    }
    pair[kind][a.position! < b.position! ? 0 : 1] += 1
    pair.counted += 1
    pairs.set(key, pair)
  }
  const order = (p: Pair) => {
    const i = teamOrder.indexOf(p.team)
    return i === -1 ? Infinity : i
  }
  return [...pairs.values()]
    .sort((x, y) => order(x) - order(y) || y.counted - x.counted)
    .map(({ counted: _, ...duel }) => duel)
}

export function statsSnapshot(d: SeasonData): StatsSnapshot | null {
  const round = lastCompleteStandingsRound(d)
  if (round === null) return null
  // Hasta la ronda de las tablas, así las stats coinciden con ellas.
  const results = d.results.filter((r) => r.round <= round)
  const driverTable = standingsOf(d, round, 'drivers')
  const teamTable = standingsOf(d, round, 'constructors')

  const driverRows = driverTable.map((s) => ({
    ...driverRef(d, s.entityId, currentTeam(d, s.entityId)), position: s.position, points: s.points,
  }))
  const teamRows = teamTable.map((s) => ({ ...teamRef(d, s.entityId), position: s.position, points: s.points }))

  const remaining = remainingAfter(d.sessions, round)
  const title = <T>(table: StandingRow[], rows: T[], kind: StandingRow['kind']): TitleRace<T> => {
    const ids = new Set(contenders(table, remaining).map((c) => c.entityId))
    return { contenders: rows.filter((_, i) => ids.has(table[i]!.entityId)), pointsLeft: maxPoints(remaining, kind) }
  }

  const position = new Map(driverTable.map((s, i) => [s.entityId, i]))
  return {
    season: d.season,
    round,
    titles: {
      drivers: title(driverTable, driverRows, 'drivers'),
      constructors: title(teamTable, teamRows, 'constructors'),
    },
    drivers: driverTable.map((s) => ({
      ...driverRef(d, s.entityId, currentTeam(d, s.entityId)),
      ...kpis(results.filter((r) => r.driverId === s.entityId)),
    })),
    teams: teamTable.map((s) => ({ ...teamRef(d, s.entityId), ...kpis(results.filter((r) => r.constructorId === s.entityId)) })),
    duels: duels(d, results, (id) => position.get(id) ?? Infinity, teamRows.map((t) => t.team)),
  }
}
