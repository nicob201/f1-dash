// El marco: encabezado, la pantalla de cada ruta y el pie.
import type { HomeResponse } from '../src/snapshots/types'
import { channelUrl, matchRoute, type Route } from './lib'
import { usePathname } from './router'
import { Link, NotFound, useJson, type Fetched } from './ui'

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
          <a href={channel} className="slant ml-auto bg-accent px-5 py-2 text-sm font-bold text-ink">
            Recibí los avisos en Telegram
          </a>
        )}
      </div>
    </header>
  )
}

export function App() {
  const route = matchRoute(usePathname())
  // Se pide una sola vez: lo usan el encabezado, el inicio y la lista de carreras.
  const [home] = useJson<HomeResponse>('/api/home')

  return (
    <div className="flex min-h-screen flex-col">
      <Header route={route} home={home} />
      <main className="mx-auto w-full max-w-6xl grow">
        <Page route={route} />
      </main>
      <footer className="border-t border-line px-6 py-6 text-center text-xs text-muted">
        <p>Proyecto de un fan. No es un sitio oficial de la Fórmula 1.</p>
        <p className="mt-1">Datos: Jolpica y OpenF1</p>
      </footer>
    </div>
  )
}

function Page({ route }: { route: Route }) {
  return route.page === 'notFound' ? <NotFound /> : null
}
