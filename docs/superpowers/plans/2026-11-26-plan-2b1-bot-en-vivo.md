# F1 Dash, Plan 2B-1 (bot en vivo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `@F1DashArBot` conteste los comandos desde Cloudflare, leyendo la D1 remota.

**Architecture:** Un Worker con Hono y una sola ruta, el webhook de Telegram. Valida el secreto, lee de D1 solo lo que pide cada comando, arma la respuesta con `commandReply` (Plan 2A) y la manda con `sendMessage`.

**Tech Stack:** Cloudflare Workers, Hono (`hono@^4`, dependencia nueva, elegida en el spec), D1 con Drizzle, zod, Vitest.

**Spec:** `docs/2026-11-25-f1-dash-design.md`, secciones 4.4, 4.5, 5.2 y 7.

**Fuera de este plan:** el reloj, la descarga de datos, la publicación en el canal, las alertas y la web. Hasta que exista el reloj, la base remota **no se actualiza sola**: se refresca con `npm run seed -- --remote`.

## Global Constraints

- Los comandos leen **solo la base**. Una visita o un mensaje nunca consulta Jolpica ni OpenF1.
- El webhook exige `X-Telegram-Bot-Api-Secret-Token` igual a `TELEGRAM_WEBHOOK_SECRET`, comparado en tiempo constante.
- El token y el secreto no se imprimen, no aparecen en logs ni errores y no se commitean. **El repo es público.**
- Los tests **nunca** llaman a Telegram: `cloudflareTest` carga `.dev.vars`, así que cada test inyecta su `fetcher` y sus bindings.
- Plan gratis: 10 ms de CPU por pedido. Ningún comando lee la temporada entera.
- Textos en español rioplatense. Commits en inglés y sin atribución.
- Antes de subir a GitHub, consultar al autor.

## Decisiones aprobadas (2026-11-26)

1. **`/start` con el canal privado.** El texto aprobado dice que los avisos salen en `@F1DashAr`, y hoy ese enlace no lleva a ningún lado ni publica nada. **Propuesta:** mientras no haya `CHANNEL_LINK` configurado, decir `El canal con los avisos está por abrir.`
2. **Solo chats privados.** El spec dice "responde por privado". **Propuesta:** en grupos el bot no contesta.
3. **Fotos, stickers y audios** por privado reciben la lista de comandos ("cualquier otro mensaje", spec 4.4).
4. **Menú de comandos** en Telegram (el botón `/` con `/proxima`, `/ultima` y `/campeonato`). Se registra junto con el webhook.
5. **Dirección:** `https://f1-dash.<tu-subdominio>.workers.dev`. El subdominio es el de tu cuenta (el mismo del Worker de medición) y queda visible cuando publiques la web. No se cambia en este plan.

## Review Focus

1. `TELEGRAM_WEBHOOK_SECRET` sin cargar o vacío: se rechaza todo, también un pedido sin header. (Tarea 3)
2. La base falla o está vacía: responde 200 (para que Telegram no reintente en loop), deja el error en el log y no filtra secretos. (Tarea 3)
3. Un cuerpo que no es JSON o un update de otro tipo (mensaje editado, alta en un canal): 200 y no se manda nada. (Tarea 3)
4. Entre temporadas, con la siguiente ya cargada sin resultados: `/ultima` y `/campeonato` muestran la anterior y `/proxima` la primera de la nueva. (Tarea 2)
5. Comandos que no consultan nada (`/start`, ayuda): contestan aunque D1 esté caída. (Tarea 2)

## Estructura de archivos

```
src/db/queries.ts          + loadForCommand
src/notices/commands.ts    + parseCommand, canal opcional
src/app.ts                 Hono: el webhook
src/index.ts               exporta la app
scripts/set-webhook.ts     registra webhook y menú
```

---

### Task 1: Pendientes que afectan a los comandos y `/start` sin canal

**Files:** Modify `src/notices/messages.ts`, `src/notices/commands.ts` y sus tests

**Interfaces:**
- Produces: `type Links = { channel: string | null; webUrl: string | null }`

- [ ] **Step 1: Tests que fallan:**
  - `raceTop` escapa `fastestLapTime` (`'<1>'` sale como `&lt;1&gt;`).
  - `/campeonato` con la tabla de constructores de la última ronda ausente muestra la última ronda que tiene **las dos**, sin ningún `<code class="language-…"></code>` vacío. Sin ninguna ronda completa, `Todavía no se corrió ninguna carrera.`
  - `/start` con `channel: null` dice `El canal con los avisos está por abrir.` en lugar de la línea del canal (según la decisión 1).
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. En `scripts/preview.ts`, `channel: null`.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `fix: escape fastest lap, skip incomplete standings and support a closed channel`.

### Task 2: Leer solo lo que pide cada comando

**Files:** Modify `src/db/queries.ts`, `src/notices/commands.ts`; Test `src/db/queries.test.ts`

**Interfaces:**
- Consumes: `SeasonData`, `commandReply`.
- Produces:
  - `type Command = '/start' | '/proxima' | '/ultima' | '/campeonato' | 'help'`
  - `parseCommand(text: string): Command` (en `commands.ts`; la usa también `commandReply`)
  - `loadForCommand(db: Db, command: Command, now: Date): Promise<SeasonData>`: devuelve `SeasonData` con las listas que no hacen falta vacías.
- Qué trae cada uno (en un `db.batch`, salvo la consulta que elige temporada y ronda):
  - `/start` y `help`: **ninguna consulta**.
  - `/proxima`: la próxima sesión `race` con `startsAt > now`, de **cualquier** temporada; de la suya, las carreras y las sesiones de esa ronda.
  - `/ultima`: temporada y ronda del último resultado `race` (por temporada y ronda); esa carrera, sus resultados, y pilotos y equipos de la temporada.
  - `/campeonato`: la última ronda (por temporada y ronda) con las dos tablas; esas tablas, las carreras, pilotos y equipos.

- [ ] **Step 1: Tests que fallan** (contra D1, guardando `season2026()` con las funciones `save*`):

```ts
const reply = async (command: Command, now = NOW) =>
  commandReply(command, await loadForCommand(db, command, now), now, LINKS)

it.each(['/proxima', '/ultima', '/campeonato'] as const)('%s responde igual que con la temporada entera', async (c) => {
  await save(2026)
  expect(await reply(c)).toBe(commandReply(c, await loadSeason(db, 2026), NOW, LINKS))
})
it('lee poco', async () => {
  await save(2026)
  const d = await loadForCommand(db, '/ultima', NOW)
  expect([d.results.length, d.standings.length, d.sessions.length]).toEqual([22, 0, 0])
  expect((await loadForCommand(db, '/proxima', NOW)).sessions).toHaveLength(5)
  expect((await loadForCommand(db, '/campeonato', NOW)).results).toHaveLength(0)
})
it('/start y la ayuda no tocan la base', async () => {
  const broken = {} as Db
  for (const c of ['/start', 'help'] as const) await expect(loadForCommand(broken, c, NOW)).resolves.toBeDefined()
})
it('entre temporadas', async () => {
  await save(2026)
  await saveCalendar(db, [race2027], [raceSession2027])   // 2027, ronda 1, sin resultados
  const december = new Date('2026-12-10T12:00:00Z')
  expect(await reply('/proxima', december)).toContain('(ronda 1 de 1)')
  expect(await reply('/ultima', december)).toContain('GP de Las Vegas')
  expect(await reply('/campeonato', december)).toContain('ANT')
})
it('base vacía: textos de "todavía no" y de temporada terminada', async () => {
  expect(await reply('/ultima')).toBe('Todavía no se corrió ninguna carrera.')
  expect(await reply('/proxima')).toBe('La temporada terminó. ¡Nos vemos el año que viene! 👋')
})
```

`race2027` y `raceSession2027` se arman en el test copiando la fila de la ronda 1 con `season: 2027` y `startsAt` en marzo de 2027.

- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `commandReply(command, …)` sigue aceptando el texto crudo: un `Command` es un texto válido (`'help'` cae en la ayuda).
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: load only the data each command needs`.

### Task 3: Webhook

**Files:** Create `src/app.ts`, `src/app.test.ts`; Modify `src/index.ts`, `package.json`, `wrangler.jsonc`

**Interfaces:**
- Consumes: `parseCommand`, `loadForCommand`, `commandReply`, `sendMessage`.
- Produces:
  - `type Bindings = { DB: D1Database; TELEGRAM_BOT_TOKEN: string; TELEGRAM_WEBHOOK_SECRET: string; CHANNEL_LINK?: string; WEB_URL?: string }`
  - `createApp(fetcher?: typeof fetch): Hono<{ Bindings: Bindings }>`
  - Ruta `POST /telegram/webhook`. Cualquier otra ruta o método: 404.
- Reglas:
  - Secreto ausente, vacío o distinto → 401, sin leer el cuerpo ni la base. Comparar los SHA-256 de ambos con `crypto.subtle.timingSafeEqual`.
  - Con secreto válido, **siempre 200**.
  - Del update solo se lee `message.chat.id`, `message.chat.type` y `message.text`. Se contesta solo si `chat.type === 'private'`.
  - Mensaje sin `text` → ayuda.
  - Un error de base o de envío se loguea como una línea con el comando y la causa, sin token, secreto ni id de chat.

- [ ] **Step 1: Tests que fallan:** con `app.request('/telegram/webhook', …, bindings)` y un `fetcher` que registra los envíos:
  - sin header, header distinto, y secreto `''` o `undefined` en los bindings (con y sin header) → 401 y 0 envíos;
  - `/proxima` privado → 200, un envío a ese chat con `parse_mode: 'HTML'` y el texto de `commandReply`;
  - sticker privado → ayuda; mensaje en `group` → 200 y 0 envíos;
  - cuerpo `'no es json'`, `{"edited_message":…}` y `{"my_chat_member":…}` → 200 y 0 envíos;
  - D1 que lanza con `/ultima` → 200, 0 envíos, y el log no contiene el token ni el secreto;
  - Telegram que responde 400 → 200 y el log tiene la descripción;
  - `GET /` y `GET /telegram/webhook` → 404;
  - `CHANNEL_LINK` presente aparece en `/start`.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** `npm install hono@^4`. Implementar; `src/index.ts` queda `export default createApp()`. En `wrangler.jsonc`, sin `triggers`.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Probar con `wrangler dev` y `curl`: sin header → 401; con un update `/start` cuyo `chat.type` es `group` y el header correcto → 200. (No manda nada.)
- [ ] **Step 6:** Commit `feat: answer bot commands through a Telegram webhook`.

### Task 4: Registro del webhook

**Files:** Create `scripts/set-webhook.ts`; Modify `src/telegram.ts`, `src/telegram.test.ts`, `package.json`, `README.md`

**Interfaces:**
- Produces:
  - `registerBot(token: string, url: string, secret: string, fetcher?: typeof fetch): Promise<void>`: `setWebhook` con `secret_token`, `allowed_updates: ['message']` y `drop_pending_updates: true`; después `setMyCommands` con `proxima` (`Próxima carrera`), `ultima` (`Última carrera`) y `campeonato` (`Las dos tablas`). Lanza si Telegram rechaza, sin el token en el mensaje.
  - `npm run webhook -- https://….workers.dev`: lee `.dev.vars`, exige URL `https:` y los dos valores, y agrega `/telegram/webhook`.

- [ ] **Step 1: Tests que fallan:** los dos pedidos con esos cuerpos y en ese orden; un rechazo lanza con la descripción de Telegram; un error de red lanza sin el token.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: add webhook registration script`.

### Task 5: Salir a Cloudflare

**Files:** Modify `wrangler.jsonc`, `wrangler.seed.jsonc`, `README.md`

Aprobar este plan autoriza estos pasos en la cuenta del autor.

- [ ] **Step 1:** `npx wrangler d1 list`. Si no existe `f1-dash`, `npx wrangler d1 create f1-dash`; poner el `database_id` en los dos archivos. (No tocar `f1-dash-medicion`.)
- [ ] **Step 2:** `npx wrangler d1 migrations apply f1-dash --remote` y `npm run seed -- --remote`. Verificar con las consultas del Plan 1 (23 carreras; `antonelli`, 402).
- [ ] **Step 3:** Generar `TELEGRAM_WEBHOOK_SECRET` (32 bytes al azar) en `.dev.vars` sin imprimirlo. Cargar token y secreto con `wrangler secret put`, por entrada estándar.
- [ ] **Step 4:** `npx wrangler deploy`. Comprobar: `GET /` → 404; `POST /telegram/webhook` sin header → 401.
- [ ] **Step 5:** `npm run webhook -- <url>`. Comprobar `getWebhookInfo`: URL puesta, sin `last_error_message`.
- [ ] **Step 6 (autor):** probar los cuatro comandos y un mensaje cualquiera desde el celular.
- [ ] **Step 7:** Medir el tiempo de CPU de cada comando (`wrangler tail --format json` o el panel). Anotarlo en la sección 9 del spec; si alguno supera 10 ms, arreglarlo antes de cerrar.
- [ ] **Step 8:** Commit `chore: deploy the bot to Cloudflare`.
