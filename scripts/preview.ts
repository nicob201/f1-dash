// Muestra un mensaje armado con la base local.
// Uso: npm run avisos -- <aviso> <ronda>   |   npm run avisos -- /proxima
import { drizzle } from 'drizzle-orm/d1'
import { getPlatformProxy } from 'wrangler'
import { loadSeason } from '../src/db/queries'
import { commandReply } from '../src/notices/commands'
import type { SeasonData } from '../src/notices/data'
import type { NoticeType } from '../src/notices/decide'
import * as messages from '../src/notices/messages'

const SEASON = 2026
const LINKS = { channel: '@F1DashAr', webUrl: null }

const NOTICES: Record<NoticeType, (d: SeasonData, round: number) => string> = {
  preview: messages.previewMessage,
  quali: (d, round) => messages.qualiMessage(d, round, 'quali'),
  'sprint-quali': (d, round) => messages.qualiMessage(d, round, 'sprint_quali'),
  'sprint-start': (d, round) => messages.startMessage(d, round, 'sprint'),
  'sprint-result': messages.sprintResultMessage,
  'race-start': (d, round) => messages.startMessage(d, round, 'race'),
  'race-result': (d, round) => messages.raceResultMessage(d, round, LINKS.webUrl),
}

const [what = '', roundArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const isCommand = what.startsWith('/')
if (!isCommand && !(Object.hasOwn(NOTICES, what) && Number(roundArg) > 0)) {
  console.error(`Uso: npm run avisos -- <aviso> <ronda>\n  avisos: ${Object.keys(NOTICES).join(', ')}`)
  console.error('o:   npm run avisos -- /start | /proxima | /ultima | /campeonato')
  process.exit(1)
}

const platform = await getPlatformProxy<{ DB: D1Database }>({ configPath: 'wrangler.jsonc', remoteBindings: false })
try {
  const data = await loadSeason(drizzle(platform.env.DB), SEASON)
  if (data.races.length === 0) throw new Error('La base local está vacía: correr las migraciones y npm run seed')
  console.log(isCommand ? commandReply(what, data, new Date(), LINKS) : NOTICES[what as NoticeType](data, Number(roundArg)))
} finally {
  await platform.dispose()
}
