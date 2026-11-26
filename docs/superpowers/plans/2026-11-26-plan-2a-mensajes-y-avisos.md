# F1 Dash, Plan 2A (mensajes y avisos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Armar todos los textos del canal y del bot, decidir qué aviso toca en cada momento y poder ver los mensajes en el celular del autor.

**Architecture:** Funciones puras sobre las filas de D1: nombres en español, campeón, builders de mensajes y `decideNotices`. Un lector de la base y un script de vista previa que imprime los mensajes con datos reales y, si se le pide, los manda **solo al chat privado del autor**.

**Tech Stack:** TypeScript, Drizzle sobre D1, Vitest, Telegram Bot API con `fetch`.

**Spec:** `docs/2026-11-25-f1-dash-design.md`, secciones 4 y 6.2.

**Fuera de este plan (2B, depende de decidir la descarga de datos):** cuándo consultar las fuentes, el Cron, la tabla `notices` y el reclamo de avisos, el webhook, el deploy y publicar en el canal.

## Global Constraints

- Textos en español rioplatense. Horarios en `America/Argentina/Buenos_Aires`.
- `parse_mode: HTML`. Las tablas van en `<pre>`; ninguna línea dentro de un `<pre>` supera **32 caracteres**.
- Todo texto que venga de la base se escapa (`&`, `<`, `>`).
- Un mensaje no puede superar los 4096 caracteres.
- El aviso de largada dice "hora de largada", nunca "largó".
- Nada de logos ni tipografía de F1; nada que suene oficial.
- **Ningún código de este plan escribe en el canal.** El envío de prueba acepta solo ids de chat privado (enteros positivos).
- El token no se imprime ni aparece en errores. Vive en `.dev.vars`, que está en `.gitignore`.
- Sin dependencias nuevas.
- Commits sin atribución a Claude.

## Decisiones aprobadas (2026-11-26)

El autor aprobó las cinco con la opción propuesta, y los ejemplos de abajo.

1. **Avisos viejos.** El spec dice que los avisos de resultado no vencen. Sin un límite, el primer arranque del reloj publicaría en el canal los resultados de las 21 rondas ya cargadas. **Propuesta:** `notifyFrom`, la fecha de activación. Solo hay avisos de sesiones que empiezan desde esa fecha.
2. **Largada sin grilla.** Si a la hora de largada no hay grilla de OpenF1 ni clasificación, **propuesta:** el aviso sale igual, sin la tabla, porque lo importante es la hora. Alternativa: esperar hasta 30 minutos a que aparezca.
3. **Nombres en español.** GP y circuitos traducidos con un mapa fijo (como en el ejemplo del spec); equipos acortados (`Alpine F1 Team` → `Alpine`, `RB F1 Team` → `Racing Bulls`). Un nombre que no esté en el mapa sale como lo manda Jolpica.
4. **La previa vence** a los 30 minutos, como la largada: es un aviso por horario.
5. **Última fecha.** Sin carreras por delante, campeón es el P1 de la tabla (Jolpica ya aplica el desempate).

## Ejemplos para aprobar

Se ven así en Telegram (`**x**` es negrita; los bloques son `<pre>`). Datos reales; los horarios son de Argentina.

**Previa**

> 🗓️ **Se viene el GP de Qatar** (ronda 22 de 23)
> Circuito Internacional de Lusail

```
Vie 27  Práctica libre 1  10:30
Vie 27  Práctica libre 2  14:00
Sáb 28  Práctica libre 3  11:30
Sáb 28  Clasificación     15:00
Dom 29  Carrera           13:00
```

> Horarios de Argentina.

**Clasificación** (completa; acá recortada). La sprint se titula `clasificación sprint`.

> ⏱️ **GP de Las Vegas: clasificación**

```
 1 ANT  Mercedes      1:33.893
 2 VER  Red Bull      1:34.151
 3 RUS  Mercedes      1:34.224
```

**Largada.** La sprint dice `🚦 Hora de la sprint en Singapur`.

> 🚦 **Hora de largada en Las Vegas**
>
> Grilla de salida

```
 1 VER  Red Bull
 2 RUS  Mercedes
 3 NOR  McLaren
```

Con el plan B se agrega: `Orden según la clasificación; puede cambiar por penalizaciones.`

**Resultado de la carrera.** `+N` son los puntos sumados en la fecha (incluye la sprint) y solo aparece si N > 0.

> 🏁 **GP de Las Vegas: resultado**

```
 1 VER  Red Bull      25
 2 NOR  McLaren       18
 3 PIA  McLaren       15
```

> Vuelta rápida: LAW, 1:35.591
>
> 🏆 **Pilotos**

```
 1 ANT  402  +12
 2 VER  304  +25
 3 HAM  267   +6
```

> 🔧 **Constructores**

```
 1 Mercedes      666  +14
 2 Ferrari       517   +7
 3 Red Bull      440  +25
```

> Todo el detalle en [la web]

Si el título se define en esa fecha, debajo del título del mensaje van `👑 **Andrea Kimi Antonelli es campeón del mundo**` y/o `👑 **Mercedes es campeón del mundo de constructores**`.

**Resultado de la sprint:** `⚡ **GP de Singapur: resultado de la sprint**` y la lista completa, con puntos solo para quienes sumaron. En clasificaciones y resultados completos, quien no clasificó lleva `NC` y quien no largó, `NL`.

**`/start`**

> ¡Hola! Soy el bot de F1 Dash 🏎️
> Los avisos de cada fin de semana salen en el canal @F1DashAr.
>
> /proxima · próxima carrera
> /ultima · última carrera
> /campeonato · las dos tablas

Cuando exista la web, `/start` suma su link.

**`/proxima`** es la previa con el título `📅 **Próxima: GP de Qatar** (ronda 22 de 23)`; sin carreras por delante: `La temporada terminó. ¡Nos vemos el año que viene! 👋`. **`/ultima`** es el resultado sin las tablas. **`/campeonato`** son las dos tablas sin `+N`. **Cualquier otra cosa:** la lista de comandos.

## Review Focus

1. Primer arranque con la temporada ya cargada: no sale ningún aviso de sesiones anteriores a `notifyFrom`. (Tarea 6)
2. FP1 de madrugada en UTC (Las Vegas: 20/11 00:30Z es jueves 19 en Argentina): la previa sale el 18 a las 10:00 y los días se muestran en hora argentina. (Tareas 2 y 6)
3. La grilla trae un número de auto sin piloto en la base (un suplente que debuta): se muestra `#NN` y el mensaje sale. (Tarea 4)
4. Faltan las tablas de la ronda, o solo está una: el resultado de la carrera no sale todavía. (Tarea 6)
5. Un id de canal en `ADMIN_CHAT_ID`: el envío de prueba se niega a mandar. (Tarea 8)

## Estructura de archivos

```
src/format/es.ts          nombres y fechas en español
src/champion.ts           quién puede ser campeón
src/notices/data.ts       SeasonData y lo que se deriva de ella
src/notices/messages.ts   avisos del canal
src/notices/commands.ts   respuestas del bot
src/notices/decide.ts     qué aviso toca
src/db/queries.ts         lectura de la temporada
src/telegram.ts           sendMessage
scripts/preview.ts        vista previa y envío de prueba
```

---

### Task 1: Pendientes de la revisión del Plan 1

**Files:**
- Modify: `src/sources/http.ts`, `src/sources/http.test.ts`, `src/sources/jolpica.ts`, `src/sources/jolpica.test.ts`, `src/sources/openf1.test.ts`

- [ ] **Step 1: Tests que fallan:** un 200 con HTML lanza un error **con la URL**; en 404, 429, 403 y en los 429 que reintenta `retrying429`, el cuerpo queda cancelado o consumido (`res.bodyUsed === true`); `parseCalendar` con un `time` sin `Z` lanza. El test de Miami pasa a `toBe(11280)` (ya pasa: es un ajuste de aserción).
- [ ] **Step 2:** `npm test`. Esperado: FAIL en los tests nuevos.
- [ ] **Step 3:** `await res.body?.cancel()` en las salidas sin lectura; envolver `res.json()` con la URL y `cause`; validar la fecha unida con `z.iso.datetime()`.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `fix: errores con url y cuerpos sin leer`.

### Task 2: Nombres y fechas en español

**Files:** Create `src/format/es.ts`; Test `src/format/es.test.ts`

**Interfaces:**
- Produces:
  - `gpName(raceName: string): { gp: string; place: string; circuit(fallback: string): string }`. `gp` = `GP de Qatar`; `place` = `en Qatar`.
  - `teamName(name: string): string`
  - `sessionLabel(kind: SessionKind): string`: `Práctica libre 1/2/3`, `Clasificación`, `Clasif. sprint`, `Sprint`, `Carrera`
  - `arDay(d: Date): string` → `Vie 27`; `arTime(d: Date): string` → `10:30`
  - `previewAt(fp1: Date): Date`: las 10:00 argentinas del día anterior al día argentino de `fp1`.
  - `escapeHtml(s: string): string`
- Mapa (`raceName` sin ` Grand Prix` → `gp`, `place`): Australian, Chinese (China), Japanese (Japón), Miami, Canadian (Canadá), Monaco (Mónaco), Barcelona, Austrian, British (Gran Bretaña), Belgian (Bélgica), Hungarian (Hungría), Dutch (`GP de los Países Bajos`, `en los Países Bajos`), Italian, Spanish (España), Azerbaijan (Azerbaiyán), `Bahrain Grand Prix in Malaysia` (`GP de Baréin en Malasia`, `en Malasia`), Singapore (Singapur), United States (`GP de Estados Unidos`), Mexico City (`GP de la Ciudad de México`, `en la Ciudad de México`), Brazilian (`GP de Brasil`), Las Vegas, Qatar, Abu Dhabi (Abu Dabi).
- Circuitos: traducir solo la parte genérica y dejar el nombre propio (`Lusail International Circuit` → `Circuito Internacional de Lusail`, `Yas Marina Circuit` → `Circuito de Yas Marina`). Los que ya son nombre propio (`Red Bull Ring`, `Hungaroring`, `Madring`, `Autodromo Nazionale di Monza`, `Autódromo Hermanos Rodríguez`, `Autódromo José Carlos Pace`) quedan igual.

- [ ] **Step 1: Tests que fallan**

```ts
it('GP y lugar', () => {
  expect(gpName('Qatar Grand Prix')).toMatchObject({ gp: 'GP de Qatar', place: 'en Qatar' })
  expect(gpName('Dutch Grand Prix').place).toBe('en los Países Bajos')
  expect(gpName('Qatar Grand Prix').circuit('Lusail International Circuit')).toBe('Circuito Internacional de Lusail')
})
it('las 23 carreras de 2026 están traducidas', () => {
  for (const r of parseCalendar(calendar).races) expect(gpName(r.name).gp).toMatch(/^GP de /)
})
it('un GP desconocido sale como viene', () => {
  expect(gpName('Moon Grand Prix')).toMatchObject({ gp: 'Moon Grand Prix', place: 'en Moon Grand Prix' })
  expect(gpName('Moon Grand Prix').circuit('Crater Ring')).toBe('Crater Ring')
})
it('hora argentina, cruzando el día', () => {
  const d = new Date('2026-11-20T00:30:00Z')
  expect([arDay(d), arTime(d)]).toEqual(['Jue 19', '21:30'])
})
it('previa: 10:00 del día argentino anterior a FP1', () => {
  expect(previewAt(new Date('2026-11-27T13:30:00Z')).toISOString()).toBe('2026-11-26T13:00:00.000Z')
  expect(previewAt(new Date('2026-11-20T00:30:00Z')).toISOString()).toBe('2026-11-18T13:00:00.000Z')
  expect(previewAt(new Date('2026-12-01T12:00:00Z')).toISOString()).toBe('2026-11-30T13:00:00.000Z')
})
it('escapa HTML', () => {
  expect(escapeHtml('a<b>&c')).toBe('a&lt;b&gt;&amp;c')
})
```

- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar con `Intl.DateTimeFormat` en la zona del spec para sacar las partes; los nombres de los días van en un array propio.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: nombres y fechas en español`.

### Task 3: Campeón

**Files:** Create `src/champion.ts`; Test `src/champion.test.ts`

**Interfaces:**
- Consumes: `StandingRow`, `SessionRow`.
- Produces (los usa también la web):
  - `type Remaining = { races: number; sprints: number }`
  - `remainingAfter(sessions: SessionRow[], round: number): Remaining`
  - `maxPoints(r: Remaining, kind: StandingRow['kind']): number`: pilotos `25/8`, constructores `43/15`
  - `contenders(table: StandingRow[], r: Remaining): StandingRow[]`: de una sola ronda y un solo `kind`. Tiene chances quien con el máximo iguala o supera al líder. Sin carreras ni sprints por delante, solo `position === 1`. Tabla vacía → `[]`.
  - `decidedAt(standings: StandingRow[], sessions: SessionRow[], round: number, kind: StandingRow['kind']): string | null`: el `entityId` solo si después de `round` queda un candidato y después de `round - 1` quedaba más de uno. Si falta la tabla de la ronda anterior (y `round > 1`) → `null`.
- `// ponytail:` sin desempate por victorias mientras queden fechas.

- [ ] **Step 1: Tests que fallan**

```ts
const row = (round: number, entityId: string, points: number, position: number): StandingRow =>
  ({ season: 2026, round, kind: 'drivers', entityId, points, position, wins: 0 })
// calendario: rondas 1 a 3; la 3 tiene sprint
const s = (round: number, kind: SessionKind): SessionRow =>
  ({ season: 2026, round, kind, startsAt: new Date(0), openf1Key: null })
const cal = [s(1, 'race'), s(2, 'race'), s(3, 'sprint'), s(3, 'race')]

it('lo que queda en juego', () => {
  expect(remainingAfter(cal, 1)).toEqual({ races: 2, sprints: 1 })
  expect(maxPoints({ races: 2, sprints: 1 }, 'drivers')).toBe(58)
  expect(maxPoints({ races: 2, sprints: 1 }, 'constructors')).toBe(101)
})
it('empatar alcanza para seguir en carrera', () => {
  const t = [row(2, 'a', 100, 1), row(2, 'b', 67, 2), row(2, 'c', 66, 3)]
  expect(contenders(t, { races: 1, sprints: 1 }).map((x) => x.entityId)).toEqual(['a', 'b'])
})
it('sin fechas por delante gana el P1 aunque haya empate', () => {
  expect(contenders([row(3, 'a', 100, 1), row(3, 'b', 100, 2)], { races: 0, sprints: 0 }).map((x) => x.entityId)).toEqual(['a'])
})
it('se anuncia solo en la fecha en que se define', () => {
  const st = [row(1, 'a', 25, 1), row(1, 'b', 18, 2), row(2, 'a', 100, 1), row(2, 'b', 36, 2), row(3, 'a', 125, 1), row(3, 'b', 54, 2)]
  expect([1, 2, 3].map((r) => decidedAt(st, cal, r, 'drivers'))).toEqual([null, 'a', null])
})
it('sin tabla no afirma nada', () => {
  expect(contenders([], { races: 1, sprints: 0 })).toEqual([])
  expect(decidedAt([row(2, 'a', 100, 1)], cal, 2, 'drivers')).toBeNull()
})
```

- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `position` puede ser `null`.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: lógica de campeón`.

### Task 4: Avisos del canal

**Files:**
- Create: `src/notices/data.ts`, `src/notices/messages.ts`, `src/notices/__fixtures__/season.ts`
- Test: `src/notices/messages.test.ts`

**Interfaces:**
- Consumes: tareas 2 y 3, y las filas de `src/types.ts`.
- Produces:
  - `type SeasonData = { season: number; races: RaceRow[]; sessions: SessionRow[]; drivers: DriverRow[]; constructors: ConstructorRow[]; results: ResultRow[]; standings: StandingRow[]; grids: GridRow[] }`
  - `season.ts` exporta `season2026(): SeasonData`, armado con los parsers y fixtures del Plan 1 (calendario; resultado y clasificación de la ronda 21; tablas de la 21).
  - `previewMessage(d, round): string`
  - `qualiMessage(d, round, kind: 'quali' | 'sprint_quali'): string`
  - `startMessage(d, round, kind: 'race' | 'sprint'): string`
  - `sprintResultMessage(d, round): string`
  - `raceResultMessage(d, round, webUrl: string | null): string`
  - Piezas que reusa la Tarea 5: `scheduleBlock(d, round): string`, `raceTop(d, round): string`, `standingsBlocks(d, round, withGains: boolean): string`
- Reglas:
  - Textos exactamente como en "Ejemplos para aprobar". Columnas: posición a 2, código a 3, equipo a 12.
  - Grilla: primero las filas de `grids`; si no hay, el orden de la clasificación (`quali` o `sprint_quali`) con la aclaración; si no hay ninguna, solo el título.
  - Grilla: el piloto se busca por `carNumber`; sin piloto → `#NN` sin equipo.
  - Clasificación: el tiempo es `q3 ?? q2 ?? q1 ?? '—'`; `position: null` va al final con `—`.
  - `+N` = puntos de la ronda menos los de la anterior (en la ronda 1, todos). Si falta la tabla anterior, no hay `+N`.
  - Pilotos: top 10. Constructores: completo. Sin `webUrl` no hay línea del link.

- [ ] **Step 1: Tests que fallan:** para cada builder, el texto completo esperado en un caso, escrito a partir de los ejemplos, y estas aserciones:

```ts
const d = season2026()
const pre = (m: string) => [...m.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].flatMap((x) => x[1]!.split('\n'))

it('previa de Qatar', () => {
  expect(previewMessage(d, 22)).toBe(
    '🗓️ <b>Se viene el GP de Qatar</b> (ronda 22 de 23)\nCircuito Internacional de Lusail\n\n<pre>' +
    'Vie 27  Práctica libre 1  10:30\nVie 27  Práctica libre 2  14:00\nSáb 28  Práctica libre 3  11:30\n' +
    'Sáb 28  Clasificación     15:00\nDom 29  Carrera           13:00</pre>\nHorarios de Argentina.')
})
it('resultado de Las Vegas', () => {
  const m = raceResultMessage(d, 21, 'https://example.test')
  expect(pre(m)).toContain(' 1 VER  Red Bull      25')
  expect(m).toContain('Vuelta rápida: LAW, 1:35.591')
  expect(m).toContain('https://example.test/carreras/2026/21')
  expect(pre(m).filter((l) => /^ ?\d+ [A-Z]{3}  \d/.test(l))).toHaveLength(10)
})
it('clasificación completa', () => {
  const lines = pre(qualiMessage(d, 21, 'quali'))
  expect(lines).toHaveLength(22)
  expect(lines[0]).toBe(' 1 ANT  Mercedes      1:33.893')
  expect(lines[21]).toBe('22 BEA  Haas          1:48.005')
})
it('largada: grilla, plan B y sin datos', () => {
  const grid: GridRow[] = [{ season: 2026, round: 21, kind: 'race', carNumber: 3, position: 1, source: 'openf1' },
    { season: 2026, round: 21, kind: 'race', carNumber: 99, position: 2, source: 'openf1' }]
  const m = startMessage({ ...d, grids: grid }, 21, 'race')
  expect(pre(m)).toEqual([' 1 VER  Red Bull', ' 2 #99'])
  expect(m).not.toContain('según la clasificación')
  expect(startMessage(d, 21, 'race')).toContain('Orden según la clasificación; puede cambiar por penalizaciones.')
  expect(startMessage(d, 22, 'race')).toBe('🚦 <b>Hora de largada en Qatar</b>')
  expect(startMessage(d, 21, 'race')).not.toMatch(/largó/i)
})
it('la línea de campeón aparece solo en la fecha que define', () => {
  expect(raceResultMessage(d, 21, null)).not.toContain('👑')
  // tablas armadas para que el título se defina en la 21: ronda 20 con la diferencia justo alcanzable
  expect(raceResultMessage(withTitleDecidedAt21(d), 21, null)).toContain('👑 <b>Andrea Kimi Antonelli es campeón del mundo</b>')
})
it('ancho, tamaño y escape', () => {
  const all = [previewMessage(d, 22), qualiMessage(d, 21, 'quali'), startMessage(d, 21, 'race'), raceResultMessage(d, 21, 'https://example.test')]
  for (const m of all) {
    expect(m.length).toBeLessThanOrEqual(4096)
    for (const l of pre(m)) expect(l.length).toBeLessThanOrEqual(32)
  }
  const evil = { ...d, constructors: d.constructors.map((c) => ({ ...c, name: '<x>&' })) }
  expect(qualiMessage(evil, 21, 'quali')).toContain('&lt;x&gt;&amp;')
})
```

El fixture solo tiene las tablas de la ronda 21: el `+N` se prueba agregando en el test una tabla de la ronda 20 (`verstappen 279` → `+25`; sin ella no aparece ningún `+`). `withTitleDecidedAt21(d)` es un helper del test: reemplaza las tablas por dos pilotos con la ronda 20 en `390` y `340` y la 21 en `402` y `304`, con 2 carreras después de la 21 y 3 después de la 20. Las sprints y las clasificaciones sprint se prueban con filas armadas en el test a partir de `parseResults(sprint17, 'sprint')`.

- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: textos de los avisos del canal`.

### Task 5: Respuestas del bot

**Files:** Create `src/notices/commands.ts`; Test `src/notices/commands.test.ts`

**Interfaces:**
- Consumes: `SeasonData` y las piezas de la Tarea 4.
- Produces: `commandReply(text: string, d: SeasonData, now: Date, links: { channel: string; webUrl: string | null }): string`
- Reglas: el comando es la primera palabra, sin `@usuario` y en minúsculas. Próxima carrera: la primera cuya sesión `race` empieza después de `now`. Última: la ronda más alta con resultados `race`. Sin carreras corridas: `Todavía no se corrió ninguna carrera.`

- [ ] **Step 1: Tests que fallan:** `/start` con el canal y, si hay, la web; `/proxima` el 2026-11-26 muestra Qatar y el 2026-12-07 el texto de fin de temporada; `/ultima` es la ronda 21 sin `🏆`; `/campeonato` sin `+`; `'/Proxima@F1DashArBot ahora'` se entiende como `/proxima`; `'hola'` y `''` devuelven la lista de comandos; sin resultados, `/ultima` y `/campeonato` dan el texto de "todavía no".
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: respuestas del bot`.

### Task 6: Qué aviso toca

**Files:** Create `src/notices/decide.ts`; Test `src/notices/decide.test.ts`

**Interfaces:**
- Consumes: `SessionRow`, `previewAt`.
- Produces:
  - `type NoticeType = 'preview' | 'quali' | 'sprint-quali' | 'sprint-start' | 'sprint-result' | 'race-start' | 'race-result'`
  - `type Notice = { key: string; type: NoticeType; season: number; round: number }`, con `key` = `2026:22:race-start`
  - `type Ready = ReadonlySet<string>`: claves `` `${season}:${round}:${kind}` `` con `kind: ResultKind`
  - `readyResults(d: SeasonData): Ready`: una sesión está lista si tiene resultados; `race` además exige **las dos** tablas de esa ronda.
  - `decideNotices(input: { sessions: SessionRow[]; ready: Ready; sent: ReadonlySet<string>; now: Date; notifyFrom: Date }): Notice[]`
- Reglas:
  - Solo sesiones con `startsAt >= notifyFrom` (la previa usa la sesión `fp1`).
  - Por horario (`preview` en `previewAt(fp1)`; `race-start` y `sprint-start` en `startsAt`): desde esa hora hasta 30 minutos después, extremos incluidos. La previa tampoco sale si FP1 ya empezó.
  - Resultados: cuando están en `ready` y la sesión ya empezó; no vencen.
  - Nunca una clave que esté en `sent`. Orden: por la hora en que corresponde cada aviso.
  - `// ponytail:` la ronda sin `fp1` no tiene previa.

- [ ] **Step 1: Tests que fallan**

```ts
const { sessions } = parseCalendar(calendar)
const keys = (now: string, o: Partial<Parameters<typeof decideNotices>[0]> = {}) =>
  decideNotices({ sessions, ready: new Set(), sent: new Set(), now: new Date(now), notifyFrom: new Date('2026-11-26T00:00:00Z'), ...o }).map((n) => n.key)

it('previa de Qatar: ventana de 30 minutos', () => {
  expect(keys('2026-11-26T12:59:59Z')).toEqual([])
  expect(keys('2026-11-26T13:00:00Z')).toEqual(['2026:22:preview'])
  expect(keys('2026-11-26T13:30:00Z')).toEqual(['2026:22:preview'])
  expect(keys('2026-11-26T13:30:01Z')).toEqual([])
})
it('largada: a la hora y hasta 30 minutos', () => {
  expect(keys('2026-11-29T15:59:59Z')).toEqual([])
  expect(keys('2026-11-29T16:00:00Z')).toEqual(['2026:22:race-start'])
  expect(keys('2026-11-29T16:31:00Z')).toEqual([])
})
it('lo ya enviado no se repite', () => {
  expect(keys('2026-11-29T16:00:00Z', { sent: new Set(['2026:22:race-start']) })).toEqual([])
})
it('el resultado no vence', () => {
  expect(keys('2026-12-01T00:00:00Z', { ready: new Set(['2026:22:race']) })).toEqual(['2026:22:race-result'])
})
it('primer arranque: nada anterior a notifyFrom', () => {
  const all = new Set(sessions.flatMap((s) => [`2026:${s.round}:${s.kind}`]))
  expect(keys('2026-11-26T20:00:00Z', { ready: all })).toEqual([])
})
it('un resultado de una sesión que no empezó no sale', () => {
  expect(keys('2026-11-27T00:00:00Z', { ready: new Set(['2026:22:race']) })).toEqual([])
})
it('sprint: sus tres avisos y en orden', () => {
  const ready = new Set(['2026:17:sprint_quali', '2026:17:sprint', '2026:17:quali'])
  expect(keys('2026-10-10T15:00:00Z', { ready, notifyFrom: new Date('2026-10-09T00:00:00Z') }))
    .toEqual(['2026:17:sprint-quali', '2026:17:sprint-result', '2026:17:quali'])
})
it('la carrera necesita las dos tablas', () => {
  const d = season2026()
  expect(readyResults(d).has('2026:21:race')).toBe(true)
  expect(readyResults({ ...d, standings: d.standings.filter((s) => s.kind === 'drivers') }).has('2026:21:race')).toBe(false)
  expect(readyResults(d).has('2026:21:quali')).toBe(true)
  expect(readyResults(d).has('2026:22:quali')).toBe(false)
})
```

- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: decisión de avisos`.

### Task 7: Lectura de la base y vista previa

**Files:** Create `src/db/queries.ts`, `scripts/preview.ts`; Modify `package.json`, `README.md`; Test `src/db/queries.test.ts`

**Interfaces:**
- Consumes: `save*` (para el test), `SeasonData`, builders y `commandReply`.
- Produces:
  - `loadSeason(db: Db, season: number): Promise<SeasonData>`
  - `npm run avisos -- <aviso> [ronda]`, con `aviso` = un `NoticeType` o un comando (`/proxima`…). Lee la D1 local e imprime el HTML. Sin argumentos, lista las opciones.
- `// ponytail:` `loadSeason` lee la temporada entera: sirve para la vista previa y los comandos. **El reloj del Plan 2B no la usa cada minuto** (gastaría el cupo diario de filas y CPU de D1).

- [ ] **Step 1: Test que falla:** guardar con las funciones `save*` dos temporadas y comprobar que `loadSeason(db, 2026)` trae solo 2026, con `startsAt` como `Date` y las 22 filas de carrera.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `queries.ts` y `preview.ts` (`getPlatformProxy`, como el seed).
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Correr `npm run avisos -- preview 22`, `-- race-result 21`, `-- race-start 21`, `-- sprint-quali 17`, `-- sprint-result 17` y `-- /campeonato`. Esperado: los textos de los ejemplos con datos reales; ninguna línea de `<pre>` de más de 32 caracteres.
- [ ] **Step 6:** Commit `feat: vista previa de avisos`.

### Task 8: Verlos en Telegram (chat privado del autor)

**Files:** Create `src/telegram.ts`; Modify `scripts/preview.ts`, `README.md`; Test `src/telegram.test.ts`

**Interfaces:**
- Produces:
  - `sendMessage(token: string, chatId: string, html: string, fetcher?: typeof fetch): Promise<{ ok: true } | { ok: false; status: number | null; description: string }>`: `parse_mode: 'HTML'`, sin vista previa de links, timeout de 8 s. Nunca lanza. El token no aparece en `description`.
  - `isPrivateChat(chatId: string): boolean`: solo dígitos.
  - `npm run avisos -- <aviso> [ronda] --enviar`: lee `.dev.vars` y manda a `ADMIN_CHAT_ID`; si no es privado, termina con error sin pedir nada.
  - `npm run avisos -- --mi-chat`: con `getUpdates`, imprime los ids de los chats privados que le escribieron al bot. No imprime nombres, textos ni el token.

- [ ] **Step 1: Tests que fallan:** el cuerpo enviado lleva `parse_mode: 'HTML'` y `link_preview_options: { is_disabled: true }`; una respuesta 400 devuelve `ok: false` con la descripción de Telegram; un `fetch` que lanza un error cuyo mensaje incluye la URL devuelve un `description` **sin** el token; `isPrivateChat` acepta `'123456'` y rechaza `'@F1DashAr'`, `'-1001234567890'` y `''`.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5 (autor):** poner el token en `.dev.vars` (sin pegarlo en el chat) y mandarle `/start` al bot. Luego `npm run avisos -- --mi-chat` y poner el id en `ADMIN_CHAT_ID`.
- [ ] **Step 6 (autorizado por el autor al aprobar este plan: solo a su chat privado):** mandar previa, resultado de carrera y largada. El autor los revisa en el celular; los ajustes de texto entran con test primero.
- [ ] **Step 7:** Commit `feat: envío de prueba a telegram`.
