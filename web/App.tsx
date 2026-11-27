// El marco: encabezado, la pantalla de cada ruta y el pie.
import { useEffect, useRef } from 'react'
import type { HomeResponse } from '../src/snapshots/types'
import { channelUrl, matchRoute, type Route } from './lib'
import { Home } from './pages/Home'
import { Race } from './pages/Race'
import { Races } from './pages/Races'
import { usePathname } from './router'
import { Async, Link, NotFound, useJson, type Fetched } from './ui'

function Nav({ route }: { route: Route }) {
  const items = [
    { href: '/', label: 'Inicio', active: route.page === 'home' },
    { href: '/carreras', label: 'Carreras', active: route.page === 'races' || route.page === 'race' },
  ]
  return (
    <nav aria-label="Principal" className="flex gap-5 text-sm">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={item.active ? 'font-bold text-ink' : 'text-muted hover:text-ink'}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

function Header({ route, home }: { route: Route; home: Fetched<HomeResponse> }) {
  const channel = home.status === 'ok' ? channelUrl(home.data.channel) : null
  return (
    <header className="border-b-[3px] border-accent">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3.5">
        <Link href="/" className="title-gp text-2xl">
          F1 Dash
        </Link>
        <Nav route={route} />
        {channel && (
          <a href={channel} className="slant ml-auto bg-button px-5 py-2 text-sm font-bold text-ink">
            Recibí los avisos en Telegram
          </a>
        )}
      </div>
    </header>
  )
}

/** Al cambiar de pantalla el foco va al contenido: si no, un lector de pantalla no se entera. */
function useFocusOnNavigation(pathname: string) {
  const main = useRef<HTMLElement>(null)
  const shown = useRef(pathname)
  useEffect(() => {
    if (shown.current === pathname) return
    shown.current = pathname
    main.current?.focus({ preventScroll: true })
  }, [pathname])
  return main
}

export function App() {
  const pathname = usePathname()
  const route = matchRoute(pathname)
  const main = useFocusOnNavigation(pathname)
  // Se pide una sola vez: lo usan el encabezado, el inicio y la lista de carreras.
  const [home, retry] = useJson<HomeResponse>('/api/home')

  return (
    <div className="flex min-h-screen flex-col">
      <Header route={route} home={home} />
      <main ref={main} tabIndex={-1} className="mx-auto w-full max-w-6xl grow outline-none">
        <Page route={route} home={home} retry={retry} />
      </main>
      <footer className="border-t border-line px-6 py-6 text-center text-xs text-muted">
        <p>Proyecto de un fan. No es un sitio oficial de la Fórmula 1.</p>
        <p className="mt-1">Datos: Jolpica y OpenF1</p>
      </footer>
    </div>
  )
}

function Page({ route, home, retry }: { route: Route; home: Fetched<HomeResponse>; retry: () => void }) {
  if (route.page === 'notFound') return <NotFound />
  if (route.page === 'race') return <Race season={route.season} round={route.round} />
  const Screen = route.page === 'home' ? Home : Races
  return (
    <Async state={home} retry={retry} missing={<NotFound text="Todavía no hay datos cargados." />}>
      {({ snapshot }) => <Screen home={snapshot} />}
    </Async>
  )
}
