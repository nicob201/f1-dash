// Inicio: próxima carrera, última carrera y las puntas de los campeonatos.
import { useEffect, useState, type ReactNode } from 'react'
import type { HomeSnapshot } from '../../src/snapshots/types'
import { countdown, nextRace } from '../lib'
import { DriverTag, FastestNote, Link, PositionChip, Schedule, useTitle } from '../ui'

/** La hora, actualizada cada 30 segundos: la cuenta regresiva muestra minutos. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

const Kicker = ({ children }: { children: ReactNode }) => <p className="mb-1.5 text-[13px] text-muted">{children}</p>

const Column = ({ children }: { children: ReactNode }) => <section className="min-w-0 bg-carbon px-6 py-6">{children}</section>

function Next({ home }: { home: HomeSnapshot }) {
  const now = useNow()
  const next = nextRace(home, now)
  if (next.kind === 'unpublished') {
    return (
      <Column>
        <Kicker>Próxima carrera</Kicker>
        <p className="text-lg">El calendario {next.season} todavía no está publicado.</p>
      </Column>
    )
  }
  const { race } = next
  const start = race.sessions.find((s) => s.kind === 'race')!.startsAt
  const left = countdown(new Date(start), now)
  const units = [
    [left.days, left.days === 1 ? 'día' : 'días'],
    [left.hours, left.hours === 1 ? 'hora' : 'horas'],
    [left.minutes, 'min'],
  ] as const

  return (
    <Column>
      <Kicker>
        Próxima carrera, ronda {race.round} de {race.rounds}
      </Kicker>
      <h1 className="title-gp mb-1.5 text-6xl">{race.gp}</h1>
      <p className="text-sm text-muted">{race.circuit}</p>
      <p className="mt-5 mb-4 flex items-baseline gap-1.5">
        {units.map(([value, label]) => (
          <span key={label} className="mr-3 flex items-baseline gap-1.5">
            <b className="condensed text-[42px] leading-none">{value}</b>
            <span className="text-xs text-muted">{label}</span>
          </span>
        ))}
      </p>
      <Schedule sessions={race.sessions} />
    </Column>
  )
}

function Last({ season, last }: { season: number; last: NonNullable<HomeSnapshot['last']> }) {
  return (
    <Column>
      <Kicker>Última carrera</Kicker>
      <h2 className="title-gp mb-2.5 text-3xl">
        <Link href={`/carreras/${season}/${last.round}`} className="hover:underline">
          {last.gp}
        </Link>
      </h2>
      <ol>
        {last.top.map((line) => (
          <li key={line.name} className="flex items-center gap-2.5 border-t border-line py-2">
            <PositionChip finish={line.finish} />
            <span className="w-[4.25rem]">
              <DriverTag color={line.color} label={line.code} title={line.team} />
            </span>
            <span className="min-w-0 grow truncate text-[13px] text-muted">{line.name}</span>
            <span className="text-sm">{line.time ?? line.note ?? '—'}</span>
          </li>
        ))}
      </ol>
      {last.fastest && <FastestNote fastest={last.fastest} />}
      <Link href={`/carreras/${season}/${last.round}`} className="mt-4 inline-block text-sm font-bold underline">
        Ver la carrera completa
      </Link>
    </Column>
  )
}

function Table({ title, rows }: { title: string; rows: { position: number | null; name?: string; label: string; color: string; points: number; hint?: string }[] }) {
  return (
    <>
      <h2 className="mb-1.5 text-[13px] text-muted">{title}</h2>
      <ol className="mb-5 last:mb-0">
        {rows.map((row) => (
          <li key={row.name ?? row.label} className="flex items-center gap-2.5 border-t border-line py-2">
            <PositionChip finish={String(row.position ?? '—')} />
            <DriverTag color={row.color} label={row.label} title={row.hint} />
            <span className="condensed ml-auto text-lg">{row.points}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

export function Home({ home }: { home: HomeSnapshot }) {
  useTitle()
  const hasTables = home.drivers.length > 0 || home.constructors.length > 0
  return (
    <div className="flex flex-col gap-px bg-line pb-px lg:flex-row">
      <div className="flex min-w-0 flex-col *:grow lg:flex-[1.15]">
        <Next home={home} />
      </div>
      {home.last && (
        <div className="flex min-w-0 flex-col *:grow lg:flex-1">
          <Last season={home.season} last={home.last} />
        </div>
      )}
      {hasTables && (
        <div className="flex min-w-0 flex-col *:grow lg:flex-[0.9]">
          <Column>
            {home.standingsRound !== null && (
              <p className="mb-3 text-xs text-muted">Tablas después de la ronda {home.standingsRound}</p>
            )}
            <Table
              title="Campeonato de pilotos"
              rows={home.drivers.map((d) => ({ ...d, label: d.code, hint: `${d.name}, ${d.team}` }))}
            />
            <Table title="Constructores" rows={home.constructors.map((c) => ({ ...c, label: c.team }))} />
            <Link href="/campeonato" className="mt-4 inline-block text-sm font-bold underline">
              Ver las tablas completas
            </Link>
          </Column>
        </div>
      )}
    </div>
  )
}
