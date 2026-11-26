# F1 Dash

Canal de Telegram con los avisos de cada fin de semana de Fórmula 1 y un panel web con la temporada en curso. Todo en un Cloudflare Worker con D1, sin costo.

Proyecto de un fan. No es un sitio oficial de la Fórmula 1. Datos: Jolpica y OpenF1.

- Diseño: `docs/2026-11-25-f1-dash-design.md`
- Planes: `docs/superpowers/plans/`

**Estado:** el bot contesta `/proxima`, `/ultima` y `/campeonato` por privado. Faltan el reloj (descarga de datos y publicación en el canal) y la web. Mientras no esté el reloj, los datos se actualizan a mano con `npm run seed -- --remote`.

## Comandos

```bash
npm install
npm test                 # parsers con respuestas reales y guardado contra una D1 local
npm run typecheck
npx wrangler d1 migrations apply f1-dash --local
npm run seed             # carga la temporada 2026 en la base local (tarda unos minutos)
npm run seed -- --remote # en la base de Cloudflare (ver abajo)
npm run avisos -- race-result 21  # muestra un mensaje armado con la base local
npm run avisos -- --mi-chat       # id de tu chat privado con el bot
npm run avisos -- race-result 21 --enviar  # te lo manda a ese chat
npm run webhook -- https://…workers.dev    # conecta el bot con el Worker desplegado
```

La base remota todavía no existe. Antes de usar `--remote` hay que crearla con `npx wrangler d1 create f1-dash`, poner su `database_id` en `wrangler.jsonc` y `wrangler.seed.jsonc`, y aplicar las migraciones con `--remote`.

Para enviar, `.dev.vars` (ignorado por git) necesita `TELEGRAM_BOT_TOKEN` y `ADMIN_CHAT_ID`. `--enviar` se niega a mandar a un canal o grupo.

`package.json` deniega los scripts de instalación (`allowScripts`): `esbuild` y `workerd` funcionan con sus binarios opcionales.

## Decisiones sobre las fuentes

- **Solo el reloj y la carga inicial consultan las fuentes.** La web y el bot leen la base.
- **Jolpica** no tiene la clasificación sprint: sale de OpenF1. Responde 403 al `User-Agent` por defecto de Node y puede responder 429 antes de lo documentado.
- **OpenF1** responde 404 cuando todavía no hay datos.
- **Cruce:** las sesiones, por tipo y hora con 12 horas de tolerancia; los pilotos, por número de auto.
- **Guardado:** cada ronda se reemplaza entera para que entren las correcciones, y una respuesta vacía no borra nada.
