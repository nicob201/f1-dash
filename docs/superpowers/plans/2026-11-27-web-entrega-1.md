# Web, entrega 1: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar la web con Inicio, la lista de carreras y el detalle de cada una, en el mismo Worker que el bot.

**Architecture:** Una función arma los JSON de la web desde D1 y los guarda en la tabla `kv`; hoy la llama el script de carga. La API devuelve esa fila sin interpretarla. El front es una SPA de React que se sirve como Static Assets, integrada con `@cloudflare/vite-plugin`.

**Tech Stack:** TypeScript, Hono, D1 + Drizzle, Vitest, React 19, Vite 8, Tailwind 4, `@fontsource-variable/archivo`.

**Spec:** `docs/superpowers/specs/2026-11-27-web-entrega-1-design.md` y, para lo que no cambia, `docs/2026-11-25-f1-dash-design.md` (§6).

## Global Constraints

- Plan gratis: 10 ms de CPU por pedido. La API no calcula ni interpreta JSON al responder.
- Una visita nunca consulta a Jolpica ni a OpenF1.
- `/api/*` y `/telegram/*` van **siempre** al Worker. El bot sigue funcionando igual.
- Repo público: sin secretos ni datos personales. `dist/` nunca se commitea: el plugin copia `.dev.vars` adentro.
- Interfaz en español rioplatense; horas de Argentina. Solo dark mode.
- Estilo "Pit wall": fondo `#15151E`, paneles `#22222E`, líneas `#2D2D3B`, texto `#F3F3F7`, secundario `#9C9CB0`, acento `#EE2B3B`, violeta `#B455FF` **solo** para la vuelta rápida. Referencia: opción A de `docs/mockups/estilos.html`.
- Archivo variable, servida desde el proyecto. Títulos de GP: 900, itálica, ancho 62%. Códigos y puntos: 800, ancho 75%. Números con `tabular-nums`.
- El color nunca va solo: siempre con el código del piloto y el número de posición.
- Responsive hasta mobile, foco visible con teclado, `prefers-reduced-motion` respetado.
- Footer: "Proyecto de un fan. No es un sitio oficial de la Fórmula 1." y "Datos: Jolpica y OpenF1". Sin logo ni tipografía de la F1.
- Menú: solo **Inicio** y **Carreras**.
- Commits en inglés y sin atribución. **Consultar al autor antes de cualquier deploy, cambio en la base remota o push.**

## Review Focus

1. Fin de semana a medias (solo sprint o clasificación cargadas): la lista no muestra ganador, el detalle muestra horarios más lo que haya y la "última carrera" sigue siendo la anterior. (Tarea 2)
2. La última ronda tiene una sola de las dos tablas: el inicio muestra la última ronda que tenga ambas. (Tarea 2)
3. Un resultado cuyo piloto o equipo no está en sus tablas: sale con código de respaldo y color gris, sin romper el armado. (Tarea 2)
4. Parámetros raros en la API (`/api/races/abc/1`, ronda 999): 404 en JSON, nunca el `index.html`. (Tarea 4)
5. `CHANNEL_LINK` vacío o con un valor que no es de Telegram (`javascript:…`, un id numérico): no hay botón. (Tarea 5)

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `vite.config.ts`, `index.html` | Build y desarrollo del front con el Worker |
| `src/snapshots/types.ts` | Forma de los JSON, compartida entre Worker y front |
| `src/snapshots/build.ts` | Funciones puras que arman los JSON |
| `src/snapshots/refresh.ts` | Lee D1, arma y guarda en `kv` |
| `scripts/db.ts`, `scripts/snapshots.ts` | Abrir D1 local o remota; rearmar sin descargar |
| `src/app.ts` | Se suman las dos rutas de la API |
| `web/lib.ts` | Lógica pura del front |
| `web/App.tsx`, `web/ui.tsx`, `web/pages/*.tsx`, `web/styles.css`, `web/main.tsx` | Pantallas |
| `web/tsconfig.json` | Tipos del navegador, separados de los del Worker |

---

### Task 1: Probar el plugin de Vite (enfoque A)

**Files:** Create `vite.config.ts`, `index.html`, `web/main.tsx` (un `<h1>F1 Dash</h1>`), `web/tsconfig.json`. Modify `package.json`, `wrangler.jsonc`, `.gitignore`.

**Interfaces:** Produces `npm run dev` (`vite`), `npm run build` (`vite build`), `npm run deploy` (`npm run build && wrangler deploy`); `npm run typecheck` revisa el Worker y `web/`.

> **Condición de corte:** si un paso de verificación falla y arreglarlo exige cambiar el código del bot, los tests actuales o la carga de datos, **frenar, no commitear y consultar al autor** (spec §4). No pasar al enfoque B por cuenta propia.

- [ ] **Step 1:** Agregar `dist/` a `.gitignore`, antes de compilar nada.
- [ ] **Step 2:** `npm i react react-dom` y `npm i -D @cloudflare/vite-plugin@^1.70.2 vite@^8 @vitejs/plugin-react tailwindcss @tailwindcss/vite @types/react @types/react-dom @fontsource-variable/archivo`. El plugin declara `wrangler@4.168.0`, la versión instalada: `npm ls wrangler` debe mostrar una sola.
- [ ] **Step 3:** `vite.config.ts` con `plugins: [react(), tailwindcss(), cloudflare()]`. En `wrangler.jsonc`: `"assets": { "not_found_handling": "single-page-application", "run_worker_first": ["/api/*", "/telegram/*"] }`, sin `directory` (lo pone el plugin). `web/tsconfig.json`: `lib` con `DOM`, `jsx: "react-jsx"`, `types: ["vite/client", "vitest/globals"]`, resto como el raíz. El script `typecheck` suma `tsc --noEmit -p web`.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: 170 tests PASS, sin errores de tipos. `vitest.config.ts` no se toca.
- [ ] **Step 5:** `npm run dev` y, contra el puerto que informe:
  - `GET /` y `GET /carreras/2026/22` con `-H 'sec-fetch-mode: navigate'` → 200, `text/html`.
  - `GET /api/nada` con el mismo header → 404 que **no** es HTML.
  - `POST /telegram/webhook` sin secreto → 401.
- [ ] **Step 6:** `npm run build && npx vite preview`: repetir las tres comprobaciones del Step 5, con los mismos resultados.
- [ ] **Step 7:** Con el build hecho: `npx wrangler d1 migrations apply f1-dash --local` (esperado: sin migraciones pendientes o aplicadas, sin error), `npm run avisos -- race-result 21` (muestra el mensaje o avisa que la base local está vacía, sin error de configuración) y `npx wrangler deploy --dry-run` (usa la configuración de `dist/`, con el binding `DB`).
- [ ] **Step 8:** `grep -r -F "$(grep '^TELEGRAM_BOT_TOKEN=' .dev.vars | cut -d= -f2-)" dist/client` → sin resultados, sin imprimir el token. `git status` no muestra `dist/`.
- [ ] **Step 9:** Commit `build: serve a React front with the Cloudflare Vite plugin`.

### Task 2: Armar los JSON de la web (funciones puras)

**Files:** Create `src/snapshots/types.ts`, `src/snapshots/build.ts`. Modify `src/format/es.ts`, `src/notices/data.ts`, `src/notices/messages.ts`, `src/notices/commands.ts`. Test `src/snapshots/build.test.ts`, `src/format/es.test.ts`.

**Interfaces:**
- Produces, en `format/es.ts`: `finishingLabel(r: Pick<ResultRow, 'position' | 'positionText'>): string` (se mueve `finishing` y `NOT_PLACED` desde `messages.ts`) y `arDate(d: Date): string` (`"29 nov"`).
- Produces, en `notices/data.ts`: `lastCompleteStandingsRound(d: SeasonData): number | null` (se extrae de `championship` en `commands.ts`).
- Produces, en `build.ts`:
  - `placesGained(grid: number | null, position: number | null, positionText: string | null): number | null`
  - `homeSnapshot(d: SeasonData, upcoming: Pick<SeasonData, 'season' | 'races' | 'sessions'>): HomeSnapshot` (`upcoming` es la temporada `d.season + 1`, quizás vacía)
  - `raceSnapshot(d: SeasonData, pits: PitStopRow[], round: number): RaceSnapshot`
- Produces, en `types.ts`:

```ts
export type DriverRef = { code: string; name: string; team: string; color: string }
export type SessionTime = { kind: SessionKind; startsAt: string } // ISO, UTC
export type RaceInfo = { season: number; round: number; rounds: number; gp: string; circuit: string; sessions: SessionTime[] }
export type FastestLap = DriverRef & { lap: string }
export type ResultLine = DriverRef & { finish: string; time: string | null; points: number; gained: number | null; fastest: boolean }
export type QualiLine = DriverRef & { finish: string; q1: string | null; q2: string | null; q3: string | null }
export type PitLine = DriverRef & { stop: number; lap: number; duration: string | null }
export type DriverStanding = DriverRef & { position: number | null; points: number }
export type TeamStanding = { team: string; color: string; position: number | null; points: number }
export type HomeSnapshot = {
  season: number
  races: (RaceInfo & { winner: DriverRef | null })[]
  last: { round: number; gp: string; top: ResultLine[]; fastest: FastestLap | null } | null
  drivers: DriverStanding[]    // top 4
  constructors: TeamStanding[] // top 3
  upcoming: { season: number; races: RaceInfo[] }
}
export type RaceSnapshot = RaceInfo & {
  prev: number | null; next: number | null
  race: ResultLine[]; fastest: FastestLap | null; sprint: ResultLine[]; quali: QualiLine[]; pits: PitLine[]
}
export type HomeResponse = { channel: string | null; snapshot: HomeSnapshot }
```

Reglas: `gp`, `circuit` y `team` salen de `gpName` y `teamName`; el color, de la tabla `constructors` y si no está, `teamColor`; el equipo de una línea es el del **resultado**, no el actual del piloto. `name` es nombre y apellido; sin fila del piloto, el código de respaldo es el de `messages.ts` y el nombre es el `driverId`. `finish` usa `finishingLabel`. Listas ordenadas por posición; sesiones y rondas por fecha y número; paradas por vuelta y después por código. `gained = grid − position`, y `null` si `grid` es `null` o 0, o si `positionText` no es un número. `sprint` lleva `gained: null` y `fastest: false`.

- [ ] **Step 1: Tests que fallan** (con `season2026()` como `d` y `upcoming = { season: 2027, races: [], sessions: [] }`):
  - `homeSnapshot`: `season` 2026; 23 carreras en orden, todas con `rounds: 23`; la 22 es `GP de Qatar`, `winner: null` y su sesión `race` es `2026-11-29T16:00:00.000Z`; la 21 tiene `winner.code` `VER`; `last.round` 21, `last.top` con `['VER','NOR','PIA','ANT','GAS']`; `last.top[0].time` `1:27:39.624`; `last.fastest` es `LAW`, `1:35.591`; `drivers` = ANT 402, VER 304, HAM 267, RUS 264; `constructors` = Mercedes 666, Ferrari 517, Red Bull 440.
  - `raceSnapshot(d, [], 21)`: 22 líneas; `gained` de VER 0, NOR 1, PIA 14; ALB `finish: 'NL'` y `gained: null`; LIN `finish: 'NC'`; ALO `finish: '19'`, `time: null`; solo LAW con `fastest: true`; `quali` con 22 y la primera ANT con `q3: '1:33.893'`; `prev` 20, `next` 22; `sprint` y `pits` vacíos.
  - Ronda 1: `prev: null`. Ronda 23: `next: null`.
  - `placesGained(0, 5, '5')` → `null`; `placesGained(3, 20, 'R')` → `null`; `placesGained(2, 9, '9')` → `-7`.
  - Paradas: con las de `pitstops-2026-17.json`, `raceSnapshot(d, pits, 17).pits` tiene 25 y la primera es vuelta 18, parada 1, `24.048`; con las paradas de la 17 pedidas para la 21, vacío.
  - **Review Focus 1:** con resultados solo de `quali` en la ronda 22 (copiar filas de la 21 con `round: 22`): `winner` de la 22 `null`, `last.round` 21, y `raceSnapshot(…, 22)` con `quali.length` 22 y `race: []`.
  - **Review Focus 2:** con una tabla de pilotos de la ronda 22 y sin la de constructores, `drivers[0].points` sigue en 402.
  - **Review Focus 3:** un resultado con `driverId: 'nuevo'` y `constructorId: 'otro'` sale con `code: 'NUE'`, `team: 'otro'`, `color: '#9C9CB0'`.
  - `upcoming` con una carrera de 2027 → aparece en `upcoming.races`.
  - `arDate(new Date('2026-11-29T16:00:00Z'))` → `29 nov`; `arDate(new Date('2026-12-01T01:00:00Z'))` → `30 nov`.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar y mover lo compartido.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS, incluidos sin cambios los tests de mensajes y comandos.
- [ ] **Step 5:** Commit `feat: build web snapshots from season data`.

### Task 3: Guardar los snapshots en D1

**Files:** Modify `src/db/schema.ts`, `src/db/save.ts`, `scripts/seed.ts`, `package.json`. Create `drizzle/0001_*.sql` (con `npx drizzle-kit generate`), `src/snapshots/refresh.ts`, `scripts/db.ts`, `scripts/snapshots.ts`. Test `src/snapshots/refresh.test.ts`.

**Interfaces:**
- Consumes: `homeSnapshot`, `raceSnapshot`, `loadSeason`.
- Produces: tabla `kv` (`key` texto PK, `value` texto no nulo); `saveSnapshots(db: Db, rows: { key: string; value: string }[]): Promise<void>` (upsert en un solo batch); `buildSnapshots(db: Db): Promise<number>` (cantidad guardada); claves `home` y `race:<season>:<round>`; `openDb(remote: boolean): Promise<{ db: Db; dispose(): Promise<void> }>`; script `npm run snapshots [-- --remote]`.

La temporada que se muestra es la mayor con resultados de `race`; si no hay ninguna, la mayor del calendario (spec §6.1).

- [ ] **Step 1: Tests que fallan** (D1 de test, guardando con `saveCalendar`, `saveResults`, `saveStandings`, `savePitStops`):
  - Con 2026 guardada: devuelve 24; `home` parsea igual a `homeSnapshot(...)` de lo leído; existen `race:2026:1` y `race:2026:23`.
  - Correrla dos veces deja 24 filas; si cambia un resultado, la segunda actualiza el valor.
  - Con el calendario 2027 cargado y sin resultados: `home.season` 2026 y `home.upcoming.races` no vacío.
  - Cuando 2027 tiene un resultado de carrera: `home.season` 2027.
  - Base vacía: devuelve 0, sin error y sin borrar las filas de `kv` que hubiera.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `scripts/db.ts` saca de `seed.ts` el `getPlatformProxy` (local con `wrangler.jsonc`, remoto con `wrangler.seed.jsonc` y `remoteBindings`). `seed.ts` llama a `buildSnapshots` antes de "Listo" e informa la cantidad.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** `npx wrangler d1 migrations apply f1-dash --local`; si la base local está vacía, `npm run seed`; `npm run snapshots`. Esperado: 24 snapshots.
- [ ] **Step 6:** Commit `feat: store web snapshots in D1`.

### Task 4: API

**Files:** Modify `src/app.ts`. Test `src/app.test.ts`.

**Interfaces:**
- Consumes: claves de `kv`, `Bindings.CHANNEL_LINK`.
- Produces: `GET /api/home` → `HomeResponse`; `GET /api/races/:season/:round` → `RaceSnapshot`.

Leer con `env.DB.prepare('select value from kv where key = ?').bind(key).first<string>('value')` y responder el texto tal cual, con `Content-Type: application/json` y `Cache-Control: public, max-age=60`. Home se arma concatenando: ``{"channel":${JSON.stringify(CHANNEL_LINK || null)},"snapshot":${value}}``. Sin fila: 404 `{"error":"not_found"}`, sin `Cache-Control`. Falla de D1: 500 `{"error":"unavailable"}` y `console.error` con `cause(e)`.

- [ ] **Step 1: Tests que fallan** (escribiendo filas de `kv` directo):
  - Las dos rutas devuelven el JSON guardado, con ambos headers.
  - `channel`: `null` sin `CHANNEL_LINK` o vacío; `"@canal"` configurado; un valor con comillas sigue dando JSON válido.
  - Sin snapshot: 404 con ese cuerpo.
  - **Review Focus 4:** `/api/races/abc/1`, `/api/races/2026/0`, `/api/races/2026/999`, `/api/races/2026` → 404.
  - Base caída (el `brokenDb` que ya existe): 500, y el log es `api /api/home: D1_ERROR: D1 caída`.
  - El test "no hay más rutas" sigue pasando.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar y actualizar el comentario de cabecera de `app.ts`.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: serve web snapshots from the API`.

### Task 5: Base del front

**Files:** Create `web/lib.ts`, `web/App.tsx`, `web/ui.tsx`, `web/styles.css`. Modify `web/main.tsx`, `index.html` (`lang="es-AR"`, título, `color-scheme: dark`). Test `web/lib.test.ts`.

**Interfaces:**
- Consumes: `src/snapshots/types.ts`, `src/format/es.ts`.
- Produces, en `lib.ts`:
  - `type Route = { page: 'home' } | { page: 'races' } | { page: 'race'; season: number; round: number } | { page: 'notFound' }` y `matchRoute(pathname: string): Route`
  - `type Loaded<T> = { status: 'ok'; data: T } | { status: 'notFound' } | { status: 'error' }` y `loadJson<T>(url: string, fetcher?: typeof fetch): Promise<Loaded<T>>`
  - `channelUrl(value: string | null): string | null`
  - `nextRace(home: HomeSnapshot, now: Date): { kind: 'race'; race: RaceInfo } | { kind: 'unpublished'; season: number }`
  - `countdown(target: Date, now: Date): { days: number; hours: number; minutes: number }`
  - `resultPending(race: RaceSnapshot, now: Date): boolean`
- Produces, en `ui.tsx`: `useJson<T>(url)` (estado `loading` o `Loaded<T>`, más `retry`), `Link`, `PositionChip`, `DriverTag` (franja inclinada + código), `Loading`, `LoadError`, `NotFound`.

Rutas: `/`, `/carreras`, `/carreras/:season/:round`. La última es la que ya arma `raceResultMessage`. Router propio de pocas líneas (`history.pushState` + `popstate`, con `useSyncExternalStore`): sin librería. `Link` deja pasar los clics con modificadores. Al navegar, scroll arriba.

- [ ] **Step 1: Tests que fallan:**
  - `matchRoute`: las tres rutas, también con barra final; `/carreras/abc/1`, `/carreras/2026` y `/campeonato` → `notFound`.
  - `loadJson`: 200 con JSON → `ok`; 404 → `notFound`; 500, `fetch` que rechaza y 200 con HTML → `error`.
  - **Review Focus 5:** `channelUrl('@F1DashAr')` → `https://t.me/F1DashAr`; `https://t.me/+abc` queda igual; `null`, `''`, `javascript:alert(1)`, `-1001234567890`, `https://example.test`, `https://t.me.example.test/x` → `null`.
  - `countdown`: de `2026-11-25T18:46:00Z` a `2026-11-29T16:00:00Z` → 3, 21, 14; con el objetivo pasado → 0, 0, 0.
  - `nextRace` (con `homeSnapshot(season2026(), …)`): el `2026-11-26` es la ronda 22; el `2026-11-29T16:00:00Z` ya es la 23; en `2026-12-07` sin 2027 → `unpublished`, 2027; con 2027 en `upcoming` → su primera carrera.
  - `resultPending`: ronda 22 antes de la largada `false`, desde la largada `true`; ronda 21 (con resultado) `false`.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `lib.ts`, `ui.tsx` y el marco en `App.tsx`: header "F1 Dash" con barra roja, menú Inicio y Carreras (el activo con `aria-current="page"`), botón "Recibí los avisos en Telegram" solo si `channelUrl` da un valor (`App` pide `/api/home` una vez y lo pasa), y el footer. `styles.css`: `@import "tailwindcss"`, `@fontsource-variable/archivo/wdth.css` y `wdth-italic.css`, los colores en `@theme`. Textos de estado: "Cargando…"; "No pudimos cargar los datos." con botón "Reintentar"; "No encontramos esa página." con enlace "Volver al inicio".
- [ ] **Step 4:** `npm test && npm run typecheck && npm run build`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: add the web shell with routing and theme`.

### Task 6: Inicio

**Files:** Create `web/pages/Home.tsx`. Modify `web/App.tsx`, `web/ui.tsx`.

**Interfaces:** Consumes `HomeSnapshot`, `nextRace`, `countdown`, los componentes de la Tarea 5. Produces en `ui.tsx` `Schedule({ sessions }: { sessions: SessionTime[] })`, que reusa la Tarea 7.

Contenido y orden según el croquis del spec §5.3 y el mockup A: tres columnas en escritorio, apiladas en mobile. Próxima carrera: "Próxima carrera, ronda N de M", GP, circuito, cuenta regresiva (se actualiza cada 30 s) y horarios con la carrera marcada en rojo y la leyenda "Horarios de Argentina". Si es `unpublished`: "El calendario <año> todavía no está publicado". Última carrera: top 5 con tiempo (`—` si no hay), vuelta rápida en violeta y enlace a su detalle. Campeonatos: top 4 y top 3. Una columna sin datos no se muestra.

- [ ] **Step 1:** Implementar, con las etiquetas de `sessionLabel`, `arDay` y `arTime`.
- [ ] **Step 2:** `npm run typecheck && npm test && npm run build`. Esperado: PASS.
- [ ] **Step 3:** Con `npm run dev` y la base local, capturar a 1280 px y 390 px de ancho y comparar con el mockup. Esperado: sin scroll horizontal, nada cortado, foco visible al recorrer con Tab. Corregir lo que no coincida.
- [ ] **Step 4:** Commit `feat: add the home page`.
- [ ] **Step 5 (autor):** mostrarle el inicio y esperar sus correcciones **antes** de la Tarea 7: es donde se valida el estilo.

### Task 7: Carreras y detalle

**Files:** Create `web/pages/Races.tsx`, `web/pages/Race.tsx`. Modify `web/App.tsx`.

**Interfaces:** Consumes `HomeSnapshot.races`, `RaceSnapshot`, `resultPending`, `arDate`, `Schedule`.

- Lista: todas las rondas, cada una con número, GP, fecha (`arDate` de la sesión `race`) y el ganador si lo hay; toda la fila enlaza al detalle.
- Detalle: encabezado con ronda, GP, circuito y flechas (con texto accesible; la que no existe no se muestra). Secciones en una columna: **Resultado** (puesto, piloto, tiempo, puntos y "Posiciones" con `▲ 14`, `▼ 7`, `=` o `—`, con texto accesible; la fila de la vuelta rápida marcada en violeta y debajo "Vuelta rápida: <código>, <tiempo>"), **Sprint**, **Clasificación** (Q1, Q2, Q3) y **Paradas en boxes** (piloto, parada, vuelta, duración).
- Una sección sin datos no se muestra. Sin resultado de carrera: horarios primero y, si `resultPending`, "Todavía no tenemos el resultado".
- En mobile las tablas entran sin scroll de la página; si una no entra, su scroll es propio.

- [ ] **Step 1:** Implementar, usando `<table>` con encabezados.
- [ ] **Step 2:** `npm run typecheck && npm test && npm run build`. Esperado: PASS.
- [ ] **Step 3:** En el navegador, a 1280 px y 390 px: `/carreras`, una carrera con sprint (ronda 17), la 21, la 22, la 1, `/carreras/2026/99` y `/cualquiera`. Esperado: lo de arriba, y las dos últimas muestran "No encontramos esa página."
- [ ] **Step 4:** Commit `feat: add the races list and race detail pages`.

### Task 8: Cierre y publicación

**Files:** Modify `README.md`, `wrangler.jsonc`, `docs/2026-11-25-f1-dash-design.md`.

- [ ] **Step 1:** README: estado, `npm run dev`, `build`, `snapshots`, `deploy` (reemplaza a `npx wrangler deploy`: sin build se publica el anterior o falla), y `CHANNEL_LINK` / `WEB_URL` en `vars` de `wrangler.jsonc` (lo cargado solo en el panel lo borra el próximo deploy). En el spec original, una nota en §6.3 que apunte al cambio de quién arma los snapshots.
- [ ] **Step 2:** `npm test && npm run typecheck && npm run build`. Commit `docs: document the web commands`.
- [ ] **Step 3:** Revisión final de toda la rama y arreglo de lo que corresponda.
- [ ] **Step 4:** **Consultar al autor.** Con su OK: `npx wrangler d1 migrations apply f1-dash --remote`, `npm run snapshots -- --remote` (si ya corrió Qatar, `npm run seed -- --remote`) y `npm run deploy`.
- [ ] **Step 5:** En producción: `/` y `/carreras/2026/21` → 200 HTML; `/api/home` → 200 JSON; `/api/races/2026/999` → 404 JSON; webhook sin secreto → 401. El autor prueba un comando del bot y mira la web en el celular.
- [ ] **Step 6:** Medir `/api/*` con `wrangler tail --format json`, incluido el primer pedido tras el deploy, y anotarlo en la §9 del spec original. Si hay `exceededCpu` o los pedidos en uso pasan 10 ms, consultar al autor.
- [ ] **Step 7:** **Consultar al autor** (la dirección incluye su cuenta de Cloudflare y quedaría en el repo público). Con su OK: `WEB_URL` en `vars`, `npm run deploy` y probar `/start`. Commit `chore: link the web from the bot`.
- [ ] **Step 8:** Cerrar la rama con superpowers:finishing-a-development-branch. El push se consulta aparte.
