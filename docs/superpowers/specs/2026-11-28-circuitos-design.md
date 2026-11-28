# Panel del circuito en el detalle de carrera

Fecha: 2026-11-28. Cambio chico sobre la entrega 1 de la web.

## Para qué

Que quien abre la página de una carrera vea de un vistazo cómo es el circuito: el trazado y unos pocos datos. El autor eligió la fuente: "vamos con esa fuente por ahora y vemos cómo queda". La idea es probarlo y ajustarlo después de verlo.

## Qué se ve

Cada página `/carreras/:temporada/:ronda` lleva un panel con el trazado dibujado y cuatro datos: longitud, altitud, año de inauguración y año del primer GP. En la computadora el panel va en una columna a la izquierda; en el celular, debajo del nombre del circuito y antes de los horarios. Si no hay datos del circuito, la página queda como hoy.

```
┌──────────────┬───────────────────────────┐
│  [trazado]   │ Ronda 22 de 23     ← →    │
│              │ GP de Qatar               │
│ Longitud     │ Circuito Int. de Lusail   │
│ Altitud      │ Horarios / Resultado / …  │
│ Inaugurado   │                           │
│ Primer GP    │                           │
└──────────────┴───────────────────────────┘
```

## Fuera de alcance

- Curvas y récord de vuelta: la fuente no los trae.
- Corregir los valores de la fuente. La longitud de Lusail figura como 5,380 km y la oficial es 5,419 km: queda así por ahora.
- Rotar los trazados como los dibuja la F1: van con el norte arriba, como vienen.

## Datos

- Fuente: `bacinger/f1-circuits` (MIT, © Tomislav Bacinger), el GeoJSON en el commit `fda4a2f`, fijo para que una carga no cambie sola.
- Se guardan una sola vez en nuestra base, en una tabla `circuits` con la clave de Jolpica (`losail`), la longitud y la altitud en metros, los dos años y el trazado ya convertido a un path SVG en un cuadro de 100 × 100. El navegador no proyecta nada.
- La fuente usa sus propias claves (`qa-2004`): una tabla escrita a mano las cruza con las de Jolpica para los 23 circuitos de 2026, más Bahréin y Yeda, que vuelven en 2027. Un circuito sin cruce no tiene panel.
- `races` suma `circuit_id`, la clave de Jolpica que ya trae el calendario. Las filas que ya existen la toman en la próxima carga.
- `npm run circuits` (con `-- --remote` para producción) baja el GeoJSON, guarda la tabla y rearma los snapshots. El JSON de cada carrera suma `track`, o `null` si no hay datos. El del inicio no cambia.
- La licencia pide el aviso: el pie de la web suma el crédito con el enlace al repo.

## Enfoques

1. **Tabla en D1 cargada por un script (elegido).** Es lo que se había acordado: los datos se guardan una vez en nuestra base y el reloj puede rearmar snapshots sin bajar nada.
2. Un archivo generado y commiteado en el repo. Es igual de simple, pero mete datos de terceros en el bundle y se aparta de lo acordado.
3. Bajarlo en el navegador. Depende de GitHub en cada visita y proyecta en el cliente: no.

## Publicación

Migración remota, `npm run circuits -- --remote`, deploy, y `npm run seed -- --remote` después de Qatar para que las carreras tomen su `circuit_id`.

## Queda al builder

El estilo del panel dentro del "Pit wall" y cómo se ve el trazado (grosor, color). Se ajusta mirándolo.
