# F1 Dash: documento de diseño

- **Fecha:** 2026-11-25
- **Estado:** aprobado por el autor el 2026-11-26
- **Nombre:** F1 Dash (elegido por el autor el 2026-11-25). Bot `@F1DashArBot` y canal `@F1DashAr` (aparecían libres el 2026-11-25; se confirman al registrarlos). Arma serie con Boca Dash.
- **Roles:** el autor (dueño del proyecto) prueba cada fase. Claude escribe el código con SDD (spec primero) y TDD.
- **Proyecto hermano:** Boca Dash (`~/Developer/boca-dash`). Muchas decisiones se copian de ahí a propósito.

## 1. Qué es y para qué

Un proyecto personal con dos partes:

1. **Un canal público de Telegram** donde un bot publica los avisos de cada fin de semana de Fórmula 1: la previa con los horarios, la clasificación, la hora de largada con la grilla y, al terminar la carrera, el resultado con los campeonatos de pilotos y constructores actualizados. El mismo bot responde algunos comandos por privado.
2. **Un panel web público** con la temporada en curso: próxima carrera, última carrera, campeonatos, estadísticas y el detalle de cada carrera.

**Para qué:** mantener la cabeza activa con un proyecto propio, aprender un stack que el autor no usó todavía (Cloudflare Workers, D1/SQLite, Cron Triggers, Hono) y publicarlo en LinkedIn. Es de uso personal, pero abierto a quien quiera seguirlo.

**Lo que tiene que lograr:** que los mensajes y la web se vean muy bien y prolijos. La estética importa tanto como que funcione.

## 2. Objetivos (v1)

1. Canal público de Telegram con los avisos de la sección 4.
2. Bot que responde por privado los comandos de la sección 4.4.
3. Panel web público, sin login, en dark mode y con el estilo "Pit wall" (sección 6).
4. Navegación entre todas las carreras de la temporada en curso.
5. Costo cero permanente, sin tarjeta de crédito en ningún servicio.

## 3. Fuera de alcance y anti-objetivos

**Fuera de v1:**

- Datos en vivo de ningún tipo: posiciones en carrera, boxes, safety car o banderas. OpenF1 en vivo es pago y el live timing oficial pide cuenta F1TV.
- Avisos de las prácticas libres. Sus horarios sí aparecen en la previa y en la web.
- Estrategia de neumáticos.
- Historia de la F1 y selector de temporadas. Los datos de temporadas anteriores **no se borran**, pero la web solo muestra la temporada en curso.
- Fotos de pilotos, escudos y logos de equipos.
- Login, cuentas o preferencias por usuario.
- Mensajes privados masivos: todo lo que es para todos va al canal.
- Capa de lecciones como la de Boca Dash. Las decisiones clave van en el README.
- Light mode e idiomas que no sean el español.
- Dominio propio: se usa el subdominio gratis `*.workers.dev`.

**Anti-objetivos (sería un fracaso aunque funcione):**

- Que cueste plata o pida tarjeta.
- Que el canal reciba un aviso duplicado, por ejemplo después de un reintento o de dos ejecuciones del reloj en paralelo.
- Que la web dependa de que Jolpica u OpenF1 respondan en el momento.
- Que una visita a la web dispare una consulta a Jolpica u OpenF1. El reloj consulta, la web lee.
- Que el sitio o el canal parezcan oficiales de la Fórmula 1: no se usan el logo de F1 ni su tipografía, y el footer lo aclara.
- Que un mensaje afirme algo que no sabemos. Por ejemplo, el aviso de largada sale por horario, así que no puede decir "largó" como si lo hubiéramos visto.
- Pasarse de los límites del plan gratis de Cloudflare (sección 7.3).
- Sobre-ingeniería: capas, servicios o abstracciones que v1 no necesita.

## 4. El canal y el bot

Todos los textos van en español rioplatense y todos los horarios en hora de Argentina (`America/Argentina/Buenos_Aires`). Los mensajes usan `parse_mode: HTML` y las tablas van en `<pre>` para que las columnas queden alineadas en el celular. Cada tabla lleva barra de título (`<pre><code class="language-Pilotos">`), para que el botón de copiar de Telegram no tape datos. *(Elegido por el autor el 2026-11-26.)*

### 4.1 Avisos del canal

| Aviso | Cuándo | Contenido |
|---|---|---|
| Previa | 10:00 del día anterior a la Práctica Libre 1 | GP, ronda, circuito y los horarios de todas las sesiones en hora argentina |
| Clasificación | Cuando el resultado de la clasificación está disponible | Resultado completo con los 22 pilotos |
| Clasificación sprint | Ídem, en los fines de semana con sprint | Resultado completo |
| Largada de la sprint | A la hora programada de la sprint | Hora de largada y grilla |
| Resultado de la sprint | Cuando el resultado está disponible | Resultado con los puntos |
| Largada de la carrera | A la hora programada de la carrera | Hora de largada y grilla de salida |
| Resultado de la carrera | Cuando están disponibles el resultado **y** las tablas de esa ronda | Top 10 con puntos, vuelta rápida, campeonato de pilotos (top 10, con los puntos sumados en la fecha) y de constructores (completo), más link a la web |
| Campeón | Dentro del mensaje de resultado, en la fecha en que el título queda definido | Una línea extra: "X es campeón del mundo" (pilotos y/o constructores) |

- Solo hay avisos de sesiones que empiezan desde la fecha de activación del reloj (`notifyFrom`), para que el primer arranque no publique la temporada ya cargada. *(Aprobado el 2026-11-26.)*
- La previa también vence a los 30 minutos. Si a la hora de largada no hay grilla ni clasificación, el aviso sale igual, sin la tabla. Sin carreras por delante, el campeón es el P1 de la tabla. *(Aprobado el 2026-11-26.)*
- La clasificación sprint lista solo a quienes informe OpenF1, que en tres rondas de 2026 fueron 20 o 21. Los descalificados salen como `DSQ`. *(Aprobado el 2026-11-26.)*
- El resultado de la carrera sale solo si las dos tablas cierran: los puntos de cada una son los de la ronda anterior más lo repartido en la sprint y la carrera. Si no cierran, espera; a las 6 horas, alerta al admin. Una sanción de puntos lo deja frenado hasta que el autor intervenga. *(Aprobado el 2026-11-26. La alerta la implementa el reloj.)*
- Si Jolpica cambia el horario de una sesión, los avisos programados usan el horario nuevo, porque el calendario se resincroniza (sección 5.3).
- Si el reloj estuvo caído y un aviso de horario ya pasó, se manda igual solo si no pasaron más de 30 minutos. Pasado ese tiempo se descarta. Los avisos de resultado no vencen. *(Decisión de Claude.)*

### 4.2 Ejemplos

Previa:

```
🗓️ Se viene el GP de Qatar (ronda 22 de 23)
Circuito Internacional de Lusail

Vie 27  Práctica libre 1   10:30
Vie 27  Práctica libre 2   14:00
Sáb 28  Práctica libre 3   11:30
Sáb 28  Clasificación      15:00
Dom 29  Carrera            13:00

Horarios de Argentina.
```

Largada:

```
🚦 Hora de largada en Qatar

Grilla de salida
 1 VER  Red Bull
 2 RUS  Mercedes
 3 NOR  McLaren
 …
```

Resultado de la carrera (los datos son reales del GP de Las Vegas 2026, salvo los puntos sumados que son ilustrativos):

```
🏁 GP de Las Vegas: resultado
 1 VER  Red Bull   25
 2 NOR  McLaren    18
 3 PIA  McLaren    15
 …
Vuelta rápida: …

🏆 Pilotos
 1 ANT  402
 2 VER  304  +25
 3 HAM  267
 …
🔧 Constructores
 …

Todo el detalle en <link a la web>
```

El texto exacto de cada mensaje lo define el builder dentro de este tono. La regla de los anti-objetivos manda: el aviso de largada dice "hora de largada", no "largó".

### 4.3 Grilla de salida

- **Fuente principal:** el endpoint `starting_grid` de OpenF1, consultado con el `session_key` de la **clasificación**. Verificado el 2026-11-25 con Las Vegas 2026: coincide con el campo `grid` de los resultados de Jolpica (VER 1, NOR 3, PIA 17), así que incluye las penalizaciones.
- **Plan B:** si a la hora de largada no hay grilla en OpenF1, se usa el orden de la clasificación de Jolpica con la aclaración "según la clasificación; puede cambiar por penalizaciones".
- Para la sprint vale lo mismo con la clasificación sprint. Hay que verificar que OpenF1 tenga la grilla de la sprint con ese `session_key` (sección 9).

### 4.4 Comandos del bot (por privado)

- `/start`: bienvenida, link al canal y link a la web.
- `/proxima`: próxima carrera con los horarios de las sesiones.
- `/ultima`: resultado de la última carrera.
- `/campeonato`: las dos tablas.
- Cualquier otro mensaje: respuesta corta con la lista de comandos.

Los comandos leen solo la base. No consultan Jolpica ni OpenF1. *(La lista de comandos es una decisión de Claude.)*

*(Aprobado el 2026-11-26:)* el bot contesta solo en chats privados; fotos, stickers y audios reciben la lista de comandos; Telegram muestra el menú de comandos; mientras el canal no esté abierto, `/start` dice "El canal con los avisos está por abrir.".

### 4.5 Setup de Telegram

- El bot tiene que ser administrador del canal para poder publicar.
- El webhook se registra con `secret_token`, y el Worker rechaza cualquier pedido que no traiga ese valor en el header `X-Telegram-Bot-Api-Secret-Token`, comparado en tiempo constante, igual que el `CRON_SECRET` de Boca Dash.
- Hay un `ADMIN_CHAT_ID` para las alertas al autor (sección 5.5).

## 5. Datos

### 5.1 Fuentes

**Jolpica** (`https://api.jolpi.ca/ergast/f1/`, el reemplazo de Ergast, sin key). Verificado el 2026-11-25:

- **Calendario 2026:** 23 carreras, con fecha y hora UTC de cada sesión. Las claves son `FirstPractice`, `SecondPractice`, `ThirdPractice`, `Qualifying`, `Sprint` y `SprintQualifying`. En 2026 hay seis fines de semana con sprint: China, Miami, Canadá, Gran Bretaña, Países Bajos y Singapur.
- **Resultados de carrera y sprint:** posición, `grid`, puntos, `status`, tiempo y `FastestLap.rank`.
- **Resultados de la clasificación.**
- **Tablas de pilotos y constructores por ronda.**
- **Paradas en boxes.**
- **Límite:** 4 pedidos por segundo y 500 por hora **por IP**.

**OpenF1** (`https://api.openf1.org/v1/`, histórico gratis y sin login):

- **Usos:** `sessions` (para obtener los `session_key`), `starting_grid` (sección 4.3) y, como plan B, `session_result`. Verificado el 2026-11-25 con Las Vegas 2026.
- **Cruce con Jolpica:**
  - Pilotos: por número de auto y temporada.
  - Sesiones: por fecha y hora de inicio. OpenF1 usa `meeting_key` y `session_key`, no la ronda.

**Verificado el 2026-11-26:**

- Jolpica **no tiene** la clasificación sprint: sale de `session_result` de OpenF1.
- El Cloudflare de Jolpica responde 403 al User-Agent por defecto de Node. Todo pedido manda uno genérico propio.
- OpenF1 responde 404 cuando todavía no hay datos.
- Los horarios coinciden en 114 de 115 sesiones; la carrera de Miami difiere 3 horas. El cruce de sesiones admite una tolerancia de 12 horas.

**Colores de los equipos:** no los da Jolpica. Salen de un mapa fijo por temporada en el código, o del campo `team_colour` de `drivers` en OpenF1. Lo elige el builder.

### 5.2 Regla de oro

Igual que en Boca Dash: **el reloj consulta, la web lee.** Solo el reloj habla con Jolpica y OpenF1. Guarda lo que encuentra en D1, ya traducido a nuestra forma y validado con zod, así que ni la web ni los comandos dependen de la forma del JSON de las fuentes.

### 5.3 El reloj

Un Cron Trigger cada minuto (`* * * * *`). En cada ejecución:

1. **Decide qué toca**, con una función pura: `decide(calendario, datos guardados, avisos enviados, ahora)` → avisos a mandar y datos a buscar. Sin I/O, con `ahora` como parámetro. Ahí viven los tests de la lógica.
2. **Busca solo lo que hace falta:**
   - **Calendario:** una vez por día.
   - **Resultados:** desde el fin nominal de la sesión (inicio + 60 min para la clasificación, 45 para la clasificación sprint, 60 para la sprint y 120 para la carrera), cada 5 minutos, hasta que aparezcan o pasen 6 horas. Si se cumplen las 6 horas, alerta al admin.
   - **Grilla:** desde 3 horas antes de la largada, cada 10 minutos, hasta que aparezca.
3. **Manda los avisos que tocan**, reclamando cada uno antes de mandarlo (sección 5.4).
4. **Si entraron datos nuevos, recalcula los snapshots** de la web (sección 6.3).

**Comparar estados, no eventos:** igual que en Boca Dash, cada ejecución compara lo que hay con lo ya enviado. Si el reloj se cae un rato, la siguiente ejecución se pone al día (con el límite de 30 minutos para los avisos de horario, sección 4.1).

La carga inicial de la temporada (calendario y todas las rondas ya corridas) se hace con un script local que escribe en D1, no desde el Worker, para no chocar con los límites de CPU y de llamadas.

### 5.4 Avisos a lo sumo una vez

Igual que en Boca Dash: cada aviso tiene una clave (por ejemplo `2026:22:race-start`), y se reclama con `insert … on conflict do nothing returning` sobre esa clave como primary key **antes** de mandarlo. Si dos ejecuciones corren a la vez, solo una gana. El costo es que, si el Worker se cae entre el reclamo y el envío, ese aviso se pierde en lugar de duplicarse. D1 (SQLite) soporta `ON CONFLICT DO NOTHING` y `RETURNING`.

### 5.5 Errores

- Si zod falla al validar una respuesta, no se escribe nada y se alerta al admin por Telegram, como mucho una vez por hora (igual que el `fail()` de Boca Dash).
- Un 429 de Jolpica no es un error grave: se reintenta en la próxima ventana de consulta. Si se repite durante una hora, alerta al admin.
- El reloj nunca lanza una excepción sin atrapar. Cada ejecución termina con un resumen en el log.

### 5.6 Modelo de datos (propuesta)

Es una guía. Los nombres y la forma exacta los decide el builder.

- `races`: temporada, ronda, nombre, circuito, localidad, país.
- `sessions`: temporada, ronda, tipo (`fp1`, `fp2`, `fp3`, `quali`, `sprint_quali`, `sprint`, `race`), `starts_at` en UTC y `session_key` de OpenF1 cuando se conoce.
- `drivers` y `constructors` por temporada (código, número, nombre, equipo, color).
- `results`: temporada, ronda, tipo de sesión, piloto, posición, grilla, puntos, estado, tiempo y vuelta rápida.
- `standings`: temporada, ronda, tipo (pilotos o constructores), entidad, posición, puntos y victorias.
- `grids`: temporada, ronda, tipo (carrera o sprint), piloto, posición y fuente (`openf1` o `quali`).
- `notices`: clave (PK) y `sent_at`.
- `kv`: snapshots de la web y el control de alertas.

Las horas se guardan en UTC y se convierten a hora argentina solo al mostrarlas. Nada se borra al cambiar de temporada: todas las consultas filtran por temporada.

## 6. La web

### 6.1 Qué temporada se muestra

La de la última carrera terminada. Entre diciembre y marzo se ve la temporada anterior completa, con la cuenta regresiva a la primera carrera de la nueva. Cuando termina esa carrera, la web pasa sola a la temporada nueva. Es la misma regla que Boca Dash. Si Jolpica todavía no publicó el calendario nuevo, en lugar de la cuenta regresiva se muestra "El calendario <año> todavía no está publicado".

### 6.2 Páginas

- **Inicio:**
  - próxima carrera: GP, ronda, circuito, cuenta regresiva y horarios en hora argentina;
  - última carrera: top 5 con tiempos y vuelta rápida;
  - campeonatos: top 4 de pilotos y top 3 de constructores;
  - botón "Recibí los avisos en Telegram", que lleva al canal.
- **Carreras:** la lista de la temporada (corridas y por correr). Cada carrera tiene su página con flechas a la anterior y a la siguiente. La página muestra:
  - resultado completo;
  - clasificación;
  - sprint, si hubo;
  - grilla contra llegada (posiciones ganadas o perdidas);
  - vuelta rápida;
  - paradas en boxes.

  Si la carrera no se corrió, muestra los horarios.
- **Campeonato:** las dos tablas completas y un gráfico de puntos acumulados fecha a fecha.
- **Stats:**
  - **KPIs por piloto y por equipo:** victorias, podios, poles, abandonos, posiciones ganadas y promedio de llegada.
  - **Duelos de compañeros:** quién terminó adelante, en clasificación y en carrera.
  - **"¿Quién puede ser campeón?"**, mientras haya más de un candidato.

**Definiciones** (el builder las verifica contra los fixtures reales):

- Victorias y podios son solo de la carrera del domingo. La sprint no cuenta.
- La pole es el P1 de la clasificación.
- Abandono: no clasificado según el `status` de Jolpica. Hay que mapear los valores reales.
- Posiciones ganadas = `grid − posición`, solo para clasificados que no largaron desde boxes (`grid` 0).
- Duelos: en clasificación, cuenta toda fecha donde los dos marcaron tiempo. En carrera, cuenta toda fecha donde los dos terminaron clasificados.
- "¿Quién puede ser campeón?":
  - Máximo de puntos que quedan en juego = carreras restantes × 25 + sprints restantes × 8 (en 2026 no hay punto por vuelta rápida).
  - Un piloto tiene chances si sus puntos más ese máximo son ≥ los del líder. El desempate por victorias queda afuera. *(`ponytail:`, con el límite anotado.)*
  - Para constructores, el máximo es 43 por carrera (25 + 18) y 15 por sprint (8 + 7).
  - Es lógica pura con tests, y la comparten la web y el mensaje de campeón.

### 6.3 API

Un Worker con Hono. Las respuestas son `GET` públicos y nunca consultan las fuentes.

- `GET /api/home`: inicio, campeonatos y stats de la temporada en curso.
- `GET /api/races/:season/:round`: el detalle de una carrera.

**Decisión de Claude: snapshots precalculados.** Cuando el reloj guarda datos nuevos, arma el JSON de cada endpoint con SQL (KPIs, duelos, puntos acumulados) y lo guarda en `kv`. La API lee una sola fila. Las razones:

- Los datos cambian pocas veces por fin de semana.
- Cada visita lee una fila en lugar de cientos, lo que cuida el tope diario de filas leídas de D1.
- No dependemos de la caché de Cloudflare, que en `*.workers.dev` podría no funcionar con la Cache API (a verificar, sección 9).

Es lo opuesto a lo que se eligió en Boca Dash, y la diferencia está justificada: allá la CDN de Vercel cacheaba gratis. Además, las respuestas llevan un `Cache-Control` corto para el navegador.

### 6.4 Estilo visual: "Pit wall"

Elegido por el autor el 2026-11-25 entre tres opciones. La referencia es la opción A de `docs/mockups/estilos.html` (captura en `docs/mockups/estilos.png`).

- **Fondo carbono `#15151E`**, paneles `#22222E`, líneas `#2D2D3B`, texto `#F3F3F7` y texto secundario `#9C9CB0`.
- **Acento rojo `#EE2B3B`:** la barra bajo el header, el botón de Telegram y la carrera dentro del horario. Es un rojo propio, no el de la marca F1.
- **Violeta `#B455FF`** solo para la vuelta rápida.
- **Tipografía Archivo** (variable, de Omnibus-Type), en un solo family:
  - Títulos de GP: peso 900, itálica, ancho 62%.
  - Códigos de piloto y puntos: peso 800, ancho 75%.
  - Texto corrido: ancho normal.
  - Números con `tabular-nums`.
- **Cada piloto lleva una franja inclinada con el color de su equipo**, como la torre de tiempos de la tele. Las posiciones van en chips con forma de paralelogramo, y el P1 se resalta en blanco.
- **El color nunca va solo:** siempre está el código del piloto y el número de posición.
- **Responsive hasta mobile** (las grillas pasan a una columna), foco visible con teclado y `prefers-reduced-motion` respetado.
- **Footer:** "Proyecto de un fan. No es un sitio oficial de la Fórmula 1." y "Datos: Jolpica y OpenF1".

Los mockups tienen datos inventados (por ejemplo, la ronda "23 de 24") y el nombre de trabajo anterior, "Parque Cerrado". Los datos reales salen de la API.

## 7. Stack e infraestructura

### 7.1 Piezas

- **Un solo Cloudflare Worker** en TypeScript que hace todo:
  - Hono para las rutas;
  - el handler `scheduled` para el reloj;
  - Static Assets para la web, con el fallback de SPA para las rutas del front.
- **D1** con Drizzle (`drizzle-orm/d1`). Las migraciones se aplican con `wrangler d1 migrations`.
- **zod** para validar todo lo que entra.
- **Telegram Bot API** con `fetch` directo, sin librería (como en Boca Dash).
- **Front** en React + Vite + Tailwind, como el Plan 3 de Boca Dash.
- **Tests** con Vitest:
  - funciones puras con tests unitarios;
  - SQL contra D1 real con `@cloudflare/vitest-plugin` (antes `vitest-pool-workers`, hoy deprecado), el equivalente a PGlite en Boca Dash;
  - fixtures con JSON real de Jolpica y OpenF1.
- **Secrets** con `wrangler secret`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_CHANNEL_ID` y `ADMIN_CHAT_ID`.
- **Repo:** git nuevo en `~/Developer/f1-dash`. Los commits no llevan líneas de atribución a Claude (preferencia del autor).

### 7.2 Diagrama

```
                 cada minuto (Cron Trigger)
                         │
Jolpica / OpenF1 ◄── reloj ──► D1 ◄── API (/api/*) ◄── web (React, Static Assets)
                         │      ▲
                         ▼      │
             Canal de Telegram  └── webhook del bot ◄── Telegram (comandos por privado)
```

### 7.3 Límites del plan gratis que condicionan el diseño

- **50 llamadas externas por ejecución** (Telegram, Jolpica y OpenF1). Una ejecución del reloj nunca manda más de un puñado de mensajes, porque el canal es uno solo. Es la razón por la que se eligió canal en lugar de mensajes privados.
- **10 ms de CPU por ejecución:** esperar un `fetch` no cuenta, pero parsear sí. Por eso el reloj procesa poco por vez y la carga inicial va por script local.
- **100.000 pedidos por día al Worker.** Los archivos estáticos no cuentan y son ilimitados.
- **D1:** 5 millones de filas leídas y 100.000 escritas por día, y 500 MB por base. Una temporada son unos pocos miles de filas.
- **Cron Triggers:** 5 por cuenta. Se usa uno.

### 7.4 Setup manual del autor

Son pasos que Claude no puede hacer por el autor. El plan los marca en el momento en que hacen falta:

- crear el bot con @BotFather;
- crear el canal público y sumar al bot como administrador;
- crear la cuenta gratis de Cloudflare, sin tarjeta;
- crear el repo en GitHub.

Los nombres del canal y del subdominio `workers.dev` van por variables de entorno, así que se pueden decidir cuando llegue ese paso.

## 8. Enfoques considerados

**Hosting y base** (decidido por el autor el 2026-11-25):

- **1. Todo en Cloudflare: Worker + D1 (elegido).** Una sola plataforma y un solo deploy. El cron viene incluido, así que no hace falta cron-job.org. Drizzle ya es conocido.
- 2. Cloudflare + MongoDB Atlas (plan gratis). Sumaba aprender NoSQL, pero los datos de F1 son relacionales, cada ejecución abría una conexión a Atlas y eran dos cuentas.
- Descartados:
  - Firebase: las tareas programadas piden el plan Blaze, con tarjeta, y Firestore es débil para agregados.
  - Supabase: no quedan proyectos gratis.
  - Vercel: el autor quiere probar Cloudflare.

**Distribución de los avisos** (decidido por el autor):

- **A. Canal de Telegram (elegido).** Una llamada por aviso, sin importar la cantidad de seguidores. No hace falta tabla de suscriptores, ni `/stop`, ni manejar bloqueos.
- B. Mensajes privados en tandas, como Boca Dash. Con el límite de 50 llamadas, a partir de unos cientos de suscriptores el aviso de largada llegaba minutos tarde.

**Estilo visual** (decidido por el autor): **A. Pit wall (elegido)**, B. Telemetría y C. Editorial (los tres están en `docs/mockups/`).

**Alcance de los datos** (decidido por el autor): **temporada en curso, sin borrar las anteriores (elegido)**. La historia completa desde 1950 duplicaba el proyecto.

**Datos en vivo:** descartados por el autor. No hay fuente gratis y no hacen falta: los avisos salen por horario o al publicarse los resultados.

## 9. Riesgos y verificaciones

Las dos carreras que quedan de 2026 (Qatar el 29/11 y Abu Dabi el 6/12) sirven para medir esto con datos reales antes de construir lo que depende de cada punto.

1. **Jolpica desde las IPs de Cloudflare.** El límite de Jolpica es por IP, y los Workers salen por IPs compartidas con otros clientes de Cloudflare, así que podríamos recibir 429 por culpa de otros. Hay que verificarlo en la primera tarea, con un Worker de prueba. Plan B: mover la descarga a un GitHub Action programado que escriba en D1 por su API HTTP. *(**Se cumplió**, medido del 2026-11-25 21:50 al 2026-11-26 21:00 UTC con `_lab/f1-dash-medicion`: con 6 pedidos por hora, 125 de 140 respondieron 429, con rachas de más de 3 horas; el mismo pedido desde una conexión hogareña respondió 200. Pendiente de decidir el rediseño.)*
2. **Cuánto tarda Jolpica en publicar resultados y tablas** después de cada sesión. No está documentado, y de eso depende a qué hora sale el mensaje de cierre. Se mide este fin de semana con un script que consulte cada pocos minutos y anote cuándo aparece cada dato. Si tarda horas, plan B: armar el resultado con `session_result` de OpenF1 (verificado que existe) y sumar los puntos nosotros.
3. **Cuándo publica OpenF1 la grilla** (antes de la carrera o recién después), si tiene la de la sprint y si restringe el acceso sin login mientras hay una sesión en vivo. *(2026-11-26: la de la sprint está, con el `session_key` de la clasificación sprint; en Singapur coincide en los 22 con Jolpica. El resto se mide en Qatar con el Worker `_lab/f1-dash-medicion`.)*
4. **La Cache API en `*.workers.dev`.** No es bloqueante, porque los snapshots ya resuelven la carga (sección 6.3).
5. **CPU del reloj:** medir en producción que una ejecución con resultados nuevos y el recálculo de snapshots entre en 10 ms de CPU. Si no entra, el recálculo pasa a la ejecución siguiente. *(2026-11-26, primera medición, del **webhook del bot** y no del reloj: en 8 mensajes reales los tiempos de CPU fueron 11, 5, 8, 14, 1, 1, 7 y 1 ms. Todos terminaron `ok`, pero dos superaron los 10 ms. El registro no dice qué comando fue cada uno. **2026-11-27, segunda medición, con el comando en el log:** 15 mensajes, todos `ok`. En la primera vuelta `/start`, `/proxima`, `/ultima`, `/campeonato` y la ayuda tardaron 5, 21, 8, 7 y 1 ms; en las dos siguientes, entre 1 y 6 ms. **Hipótesis sin confirmar:** el exceso es de la primera consulta a la base tras un arranque en frío, no de `/proxima` (fue el primer comando que consultó la base). **Decisión:** no optimizar el bot, porque Cloudflare tolera excesos ocasionales; si aparece `exceededCpu` o el bot deja de contestar, perfilar la CPU. La medición del reloj sigue pendiente.)*

## 10. Lo que queda al builder

- Los nombres, la estructura de archivos y la forma exacta de las tablas (con la sección 5.6 como guía).
- El texto exacto de los mensajes, dentro del tono y las reglas de la sección 4.
- La fuente de los colores de equipo (sección 5.1).
- Las ventanas exactas de consulta, siempre dentro de los límites de Jolpica.
- El router del front y cómo se arma el gráfico de puntos.
- El orden de las tareas, con las verificaciones de la sección 9 lo más temprano posible.
