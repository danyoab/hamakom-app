import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { initialMarket, MARKETS } from './markets.js'
const Context = createContext({ market: MARKETS.israel, setMarket: () => {} })
export function MarketProvider({ children }) {
  const [id, setId] = useState(() => {
    let saved
    try { saved = localStorage.getItem('hamakom-market') } catch { /* Private browsing. */ }
    return initialMarket(window.location.href, saved)
  })
  useEffect(() => { try { localStorage.setItem('hamakom-market', id) } catch { /* Private browsing. */ } }, [id])
  const setMarket = useCallback(next => setId(next === 'ny' ? 'ny' : 'israel'), [])
  return <Context.Provider value={{ market: MARKETS[id], setMarket }}>{children}</Context.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useMarket() { return useContext(Context) }
