// Todas las carreras de la temporada, corridas y por correr.
import { arDate } from '../../src/format/es'
import type { HomeSnapshot } from '../../src/snapshots/types'
import { DriverTag, Link, useTitle } from '../ui'

export function Races({ home }: { home: HomeSnapshot }) {
  useTitle('Carreras')
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <h1 className="title-gp mb-4 text-5xl">Carreras {home.season}</h1>
      <ol>
        {home.races.map((race) => {
          const start = race.sessions.find((s) => s.kind === 'race')
          return (
            <li key={race.round} className="border-t border-line">
              <Link href={`/carreras/${race.season}/${race.round}`} className="flex items-center gap-3 py-3 hover:bg-panel">
                <span className="condensed w-7 shrink-0 text-right text-lg text-muted">
                  <span className="sr-only">Ronda </span>
                  {race.round}
                </span>
                <span className="min-w-0 grow">
                  <span className="block font-bold">{race.gp}</span>
                  {start && <span className="block text-[13px] text-muted">{arDate(new Date(start.startsAt))}</span>}
                </span>
                {race.winner && (
                  <span className="shrink-0">
                    <span className="sr-only">Ganó </span>
                    <DriverTag color={race.winner.color} label={race.winner.code} title={`Ganó ${race.winner.name}`} />
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
