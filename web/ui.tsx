// Piezas que comparten las pantallas.
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
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
    <button type="button" onClick={retry} className="slant mt-4 cursor-pointer bg-accent px-5 py-2 font-bold text-ink">
      Reintentar
    </button>
  </Message>
)

export const NotFound = ({ text = 'No encontramos esa página.' }: { text?: string }) => (
  <Message>
    <p>{text}</p>
    <Link href="/" className="mt-4 inline-block font-bold text-ink underline">
      Volver al inicio
    </Link>
  </Message>
)

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
