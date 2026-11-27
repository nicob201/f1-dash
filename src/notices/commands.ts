// Respuestas del bot por privado. Leen solo lo que ya está en la base.
import { escapeHtml, gpName } from '../format/es'
import { lastCompleteStandingsRound, raceOf, type SeasonData } from './data'
import { eventDetail, raceTop, standingsBlocks } from './messages'

/** `channel: null` mientras el canal no esté abierto. */
export type Links = { channel: string | null; webUrl: string | null }

const COMMANDS = '/proxima · próxima carrera\n/ultima · última carrera\n/campeonato · las dos tablas'
const NO_RACES = 'Todavía no se corrió ninguna carrera.'

const gp = (d: SeasonData, round: number) => escapeHtml(gpName(raceOf(d, round).name).gp)
const lastRound = (rows: { round: number }[]) => (rows.length ? Math.max(...rows.map((r) => r.round)) : null)

function welcome({ channel, webUrl }: Links): string {
  const web = webUrl ? `\n\n<a href="${escapeHtml(webUrl)}">Ver la web</a>` : ''
  const where = channel
    ? `Los avisos de cada fin de semana salen en el canal ${escapeHtml(channel)}.`
    : 'El canal con los avisos está por abrir.'
  return `¡Hola! Soy el bot de F1 Dash 🏎️\n${where}\n\n${COMMANDS}${web}`
}

function next(d: SeasonData, now: Date): string {
  const [race] = d.sessions
    .filter((s) => s.kind === 'race' && s.startsAt > now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  if (!race) return 'La temporada terminó. ¡Nos vemos el año que viene! 👋'
  return `📅 <b>Próxima: ${gp(d, race.round)}</b> (ronda ${race.round} de ${d.races.length})\n${eventDetail(d, race.round)}`
}

function last(d: SeasonData): string {
  const round = lastRound(d.results.filter((r) => r.kind === 'race'))
  return round === null ? NO_RACES : `🏁 <b>${gp(d, round)}: resultado</b>\n\n${raceTop(d, round)}`
}

function championship(d: SeasonData): string {
  const round = lastCompleteStandingsRound(d)
  return round === null ? NO_RACES : standingsBlocks(d, round, false)
}

export type Command = '/start' | '/proxima' | '/ultima' | '/campeonato' | 'help'
const KNOWN: readonly Command[] = ['/start', '/proxima', '/ultima', '/campeonato']

export function parseCommand(text: string): Command {
  // "/Proxima@F1DashArBot ahora" → "/proxima"
  const word = text.trim().split(/[\s@]/)[0]!.toLowerCase()
  return KNOWN.find((c) => c === word) ?? 'help'
}

export function commandReply(text: string, d: SeasonData, now: Date, links: Links): string {
  const command = parseCommand(text)
  if (command === '/start') return welcome(links)
  if (command === '/proxima') return next(d, now)
  if (command === '/ultima') return last(d)
  if (command === '/campeonato') return championship(d)
  return `Comandos:\n${COMMANDS}`
}
