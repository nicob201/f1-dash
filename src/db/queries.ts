// Lectura de D1.
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm'
import type { Command } from '../notices/commands'
import type { SeasonData } from '../notices/data'
import type { Db } from './save'
import { constructors, drivers, grids, races, results, sessions, standings } from './schema'

// ponytail: lee la temporada entera. Sirve para la vista previa y los comandos; el reloj no puede usarla cada minuto
// (gastaría el cupo diario de filas de D1 y los 10 ms de CPU).
export async function loadSeason(db: Db, season: number): Promise<SeasonData> {
  const [r, s, d, c, re, st, g] = await db.batch([
    db.select().from(races).where(eq(races.season, season)),
    db.select().from(sessions).where(eq(sessions.season, season)),
    db.select().from(drivers).where(eq(drivers.season, season)),
    db.select().from(constructors).where(eq(constructors.season, season)),
    db.select().from(results).where(eq(results.season, season)),
    db.select().from(standings).where(eq(standings.season, season)),
    db.select().from(grids).where(eq(grids.season, season)),
  ])
  return { season, races: r, sessions: s, drivers: d, constructors: c, results: re, standings: st, grids: g }
}

const nothing = (season = 0): SeasonData => ({
  season, races: [], sessions: [], drivers: [], constructors: [], results: [], standings: [], grids: [],
})

/** Solo lo que usa cada comando: el plan gratis da 10 ms de CPU por pedido. Las listas que no usa vienen vacías. */
export async function loadForCommand(db: Db, command: Command, now: Date): Promise<SeasonData> {
  const racesOf = (season: number) => db.select().from(races).where(eq(races.season, season))
  const driversOf = (season: number) => db.select().from(drivers).where(eq(drivers.season, season))
  const constructorsOf = (season: number) => db.select().from(constructors).where(eq(constructors.season, season))

  if (command === '/proxima') {
    // De cualquier temporada: entre diciembre y marzo, la próxima es de la que viene.
    const [next] = await db.select().from(sessions)
      .where(and(eq(sessions.kind, 'race'), gt(sessions.startsAt, now)))
      .orderBy(asc(sessions.startsAt)).limit(1)
    if (!next) return nothing()
    const [r, s] = await db.batch([
      racesOf(next.season),
      db.select().from(sessions).where(and(eq(sessions.season, next.season), eq(sessions.round, next.round))),
    ])
    return { ...nothing(next.season), races: r, sessions: s }
  }

  if (command === '/ultima') {
    const [last] = await db.select({ season: results.season, round: results.round }).from(results)
      .where(eq(results.kind, 'race'))
      .orderBy(desc(results.season), desc(results.round)).limit(1)
    if (!last) return nothing()
    const [r, re, d, c] = await db.batch([
      racesOf(last.season),
      db.select().from(results)
        .where(and(eq(results.season, last.season), eq(results.round, last.round), eq(results.kind, 'race'))),
      driversOf(last.season),
      constructorsOf(last.season),
    ])
    return { ...nothing(last.season), races: r, results: re, drivers: d, constructors: c }
  }

  if (command === '/campeonato') {
    const [last] = await db.select({ season: standings.season, round: standings.round }).from(standings)
      .groupBy(standings.season, standings.round)
      .having(sql`count(distinct ${standings.kind}) = 2`)
      .orderBy(desc(standings.season), desc(standings.round)).limit(1)
    if (!last) return nothing()
    const [r, st, d, c] = await db.batch([
      racesOf(last.season),
      db.select().from(standings).where(and(eq(standings.season, last.season), eq(standings.round, last.round))),
      driversOf(last.season),
      constructorsOf(last.season),
    ])
    return { ...nothing(last.season), races: r, standings: st, drivers: d, constructors: c }
  }

  return nothing()
}
