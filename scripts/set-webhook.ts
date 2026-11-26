// Uso: npm run webhook -- https://f1-dash.<subdominio>.workers.dev
// Lee TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_SECRET de .dev.vars; no imprime ninguno.
import { existsSync } from 'node:fs'
import { registerBot } from '../src/telegram'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

if (existsSync('.dev.vars')) process.loadEnvFile('.dev.vars')
const base = URL.parse(process.argv[2] ?? '')
if (base?.protocol !== 'https:') fail('Uso: npm run webhook -- https://…workers.dev')
const token = process.env.TELEGRAM_BOT_TOKEN || fail('Falta TELEGRAM_BOT_TOKEN en .dev.vars')
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || fail('Falta TELEGRAM_WEBHOOK_SECRET en .dev.vars')

const url = new URL('/telegram/webhook', base).href
await registerBot(token, url, secret)
console.log(`Webhook y menú registrados en ${url}`)
