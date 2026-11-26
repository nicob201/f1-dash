// Traduce el JSON de Jolpica a nuestras filas. Si la forma no es la esperada, zod lanza.
import { z } from 'zod'
import type { RaceRow, SessionKind, SessionRow } from '../types'

// Jolpica manda los números como texto.
const num = z.string().regex(/^\d+(\.\d+)?$/).transform(Number)
const when = z.object({ date: z.iso.date(), time: z.string() })
const utc = (w: z.infer<typeof when>) => z.coerce.date().parse(`${w.date}T${w.time}`)

const calendarSchema = z.object({
  MRData: z.object({
    RaceTable: z.object({
      Races: z.array(
        when.extend({
          season: num,
          round: num,
          raceName: z.string(),
          Circuit: z.object({ circuitName: z.string(), Location: z.object({ locality: z.string(), country: z.string() }) }),
          FirstPractice: when.optional(),
          SecondPractice: when.optional(),
          ThirdPractice: when.optional(),
          Qualifying: when.optional(),
          SprintQualifying: when.optional(),
          Sprint: when.optional(),
        }),
      ),
    }),
  }),
})

const SESSION_KEYS = [
  ['FirstPractice', 'fp1'],
  ['SecondPractice', 'fp2'],
  ['ThirdPractice', 'fp3'],
  ['Qualifying', 'quali'],
  ['SprintQualifying', 'sprint_quali'],
  ['Sprint', 'sprint'],
] as const

export function parseCalendar(body: unknown): { races: RaceRow[]; sessions: SessionRow[] } {
  const races: RaceRow[] = []
  const sessions: SessionRow[] = []
  for (const r of calendarSchema.parse(body).MRData.RaceTable.Races) {
    const { season, round } = r
    const { locality, country } = r.Circuit.Location
    races.push({ season, round, name: r.raceName, circuit: r.Circuit.circuitName, locality, country })
    const add = (kind: SessionKind, w: z.infer<typeof when>) =>
      sessions.push({ season, round, kind, startsAt: utc(w), openf1Key: null })
    for (const [key, kind] of SESSION_KEYS) if (r[key]) add(kind, r[key])
    add('race', r)
  }
  return { races, sessions }
}
