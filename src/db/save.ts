// Única puerta de escritura a D1. Cada función escribe en un solo batch, que es atómico.
import { and, eq, getTableColumns, like, sql, type SQL } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { CircuitRow, GridRow, ParsedResults, PitStopRow, RaceRow, SessionRow, StandingRow } from '../types'
import { circuits, constructors, drivers, grids, kv, pitStops, races, results, sessions, standings } from './schema'

export type Db = DrizzleD1Database

/** D1 admite 100 parámetros por query: los inserts multifila se cortan según las columnas. */
function chunks<T>(table: SQLiteTable, rows: T[]): T[][] {
  const size = Math.floor(100 / Object.keys(getTableColumns(table)).length)
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))
}

async function run(db: Db, statements: BatchItem<'sqlite'>[]): Promise<void> {
  const [first, ...rest] = statements
  if (first) await db.batch([first, ...rest])
}

/** En un upsert: pisar cada columna con el valor que se intentó insertar. */
function incoming<T extends SQLiteTable>(table: T): Record<string, SQL> {
  return Object.fromEntries(
    Object.entries(getTableColumns(table)).map(([key, col]) => [key, sql.raw(`excluded.${(col as SQLiteColumn).name}`)]),
  )
}

const upsert = <T extends SQLiteTable>(db: Db, table: T, target: SQLiteColumn[], rows: T['$inferInsert'][], set = incoming(table)) =>
  chunks(table, rows).map((part) => db.insert(table).values(part).onConflictDoUpdate({ target, set: set as never }))

/**
 * Reemplaza cada grupo presente en `rows`, para que entren las correcciones de la fuente.
 * Los grupos que no vienen quedan como estaban: una respuesta vacía no borra nada.
 */
function replace<T extends SQLiteTable, R extends T['$inferInsert']>(
  db: Db,
  table: T,
  rows: R[],
  group: (row: R) => (readonly [SQLiteColumn, unknown])[],
): BatchItem<'sqlite'>[] {
  const groups = new Map(rows.map((r) => [JSON.stringify(group(r).map(([, v]) => v)), group(r)]))
  return [
    ...[...groups.values()].map((cols) => db.delete(table).where(and(...cols.map(([col, v]) => eq(col, v))))),
    ...chunks(table, rows).map((part) => db.insert(table).values(part)),
  ]
}

/** Por cada temporada presente en `rows`, borra de `table` lo que no vino. Una lista vacía no borra nada. */
function prune<R extends { season: number }>(db: Db, table: typeof races | typeof sessions, rows: R[], key: SQL, id: (r: R) => string) {
  return [...new Set(rows.map((r) => r.season))].map((season) => {
    // La lista va en un solo parámetro: D1 admite 100 por query.
    const kept = JSON.stringify(rows.filter((r) => r.season === season).map(id))
    return db.delete(table).where(and(eq(table.season, season), sql`${key} not in (select value from json_each(${kept}))`))
  })
}

export async function saveCalendar(db: Db, raceRows: RaceRow[], sessionRows: SessionRow[]): Promise<void> {
  await run(db, [
    // Una ronda cancelada o una sesión que se saca no pueden quedar guardadas.
    ...prune(db, races, raceRows, sql`cast(${races.round} as text)`, (r) => String(r.round)),
    ...prune(db, sessions, sessionRows, sql`${sessions.round} || ':' || ${sessions.kind}`, (s) => `${s.round}:${s.kind}`),
    ...upsert(db, races, [races.season, races.round], raceRows),
    ...upsert(db, sessions, [sessions.season, sessions.round, sessions.kind], sessionRows, {
      ...incoming(sessions),
      openf1Key: sql`coalesce(excluded.openf1_key, ${sessions.openf1Key})`,
    }),
  ])
}

export async function saveResults(db: Db, parsed: ParsedResults): Promise<void> {
  await run(db, [
    ...upsert(db, drivers, [drivers.season, drivers.driverId], parsed.drivers),
    ...upsert(db, constructors, [constructors.season, constructors.constructorId], parsed.constructors),
    ...replace(db, results, parsed.results, (r) => [
      [results.season, r.season], [results.round, r.round], [results.kind, r.kind],
    ]),
  ])
}

export async function saveStandings(db: Db, rows: StandingRow[]): Promise<void> {
  await run(db, replace(db, standings, rows, (r) => [
    [standings.season, r.season], [standings.round, r.round], [standings.kind, r.kind],
  ]))
}

export async function savePitStops(db: Db, rows: PitStopRow[]): Promise<void> {
  await run(db, replace(db, pitStops, rows, (r) => [[pitStops.season, r.season], [pitStops.round, r.round]]))
}

export async function saveGrid(db: Db, rows: GridRow[]): Promise<void> {
  await run(db, replace(db, grids, rows, (r) => [[grids.season, r.season], [grids.round, r.round], [grids.kind, r.kind]]))
}

export async function saveCircuits(db: Db, rows: CircuitRow[]): Promise<void> {
  await run(db, upsert(db, circuits, [circuits.id], rows))
}

/** Guarda los snapshots y borra las páginas de carrera de `seasons` que no vinieron, todo junto. */
export async function saveSnapshots(db: Db, rows: { key: string; value: string }[], seasons: number[]): Promise<void> {
  const kept = JSON.stringify(rows.map((r) => r.key))
  await run(db, [
    ...seasons.map((season) =>
      db.delete(kv).where(and(like(kv.key, `race:${season}:%`), sql`${kv.key} not in (select value from json_each(${kept}))`)),
    ),
    ...upsert(db, kv, [kv.key], rows),
  ])
}
