// team_colour de OpenF1, temporada 2026. Jolpica no da colores.
const COLORS: Record<string, string> = {
  mercedes: '#00D7B6',
  mclaren: '#F47600',
  aston_martin: '#229971',
  haas: '#9C9FA2',
  williams: '#1868DB',
  red_bull: '#4781D7',
  ferrari: '#ED1131',
  alpine: '#00A1E8',
  rb: '#6C98FF',
  audi: '#F50537',
  cadillac: '#909090',
}

export const teamColor = (constructorId: string): string => COLORS[constructorId] ?? '#9C9CB0'
