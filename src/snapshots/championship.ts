// El JSON de la página Campeonato. Función pura, como las de build.ts.
import { lastCompleteStandingsRound, standingsOf, type SeasonData } from '../notices/data'
import { currentTeam, driverRef, teamRef } from './build'
import type { ChampionshipSnapshot, ChartLine } from './types'

/** Los que el gráfico muestra en color y con nombre. */
const HIGHLIGHTED = 5

export function championshipSnapshot(d: SeasonData): ChampionshipSnapshot | null {
  const round = lastCompleteStandingsRound(d)
  if (round === null) return null

  const table = standingsOf(d, round, 'drivers')
  const drivers = table.map((s) => ({
    ...driverRef(d, s.entityId, currentTeam(d, s.entityId)), position: s.position, points: s.points, wins: s.wins,
  }))

  const byDriver = d.standings.filter((s) => s.kind === 'drivers' && s.round <= round)
  const rounds = [...new Set(byDriver.map((s) => s.round))].sort((a, b) => a - b)
  const points = new Map(byDriver.map((s) => [`${s.round}:${s.entityId}`, s.points]))
  const lines: ChartLine[] = table.map((s, i) => {
    const team = currentTeam(d, s.entityId)
    const highlight = i < HIGHLIGHTED
    // Mismo color que un compañero mejor ubicado: el punteado los distingue. Sin equipo conocido no hay compañero.
    const dashed = highlight && team !== '' && table.slice(0, i).some((x) => currentTeam(d, x.entityId) === team)
    const { code, color } = drivers[i]!
    return { code, color, highlight, dashed, points: rounds.map((r) => points.get(`${r}:${s.entityId}`) ?? null) }
  })

  return {
    season: d.season,
    round,
    drivers,
    constructors: standingsOf(d, round, 'constructors').map((s) => ({
      ...teamRef(d, s.entityId), position: s.position, points: s.points, wins: s.wins,
    })),
    chart: { rounds, lines },
  }
}
