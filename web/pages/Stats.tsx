// "¿Quién puede ser campeón?", los KPIs por piloto y por equipo, y los duelos de compañeros.
import type { ReactNode } from 'react'
import type { DriverRef, Duel, Kpis, StatsSnapshot, TitleRace } from '../../src/snapshots/types'
import { formatAverage, formatGained } from '../lib'
import { Async, DriverTag, NotFound, RIGHT, Section, useJson, useTitle, type Column } from '../ui'

const H2 = ({ children }: { children: ReactNode }) => <h2 className="title-gp mb-3 text-3xl">{children}</h2>

/** Con un solo candidato, ese es el campeón: nadie más puede ni empatarlo. */
function TitleBlock<T extends { color: string; points: number }>({ heading, race, label, champion }: {
  heading: string
  race: TitleRace<T>
  label: (c: T) => string
  champion: (c: T) => string
}) {
  const [only] = race.contenders
  return (
    <div className="bg-panel p-4">
      <h3 className="text-[13px] text-muted">{heading}</h3>
      {race.contenders.length === 1 && only ? (
        <p className="mt-2 text-lg font-bold">{champion(only)}</p>
      ) : (
        <>
          <ul className="mt-1">
            {race.contenders.map((c) => (
              <li key={label(c)} className="flex items-center justify-between border-t border-line py-1.5 first:border-t-0">
                <DriverTag color={c.color} label={label(c)} />
                <span className="condensed text-base">{c.points}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Quedan {race.pointsLeft} puntos en juego</p>
        </>
      )}
    </div>
  )
}

const kpis = <T extends Kpis>(): Column<T>[] => [
  { head: 'Victorias', cell: (r) => r.wins, className: RIGHT },
  { head: 'Podios', cell: (r) => r.podiums, className: RIGHT },
  { head: 'Poles', cell: (r) => r.poles, className: RIGHT },
  { head: 'Abandonos', cell: (r) => r.dnfs, className: RIGHT },
  { head: 'Posiciones', cell: (r) => formatGained(r.gained), className: RIGHT },
  { head: 'Promedio', cell: (r) => formatAverage(r.average), className: RIGHT },
]

const Notes = () => (
  <div className="mt-2 space-y-0.5 text-xs text-muted">
    <p>Posiciones: las ganadas o perdidas desde la grilla, sumadas.</p>
    <p>Promedio: la posición de llegada, solo en las carreras que terminó clasificado.</p>
  </div>
)

function Score({ label, a, b, score }: { label: string; a: DriverRef; b: DriverRef; score: [number, number] }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="flex items-center gap-3">
        <DriverTag color={a.color} label={a.code} title={a.name} />
        <span className="condensed text-lg whitespace-nowrap">
          {score[0]} – {score[1]}
        </span>
        <DriverTag color={b.color} label={b.code} title={b.name} />
      </span>
    </div>
  )
}

/** Los duelos vienen ordenados por equipo: los de un mismo equipo quedan juntos. */
function Duels({ duels }: { duels: Duel[] }) {
  const teams = new Map<string, Duel[]>()
  for (const d of duels) teams.set(d.team, [...(teams.get(d.team) ?? []), d])
  return (
    <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
      {[...teams].map(([team, pairs]) => (
        <div key={team} className="bg-carbon py-3 sm:px-4">
          <h3 className="flex items-center gap-2 font-bold">
            <span aria-hidden className="h-4 w-1.5 -skew-x-12" style={{ background: pairs[0]!.color }} />
            {team}
          </h3>
          {pairs.map((p) => (
            <div key={`${p.a.code}-${p.b.code}`} className="mt-1 border-t border-line first-of-type:border-t-0">
              <Score label="Clasificación" a={p.a} b={p.b} score={p.quali} />
              <Score label="Carrera" a={p.a} b={p.b} score={p.race} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Detail({ s }: { s: StatsSnapshot }) {
  return (
    <article className="mx-auto max-w-5xl px-6 py-6">
      <h1 className="title-gp text-5xl sm:text-6xl">Stats {s.season}</h1>
      <p className="mt-1.5 text-[13px] text-muted">Después de la ronda {s.round}</p>

      <section className="mt-9">
        <H2>¿Quién puede ser campeón?</H2>
        <div className="grid gap-3 sm:grid-cols-2">
          <TitleBlock
            heading="Pilotos"
            race={s.titles.drivers}
            label={(c) => c.code}
            champion={(c) => `${c.name} es el campeón ${s.season}`}
          />
          <TitleBlock
            heading="Constructores"
            race={s.titles.constructors}
            label={(c) => c.team}
            champion={(c) => `${c.team} es el campeón de constructores ${s.season}`}
          />
        </div>
      </section>

      <Section
        title="Pilotos"
        rows={s.drivers}
        rowKey={(r) => r.name}
        columns={[{ head: 'Piloto', cell: (r) => <DriverTag color={r.color} label={r.code} title={`${r.name}, ${r.team}`} /> }, ...kpis()]}
      >
        <Notes />
      </Section>

      <Section
        title="Equipos"
        rows={s.teams}
        rowKey={(r) => r.team}
        columns={[{ head: 'Equipo', cell: (r) => <DriverTag color={r.color} label={r.team} /> }, ...kpis()]}
      >
        <Notes />
      </Section>

      {s.duels.length > 0 && (
        <section className="mt-9">
          <H2>Duelos de compañeros</H2>
          <Duels duels={s.duels} />
          <p className="mt-2 text-xs text-muted">
            En clasificación cuentan las fechas en que los dos marcaron tiempo; en carrera, las que los dos terminaron clasificados.
          </p>
        </section>
      )}
    </article>
  )
}

export function Stats() {
  useTitle('Stats')
  const [state, retry] = useJson<StatsSnapshot>('/api/stats')
  return (
    <Async state={state} retry={retry} missing={<NotFound text="Todavía no hay datos cargados." />}>
      {(s) => <Detail s={s} />}
    </Async>
  )
}
