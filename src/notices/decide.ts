// Qué aviso toca ahora. Pura: compara el estado actual con lo ya enviado, así una corrida perdida se recupera en la siguiente.
import { previewAt } from '../format/es'
import type { ResultKind, SessionKind, SessionRow } from '../types'
import { resultsOf, standingsOf, type SeasonData } from './data'

export type NoticeType = 'preview' | 'quali' | 'sprint-quali' | 'sprint-start' | 'sprint-result' | 'race-start' | 'race-result'
export type Notice = { key: string; type: NoticeType; season: number; round: number }
/** `temporada:ronda:kind` de las sesiones cuyo aviso de resultado ya se puede armar. */
export type Ready = ReadonlySet<string>

/** Si el reloj estuvo caído, un aviso por horario sale solo hasta 30 minutos tarde. */
const GRACE_MS = 30 * 60 * 1000

// ponytail: una ronda sin fp1 no tiene previa; en 2026 todas la tienen.
const AT_TIME: Partial<Record<SessionKind, { type: NoticeType; due: (startsAt: Date) => Date }>> = {
  fp1: { type: 'preview', due: previewAt },
  sprint: { type: 'sprint-start', due: (d) => d },
  race: { type: 'race-start', due: (d) => d },
}
const RESULT: Partial<Record<SessionKind, { type: NoticeType; kind: ResultKind }>> = {
  quali: { type: 'quali', kind: 'quali' },
  sprint_quali: { type: 'sprint-quali', kind: 'sprint_quali' },
  sprint: { type: 'sprint-result', kind: 'sprint' },
  race: { type: 'race-result', kind: 'race' },
}

/**
 * El mensaje de la carrera lleva las tablas y puede anunciar al campeón, y no se corrige.
 * Que existan no alcanza: cada una tiene que ser la anterior más lo repartido en la sprint y la carrera.
 * Una sanción de puntos tampoco cierra: el aviso queda frenado hasta que el autor intervenga.
 */
function standingsAddUp(d: SeasonData, round: number): boolean {
  const total = (rows: { points: number | null }[]) => rows.reduce((sum, r) => sum + (r.points ?? 0), 0)
  const awarded = total([...resultsOf(d, round, 'sprint'), ...resultsOf(d, round, 'race')])
  return (['drivers', 'constructors'] as const).every((kind) => {
    const current = standingsOf(d, round, kind)
    const previous = standingsOf(d, round - 1, kind) // en la ronda 1 no hay: vale cero
    if (current.length === 0 || (round > 1 && previous.length === 0)) return false
    return Math.abs(total(current) - total(previous) - awarded) < 0.001
  })
}

export function readyResults(d: SeasonData): Ready {
  const sessions = new Map(d.results.map((r) => [`${r.round}:${r.kind}`, r]))
  const ready = new Set<string>()
  for (const { round, kind } of sessions.values()) {
    if (kind !== 'race' || standingsAddUp(d, round)) ready.add(`${d.season}:${round}:${kind}`)
  }
  return ready
}

export function decideNotices(input: {
  sessions: SessionRow[]
  ready: Ready
  sent: ReadonlySet<string>
  now: Date
  /** Fecha de activación: sin ella, el primer arranque publicaría la temporada ya cargada. */
  notifyFrom: Date
}): Notice[] {
  const { sessions, ready, sent, notifyFrom } = input
  const now = input.now.getTime()
  const found: (Notice & { due: number })[] = []

  for (const { season, round, kind, startsAt } of sessions) {
    if (startsAt < notifyFrom) continue
    const add = (type: NoticeType, due: number) => {
      const key = `${season}:${round}:${type}`
      if (!sent.has(key)) found.push({ key, type, season, round, due })
    }

    const timed = AT_TIME[kind]
    if (timed) {
      const due = timed.due(startsAt).getTime()
      if (now >= due && now <= due + GRACE_MS) add(timed.type, due)
    }
    // Los de resultado no vencen.
    const result = RESULT[kind]
    if (result && now >= startsAt.getTime() && ready.has(`${season}:${round}:${result.kind}`)) {
      add(result.type, startsAt.getTime())
    }
  }

  return found.sort((a, b) => a.due - b.due).map(({ due, ...notice }) => notice)
}
