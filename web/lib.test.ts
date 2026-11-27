import { season2026 } from '../src/notices/__fixtures__/season'
import { homeSnapshot, raceSnapshot } from '../src/snapshots/build'
import { channelUrl, countdown, loadJson, matchRoute, nextRace, resultPending } from './lib'

const d = season2026()
const NONE = { season: 2027, races: [], sessions: [] }
const home = homeSnapshot(d, NONE)
const at = (iso: string) => new Date(iso)

describe('matchRoute', () => {
  it.each([
    ['/', { page: 'home' }],
    ['/carreras', { page: 'races' }],
    ['/carreras/', { page: 'races' }],
    ['/carreras/2026/22', { page: 'race', season: 2026, round: 22 }],
    ['/carreras/2026/22/', { page: 'race', season: 2026, round: 22 }],
    ['/carreras/abc/1', { page: 'notFound' }],
    ['/carreras/2026', { page: 'notFound' }],
    ['/carreras/2026/22/x', { page: 'notFound' }],
    ['/campeonato', { page: 'notFound' }],
  ])('%s', (path, route) => expect(matchRoute(path)).toEqual(route))
})

describe('loadJson', () => {
  const from = (res: () => Response) => loadJson('/api/x', async () => res())
  it('distingue lo que llegó, lo que no existe y lo que falló', async () => {
    expect(await from(() => Response.json({ a: 1 }))).toEqual({ status: 'ok', data: { a: 1 } })
    expect(await from(() => Response.json({ error: 'not_found' }, { status: 404 }))).toEqual({ status: 'notFound' })
    expect(await from(() => new Response('x', { status: 500 }))).toEqual({ status: 'error' })
    expect(await from(() => new Response('<!doctype html>'))).toEqual({ status: 'error' })
    expect(await loadJson('/api/x', async () => { throw new Error('sin red') })).toEqual({ status: 'error' })
  })
})

describe('channelUrl', () => {
  it('arma el enlace desde el usuario o deja el de t.me', () => {
    expect(channelUrl('@F1DashAr')).toBe('https://t.me/F1DashAr')
    expect(channelUrl('https://t.me/+abc')).toBe('https://t.me/+abc')
  })
  it.each([
    null, '', '@', '@a/b', 'javascript:alert(1)', '-1001234567890', 'https://example.test',
    'https://t.me.example.test/x', 'http://t.me/x',
  ])('%j no da botón', (value) => expect(channelUrl(value)).toBeNull())
})

it('countdown', () => {
  expect(countdown(at('2026-11-29T16:00:00Z'), at('2026-11-25T18:46:00Z'))).toEqual({ days: 3, hours: 21, minutes: 14 })
  expect(countdown(at('2026-11-29T16:00:00Z'), at('2026-11-30T00:00:00Z'))).toEqual({ days: 0, hours: 0, minutes: 0 })
})

describe('nextRace', () => {
  const round = (now: string) => {
    const next = nextRace(home, at(now))
    return next.kind === 'race' ? next.race.round : next
  }
  it('es la primera que todavía no largó', () => {
    expect(round('2026-11-26T20:00:00Z')).toBe(22)
    expect(round('2026-11-29T16:00:00Z')).toBe(23)
  })
  it('sin carreras por delante ni calendario nuevo, lo dice', () => {
    expect(round('2026-12-07T00:00:00Z')).toEqual({ kind: 'unpublished', season: 2027 })
  })
  it('con el calendario nuevo, pasa a su primera carrera', () => {
    const race = { ...d.races[0]!, season: 2027 }
    const session = { ...d.sessions.find((s) => s.round === 1 && s.kind === 'race')!, season: 2027, startsAt: at('2027-03-07T04:00:00Z') }
    const next = nextRace(homeSnapshot(d, { season: 2027, races: [race], sessions: [session] }), at('2026-12-07T00:00:00Z'))
    expect(next).toMatchObject({ kind: 'race', race: { season: 2027, round: 1 } })
  })
})

it('resultPending: solo desde la largada y sin resultado', () => {
  const qatar = raceSnapshot(d, [], 22)
  expect(resultPending(qatar, at('2026-11-29T15:59:00Z'))).toBe(false)
  expect(resultPending(qatar, at('2026-11-29T16:00:00Z'))).toBe(true)
  expect(resultPending(raceSnapshot(d, [], 21), at('2026-12-01T00:00:00Z'))).toBe(false)
})
