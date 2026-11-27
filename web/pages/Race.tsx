// El detalle de una carrera. Una sección sin datos no se muestra.
import type { ReactNode } from 'react'
import { arDate } from '../../src/format/es'
import type { DriverRef, RaceSnapshot, ResultLine } from '../../src/snapshots/types'
import { resultPending } from '../lib'
import { Async, DriverTag, FastestNote, Link, PositionChip, Schedule, useJson } from '../ui'

export function Race({ season, round }: { season: number; round: number }) {
  const [state, retry] = useJson<RaceSnapshot>(`/api/races/${season}/${round}`)
  return (
    <Async state={state} retry={retry}>
      {(race) => <Detail race={race} />}
    </Async>
  )
}

function Arrow({ season, round, label, symbol }: { season: number; round: number; label: string; symbol: string }) {
  return (
    <Link
      href={`/carreras/${season}/${round}`}
      aria-label={label}
      title={label}
      className="slant grid h-9 w-11 place-items-center bg-panel text-lg font-bold hover:bg-line"
    >
      <span aria-hidden>{symbol}</span>
    </Link>
  )
}

type Column<T> = { head: string; cell: (row: T) => ReactNode; className?: string }

/** Una sección con su tabla. Si no entra, el scroll es de la tabla y no de la página. */
function Section<T>({ title, rows, columns, rowKey, children }: {
  title: string
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  children?: ReactNode
}) {
  if (rows.length === 0) return null
  return (
    <section className="mt-9">
      <h2 className="title-gp mb-2 text-3xl">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              {columns.map((c) => (
                <th key={c.head} scope="col" className={`pr-2 pb-2 font-normal last:pr-0 ${c.className ?? ''}`}>
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-line">
                {columns.map((c) => (
                  <td key={c.head} className={`py-2 pr-2 last:pr-0 ${c.className ?? ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {children}
    </section>
  )
}

const RIGHT = 'text-right whitespace-nowrap'
/** En mobile alcanza con el código. */
const WIDE = 'hidden sm:table-cell text-[13px] text-muted'

const driver = <T extends DriverRef>(): Column<T> => ({
  head: 'Piloto',
  cell: (r) => <DriverTag color={r.color} label={r.code} title={`${r.name}, ${r.team}`} />,
})
const names = <T extends DriverRef>(): Column<T>[] => [
  { head: 'Nombre', cell: (r) => r.name, className: WIDE },
  { head: 'Equipo', cell: (r) => r.team, className: WIDE },
]
const position = <T extends { finish: string }>(): Column<T> => ({
  head: 'Pos',
  cell: (r) => <PositionChip finish={r.finish} />,
  className: 'w-11',
})

/** La vuelta rápida va en violeta y además se dice, para que no dependa del color. */
const time: Column<ResultLine> = {
  head: 'Tiempo',
  cell: (r) =>
    r.fastest ? (
      <span className="font-bold text-fastest" title="Vuelta rápida">
        {r.time ?? r.note ?? '—'}
        <span className="sr-only"> (vuelta rápida)</span>
      </span>
    ) : (
      (r.time ?? r.note ?? '—')
    ),
  className: RIGHT,
}
const points: Column<ResultLine> = {
  head: 'Pts',
  cell: (r) => <span className="condensed text-base">{r.points || ''}</span>,
  className: RIGHT,
}

function Gained({ value }: { value: number | null }) {
  const [shown, said] =
    value === null
      ? ['—', 'no se calcula']
      : value === 0
        ? ['=', 'sin cambios']
        : value > 0
          ? [`▲ ${value}`, `ganó ${value}`]
          : [`▼ ${-value}`, `perdió ${-value}`]
  return (
    <>
      <span aria-hidden className={value ? '' : 'text-muted'}>
        {shown}
      </span>
      <span className="sr-only">{said}</span>
    </>
  )
}

function Detail({ race }: { race: RaceSnapshot }) {
  const start = race.sessions.find((s) => s.kind === 'race')
  const byDriver = (r: DriverRef) => r.code

  return (
    <article className="mx-auto max-w-3xl px-6 py-6">
      {/* Las flechas van arriba para que el título use todo el ancho en mobile. */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-muted">
          Ronda {race.round} de {race.rounds}
          {start && `, ${arDate(new Date(start.startsAt))}`}
        </p>
        <nav aria-label="Otras carreras" className="flex gap-2">
          {race.prev !== null && <Arrow season={race.season} round={race.prev} label="Carrera anterior" symbol="←" />}
          {race.next !== null && <Arrow season={race.season} round={race.next} label="Carrera siguiente" symbol="→" />}
        </nav>
      </div>
      <h1 className="title-gp mt-1.5 mb-1.5 text-5xl sm:text-6xl">{race.gp}</h1>
      <p className="text-sm text-muted">{race.circuit}</p>

      {race.race.length === 0 && (
        <div className="mt-8">
          {resultPending(race, new Date()) && <p className="mb-4 bg-panel px-4 py-3">Todavía no tenemos el resultado.</p>}
          <Schedule sessions={race.sessions} />
        </div>
      )}

      <Section
        title="Resultado"
        rows={race.race}
        rowKey={byDriver}
        columns={[
          position(),
          driver(),
          ...names<ResultLine>(),
          time,
          points,
          { head: 'Posiciones', cell: (r) => <Gained value={r.gained} />, className: RIGHT },
        ]}
      >
        {race.fastest && <FastestNote fastest={race.fastest} />}
        <p className="mt-1 text-xs text-muted">Posiciones: las ganadas o perdidas desde la grilla.</p>
      </Section>

      <Section
        title="Sprint"
        rows={race.sprint}
        rowKey={byDriver}
        columns={[position(), driver(), ...names<ResultLine>(), time, points]}
      />

      <Section
        title="Clasificación"
        rows={race.quali}
        rowKey={byDriver}
        columns={[
          position(),
          driver(),
          ...(['q1', 'q2', 'q3'] as const).map((q) => ({
            head: q.toUpperCase(),
            cell: (r: RaceSnapshot['quali'][number]) => r[q] ?? '—',
            className: `${RIGHT} text-[13px]`,
          })),
        ]}
      />

      <Section
        title="Paradas en boxes"
        rows={race.pits}
        rowKey={(r) => `${r.code} ${r.stop}`}
        columns={[
          driver(),
          { head: 'Parada', cell: (r) => r.stop, className: RIGHT },
          { head: 'Vuelta', cell: (r) => r.lap, className: RIGHT },
          { head: 'Duración', cell: (r) => r.duration ?? '—', className: RIGHT },
        ]}
      />
    </article>
  )
}
