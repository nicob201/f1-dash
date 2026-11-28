# Web, entrega 2: Campeonato y Stats

- **Fecha:** 2026-11-28
- **Estado:** borrador para el autor
- **Base:** `docs/2026-11-25-f1-dash-design.md` (en adelante, "el spec") y `docs/superpowers/specs/2026-11-27-web-entrega-1-design.md` ("la entrega 1"). Lo que este documento no cambia vale como está ahí. Lo marcado **(Claude)** es una decisión propia para que el autor la revise.

## 1. Qué es y para qué

La segunda y última entrega de la web del spec (sección 6.2): las páginas **Campeonato** y **Stats**. La entrega 1 ya está publicada, con el Inicio, las Carreras y el panel de cada circuito. Igual que en esa entrega, la estética importa tanto como que funcione.

Con esta entrega la web queda completa para el receso: la temporada 2026 termina el 6/12 y hasta marzo de 2027 la web muestra 2026.

## 2. Objetivos

1. Página **Campeonato** (`/campeonato`): las dos tablas completas y un gráfico de puntos acumulados fecha a fecha.
2. Página **Stats** (`/stats`): KPIs por piloto y por equipo, duelos de compañeros y "¿Quién puede ser campeón?".
3. **Campeonato** y **Stats** se suman al menú.
4. Todo precalculado en snapshots, como en la entrega 1: una visita nunca calcula nada pesado ni consulta fuentes externas.

**Fuera de esta entrega:**
- Un gráfico de constructores: el gráfico es de pilotos **(Claude)**. Las tablas sí son las dos.
- Interacción con el gráfico (tocar, resaltar, elegir pilotos): el autor eligió el gráfico fijo.
- Temporadas anteriores, stats de la sprint y el desempate por victorias en "¿Quién puede ser campeón?" (ya excluido en el spec).

**Anti-objetivos:** los del spec y la entrega 1. Pesan acá: no se afirma lo que no sabemos, nada parece oficial de la F1 y no se sobre-diseña.

## 3. Restricciones

- Mismo Worker, misma D1 y mismo estilo "Pit wall" (spec §6.4). Sin dependencias nuevas para el gráfico **(Claude)**: un SVG hecho a mano, como el trazado del circuito.
- Cuando exista el reloj, rearmar los snapshots tiene que entrar en 10 ms de CPU (spec §9.5, sin medir). Las stats son cuentas lineales sobre unos 2000 resultados: no deberían pesar, pero el plan las mide.
- Se ve bien en un celular de 390 px y en escritorio.

## 4. Enfoques

**El gráfico** (elegido por el autor el 2026-11-28):

1. **Fijo, los 5 primeros resaltados (elegido).** Los cinco primeros del campeonato con el color de su equipo y su código al final de la línea; el resto en gris, finitas y sin nombre. Se lee igual en celular y no necesita interacción.
2. Las 22 líneas, tocar una para resaltarla: más completo, pero en el celular cuesta acertarle a una línea.
3. Elegir pilotos con botones: lo más flexible y lo que más trabajo lleva.

**Cómo se dibuja (Claude):** SVG a mano con los puntos ya armados en el snapshot. Una biblioteca de gráficos sumaría peso al bundle para un solo gráfico fijo.

## 5. Las páginas

### 5.1 Menú e Inicio

- Menú: **Inicio**, **Carreras**, **Campeonato**, **Stats**. En un celular angosto puede pasar a una segunda línea: tiene que verse prolijo igual.
- En el Inicio, el bloque de campeonatos suma un enlace "Ver las tablas completas" a `/campeonato` **(Claude)**.

### 5.2 Campeonato

De arriba abajo **(Claude, el orden)**:

1. Título "Campeonato 2026" y "Después de la ronda N" (la última ronda con las dos tablas, como en el Inicio).
2. **Gráfico "Puntos fecha a fecha":**
   - Eje X: las rondas, de la 1 a la N. Eje Y: puntos, con líneas guía en valores redondos.
   - Los 5 primeros del campeonato actual: línea gruesa con el color de su equipo y el código al final. Si dos de ellos son del mismo equipo, el peor ubicado va punteado. Hoy pasa con Antonelli y Russell (Mercedes), así que no depende solo del color.
   - El resto: línea fina en gris, sin nombre.
   - Los puntos de cada ronda salen de la tabla guardada de esa ronda, no de sumar resultados: así coinciden con las tablas.
   - Un piloto que entró o salió a mitad de año tiene línea solo en las rondas en que figura en la tabla.
   - Los códigos al final de las líneas no se pisan: si dos quedan cerca (hoy Hamilton 267 y Russell 264), se separan en vertical.
   - El texto del gráfico se lee en el celular: no se achica con el dibujo.
   - Para lectores de pantalla: una descripción con los cinco primeros y sus puntos. Los datos completos están en las tablas de abajo.
3. **Pilotos:** la tabla completa. Columnas: posición, piloto (el `DriverTag` de la entrega 1), nombre y equipo (solo en pantallas anchas), victorias y puntos. El equipo es el actual.
4. **Constructores:** la tabla completa. Columnas: posición, equipo con su color, victorias y puntos.

En escritorio las dos tablas pueden ir lado a lado. Lo decide el builder mirándolo.

Sin tablas cargadas, la página dice "Todavía no hay datos cargados", como el Inicio.

### 5.3 Stats

De arriba abajo:

1. **"¿Quién puede ser campeón?"**, para pilotos y para constructores, con la lógica que ya existe en `src/champion.ts` (la usa el bot):
   - Con más de un candidato: los candidatos con sus puntos y cuántos puntos quedan en juego.
   - Con uno solo **(Claude)**: "Andrea Kimi Antonelli es el campeón 2026" (el nombre como viene de Jolpica) (y lo mismo para constructores). Es seguro: con un solo candidato, nadie puede ni empatarlo. El spec decía mostrar el bloque solo "mientras haya más de un candidato". Hoy los dos títulos de 2026 ya están definidos, y así el bloque no desaparece justo en el cierre.
2. **Pilotos:** una tabla con victorias, podios, poles, abandonos, posiciones ganadas y promedio de llegada, en el orden del campeonato. En el celular la tabla se desplaza de costado, como las de la entrega 1.
3. **Equipos:** la misma tabla por equipo.
4. **Duelos de compañeros:** por equipo, cada pareja que corrió junta, con el marcador en clasificación y en carrera (por ejemplo "VER 15 – 4 HAD"). Las parejas salen de las rondas en que los dos corrieron para el mismo equipo. Haas tuvo cuatro pilotos este año, así que tiene varias parejas.

## 6. Definiciones

Las del spec, con lo verificado en los datos de 2026:

- **Victoria y podio:** solo la carrera del domingo, clasificados en P1 y P1–P3. La sprint no cuenta.
- **Pole:** P1 de la clasificación.
- **Abandono:** `positionText` "R", es decir, no clasificado tras largar. En 2026 son 75: 73 con status "Retired" y 2 con "Lapped". No cuentan "W" (no largó, 9 casos), "D" o "E" (descalificado), ni los 10 que abandonaron pero quedaron clasificados por distancia.
- **Posiciones ganadas:** la suma de `placesGained` (ya existe: `grid − posición`, solo clasificados que no largaron desde boxes). Puede ser negativa.
- **Promedio de llegada (Claude):** el promedio de las posiciones de las carreras en que terminó clasificado, con un decimal. Sin ninguna, "—".
- **Por equipo (Claude):** se suman los dos autos. Dos podios en la misma carrera cuentan 2. El promedio es sobre todas las llegadas clasificadas del equipo.
- **Duelos:** en clasificación cuenta cada ronda en que los dos marcaron tiempo, y gana el de mejor posición. En carrera cuenta cada ronda en que los dos terminaron clasificados, y gana el de mejor posición.
- **Equipo de un piloto:** en las tablas, el actual. En los duelos, el de cada ronda.

## 7. Datos y API

- Dos snapshots nuevos en `kv`, para la temporada que se muestra (la misma que el Inicio): `championship` y `stats` **(Claude)**. Los arma `buildSnapshots`, junto con los demás. Hay que correr `npm run snapshots` (o el seed) para que existan.
- `GET /api/championship` y `GET /api/stats`: 200 con el JSON, o 404 si todavía no hay snapshot. Como las otras rutas de la API. El spec (§6.3) ponía las stats dentro de `/api/home`; la entrega 1 ya había separado el Inicio, y esto sigue esa línea **(Claude)**.
- El snapshot del campeonato lleva las dos tablas, la ronda y, por piloto, los puntos acumulados ronda a ronda (22 × 21 números hoy). Qué líneas se resaltan y cuál va punteada se decide al armar el snapshot, así el navegador solo dibuja **(Claude)**.
- Funciones puras con tests, como `homeSnapshot` y `raceSnapshot`.

## 8. Verificación y publicación

- Tests de cada definición con datos armados a mano y con los fixtures reales. Los fixtures traen una sola carrera completa (Las Vegas), así que los totales de la temporada se comparan además, una vez, contra la D1 local cargada.
- Revisión del autor: primero Campeonato y después Stats, en celular y escritorio, antes de seguir. Así se hizo con el Inicio en la entrega 1.
- Publicación con OK del autor: deploy y `npm run snapshots -- --remote` (si ya corrió Qatar, el seed alcanza). Medir la CPU de `/api/championship` y `/api/stats` con `wrangler tail`, como en la entrega 1.

## 9. Queda al builder

- La forma exacta de los JSON.
- El estilo del gráfico dentro del "Pit wall": grosores, tamaños, cuántas líneas guía.
- El acomodo de las tablas en escritorio.
- Cómo se separan los códigos al final de las líneas.
