# F1 Dash

Canal de Telegram con los avisos de cada fin de semana de Fórmula 1 y un panel web con la temporada en curso. Todo en un Cloudflare Worker con D1, sin costo.

Proyecto de un fan. No es un sitio oficial de la Fórmula 1. Datos: Jolpica y OpenF1. Trazados de circuitos: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT, © Tomislav Bacinger).

- Diseño: `docs/2026-11-25-f1-dash-design.md`
- Planes: `docs/superpowers/plans/`

**Estado:** el bot contesta `/proxima`, `/ultima` y `/campeonato` por privado. La web está completa: inicio, carreras con el trazado de cada circuito, campeonato con el gráfico de puntos y stats. Falta el reloj (descarga de datos y publicación en el canal). Mientras no esté el reloj, los datos se actualizan a mano con `npm run seed -- --remote`.

## Comandos

```bash
npm install
npm run dev              # la web y la API con la D1 local, en http://localhost:5173
npm run build            # compila el front y el Worker en dist/
npm test                 # parsers con respuestas reales y guardado contra una D1 local
npm run typecheck
npx wrangler d1 migrations apply f1-dash --local
npm run seed             # carga la temporada 2026 en la base local (tarda unos minutos)
npm run seed -- --remote # en la base de Cloudflare (ver abajo)
npm run snapshots        # rearma los datos de la web sin descargar nada (también con -- --remote)
npm run circuits         # carga trazados y datos de los circuitos, una vez (también con -- --remote)
npm run avisos -- race-result 21  # muestra un mensaje armado con la base local
npm run avisos -- --mi-chat       # id de tu chat privado con el bot
npm run avisos -- race-result 21 --enviar  # te lo manda a ese chat
npm run webhook -- https://…workers.dev    # conecta el bot con el Worker desplegado
```

## Despliegue

El Worker y la base D1 `f1-dash` ya están en Cloudflare (el `database_id` está en `wrangler.jsonc` y `wrangler.seed.jsonc`).

```bash
npx wrangler d1 migrations apply f1-dash --remote   # si hay migraciones nuevas
npm run snapshots -- --remote                       # si cambió la forma de los datos de la web
npm run deploy                                      # compila y despliega
```

Desplegar siempre con `npm run deploy`: `wrangler deploy` a secas publica el último build. `dist/` tiene una copia de `.dev.vars` y está ignorado por git.

Los secretos del Worker (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`) se cargan con `npx wrangler secret put`. Para que `/start` muestre la web, `WEB_URL` va como secreto (`npx wrangler secret put WEB_URL`), así la dirección no queda en el repo. Para el canal, `CHANNEL_LINK` en `vars` de `wrangler.jsonc` (lo cargado solo en el panel de Cloudflare lo borra el próximo deploy). `CHANNEL_LINK` también muestra el botón de Telegram en la web: `@canal` o un enlace `https://t.me/…`.

Para enviar, `.dev.vars` (ignorado por git) necesita `TELEGRAM_BOT_TOKEN` y `ADMIN_CHAT_ID`. `--enviar` se niega a mandar a un canal o grupo.

`package.json` deniega los scripts de instalación (`allowScripts`): `esbuild` y `workerd` funcionan con sus binarios opcionales.

## Decisiones sobre las fuentes

- **Solo el reloj y la carga inicial consultan las fuentes.** La web y el bot leen la base.
- **Jolpica** no tiene la clasificación sprint: sale de OpenF1. Responde 403 al `User-Agent` por defecto de Node y puede responder 429 antes de lo documentado.
- **OpenF1** responde 404 cuando todavía no hay datos.
- **Cruce:** las sesiones, por tipo y hora con 12 horas de tolerancia; los pilotos, por número de auto.
- **Guardado:** cada ronda se reemplaza entera para que entren las correcciones, y una respuesta vacía no borra nada.
