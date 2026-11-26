// Traduce el JSON de OpenF1 y lo cruza con lo de Jolpica.
import { z } from 'zod'
import type { DriverRow, ResultRow, SessionKind, SessionRow } from '../types'

export type Of1Session = { key: number; name: string; startsAt: Date; cancelled: boolean }
export type Of1Result = {
  carNumber: number; position: number | null; times: (number | null)[]
  dnf: boolean; dns: boolean; dsq: boolean
}

const sessionList = z.array(
  z.object({ session_key: z.number(), session_name: z.string(), date_start: z.iso.datetime({ offset: true }), is_cancelled: z.boolean() }),
)
const gridList = z.array(z.object({ driver_number: z.number(), position: z.number() }))
const time = z.number().nullable()
const resultList = z.array(
  z.object({
    driver_number: z.number(),
    position: z.number().nullable(),
    // En clasificaciones es un array (Q1, Q2, Q3); en carreras, un número.
    duration: z.union([z.array(time), time]),
    dnf: z.boolean(),
    dns: z.boolean(),
    dsq: z.boolean(),
  }),
)

export const parseSessions = (body: unknown): Of1Session[] =>
  sessionList.parse(body).map((s) => ({
    key: s.session_key,
    name: s.session_name,
    startsAt: new Date(s.date_start),
    cancelled: s.is_cancelled,
  }))

const NAMES: Record<SessionKind, string> = {
  fp1: 'Practice 1',
  fp2: 'Practice 2',
  fp3: 'Practice 3',
  quali: 'Qualifying',
  sprint_quali: 'Sprint Qualifying',
  sprint: 'Sprint',
  race: 'Race',
}
// Las fuentes no siempre coinciden en la hora: en Miami 2026 difieren 3 h.
const TOLERANCE_MS = 12 * 60 * 60 * 1000

export function matchSessionKeys(sessions: SessionRow[], of1: Of1Session[]): SessionRow[] {
  return sessions.map((session) => {
    const distance = (c: Of1Session) => Math.abs(c.startsAt.getTime() - session.startsAt.getTime())
    const [best] = of1
      .filter((c) => !c.cancelled && c.name === NAMES[session.kind] && distance(c) <= TOLERANCE_MS)
      .sort((a, b) => distance(a) - distance(b))
    return { ...session, openf1Key: best?.key ?? null }
  })
}

export const parseGrid = (body: unknown): { carNumber: number; position: number }[] =>
  gridList.parse(body).map((g) => ({ carNumber: g.driver_number, position: g.position }))

export const parseSessionResult = (body: unknown): Of1Result[] =>
  resultList.parse(body).map((r) => ({
    carNumber: r.driver_number,
    position: r.position,
    times: Array.isArray(r.duration) ? r.duration : [r.duration],
    dnf: r.dnf,
    dns: r.dns,
    dsq: r.dsq,
  }))

export function formatLap(seconds: number | null): string | null {
  if (seconds === null) return null
  const ms = Math.round(seconds * 1000)
  return `${Math.floor(ms / 60_000)}:${((ms % 60_000) / 1000).toFixed(3).padStart(6, '0')}`
}

/** La clasificación sprint solo existe en OpenF1: se arma con la forma de nuestros resultados. */
export function sprintQualiRows(res: Of1Result[], season: number, round: number, drivers: DriverRow[]): ResultRow[] {
  const byNumber = new Map(drivers.map((d) => [d.carNumber, d]))
  return res.map((r) => {
    const driver = byNumber.get(r.carNumber)
    if (!driver) throw new Error(`OpenF1 trae el auto ${r.carNumber} y no hay piloto con ese número (ronda ${round})`)
    return {
      season, round, kind: 'sprint_quali', driverId: driver.driverId, constructorId: driver.constructorId,
      carNumber: r.carNumber, position: r.position, positionText: null, grid: null, points: null, status: null, time: null,
      q1: formatLap(r.times[0] ?? null), q2: formatLap(r.times[1] ?? null), q3: formatLap(r.times[2] ?? null),
      fastestLapRank: null, fastestLapTime: null,
    }
  })
}
