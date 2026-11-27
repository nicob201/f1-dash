// Rearma los JSON de la web con lo que hay en la base. Hoy la llama la carga; después, el reloj.
import { eq, max } from 'drizzle-orm'
import { loadSeason } from '../db/queries'
import { saveSnapshots, type Db } from '../db/save'
import { pitStops, races, results } from '../db/schema'
import { homeSnapshot, raceSnapshot } from './build'

/** La de la última carrera corrida; sin ninguna, la del calendario más nuevo. */
async function shownSeason(db: Db): Promise<number | null> {
  const [run] = await db.select({ season: max(results.season) }).from(results).where(eq(results.kind, 'race'))
  if (run?.season != null) return run.season
  const [calendar] = await db.select({ season: max(races.season) }).from(races)
  return calendar?.season ?? null
}

/** Devuelve cuántos guardó. */
export async function buildSnapshots(db: Db): Promise<number> {
  const season = await shownSeason(db)
  if (season === null) return 0
  // ponytail: lee y arma todo de una vez, sin límite en el script local. El reloj va a tener 10 ms de CPU:
  // medirlo en su plan y, si no entra, armar solo la ronda que cambió.
  const data = await loadSeason(db, season)
  const upcoming = await loadSeason(db, season + 1)
  const pits = await db.select().from(pitStops).where(eq(pitStops.season, season))
  const rows = [
    { key: 'home', value: JSON.stringify(homeSnapshot(data, upcoming)) },
    ...data.races.map((r) => ({
      key: `race:${season}:${r.round}`,
      value: JSON.stringify(raceSnapshot(data, pits, r.round)),
    })),
  ]
  await saveSnapshots(db, rows)
  return rows.length
}
