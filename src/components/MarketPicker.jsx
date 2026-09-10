import { useState } from 'react'
import { useMarket } from '../lib/MarketContext.jsx'
import { MARKETS } from '../lib/markets.js'
import Sheet from './Sheet.jsx'
import Icon from './Icon.jsx'
export default function MarketPicker({ lang = 'en', onChange }) {
  const { market, setMarket } = useMarket()
  const [open, setOpen] = useState(false)
  const he = lang === 'he'
  return <><button className="ui-market-picker" onClick={() => setOpen(true)} aria-haspopup="dialog"><Icon name="pin" size={16} />{market[lang]}<Icon name="chevron" size={13} /></button>
    <Sheet open={open} onClose={() => setOpen(false)} title={he ? 'איפה הדייט הבא שלכם?' : 'Where’s your next date?'} lang={lang}>
      <p className="ui-subtitle">{he ? 'מקומות ורעיונות שמתאימים לאזור שלכם.' : 'Local places. Thoughtful plans. Pick your area.'}</p>
      {Object.values(MARKETS).map(m => <button key={m.id} className="ui-market-option" aria-pressed={m.id === market.id} onClick={() => { setMarket(m.id); onChange?.(m.id); setOpen(false) }}><span><strong>{m[lang]}</strong><small>{m.id === 'ny' ? (he ? 'מנהטן, ברוקלין, קווינס, חמש העיירות והסביבה' : 'Manhattan, Brooklyn, Queens, Five Towns & beyond') : (he ? 'ירושלים, תל אביב, בית שמש ועוד' : 'Jerusalem, Tel Aviv, Beit Shemesh & beyond')}</small></span><Icon name={m.id === market.id ? 'check' : 'chevron'} /></button>)}
    </Sheet></>
}
