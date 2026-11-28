// Piezas que comparten las pantallas.
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { arDay, arTime, sessionLabel } from '../src/format/es'
import type { FastestLap, SessionTime } from '../src/snapshots/types'
import { loadJson, type Loaded } from './lib'
import { navigate } from './router'

export type Fetched<T> = Loaded<T> | { status: 'loading' }

export function useJson<T>(url: string): [Fetched<T>, () => void] {
  const [attempt, setAttempt] = useState(0)
  const [done, setDone] = useState<{ key: string; result: Loaded<T> } | null>(null)
  const key = `${url} ${attempt}`
  useEffect(() => {
    let current = true
    void loadJson<T>(url).then((result) => current && setDone({ key, result }))
    return () => {
      current = false
    }
  }, [url, key])
  // Mientras no llegue la respuesta de este pedido, no se muestra la anterior.
  return [done?.key === key ? done.result : { status: 'loading' }, () => setAttempt((n) => n + 1)]
}

/** El título de la pestaña de cada pantalla. */
export function useTitle(page?: string): void {
  useEffect(() => {
    document.title = page ? `${page} · F1 Dash` : 'F1 Dash'
  }, [page])
}

export function Link({ href, onClick, ...props }: ComponentProps<'a'> & { href: string }) {
  return (
    <a
      {...props}
      href={href}
      onClick={(e) => {
        onClick?.(e)
        // Con modificadores el navegador hace lo suyo (abrir en otra pestaña).
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        navigate(href)
      }}
    />
  )
}

export const PositionChip = ({ finish }: { finish: string }) => (
  <span
    className={`slant condensed inline-grid h-6 min-w-9 place-items-center px-1.5 text-sm ${
      finish === '1' ? 'bg-ink text-carbon' : 'bg-panel text-ink'
    }`}
  >
    {finish}
  </span>
)

/** La franja con el color del equipo, siempre junto al código. */
export const DriverTag = ({ color, label, title }: { color: string; label: string; title?: string }) => (
  <span className="inline-flex items-center gap-2.5 whitespace-nowrap" title={title}>
    <span aria-hidden className="h-5 w-1.5 -skew-x-12" style={{ background: color }} />
    <span className="condensed text-lg tracking-wide">{label}</span>
  </span>
)

export const FastestNote = ({ fastest }: { fastest: FastestLap }) => (
  <p className="mt-3 text-[13px] text-muted">
    Vuelta rápida:{' '}
    <b className="font-bold text-fastest">
      {fastest.code}, {fastest.lap}
    </b>
  </p>
)

/** Los horarios del fin de semana, en hora argentina. */
export const Schedule = ({ sessions }: { sessions: SessionTime[] }) => (
  <>
    <table className="w-full text-sm">
      <caption className="sr-only">Horarios del fin de semana</caption>
      <tbody>
        {sessions.map((s) => {
          const start = new Date(s.startsAt)
          const race = s.kind === 'race'
          return (
            <tr key={s.kind} className={`border-t border-line ${race ? 'font-extrabold' : ''}`}>
              <td className={`py-2 ${race ? 'pl-2.5 shadow-[inset_3px_0_0_var(--color-accent)]' : 'text-muted'}`}>
                {arDay(start)}
              </td>
              <td className="py-2">{sessionLabel(s.kind)}</td>
              <td className="py-2 text-right">{arTime(start)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
    <p className="mt-2 text-xs text-muted">Horarios de Argentina</p>
  </>
)

const Message = ({ children }: { children: ReactNode }) => (
  <div className="px-6 py-16 text-center text-muted">{children}</div>
)

export const Loading = () => (
  <Message>
    <p role="status">Cargando…</p>
  </Message>
)

export const LoadError = ({ retry }: { retry: () => void }) => (
  <Message>
    <p role="alert">No pudimos cargar los datos.</p>
    <button type="button" onClick={retry} className="slant mt-4 cursor-pointer bg-button px-5 py-2 font-bold text-ink">
      Reintentar
    </button>
  </Message>
)

export function NotFound({ text = 'No encontramos esa página.' }: { text?: string }) {
  useTitle('No encontrada')
  return (
  <Message>
    <p>{text}</p>
    <Link href="/" className="mt-4 inline-block font-bold text-ink underline">
      Volver al inicio
    </Link>
  </Message>
  )
}

/** Los tres estados de un pedido; con los datos, `children`. */
export function Async<T>({ state, retry, missing, children }: {
  state: Fetched<T>
  retry: () => void
  missing?: ReactNode
  children: (data: T) => ReactNode
}) {
  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <LoadError retry={retry} />
  if (state.status === 'notFound') return missing ?? <NotFound />
  return children(state.data)
}

export type Column<T> = { head: string; cell: (row: T) => ReactNode; className?: string }

/** Una sección con su tabla. Si no entra, el scroll es de la tabla y no de la página. */
export function Section<T>({ title, rows, columns, rowKey, children }: {
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

export const RIGHT = 'text-right whitespace-nowrap'
/** En mobile alcanza con el código. */
export const WIDE = 'hidden sm:table-cell text-[13px] text-muted'
