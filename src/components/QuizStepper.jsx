import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/translations'
import { canonicalCity } from '../lib/planGates.js'
import Icon from './Icon.jsx'
const pictured = ['Jerusalem', 'Tel Aviv', 'Beit Shemesh', "Modi'in", 'Tzur Hadassah', 'Haifa', 'Herzliya', "Ra'anana", 'Netanya', 'Petach Tikva', 'Givat Shmuel', 'Zichron Yaakov', 'Caesarea', 'Eilat', 'Tiberias', 'Beer Sheva', 'Dead Sea', 'Mitzpe Ramon']
export default function QuizStepper({ lang, cityOptions = [], onComplete, onBack }) {
  const [city, setCity] = useState('')
  const [search, setSearch] = useState('')
  const [all, setAll] = useState(false)
  const titleRef = useRef(null)
  const he = lang === 'he'
  useEffect(() => { titleRef.current?.focus() }, [city])
  const matches = cityOptions.filter(c => search ? [c,t.en.cities?.[c],t.he.cities?.[c]].some(v => v?.toLowerCase().includes(search.toLowerCase())) || canonicalCity(search) === c : true)
  return <main className="ui-quiz" dir={he ? 'rtl' : 'ltr'}>
    <header className="ui-quiz-nav"><button className="ui-icon-button" aria-label={he ? 'חזרה' : 'Back'} onClick={() => city ? setCity('') : onBack()}><Icon name="back" className="ui-direction" /></button><span>{he ? `שלב ${city ? 2 : 1} מתוך 2` : `${city ? 2 : 1} of 2`}</span><span className="ui-wordmark">HaMakom</span></header>
    <progress className="ui-progress" value={city ? 2 : 1} max={2} aria-label={he ? 'התקדמות' : 'Progress'} />
    <section className="ui-quiz-body" key={city ? 'stage' : 'city'}><p className="ui-eyebrow">{he ? 'בואו נמצא את המקום שלכם' : 'Let’s find your somewhere'}</p><h1 ref={titleRef} tabIndex={-1}>{city ? (he ? 'איפה אתם בתהליך?' : 'Where are you two at?') : (he ? 'איפה נפגשים?' : 'Where shall we go?')}</h1><p className="ui-subtitle">{city ? (he ? 'נמצא רעיון בקצב שמתאים לכם.' : 'We’ll find something at your pace.') : (he ? 'בחרו עיר. את השאר נתכנן יחד.' : 'Pick a city. We’ll take it from there.')}</p>
      {!city ? <>
        <div className="ui-search"><Icon name="search" /><input aria-label={he ? 'חיפוש עיר' : 'Search cities'} placeholder={he ? 'עיר או אזור' : 'City or area'} value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="ui-icon-button" aria-label={he ? 'ניקוי החיפוש' : 'Clear search'} onClick={() => setSearch('')}><Icon name="close" size={16} /></button>}</div>
        <div className="ui-city-grid">{(all || search ? matches : matches.slice(0,6)).map(c => <button key={c} onClick={() => setCity(c)}>{pictured.includes(c) ? <img src={`/city-images/${c.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}.jpg`} alt="" /> : <span className="ui-city-placeholder"><Icon name="pin" size={25} /></span>}<span>{t[lang].cities?.[c] || c}</span><Icon name="chevron" size={16} className="ui-direction" /></button>)}</div>
        {!matches.length && <p className="ui-subtitle" role="status">{he ? 'לא מצאנו עיר כזאת. נסו שם אחר.' : 'No cities found. Try another name.'}</p>}
        {!search && <button className="ui-text-button" onClick={() => setAll(!all)}>{he ? all ? 'ערים מרכזיות' : `כל ${cityOptions.length} הערים` : all ? 'Popular cities' : `All ${cityOptions.length} cities`}</button>}
        <button className="ui-anywhere" onClick={() => setCity('flexible')}><Icon name="sparkle" /><span>{he ? 'פתוחים להצעות' : 'Open to anywhere'}<small>{he ? 'מצאו לנו מקום מיוחד' : 'Find us somewhere worth going'}</small></span><Icon name="chevron" size={17} className="ui-direction" /></button>
      </> : <div className="ui-stage-options">{[
        ['just-met',he ? 'הדייטים הראשונים' : 'First few dates',he ? 'קליל, נעים ובלי לחץ.' : 'Easy conversation. No pressure.'],
        ['getting-to-know',he ? 'מכירים יותר' : 'Getting to know each other',he ? 'עוד זמן לשיחה טובה.' : 'A little more time to connect.'],
        ['getting-serious',he ? 'כבר קרובים' : 'Already close',he ? 'זמן איכות רק לשניכם.' : 'Make some time just for you two.'],
      ].map(([value,title,description],i) => <button key={value} onClick={() => onComplete({ city, seriousness:value, when:'planning-ahead' })}><span className="ui-stage-number">0{i+1}</span><span><strong>{title}</strong><small>{description}</small></span><Icon name="chevron" size={18} className="ui-direction" /></button>)}</div>}
    </section>
  </main>
}
