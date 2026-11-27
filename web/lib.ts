// La lógica del front, sin React: se prueba sola.
import type { HomeSnapshot, RaceInfo, RaceSnapshot } from '../src/snapshots/types'

export type Route =
  | { page: 'home' }
  | { page: 'races' }
  | { page: 'race'; season: number; round: number }
  | { page: 'notFound' }

export function matchRoute(pathname: string): Route {
  const path = pathname.replace(/(.)\/$/, '$1')
  if (path === '/') return { page: 'home' }
  if (path === '/carreras') return { page: 'races' }
  // La misma dirección que arma el mensaje de la carrera.
  const race = /^\/carreras\/(\d+)\/(\d+)$/.exec(path)
  return race ? { page: 'race', season: Number(race[1]), round: Number(race[2]) } : { page: 'notFound' }
}

export type Loaded<T> = { status: 'ok'; data: T } | { status: 'notFound' } | { status: 'error' }

export async function loadJson<T>(url: string, fetcher: typeof fetch = (...args) => fetch(...args)): Promise<Loaded<T>> {
  try {
    const res = await fetcher(url)
    if (res.status === 404) return { status: 'notFound' }
    if (!res.ok) return { status: 'error' }
    return { status: 'ok', data: (await res.json()) as T }
  } catch {
    return { status: 'error' }
  }
}

/** El enlace del botón, o null. Solo va a t.me: acepta "@canal" o un enlace de invitación. */
export function channelUrl(value: string | null): string | null {
  if (!value) return null
  if (/^@\w+$/.test(value)) return `https://t.me/${value.slice(1)}`
  return value.startsWith('https://t.me/') ? value : null
}

const startOf = (race: RaceInfo): number => {
  const session = race.sessions.find((s) => s.kind === 'race')
  return session ? Date.parse(session.startsAt) : NaN
}

export function nextRace(home: HomeSnapshot, now: Date): { kind: 'race'; race: RaceInfo } | { kind: 'unpublished'; season: number } {
  const race = [...home.races, ...home.upcoming.races].find((r) => startOf(r) > now.getTime())
  return race ? { kind: 'race', race } : { kind: 'unpublished', season: home.upcoming.season }
}

export function countdown(target: Date, now: Date) {
  const minutes = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60_000))
  return { days: Math.floor(minutes / 1440), hours: Math.floor(minutes / 60) % 24, minutes: minutes % 60 }
}

/** Ya pasó la hora de largada y no hay resultado. No afirma que se haya corrido. */
export const resultPending = (race: RaceSnapshot, now: Date): boolean => race.race.length === 0 && startOf(race) <= now.getTime()
