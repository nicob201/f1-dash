// Las dos tablas completas y el gráfico de puntos fecha a fecha.
import type { ChampionshipSnapshot } from '../../src/snapshots/types'
import { linePath, spreadLabels } from '../lib'
import { Async, DriverTag, NotFound, PositionChip, RIGHT, Section, useJson, useTitle, WIDE } from '../ui'

type Chart = ChampionshipSnapshot['chart']
const last = (points: (number | null)[]) => points.findLast((p) => p !== null) ?? 0

/** Fijo y sin interacción: los cinco primeros en color y con su código, el resto en gris. */
function PointsChart({ chart, season }: { chart: Chart; season: number }) {
  const { rounds, lines } = chart
  const max = Math.max(1, ...lines.flatMap((l) => l.points.filter((p) => p !== null)))
  const step = max < 200 ? 50 : 100
  const top = Math.ceil(max / step) * step
  const x = (i: number) => (rounds.length > 1 ? (i / (rounds.length - 1)) * 100 : 50)
  const y = (p: number) => 100 - (p / top) * 100

  const highlighted = lines.filter((l) => l.highlight)
  // Las resaltadas al final, y el líder último: queda arriba de todo.
  const drawn = [...lines.filter((l) => !l.highlight), ...highlighted.toReversed()]
  // El alto es fijo (h-72, 288 px): 5 % deja unos 14 px entre códigos.
  const labelTops = spreadLabels(highlighted.map((l) => y(last(l.points))), 5, 100)
  const guides = Array.from({ length: top / step + 1 }, (_, i) => i * step)
  const end = rounds.length - 1
  // La primera, la última y cada 5; una de cada 5 pegada a la última se saltea, si no se pisan en el celular.
  const ticks = rounds.map((round, i) => ({ round, i })).filter(({ round, i }) => i === 0 || i === end || (round % 5 === 0 && end - i > 1))
  const summary = highlighted.map((l) => `${l.code} ${last(l.points)}`).join(', ')

  return (
    <div role="img" aria-label={`Puntos acumulados en ${season}. Los cinco primeros: ${summary}`} className="relative mt-4 mr-14 mb-8 ml-9 h-72">
      {guides.map((g) => (
        <span key={g} className="absolute -left-9 w-7 -translate-y-1/2 text-right text-[11px] text-muted" style={{ top: `${y(g)}%` }}>
          {g}
        </span>
      ))}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        {guides.map((g) => (
          <line key={g} x1={0} x2={100} y1={y(g)} y2={y(g)} stroke="var(--color-line)" vectorEffect="non-scaling-stroke" />
        ))}
        {drawn.map((l) => (
          <path
            key={l.code}
            d={linePath(l.points, x, y)}
            fill="none"
            stroke={l.highlight ? l.color : 'var(--color-muted)'}
            strokeOpacity={l.highlight ? 1 : 0.3}
            strokeWidth={l.highlight ? 2.5 : 1}
            strokeDasharray={l.dashed ? '6 4' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {highlighted.map((l, i) => (
        <span
          key={l.code}
          className="absolute left-full ml-2 flex -translate-y-1/2 items-center gap-1.5"
          style={{ top: `${labelTops[i]}%` }}
        >
          <span className="h-3 w-1 -skew-x-12" style={{ background: l.color }} />
          <span className="condensed text-sm">{l.code}</span>
        </span>
      ))}
      {ticks.map(({ round, i }) => (
        <span key={round} className="absolute top-full mt-1.5 -translate-x-1/2 text-[11px] text-muted" style={{ left: `${x(i)}%` }}>
          {round}
        </span>
      ))}
    </div>
  )
}

const points = { head: 'Pts', cell: (r: { points: number }) => <span className="condensed text-base">{r.points}</span>, className: RIGHT }
const wins = { head: 'Victorias', cell: (r: { wins: number }) => r.wins, className: RIGHT }
const position = { head: 'Pos', cell: (r: { position: number | null }) => <PositionChip finish={String(r.position ?? '—')} />, className: 'w-11' }

function Detail({ c }: { c: ChampionshipSnapshot }) {
  return (
    <article className="mx-auto max-w-5xl px-6 py-6">
      <h1 className="title-gp text-5xl sm:text-6xl">Campeonato {c.season}</h1>
      <p className="mt-1.5 text-[13px] text-muted">Después de la ronda {c.round}</p>

      <section className="mt-9">
        <h2 className="title-gp mb-2 text-3xl">Puntos fecha a fecha</h2>
        <PointsChart chart={c.chart} season={c.season} />
        <p className="text-xs text-muted">Ronda en el eje horizontal. Los cinco primeros, en color; el compañero de equipo, punteado.</p>
      </section>

      <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:gap-10">
        <Section
          title="Pilotos"
          rows={c.drivers}
          rowKey={(r) => r.name}
          columns={[
            position,
            { head: 'Piloto', cell: (r) => <DriverTag color={r.color} label={r.code} title={`${r.name}, ${r.team}`} /> },
            { head: 'Nombre', cell: (r) => r.name, className: WIDE },
            { head: 'Equipo', cell: (r) => r.team, className: WIDE },
            wins,
            points,
          ]}
        />
        <Section
          title="Constructores"
          rows={c.constructors}
          rowKey={(r) => r.team}
          columns={[position, { head: 'Equipo', cell: (r) => <DriverTag color={r.color} label={r.team} /> }, wins, points]}
        />
      </div>
    </article>
  )
}

export function Championship() {
  useTitle('Campeonato')
  const [state, retry] = useJson<ChampionshipSnapshot>('/api/championship')
  return (
    <Async state={state} retry={retry} missing={<NotFound text="Todavía no hay datos cargados." />}>
      {(c) => <Detail c={c} />}
    </Async>
  )
}
