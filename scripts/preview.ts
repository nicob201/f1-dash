// Muestra un mensaje armado con la base local.
// Uso: npm run avisos -- <aviso> <ronda>   |   npm run avisos -- /proxima
//   --enviar   además lo manda a ADMIN_CHAT_ID, solo si es un chat privado (nunca al canal)
//   --mi-chat  muestra los ids de los chats privados que le escribieron al bot
import { existsSync } from 'node:fs'
import { loadSeason } from '../src/db/queries'
import { commandReply } from '../src/notices/commands'
import type { SeasonData } from '../src/notices/data'
import type { NoticeType } from '../src/notices/decide'
import * as messages from '../src/notices/messages'
import { isPrivateChat, sendMessage } from '../src/telegram'
import { openDb } from './db'

const SEASON = 2026
const LINKS = { channel: null, webUrl: null }

const NOTICES: Record<NoticeType, (d: SeasonData, round: number) => string> = {
  preview: messages.previewMessage,
  quali: (d, round) => messages.qualiMessage(d, round, 'quali'),
  'sprint-quali': (d, round) => messages.qualiMessage(d, round, 'sprint_quali'),
  'sprint-start': (d, round) => messages.startMessage(d, round, 'sprint'),
  'sprint-result': messages.sprintResultMessage,
  'race-start': (d, round) => messages.startMessage(d, round, 'race'),
  'race-result': (d, round) => messages.raceResultMessage(d, round, LINKS.webUrl),
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function botToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || fail('Falta TELEGRAM_BOT_TOKEN en .dev.vars')
}

/** Imprime solo ids: ni nombres, ni textos, ni el token. */
async function showMyChat(token: string): Promise<void> {
  const ids = new Set<number>()
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { signal: AbortSignal.timeout(8000) })
    const data = (await res.json()) as {
      ok: boolean
      description?: string
      result?: { message?: { chat: { id: number; type: string } } }[]
    }
    if (!data.ok) fail(`Telegram: ${res.status} ${data.description}`)
    for (const u of data.result ?? []) if (u.message?.chat.type === 'private') ids.add(u.message.chat.id)
  } catch (e) {
    fail(`No se pudo consultar Telegram: ${(e as Error).name}`)
  }
  console.log(
    ids.size
      ? `Chats privados: ${[...ids].join(', ')}\nPoné el tuyo en ADMIN_CHAT_ID dentro de .dev.vars`
      : 'Nadie le escribió al bot en las últimas 24 h. Mandale /start y volvé a correr esto.',
  )
}

const args = process.argv.slice(2)
if (existsSync('.dev.vars')) process.loadEnvFile('.dev.vars')
if (args.includes('--mi-chat')) {
  await showMyChat(botToken())
  process.exit(0)
}

const send = args.includes('--enviar')
// Antes de armar nada: si el destino no es un chat privado, no se manda ni se consulta.
const chatId = process.env.ADMIN_CHAT_ID ?? ''
if (send && !isPrivateChat(chatId)) fail('--enviar solo manda a un chat privado: ADMIN_CHAT_ID tiene que ser un id numérico positivo')
const token = send ? botToken() : ''

const [what = '', roundArg] = args.filter((a) => !a.startsWith('--'))
const isCommand = what.startsWith('/')
if (!isCommand && !(Object.hasOwn(NOTICES, what) && Number(roundArg) > 0)) {
  console.error(`Uso: npm run avisos -- <aviso> <ronda>\n  avisos: ${Object.keys(NOTICES).join(', ')}`)
  console.error('o:   npm run avisos -- /start | /proxima | /ultima | /campeonato')
  process.exit(1)
}

const { db, dispose } = await openDb(false)
try {
  const data = await loadSeason(db, SEASON)
  if (data.races.length === 0) throw new Error('La base local está vacía: correr las migraciones y npm run seed')
  const text = isCommand ? commandReply(what, data, new Date(), LINKS) : NOTICES[what as NoticeType](data, Number(roundArg))
  console.log(text)
  if (send) {
    const result = await sendMessage(token, chatId, text)
    if (result.ok) console.log('\nEnviado a tu chat privado.')
    else {
      console.error(`\nNo se envió: ${result.status ?? 'sin respuesta'} ${result.description}`)
      process.exitCode = 1
    }
  }
} finally {
  await dispose()
}
