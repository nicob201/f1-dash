# Web, entrega 2: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar a la web las páginas Campeonato (tablas completas y gráfico de puntos) y Stats (KPIs, duelos y "¿Quién puede ser campeón?").

**Architecture:** Dos funciones puras nuevas arman los JSON `championship` y `stats` desde `SeasonData`. `buildSnapshots` los guarda en `kv` junto a los demás, y la API los devuelve sin interpretarlos, como `home`. El front suma dos rutas; el gráfico es un SVG hecho a mano.

**Tech Stack:** TypeScript, Hono, D1 + Drizzle, Vitest, React 19, Vite 8, Tailwind 4. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-28-web-entrega-2-design.md`. Para lo que no cambia: `docs/superpowers/specs/2026-11-27-web-entrega-1-design.md` y `docs/2026-11-25-f1-dash-design.md` (§6).

## Global Constraints

- Plan gratis: 10 ms de CPU por pedido. La API no calcula ni interpreta JSON al responder.
- Una visita nunca consulta a Jolpica ni a OpenF1. Sin dependencias nuevas.
- Repo público: sin secretos ni datos personales. `dist/` nunca se commitea.
- Interfaz en español rioplatense. Solo dark mode. Estilo "Pit wall" con los colores de `web/styles.css`; el violeta `fastest` es **solo** para la vuelta rápida.
- El color nunca va solo: siempre con el código del piloto o el nombre del equipo, y en el gráfico el compañero resaltado va punteado.
- Responsive hasta 390 px, foco visible con teclado, `prefers-reduced-motion` respetado.
- Menú: **Inicio**, **Carreras**, **Campeonato**, **Stats**.
- Commits en inglés y sin atribución. **Consultar al autor antes de cualquier deploy, cambio en la base remota o push.**

## Review Focus

1. Piloto que entró o salió a mitad de año (Cámara, Tsunoda, Hirakawa): su línea tiene `null` en las rondas en que no figuraba, y sus duelos forman parejas aparte. (Tareas 1 y 2)
2. Resultados más adelantados que las tablas (llegó la carrera 22 y la tabla todavía no): las stats cuentan solo hasta la ronda de las tablas, así coinciden con ellas. (Tarea 2)
3. Dos compañeros entre los 5 resaltados: punteado solo el peor ubicado. Hoy: Antonelli y Russell. (Tarea 1)
4. Sin tablas cargadas (temporada nueva, solo calendario): no hay snapshots `championship` ni `stats`, la API da 404 y la página dice "Todavía no hay datos cargados." (Tareas 1, 2, 3 y 4)
5. Piloto sin ninguna llegada clasificada o que no largó: promedio `null` ("—"), y un "W" no cuenta como abandono. (Tarea 2)

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `src/snapshots/types.ts` | Se suman los tipos de los dos JSON nuevos |
| `src/snapshots/build.ts` | Se exportan `driverRef`, `teamRef` y `currentTeam` para reusarlos |
| `src/snapshots/championship.ts` | Arma el JSON del campeonato (nuevo) |
| `src/snapshots/stats.ts` | Arma el JSON de las stats (nuevo) |
| `src/snapshots/refresh.ts`, `src/app.ts` | Guardar y servir los dos JSON |
| `web/lib.ts` | Rutas nuevas y lógica pura del gráfico y de los formatos |
| `web/ui.tsx` | Recibe `Section` y sus ayudas, que hoy viven en `Race.tsx` |
| `web/pages/Championship.tsx`, `web/pages/Stats.tsx` | Las dos páginas (nuevas) |
| `web/App.tsx`, `web/pages/Home.tsx` | Menú, ruteo y enlace del inicio |

---

### Task 1: El JSON del campeonato

**Files:** Create `src/snapshots/championship.ts`. Modify `src/snapshots/types.ts`, `src/snapshots/build.ts` (solo `export`). Test `src/snapshots/championship.test.ts`.

**Interfaces:**
- Consumes: `SeasonData`, `standingsOf`, `lastCompleteStandingsRound`, `driverCode` (`src/notices/data.ts`).
- Produces, en `build.ts`: se exportan sin cambios `driverRef(d, driverId, constructorId): DriverRef`, `teamRef(d, constructorId): { team: string; color: string }` y `currentTeam(d, driverId): string`.
- Produces, en `types.ts`:

```ts
export type ChartLine = { code: string; color: string; highlight: boolean; dashed: boolean; points: (number | null)[] }
export type ChampionshipSnapshot = {
  season: number
  /** La última ronda con las dos tablas. */
  round: number
  drivers: (DriverStanding & { wins: number })[]
  constructors: (TeamStanding & { wins: number })[]
  /** points[i] es el total tras rounds[i]; null si ese piloto no figuraba en esa tabla. */
  chart: { rounds: number[]; lines: ChartLine[] }
}
```

- Produces, en `championship.ts`: `championshipSnapshot(d: SeasonData): ChampionshipSnapshot | null`. Devuelve `null` si `lastCompleteStandingsRound(d)` es `null`.

Reglas:
- Las tablas son las de `round`, completas y en orden. Pilotos con su equipo actual, como en `homeSnapshot`.
- `chart.rounds` son las rondas con tabla de pilotos hasta `round`, en orden.
- Hay una línea por piloto de la tabla de `round`, en el orden del campeonato, con el color de su equipo actual.
- `highlight` va en los 5 primeros. `dashed` va en un resaltado que tiene un compañero actual mejor ubicado entre los resaltados.

- [ ] **Step 1: Tests que fallan.** `d` es `season2026()` con las tablas de pilotos de las rondas 1 y 20 y la de constructores de la 20 (fixtures `driverstandings-2026-1.json`, `driverstandings-2026-20.json` y `constructorstandings-2026-20.json`, con `parseStandings`):
  - `round` 21; `drivers[0]` es ANT, 402 puntos, 9 victorias, `team` Mercedes; `constructors[0]` es Mercedes, 666, 12 victorias.
  - `chart.rounds` es `[1, 20, 21]`.
  - Línea de ANT: `points` `[18, 390, 402]`. Línea de CAM: `[null, 0, 0]` (**Review Focus 1**).
  - Los resaltados son `['ANT', 'VER', 'HAM', 'RUS', 'NOR']`. Solo RUS tiene `dashed: true` (**Review Focus 3**).
  - Hay tantas líneas como pilotos en la tabla de la 21.
  - Con `standings: []`, devuelve `null` (**Review Focus 4**).
- [ ] **Step 2:** `npx vitest run src/snapshots/championship.test.ts`. Esperado: FAIL, el módulo no existe.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: build the championship snapshot`.

### Task 2: El JSON de las stats

**Files:** Create `src/snapshots/stats.ts`. Modify `src/snapshots/types.ts`. Test `src/snapshots/stats.test.ts`.

**Interfaces:**
- Consumes: `driverRef`, `teamRef`, `currentTeam`, `placesGained` (`build.ts`); `contenders`, `remainingAfter`, `maxPoints` (`src/champion.ts`); `standingsOf`, `lastCompleteStandingsRound`.
- Produces, en `types.ts`:

```ts
export type Kpis = { wins: number; podiums: number; poles: number; dnfs: number; gained: number; average: number | null }
/** Con un solo candidato, ese es el campeón. */
export type TitleRace<T> = { contenders: T[]; pointsLeft: number }
/** `a` es el mejor ubicado de los dos en el campeonato. Marcadores como [a, b]. */
export type Duel = { team: string; color: string; a: DriverRef; b: DriverRef; quali: [number, number]; race: [number, number] }
export type StatsSnapshot = {
  season: number
  round: number
  titles: { drivers: TitleRace<DriverStanding>; constructors: TitleRace<TeamStanding> }
  drivers: (DriverRef & Kpis)[]
  teams: ({ team: string; color: string } & Kpis)[]
  duels: Duel[]
}
```

- Produces, en `stats.ts`: `statsSnapshot(d: SeasonData): StatsSnapshot | null`. Devuelve `null` si `lastCompleteStandingsRound(d)` es `null`.

Reglas, con las definiciones del spec §6:
- Solo cuentan los resultados de rondas `<= round`.
- `wins` y `podiums` cuentan las carreras con `positionText` numérico y posición 1, o de 1 a 3.
- `poles` cuenta P1 en `quali`. `dnfs` cuenta `positionText === 'R'` en `race`. `gained` es la suma de `placesGained` (null suma 0).
- `average` es el promedio de las posiciones con `positionText` numérico, redondeado a un decimal, o `null` si no hay ninguna.
- `drivers` y `teams` van en el orden de las tablas de `round`. Un equipo suma los resultados con su `constructorId`.
- `titles` usa `contenders` sobre la tabla de `round` y `remainingAfter(d.sessions, round)`, y `pointsLeft = maxPoints(…)` de cada tipo.
- Duelos: en cada ronda, se agrupan por `constructorId` los resultados de `quali` y, aparte, los de `race`; solo grupos de exactamente 2. La pareja se identifica por equipo y los dos `driverId`.
  - En `quali` cuenta si los dos tienen `q1`; en `race`, si los dos tienen `positionText` numérico. Gana la mejor posición.
  - Se listan las parejas con al menos una ronda contada, en el orden de la tabla de constructores. Dentro de un equipo van por rondas contadas, de mayor a menor.

- [ ] **Step 1: Tests que fallan.** Con `d = season2026()`, que trae Las Vegas completa y las tablas de la 21:
  - VER: `wins` 1, `podiums` 1, `gained` 0, `average` 1. NOR: `podiums` 1, `average` 2. PIA: `gained` 14. ANT: `poles` 1.
  - LIN y PER: `dnfs` 1, `average` null. ALB, que no largó ("W"): `dnfs` 0, `average` null (**Review Focus 5**). ALO, que abandonó pero quedó clasificado 19.º: `dnfs` 0, `average` 19.
  - Equipos: Red Bull `wins` 1 y `average` 8; McLaren `podiums` 2 y `average` 2.5; Mercedes `poles` 1; Racing Bulls `dnfs` 1. El primero de `teams` es Mercedes.
  - `titles.drivers`: contendientes `['ANT']` y `pointsLeft` 50. `titles.constructors`: `['Mercedes']`, 86. Con la tabla de la 21 cambiada para que VER tenga 360: `['ANT', 'VER']`.
  - Duelos: Red Bull VER/HAD: `a` VER, `quali` `[1, 0]`, `race` `[1, 0]`. Ferrari: `a` HAM, `quali` `[0, 1]`, `race` `[1, 0]`. Williams SAI/ALB: `quali` `[1, 0]`, `race` `[0, 0]`.
  - **Review Focus 1:** se suma una ronda 20 con las filas de Red Bull de la 21, con HAD reemplazado por `lawson`. Red Bull queda con dos parejas: VER/HAD y VER/LAW.
  - **Review Focus 2:** se suman las filas de `race` de la 21 copiadas como ronda 22, sin tabla de la 22. VER sigue con `wins` 1.
  - Con `standings: []`, devuelve `null`.
- [ ] **Step 2:** `npx vitest run src/snapshots/stats.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: build the stats snapshot`.

### Task 3: Guardar y servir los dos JSON

**Files:** Modify `src/snapshots/refresh.ts`, `src/app.ts`. Test `src/snapshots/refresh.test.ts`, `src/app.test.ts`.

**Interfaces:**
- Consumes: `championshipSnapshot`, `statsSnapshot`.
- Produces: claves `championship` y `stats` en `kv`, de la temporada que se muestra. Rutas `GET /api/championship` y `GET /api/stats`, con el helper `snapshot(c, key)` que ya existe: 200 con el JSON y `cache-control: public, max-age=60`, o 404 `{"error":"not_found"}`.

- [ ] **Step 1: Tests que fallan:**
  - `refresh.test.ts`: con 2026 guardada, `buildSnapshots` devuelve 26 (antes 24), y `championship` y `stats` parsean igual a lo que arman las funciones con lo leído de la base.
  - Con solo el calendario guardado no existen ni `championship` ni `stats` (**Review Focus 4**).
  - `app.test.ts`: con `championship` y `stats` cargados en `kv`, las dos rutas devuelven el texto guardado, con los headers de siempre. `/api/stats/x` da 404 en JSON.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. En `buildSnapshots`, cada uno se agrega a `rows` solo si no es `null`.
- [ ] **Step 4:** `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: serve the championship and stats snapshots`.

### Task 4: Menú, ruteo y página Campeonato

**Files:** Create `web/pages/Championship.tsx`. Modify `web/lib.ts`, `web/ui.tsx`, `web/pages/Race.tsx`, `web/App.tsx`, `web/pages/Home.tsx`. Test `web/lib.test.ts`.

**Interfaces:**
- Consumes: `ChampionshipSnapshot`.
- Produces, en `lib.ts`:
  - `Route` suma `{ page: 'championship' }` y `{ page: 'stats' }`.
  - `matchRoute` reconoce `/campeonato` y `/stats`, con o sin barra final.
  - `spreadLabels(ys: number[], gap: number, max: number): number[]` separa posiciones verticales (en % desde arriba) para que ninguna quede a menos de `gap` de otra. Devuelve en el orden de entrada.
- Produces, en `ui.tsx`: `Section`, `Column<T>`, `RIGHT` y `WIDE` se mudan sin cambios desde `Race.tsx`, que pasa a importarlos.

Algoritmo de `spreadLabels`: ordenar por valor. De arriba hacia abajo, cada una queda en `max(propia, anterior + gap)`. Si la última pasa `max`, de abajo hacia arriba la última queda en `max` y cada una en `min(propia, siguiente − gap)`.

La página, con el orden y los textos del spec §5.2:
- `h1` "Campeonato {season}" y debajo "Después de la ronda {round}".
- `h2` "Puntos fecha a fecha", "Pilotos" y "Constructores".
- Columnas de pilotos: "Pos", "Piloto", "Nombre" y "Equipo" (estas dos solo en pantallas anchas, con `WIDE`), "Victorias" y "Pts". Columnas de constructores: "Pos", "Equipo" (con `DriverTag` del color), "Victorias" y "Pts".
- `useTitle('Campeonato')`. Sin snapshot: `NotFound` con "Todavía no hay datos cargados."

El gráfico:
- Alto fijo `h-72`. Las líneas van en un SVG `viewBox="0 0 100 100"` con `preserveAspectRatio="none"` y `vector-effect: non-scaling-stroke`.
- Los códigos son HTML con posición absoluta en %, así no se achican con el dibujo. Se separan con `spreadLabels(…, 5, 100)`.
- Primero las líneas grises, después las resaltadas. La punteada usa `stroke-dasharray`.
- Líneas guía horizontales cada 100 puntos (cada 50 si el máximo es menor a 200), con su número.
- En el eje X, la primera ronda, la última y cada 5.
- `role="img"` y `aria-label` "Puntos acumulados. Los cinco primeros: ANT 402, VER 304, HAM 267, RUS 264, NOR 264".

Menú: los dos ítems nuevos, activos en sus rutas. Inicio: debajo de las tablas, `Link` "Ver las tablas completas" a `/campeonato`.

- [ ] **Step 1: Tests que fallan** en `lib.test.ts`:
  - `matchRoute`: `/campeonato` y `/campeonato/` dan `championship` (hoy el caso `/campeonato` espera `notFound`: se cambia), `/stats` da `stats` y `/campeonato/x` da `notFound`.
  - `spreadLabels([10, 11, 50], 5, 100)` da `[10, 15, 50]`; `spreadLabels([50, 11, 10], 5, 100)` da `[50, 15, 10]`; `spreadLabels([97, 99], 5, 100)` da `[95, 100]`.
- [ ] **Step 2:** `npx vitest run web/lib.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `lib.ts`, mudar `Section`, y armar la página, el menú y el enlace.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run build`. Esperado: PASS.
- [ ] **Step 5:** `npm run snapshots` y `npm run dev`. Capturas de `/campeonato` en 1280 px y en 390 px; para el celular, la página dentro de un `iframe` de 390 px, porque Chrome sin ventana no achica la ventana a ese ancho. Comprobar:
  - Los códigos al final de las líneas no se pisan.
  - RUS se ve punteado.
  - El menú se ve prolijo en 390 px.
  - Ninguna tabla desborda la página.
- [ ] **Step 6:** Commit `feat: add the championship page`.
- [ ] **Step 7:** **Revisión del autor**: mira `/campeonato` en el celular y en escritorio. La Tarea 5 espera sus correcciones.

### Task 5: Página Stats

**Files:** Create `web/pages/Stats.tsx`. Modify `web/lib.ts`, `web/App.tsx`. Test `web/lib.test.ts`.

**Interfaces:**
- Consumes: `StatsSnapshot`, `Section`.
- Produces, en `lib.ts`: `formatAverage(v: number | null): string` y `formatGained(v: number): string`.

Textos (spec §5.3):
- `h1` "Stats {season}" y "Después de la ronda {round}".
- `h2` "¿Quién puede ser campeón?", "Pilotos", "Equipos" y "Duelos de compañeros".
- En "¿Quién puede ser campeón?" van dos bloques, "Pilotos" y "Constructores":
  - Con un solo contendiente: "{name} es el campeón {season}" (pilotos) y "{team} es el campeón de constructores {season}".
  - Con más: los contendientes con `DriverTag` y sus puntos, y "Quedan {pointsLeft} puntos en juego".
- Columnas de las dos tablas de KPIs: "Victorias", "Podios", "Poles", "Abandonos", "Posiciones" y "Promedio", después de "Piloto" o "Equipo".
- Notas debajo:
  - "Posiciones: las ganadas o perdidas desde la grilla, sumadas."
  - "Promedio: la posición de llegada, solo en las carreras que terminó clasificado."
  - Debajo de los duelos: "En clasificación cuentan las fechas en que los dos marcaron tiempo; en carrera, las que los dos terminaron clasificados."
- Cada duelo: el equipo y dos renglones, "Clasificación" y "Carrera", con `{a.code} {x} – {y} {b.code}` y el `DriverTag` de cada uno.
- `useTitle('Stats')`. Sin snapshot, como Campeonato.

- [ ] **Step 1: Tests que fallan:** `formatAverage(4.25)` da `'4,3'`; `formatAverage(8)` da `'8,0'`; `formatAverage(null)` da `'—'`; `formatGained(14)` da `'+14'`, `formatGained(0)` da `'0'` y `formatGained(-3)` da `'-3'`.
- [ ] **Step 2:** `npx vitest run web/lib.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run build`. Esperado: PASS.
- [ ] **Step 5:** Capturas de `/stats` en 1280 px y en 390 px, como en la Tarea 4. Comprobar:
  - Muestra "Andrea Kimi Antonelli es el campeón 2026" y "Mercedes es el campeón de constructores 2026".
  - Las tablas se desplazan de costado sin desbordar la página.
- [ ] **Step 6:** Commit `feat: add the stats page`.
- [ ] **Step 7:** **Revisión del autor.**

### Task 6: Cierre y publicación

**Files:** Modify `README.md`, `docs/2026-11-25-f1-dash-design.md`.

- [ ] **Step 1:** README: el **Estado** dice que la web está completa (falta el reloj).
  - En el spec original, una nota en §6.2: con un solo candidato, el bloque muestra al campeón.
  - Otra nota en §6.3: las stats y el campeonato tienen sus propias rutas.
  - Las dos notas apuntan a este spec.
- [ ] **Step 2:** `npm test && npm run typecheck && npm run build`. Commit `docs: document the second web delivery`.
- [ ] **Step 3:** Revisión final de toda la rama y arreglo de lo que corresponda.
- [ ] **Step 4:** **Consultar al autor.** Con su OK: `npm run deploy` y `npm run snapshots -- --remote`. Si el seed de después de Qatar ya corrió con este código, `snapshots` alcanza igual.
- [ ] **Step 5:** En producción:
  - `/campeonato` y `/stats` dan 200 con la página.
  - `/api/championship` y `/api/stats` dan 200 con el JSON.
  - `/api/stats/x` da 404 en JSON.
  - El autor mira las dos páginas en el celular.
- [ ] **Step 6:** Medir con `wrangler tail --format json` los pedidos a `/api/championship` y `/api/stats` y anotarlo en la §9 del spec original. Si hay `exceededCpu` o pasan 10 ms, consultar al autor.
- [ ] **Step 7:** Cerrar la rama con superpowers:finishing-a-development-branch. El push se consulta aparte.
