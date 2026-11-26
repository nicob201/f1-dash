// La temporada 2026 armada con las respuestas reales: calendario, y resultado, clasificación y tablas de Las Vegas.
import calendar from '../../sources/__fixtures__/calendar-2026.json'
import constructors21 from '../../sources/__fixtures__/constructorstandings-2026-21.json'
import drivers21 from '../../sources/__fixtures__/driverstandings-2026-21.json'
import quali21 from '../../sources/__fixtures__/qualifying-2026-21.json'
import results21 from '../../sources/__fixtures__/results-2026-21.json'
import { mergeResults, parseCalendar, parseQualifying, parseResults, parseStandings } from '../../sources/jolpica'
import type { SeasonData } from '../data'

export function season2026(): SeasonData {
  const { races, sessions } = parseCalendar(calendar)
  const { drivers, constructors, results } = mergeResults([parseQualifying(quali21), parseResults(results21, 'race')])
  const standings = [...parseStandings(drivers21, 'drivers'), ...parseStandings(constructors21, 'constructors')]
  return { season: 2026, races, sessions, drivers, constructors, results, standings, grids: [] }
}
