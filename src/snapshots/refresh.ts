// Rearma los JSON de la web con lo que hay en la base. Hoy la llama la carga; después, el reloj.
import { eq, like, max } from 'drizzle-orm'
import { loadSeason } from '../db/queries'
import { saveSnapshots, type Db } from '../db/save'
import { circuits, kv, pitStops, races, results } from '../db/schema'
import type { SeasonData } from '../notices/data'
import { homeSnapshot, raceSnapshot } from './build'

/** La de la última carrera corrida; sin ninguna, la del calendario más nuevo. */
async function shownSeason(db: Db): Promise<number | null> {
  const [run] = await db.select({ season: max(results.season) }).from(results).where(eq(results.kind, 'race'))
  if (run?.season != null) return run.season
  const [calendar] = await db.select({ season: max(races.season) }).from(races)
  return calendar?.season ?? null
}

/** Las temporadas que ya tienen páginas guardadas: también hay que rearmarlas si cambia la forma del JSON. */
async function savedSeasons(db: Db): Promise<number[]> {
  const rows = await db.select({ key: kv.key }).from(kv).where(like(kv.key, 'race:%'))
  return rows.map((r) => Number(r.key.split(':')[1]))
}

async function racePages(db: Db, data: SeasonData) {
  const pits = await db.select().from(pitStops).where(eq(pitStops.season, data.season))
  const tracks = await db.select().from(circuits)
  return data.races.map((r) => ({
    key: `race:${data.season}:${r.round}`,
    value: JSON.stringify(raceSnapshot(data, pits, r.round, tracks)),
  }))
}

/** Devuelve cuántos guardó. */
export async function buildSnapshots(db: Db): Promise<number> {
  const season = await shownSeason(db)
  if (season === null) return 0
  // ponytail: lee y arma todo de una vez, sin límite en el script local. El reloj va a tener 10 ms de CPU:
  // medirlo en su plan y, si no entra, armar solo la ronda que cambió.
  const shown = await loadSeason(db, season)
  const upcoming = await loadSeason(db, season + 1)
  const rows = [{ key: 'home', value: JSON.stringify(homeSnapshot(shown, upcoming)) }, ...(await racePages(db, shown))]
  const rebuilt = [season]
  for (const other of new Set(await savedSeasons(db))) {
    if (other === season) continue
    const data = await loadSeason(db, other)
    // Sin calendario no se toca: es mejor dejar la página que borrarla.
    if (data.races.length === 0) continue
    rows.push(...(await racePages(db, data)))
    rebuilt.push(other)
  }
  await saveSnapshots(db, rows, rebuilt)
  return rows.length
}
