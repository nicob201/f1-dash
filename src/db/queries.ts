// Lectura de D1.
import { eq } from 'drizzle-orm'
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
