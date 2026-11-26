// Textos de los avisos del canal, para parse_mode HTML. Las tablas van en <pre> y no pasan de 32 columnas.
import { decidedAt } from '../champion'
import { arDay, arTime, escapeHtml, gpName, sessionLabel, teamName } from '../format/es'
import type { ResultRow, StandingRow } from '../types'
import { raceOf, resultsOf, standingsOf, type SeasonData } from './data'

// Con "lenguaje", Telegram pone una barra con ese título: ahí va su botón de copiar y no tapa datos.
// El título es una sola palabra sin acentos.
const pre = (title: string, lines: string[]) =>
  `<pre><code class="language-${title}">${escapeHtml(lines.join('\n'))}</code></pre>`
const name = (d: SeasonData, round: number) => gpName(raceOf(d, round).name)
const gp = (d: SeasonData, round: number) => escapeHtml(name(d, round).gp)

const code = (d: SeasonData, driverId: string) =>
  d.drivers.find((x) => x.driverId === driverId)?.code ?? driverId.slice(0, 3).toUpperCase()
const team = (d: SeasonData, constructorId: string) =>
  teamName(d.constructors.find((x) => x.constructorId === constructorId)?.name ?? constructorId)

const place = (position: number | null) => String(position ?? '—').padStart(2)
// positionText de Jolpica cuando no es un puesto; los demás (R, N, F) salen como NC.
const NOT_PLACED: Record<string, string> = { W: 'NL', D: 'DSQ', E: 'DSQ' }
const finishing = (r: ResultRow) =>
  r.positionText === null || /^\d+$/.test(r.positionText) ? String(r.position ?? '—') : (NOT_PLACED[r.positionText] ?? 'NC')

/** La columna de puesto de una tabla de resultados; si hay un DSQ se ensancha para todas las filas. */
function finishingColumn(rows: ResultRow[]): (r: ResultRow) => string {
  const width = Math.max(2, ...rows.map((r) => finishing(r).length))
  return (r) => finishing(r).padStart(width)
}

const row = (position: string, driver: string, teamLabel: string, extra = '') =>
  `${position} ${driver}  ${teamLabel.padEnd(12)}${extra}`.trimEnd()

export function scheduleBlock(d: SeasonData, round: number): string {
  return pre(
    'Horarios',
    d.sessions
      .filter((s) => s.round === round)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((s) => `${arDay(s.startsAt).padEnd(6)}  ${sessionLabel(s.kind).padEnd(16)}  ${arTime(s.startsAt)}`),
  )
}

/** Circuito, horarios y la aclaración. Lo comparten la previa y /proxima. */
export const eventDetail = (d: SeasonData, round: number): string =>
  `${escapeHtml(name(d, round).circuit(raceOf(d, round).circuit))}\n\n${scheduleBlock(d, round)}\nHorarios de Argentina.`

export const previewMessage = (d: SeasonData, round: number): string =>
  `🗓️ <b>Se viene el ${gp(d, round)}</b> (ronda ${round} de ${d.races.length})\n${eventDetail(d, round)}`

export function qualiMessage(d: SeasonData, round: number, kind: 'quali' | 'sprint_quali'): string {
  const title = kind === 'quali' ? 'clasificación' : 'clasificación sprint'
  const results = resultsOf(d, round, kind)
  const column = finishingColumn(results)
  const lines = results.map((r) =>
    row(column(r), code(d, r.driverId), team(d, r.constructorId), `  ${r.q3 ?? r.q2 ?? r.q1 ?? '—'}`),
  )
  return `⏱️ <b>${gp(d, round)}: ${title}</b>\n\n${pre('Tiempos', lines)}`
}

export function startMessage(d: SeasonData, round: number, kind: 'race' | 'sprint'): string {
  const where = escapeHtml(name(d, round).place)
  const title = `🚦 <b>Hora de ${kind === 'race' ? 'largada' : 'la sprint'} ${where}</b>`
  const quali = resultsOf(d, round, kind === 'race' ? 'quali' : 'sprint_quali')

  const official = d.grids.filter((g) => g.round === round && g.kind === kind).sort((a, b) => a.position - b.position)
  const grid = official.length ? official : quali.filter((r) => r.position !== null).map((r) => ({ position: r.position!, carNumber: r.carNumber }))
  if (grid.length === 0) return title

  const lines = grid.map((g) => {
    // Primero cómo corrió este fin de semana; si no, el piloto con ese número.
    const who = quali.find((r) => r.carNumber === g.carNumber) ?? d.drivers.find((x) => x.carNumber === g.carNumber)
    return who ? row(place(g.position), code(d, who.driverId), team(d, who.constructorId)) : `${place(g.position)} #${g.carNumber}`
  })
  const note = official.length ? '' : '\nOrden según la clasificación; puede cambiar por penalizaciones.'
  return `${title}\n\nGrilla de salida\n${pre('Grilla', lines)}${note}`
}

function scoreRows(d: SeasonData, results: ResultRow[]): string[] {
  const column = finishingColumn(results)
  return results.map((r) =>
    row(column(r), code(d, r.driverId), team(d, r.constructorId), r.points ? `  ${String(r.points).padStart(2)}` : ''),
  )
}

export const sprintResultMessage = (d: SeasonData, round: number): string =>
  `⚡ <b>${gp(d, round)}: resultado de la sprint</b>\n\n${pre('Sprint', scoreRows(d, resultsOf(d, round, 'sprint')))}`

/** Top 10 de la carrera y la vuelta rápida. */
export function raceTop(d: SeasonData, round: number): string {
  const results = resultsOf(d, round, 'race')
  const fastest = results.find((r) => r.fastestLapRank === 1)
  const lap = fastest?.fastestLapTime ? `\nVuelta rápida: ${escapeHtml(code(d, fastest.driverId))}, ${fastest.fastestLapTime}` : ''
  return pre('Carrera', scoreRows(d, results.slice(0, 10))) + lap
}

/** Las dos tablas. `+N` son los puntos de la fecha, incluida la sprint. */
export function standingsBlocks(d: SeasonData, round: number, withGains: boolean): string {
  const gain = (s: StandingRow) => {
    const previous = standingsOf(d, round - 1, s.kind)
    // Sin la tabla anterior no se sabe cuánto sumó en la fecha.
    if (!withGains || (round > 1 && previous.length === 0)) return ''
    const points = s.points - (previous.find((p) => p.entityId === s.entityId)?.points ?? 0)
    return points > 0 ? `  ${`+${points}`.padStart(3)}` : ''
  }
  const drivers = standingsOf(d, round, 'drivers')
    .slice(0, 10)
    .map((s) => `${place(s.position)} ${code(d, s.entityId)}  ${String(s.points).padStart(3)}${gain(s)}`)
  const constructors = standingsOf(d, round, 'constructors').map(
    (s) => `${place(s.position)} ${team(d, s.entityId).padEnd(12)}  ${String(s.points).padStart(3)}${gain(s)}`,
  )
  return `🏆 <b>Pilotos</b>\n${pre('Pilotos', drivers)}\n\n🔧 <b>Constructores</b>\n${pre('Constructores', constructors)}`
}

function championLines(d: SeasonData, round: number): string {
  const lines: string[] = []
  const driverId = decidedAt(d.standings, d.sessions, round, 'drivers')
  const driver = d.drivers.find((x) => x.driverId === driverId)
  if (driver) lines.push(`\n👑 <b>${escapeHtml(`${driver.givenName} ${driver.familyName}`)} es campeón del mundo</b>`)
  const constructorId = decidedAt(d.standings, d.sessions, round, 'constructors')
  if (constructorId) lines.push(`\n👑 <b>${escapeHtml(team(d, constructorId))} es campeón del mundo de constructores</b>`)
  return lines.join('')
}

export function raceResultMessage(d: SeasonData, round: number, webUrl: string | null): string {
  const link = webUrl
    ? `\n\nTodo el detalle en <a href="${escapeHtml(`${webUrl}/carreras/${d.season}/${round}`)}">la web</a>`
    : ''
  return (
    `🏁 <b>${gp(d, round)}: resultado</b>${championLines(d, round)}\n\n` +
    `${raceTop(d, round)}\n\n${standingsBlocks(d, round, true)}${link}`
  )
}
