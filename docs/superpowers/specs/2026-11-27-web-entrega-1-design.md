# Web, entrega 1: datos, API, Inicio y Carreras

- **Fecha:** 2026-11-27
- **Estado:** pendiente de aprobación del autor
- **Base:** `docs/2026-11-25-f1-dash-design.md` (en adelante, "el spec"). Lo que este documento no cambia, vale como está ahí. Lo marcado **(Claude)** es una decisión propia para que el autor la revise.

## 1. Qué es y para qué

La primera versión publicada del panel web del spec (sección 6). El spec busca que la web se vea muy bien y prolija: la estética importa tanto como que funcione.

La web se hace en dos entregas (decidido por el autor, "vamos de a poco"), así el estilo se ve funcionando y se corrige antes de repetirlo:

1. **Esta:** datos precalculados, API, Inicio y Carreras.
2. **La siguiente:** Campeonato con el gráfico, y Stats.

La web no espera al reloj ni a la decisión de dónde descarga sus datos.

## 2. Objetivos

1. Inicio, lista de carreras y detalle de cada carrera, con el contenido de la sección 6.2 del spec.
2. Estilo "Pit wall" (sección 6.4 del spec), usable en celular y en escritorio.
3. Publicada en `*.workers.dev`, en el mismo Worker que el bot.
4. El bot sigue funcionando igual.

**Fuera de esta entrega:** Campeonato, Stats, "¿Quién puede ser campeón?", el reloj y la publicación en el canal. En el menú aparecen solo **Inicio** y **Carreras**: no hay enlaces a páginas que no existen **(Claude)**.

**Anti-objetivos:** los de la sección 3 del spec. Pesan acá: costo cero, una visita nunca consulta a Jolpica ni a OpenF1, nada parece oficial de la F1, no se afirma lo que no sabemos y no se sobre-diseña.

## 3. Restricciones

- Plan gratis: 10 ms de CPU por pedido. La API no calcula ni interpreta JSON al responder.
- El repo es público: sin secretos ni datos personales.
- Mientras no exista el reloj, la base remota solo cambia al recargarla a mano.

## 4. Enfoques

**Cómo se conecta el front con el Worker** (elegido por el autor). En los dos hay un Worker y un despliegue.

- **A. Plugin de Vite de Cloudflare (elegido).** Un solo comando de desarrollo, con el Worker y D1 en un entorno parecido al de producción. Suma una dependencia y cambia cómo se compila el proyecto.
- B. Vite y `wrangler dev` por separado, con proxy de `/api`. Menos piezas, pero dos procesos y rutas que pueden diferir de producción.

El autor eligió A porque no quiere rediseñar. **La primera tarea del plan es probar A** con los tests y el bot actuales. Si choca, se frena y se le consulta antes de pasar a B o a otra cosa.

**De dónde lee la API:** snapshots precalculados (ya decidido en la sección 6.3 del spec). Calcular en cada visita lee cientos de filas y pone en riesgo los 10 ms.

## 5. Cómo se arma

### 5.1 Snapshots

- Tabla nueva `kv` en D1, con una migración.
- Una función aparte lee la base, arma los JSON y los guarda en `kv`: uno para el inicio y uno por carrera.
- **Cambio respecto del spec:** hoy la llama el script de carga (`npm run seed`) al terminar. Más adelante la va a llamar el reloj.
- Un comando rearma solo los snapshots, sin volver a descargar de Jolpica **(Claude)**. Hace falta cada vez que cambia la forma del JSON.
- Los snapshots no deciden nada que dependa de la hora. Guardan los horarios, y el navegador elige la próxima carrera y calcula la cuenta regresiva.
- Qué temporada se muestra: la regla de la sección 6.1 del spec. El snapshot de inicio incluye la primera carrera de la temporada siguiente, si está cargada. Cargar 2027 queda fuera: el script sigue fijo en 2026.

### 5.2 API

- `GET /api/home`: datos del inicio y la lista de carreras de la temporada **(Claude:** así no hace falta un tercer endpoint). Las stats se agregan en la entrega 2.
- `GET /api/races/:season/:round`: el detalle de una carrera.
- Cada pedido lee una fila y devuelve su texto tal cual, con un `Cache-Control` corto.
- Si no hay snapshot, responde 404.
- El enlace al canal sale de `CHANNEL_LINK`, la misma variable del bot. Se agrega a la respuesta sin volver a interpretar el snapshot **(Claude)**.

### 5.3 Front

- React, Vite y Tailwind.
- Wrangler sirve los archivos estáticos, con el fallback de SPA. `/api/*` y `/telegram/*` van **siempre** al Worker: sin eso, el webhook del bot se podría romper.
- Reutiliza los textos y formatos que ya usa el bot (nombres de GP, circuitos, equipos, sesiones y hora argentina).
- La tipografía Archivo se sirve desde el mismo proyecto, sin pedidos a terceros **(Claude)**.

**Inicio** (referencia: opción A de `docs/mockups/estilos.html`):

```
F1 Dash   Inicio  Carreras                     [Telegram]
═════════════════════════════════════════════════════════
Próxima carrera       │ Última carrera     │ Pilotos
GP de ...             │ GP de ...          │  1 ▌XXX  000
Circuito · ronda      │ 1 ▌XXX  tiempo     │  ... top 4
00 días 00 h 00 min   │ ... top 5          │ Constructores
Horarios (Argentina)  │ Vuelta rápida      │  ... top 3
```

- En celular, las columnas se apilan en ese orden.
- La última carrera enlaza a su página.
- El botón de Telegram **no se muestra mientras `CHANNEL_LINK` esté vacío**, porque el canal todavía no está abierto **(Claude)**.
- En constructores va el nombre del equipo, no una sigla como en el mockup: los datos no traen siglas **(Claude)**.

**Carreras:** todas las rondas en orden, cada una con GP, fecha y, si ya hay resultado, el ganador **(Claude)**.

**Detalle de carrera:** flechas a la anterior y a la siguiente, y estas secciones en una sola columna, en este orden **(Claude)**:

1. Resultado completo, con puntos. La vuelta rápida va en violeta.
2. Grilla contra llegada: posiciones ganadas o perdidas, como columna del resultado. No se calcula para quien largó desde boxes ni para los no clasificados (definiciones de la sección 6.2 del spec).
3. Sprint, si hubo.
4. Clasificación, con Q1, Q2 y Q3.
5. Paradas en boxes: piloto, parada, vuelta y duración, tal como las publica la fuente.

Una sección sin datos no se muestra. La clasificación sprint está cargada, pero el spec no la pide y queda afuera **(Claude)**. Las posiciones de los no clasificados y descalificados se muestran igual que en los mensajes del bot **(Claude)**.

### 5.4 Estados y errores

- **Cargando** y **falló el pedido** (con botón para reintentar).
- **Ronda o ruta que no existe:** mensaje y enlace al inicio.
- **Carrera sin resultado cargado:** se muestran los horarios y, debajo, las secciones que ya tengan datos (sprint o clasificación). Si ya pasó la hora de largada, dice "Todavía no tenemos el resultado", sin afirmar que se corrió.
- **Temporada terminada:** cuenta regresiva a la primera carrera de la siguiente. Si no está cargada, "El calendario 2027 todavía no está publicado".

## 6. Cómo se prueba

- **Armado de snapshots y API:** TDD contra D1 real, con los fixtures que ya hay.
- **Lógica del front** (próxima carrera, cuenta regresiva, posiciones ganadas): funciones puras con tests.
- **Pantallas:** sin tests de componentes. Claude las revisa en el navegador, en ancho de celular y de escritorio, y el autor las prueba.
- **Bot:** los tests actuales siguen pasando y, después de desplegar, el autor prueba un comando.
- **CPU:** medir `/api/*` con `wrangler tail`, con la misma regla que se usó en el bot.

## 7. Publicación

- Antes de desplegar o hacer push se consulta al autor.
- Para publicar: migración en la base remota, armado de los snapshots y deploy.
- Después de publicar, `WEB_URL` se carga en `vars` de `wrangler.jsonc` para que `/start` muestre la web, y se anota en el README **(Claude)**. La dirección incluye el nombre de la cuenta de Cloudflare del autor y quedaría visible en el repo público.
- Hasta que exista el reloj, la web se actualiza solo al correr `npm run seed -- --remote`.

## 8. Lo que queda al builder

Los nombres, la estructura de archivos, la forma de los JSON, el router, los componentes y el orden de las tareas, con la prueba del enfoque A primero.
