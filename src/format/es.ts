// Nombres y fechas como salen en los mensajes. Jolpica manda todo en inglés.
import type { ResultRow, SessionKind } from '../types'

// clave: raceName sin " Grand Prix" → [cómo se llama el GP, dónde se corre]
const GP: Record<string, [string, string]> = {
  Australian: ['de Australia', 'Australia'],
  Chinese: ['de China', 'China'],
  Japanese: ['de Japón', 'Japón'],
  Miami: ['de Miami', 'Miami'],
  Canadian: ['de Canadá', 'Canadá'],
  Monaco: ['de Mónaco', 'Mónaco'],
  Barcelona: ['de Barcelona', 'Barcelona'],
  Austrian: ['de Austria', 'Austria'],
  British: ['de Gran Bretaña', 'Gran Bretaña'],
  Belgian: ['de Bélgica', 'Bélgica'],
  Hungarian: ['de Hungría', 'Hungría'],
  Dutch: ['de los Países Bajos', 'los Países Bajos'],
  Italian: ['de Italia', 'Italia'],
  Spanish: ['de España', 'España'],
  Azerbaijan: ['de Azerbaiyán', 'Azerbaiyán'],
  'Bahrain Grand Prix in Malaysia': ['de Baréin en Malasia', 'Malasia'],
  Singapore: ['de Singapur', 'Singapur'],
  'United States': ['de Estados Unidos', 'Estados Unidos'],
  'Mexico City': ['de la Ciudad de México', 'la Ciudad de México'],
  Brazilian: ['de Brasil', 'Brasil'],
  'Las Vegas': ['de Las Vegas', 'Las Vegas'],
  Qatar: ['de Qatar', 'Qatar'],
  'Abu Dhabi': ['de Abu Dabi', 'Abu Dabi'],
}

// Los que ya son un nombre propio (Red Bull Ring, Monza…) quedan como vienen.
const CIRCUITS: Record<string, string> = {
  'Albert Park Grand Prix Circuit': 'Circuito de Albert Park',
  'Shanghai International Circuit': 'Circuito Internacional de Shanghái',
  'Suzuka Circuit': 'Circuito de Suzuka',
  'Miami International Autodrome': 'Autódromo Internacional de Miami',
  'Circuit Gilles Villeneuve': 'Circuito Gilles Villeneuve',
  'Circuit de Monaco': 'Circuito de Mónaco',
  'Circuit de Barcelona-Catalunya': 'Circuito de Barcelona-Catalunya',
  'Silverstone Circuit': 'Circuito de Silverstone',
  'Circuit de Spa-Francorchamps': 'Circuito de Spa-Francorchamps',
  'Circuit Park Zandvoort': 'Circuito de Zandvoort',
  'Baku City Circuit': 'Circuito urbano de Bakú',
  'Sepang International Circuit': 'Circuito Internacional de Sepang',
  'Marina Bay Street Circuit': 'Circuito urbano de Marina Bay',
  'Circuit of the Americas': 'Circuito de las Américas',
  'Las Vegas Strip Street Circuit': 'Circuito urbano de Las Vegas Strip',
  'Lusail International Circuit': 'Circuito Internacional de Lusail',
  'Yas Marina Circuit': 'Circuito de Yas Marina',
}

export function gpName(raceName: string) {
  const known = GP[raceName.replace(/ Grand Prix$/, '')]
  return {
    gp: known ? `GP ${known[0]}` : raceName,
    place: `en ${known ? known[1] : raceName}`,
    circuit: (name: string) => CIRCUITS[name] ?? name,
  }
}

const TEAMS: Record<string, string> = {
  'Alpine F1 Team': 'Alpine',
  'RB F1 Team': 'Racing Bulls',
  'Haas F1 Team': 'Haas',
  'Cadillac F1 Team': 'Cadillac',
}
export const teamName = (name: string): string => TEAMS[name] ?? name

const SESSIONS: Record<SessionKind, string> = {
  fp1: 'Práctica libre 1',
  fp2: 'Práctica libre 2',
  fp3: 'Práctica libre 3',
  quali: 'Clasificación',
  sprint_quali: 'Clasif. sprint',
  sprint: 'Sprint',
  race: 'Carrera',
}
export const sessionLabel = (kind: SessionKind): string => SESSIONS[kind]

const argentina = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
function parts(d: Date) {
  const p = Object.fromEntries(argentina.formatToParts(d).map((x) => [x.type, x.value]))
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), time: `${p.hour}:${p.minute}` }
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export function arDay(d: Date): string {
  const { year, month, day } = parts(d)
  return `${WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]} ${day}`
}
export const arTime = (d: Date): string => parts(d).time

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function arDate(d: Date): string {
  const { month, day } = parts(d)
  return `${day} ${MONTHS[month - 1]}`
}

// positionText de Jolpica cuando no es un puesto; los demás (R, N, F) salen como NC.
const NOT_PLACED: Record<string, string> = { W: 'NL', D: 'DSQ', E: 'DSQ' }
export const finishingLabel = (r: Pick<ResultRow, 'position' | 'positionText'>): string =>
  r.positionText === null || /^\d+$/.test(r.positionText) ? String(r.position ?? '—') : (NOT_PLACED[r.positionText] ?? 'NC')

/** 10:00 en Argentina del día anterior a la práctica libre 1. */
export function previewAt(fp1: Date): Date {
  const { year, month, day } = parts(fp1)
  return new Date(Date.UTC(year, month - 1, day - 1, 13)) // Argentina es UTC-3 y no cambia la hora
}

export const escapeHtml = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
