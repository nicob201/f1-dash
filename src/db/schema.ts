// Todas las tablas llevan season: nada se borra al cambiar de temporada.
import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { GridRow, ResultKind, SessionKind, StandingRow } from '../types'

export const races = sqliteTable('races', {
  season: integer().notNull(),
  round: integer().notNull(),
  name: text().notNull(),
  circuit: text().notNull(),
  locality: text().notNull(),
  country: text().notNull(),
}, (t) => [primaryKey({ columns: [t.season, t.round] })])

export const sessions = sqliteTable('sessions', {
  season: integer().notNull(),
  round: integer().notNull(),
  kind: text().$type<SessionKind>().notNull(),
  startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(), // UTC
  openf1Key: integer('openf1_key'),
}, (t) => [primaryKey({ columns: [t.season, t.round, t.kind] })])

export const drivers = sqliteTable('drivers', {
  season: integer().notNull(),
  driverId: text('driver_id').notNull(),
  code: text().notNull(),
  carNumber: integer('car_number').notNull(),
  givenName: text('given_name').notNull(),
  familyName: text('family_name').notNull(),
  constructorId: text('constructor_id').notNull(),
}, (t) => [primaryKey({ columns: [t.season, t.driverId] })])

export const constructors = sqliteTable('constructors', {
  season: integer().notNull(),
  constructorId: text('constructor_id').notNull(),
  name: text().notNull(),
  color: text().notNull(),
}, (t) => [primaryKey({ columns: [t.season, t.constructorId] })])

export const results = sqliteTable('results', {
  season: integer().notNull(),
  round: integer().notNull(),
  kind: text().$type<ResultKind>().notNull(),
  driverId: text('driver_id').notNull(),
  constructorId: text('constructor_id').notNull(),
  carNumber: integer('car_number').notNull(),
  position: integer(),
  positionText: text('position_text'),
  grid: integer(),
  points: real(),
  status: text(),
  time: text(),
  q1: text(),
  q2: text(),
  q3: text(),
  fastestLapRank: integer('fastest_lap_rank'),
  fastestLapTime: text('fastest_lap_time'),
}, (t) => [primaryKey({ columns: [t.season, t.round, t.kind, t.driverId] })])

export const standings = sqliteTable('standings', {
  season: integer().notNull(),
  round: integer().notNull(),
  kind: text().$type<StandingRow['kind']>().notNull(),
  entityId: text('entity_id').notNull(),
  position: integer(),
  points: real().notNull(),
  wins: integer().notNull(),
}, (t) => [primaryKey({ columns: [t.season, t.round, t.kind, t.entityId] })])

export const pitStops = sqliteTable('pit_stops', {
  season: integer().notNull(),
  round: integer().notNull(),
  driverId: text('driver_id').notNull(),
  stop: integer().notNull(),
  lap: integer().notNull(),
  duration: text(),
}, (t) => [primaryKey({ columns: [t.season, t.round, t.driverId, t.stop] })])

// Por número de auto: la grilla llega de OpenF1 antes de que haya resultados.
export const grids = sqliteTable('grids', {
  season: integer().notNull(),
  round: integer().notNull(),
  kind: text().$type<GridRow['kind']>().notNull(),
  carNumber: integer('car_number').notNull(),
  position: integer().notNull(),
  source: text().$type<GridRow['source']>().notNull(),
}, (t) => [primaryKey({ columns: [t.season, t.round, t.kind, t.carNumber] })])

// Los JSON de la web, ya armados: la API devuelve la fila tal cual.
export const kv = sqliteTable('kv', {
  key: text().primaryKey(),
  value: text().notNull(),
})
