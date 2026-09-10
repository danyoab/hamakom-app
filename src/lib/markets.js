export const MARKETS = {
  israel: { id: 'israel', en: 'Israel', he: 'ישראל', country: 'IL', currency: 'ILS', symbol: '₪', timezone: 'Asia/Jerusalem', timeLabel: 'Israel time', center: [31.8, 35] },
  ny: { id: 'ny', en: 'New York', he: 'ניו יורק', country: 'US', currency: 'USD', symbol: '$', timezone: 'America/New_York', timeLabel: 'New York time', center: [40.73, -73.9] },
}
export const NY_AREAS = ['Manhattan', 'Brooklyn', 'Queens', 'Five Towns', 'Long Island', 'Bronx', 'Westchester', 'Hudson Valley', 'North Jersey']
export function marketOf(place) {
  return place?.market === 'ny' || place?.region === 'New York Metro' || NY_AREAS.includes(place?.city) ? MARKETS.ny : MARKETS.israel
}
export function priceLevel(place, lang = 'en') {
  if (!Number.isInteger(place?.price) || place.price < 0 || place.price > 4) return lang === 'he' ? 'מחיר לא מאומת' : 'Price not confirmed'
  return marketOf(place).symbol.repeat(place.price) || (lang === 'he' ? 'כניסה חינם' : 'Free entry')
}
export function initialMarket(url, saved) {
  const parsed = new URL(url, 'https://hamakom.app')
  if (parsed.pathname.replace(/\/+$/, '') === '/new-york' || parsed.searchParams.get('area') === 'ny') return 'ny'
  if (parsed.searchParams.get('area') === 'israel') return 'israel'
  return saved === 'ny' ? 'ny' : 'israel'
}
