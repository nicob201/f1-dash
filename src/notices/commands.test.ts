import { season2026 } from './__fixtures__/season'
import { commandReply } from './commands'
import { previewMessage } from './messages'

const d = season2026()
const NOW = new Date('2026-11-26T20:00:00Z')
const LINKS = { channel: '@F1DashAr', webUrl: null }
const reply = (text: string, data = d, now = NOW) => commandReply(text, data, now, LINKS)
const HELP = 'Comandos:\n/proxima · próxima carrera\n/ultima · última carrera\n/campeonato · las dos tablas'

it('/start da la bienvenida con el canal y, cuando hay, la web', () => {
  const base =
    '¡Hola! Soy el bot de F1 Dash 🏎️\nLos avisos de cada fin de semana salen en el canal @F1DashAr.\n\n' +
    '/proxima · próxima carrera\n/ultima · última carrera\n/campeonato · las dos tablas'
  expect(reply('/start')).toBe(base)
  expect(commandReply('/start', d, NOW, { ...LINKS, webUrl: 'https://example.test' })).toBe(
    `${base}\n\n<a href="https://example.test">Ver la web</a>`,
  )
})
it('/proxima es la previa con otro título', () => {
  const body = previewMessage(d, 22).split('\n').slice(1).join('\n')
  expect(reply('/proxima')).toBe(`📅 <b>Próxima: GP de Qatar</b> (ronda 22 de 23)\n${body}`)
})
it('/proxima pasa a la siguiente cuando larga la carrera', () => {
  expect(reply('/proxima', d, new Date('2026-11-29T16:00:00Z'))).toContain('Próxima: GP de Abu Dabi')
})
it('/proxima con la temporada terminada', () => {
  expect(reply('/proxima', d, new Date('2026-12-07T00:00:00Z'))).toBe('La temporada terminó. ¡Nos vemos el año que viene! 👋')
})
it('/ultima es el resultado sin las tablas', () => {
  const m = reply('/ultima')
  expect(m.startsWith('🏁 <b>GP de Las Vegas: resultado</b>\n\n<pre><code class="language-Carrera"> 1 VER')).toBe(true)
  expect(m).toContain('Vuelta rápida: LAW')
  expect(m).not.toContain('🏆')
})
it('/campeonato son las dos tablas, sin +N', () => {
  const m = reply('/campeonato')
  expect(m.startsWith('🏆 <b>Pilotos</b>')).toBe(true)
  expect(m).toContain('🔧 <b>Constructores</b>')
  expect(m).not.toContain('+')
})
it('entiende mayúsculas, @usuario y texto de más', () => {
  expect(reply('  /Proxima@F1DashArBot ahora ')).toBe(reply('/proxima'))
})
it('cualquier otra cosa devuelve la lista de comandos', () => {
  expect([reply('hola'), reply(''), reply('proxima'), reply('/stop')]).toEqual([HELP, HELP, HELP, HELP])
})
it('sin carreras corridas', () => {
  const empty = { ...d, results: [], standings: [] }
  expect(reply('/ultima', empty)).toBe('Todavía no se corrió ninguna carrera.')
  expect(reply('/campeonato', empty)).toBe('Todavía no se corrió ninguna carrera.')
})
