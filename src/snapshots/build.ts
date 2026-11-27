// Arma los JSON de la web. Funciones puras: lo que depende de la hora lo decide el navegador.
import { teamColor } from '../colors'
import { finishingLabel, gpName, statusLabel, teamName } from '../format/es'
import { driverCode, lastCompleteStandingsRound, raceOf, resultsOf, standingsOf, type SeasonData } from '../notices/data'
import type { PitStopRow, ResultRow } from '../types'
import type { DriverRef, FastestLap, HomeSnapshot, RaceInfo, RaceSnapshot, ResultLine } from './types'

type Calendar = Pick<SeasonData, 'season' | 'races' | 'sessions'>

function raceInfo(c: Calendar, round: number): RaceInfo {
  const race = c.races.find((r) => r.round === round)!
  const name = gpName(race.name)
  return {
    season: race.season,
    round,
    rounds: c.races.length,
    gp: name.gp,
    circuit: name.circuit(race.circuit),
    sessions: c.sessions
      .filter((s) => s.round === round)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((s) => ({ kind: s.kind, startsAt: s.startsAt.toISOString() })),
  }
}

const calendar = (c: Calendar): RaceInfo[] => c.races.map((r) => r.round).sort((a, b) => a - b).map((round) => raceInfo(c, round))

function teamRef(d: SeasonData, constructorId: string) {
  const row = d.constructors.find((c) => c.constructorId === constructorId)
  return { team: teamName(row?.name ?? constructorId), color: row?.color ?? teamColor(constructorId) }
}

/** El equipo es el que se pasa: en un resultado, con el que corrió esa fecha. */
function driverRef(d: SeasonData, driverId: string, constructorId: string): DriverRef {
  const driver = d.drivers.find((x) => x.driverId === driverId)
  const name = driver ? `${driver.givenName} ${driver.familyName}` : driverId
  return { code: driverCode(d, driverId), name, ...teamRef(d, constructorId) }
}

const currentTeam = (d: SeasonData, driverId: string) =>
  d.drivers.find((x) => x.driverId === driverId)?.constructorId ?? ''

export function placesGained(grid: number | null, position: number | null, positionText: string | null): number | null {
  const classified = positionText === null || /^\d+$/.test(positionText)
  // grid 0 es largada desde boxes.
  return grid && position !== null && classified ? grid - position : null
}

const resultLine = (d: SeasonData, r: ResultRow): ResultLine => ({
  ...driverRef(d, r.driverId, r.constructorId),
  finish: finishingLabel(r),
  time: r.time,
  note: statusLabel(r.status),
  points: r.points ?? 0,
  gained: r.kind === 'race' ? placesGained(r.grid, r.position, r.positionText) : null,
  fastest: r.kind === 'race' && r.fastestLapRank === 1,
})

function fastestLap(d: SeasonData, results: ResultRow[]): FastestLap | null {
  const r = results.find((x) => x.fastestLapRank === 1)
  return r?.fastestLapTime ? { ...driverRef(d, r.driverId, r.constructorId), lap: r.fastestLapTime } : null
}

export function homeSnapshot(d: SeasonData, upcoming: Calendar): HomeSnapshot {
  const run = d.results.filter((r) => r.kind === 'race').map((r) => r.round)
  const lastRound = run.length ? Math.max(...run) : null
  const tables = lastCompleteStandingsRound(d)
  const table = (kind: 'drivers' | 'constructors') => (tables === null ? [] : standingsOf(d, tables, kind))

  let last: HomeSnapshot['last'] = null
  if (lastRound !== null) {
    const results = resultsOf(d, lastRound, 'race')
    last = {
      round: lastRound,
      gp: gpName(raceOf(d, lastRound).name).gp,
      top: results.slice(0, 5).map((r) => resultLine(d, r)),
      fastest: fastestLap(d, results),
    }
  }

  return {
    season: d.season,
    races: calendar(d).map((info) => {
      const winner = resultsOf(d, info.round, 'race').find((r) => r.position === 1)
      return { ...info, winner: winner ? driverRef(d, winner.driverId, winner.constructorId) : null }
    }),
    last,
    drivers: table('drivers').slice(0, 4).map((s) => ({
      ...driverRef(d, s.entityId, currentTeam(d, s.entityId)), position: s.position, points: s.points,
    })),
    constructors: table('constructors').slice(0, 3).map((s) => ({
      ...teamRef(d, s.entityId), position: s.position, points: s.points,
    })),
    upcoming: { season: upcoming.season, races: calendar(upcoming) },
  }
}

export function raceSnapshot(d: SeasonData, pits: PitStopRow[], round: number): RaceSnapshot {
  const rounds = d.races.map((r) => r.round)
  const race = resultsOf(d, round, 'race')
  const teamThatDay = (driverId: string) =>
    d.results.find((r) => r.round === round && r.driverId === driverId)?.constructorId ?? currentTeam(d, driverId)

  return {
    ...raceInfo(d, round),
    prev: rounds.includes(round - 1) ? round - 1 : null,
    next: rounds.includes(round + 1) ? round + 1 : null,
    race: race.map((r) => resultLine(d, r)),
    fastest: fastestLap(d, race),
    sprint: resultsOf(d, round, 'sprint').map((r) => resultLine(d, r)),
    quali: resultsOf(d, round, 'quali').map((r) => ({
      ...driverRef(d, r.driverId, r.constructorId), finish: finishingLabel(r), q1: r.q1, q2: r.q2, q3: r.q3,
    })),
    pits: pits
      .filter((p) => p.season === d.season && p.round === round)
      .map((p) => ({ ...driverRef(d, p.driverId, teamThatDay(p.driverId)), stop: p.stop, lap: p.lap, duration: p.duration }))
      .sort((a, b) => a.lap - b.lap || a.code.localeCompare(b.code)),
  }
}
