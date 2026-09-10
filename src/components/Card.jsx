import { marketOf, priceLevel } from '../lib/markets.js'
import VenueImage from './VenueImage.jsx'
import { venuePhoto } from '../lib/venueImages.js'
import { locationPath } from '../lib/seo'
import { hasVerifiedKashrut, isFoodVenue, foodService } from '../lib/venuePreferences.js'
import Icon from './Icon.jsx'
export default function Card({ loc, lang, tx, saved, onToggleSave, onClick, showSave = true }) {
  const he = lang === 'he'
  const name = he ? loc.name_he || loc.name : loc.name
  return <article className={`ui-place-card ${marketOf(loc).id === 'ny' && !venuePhoto(loc) ? 'ui-place-card-text' : ''}`}>
    <a href={locationPath(loc)} onClick={e => { if (onClick) { e.preventDefault(); onClick() } }}>
      <div className="ui-place-image"><VenueImage loc={loc} fallback={<Icon name={isFoodVenue(loc) ? 'menu' : /Park/.test(loc.category) ? 'map' : 'sparkle'} size={32} />} />{loc.is_partner && <span className="ui-partner-badge">{tx.partnerBadge}</span>}</div>
      <div className="ui-place-copy"><p>{he ? loc.city_he || loc.city : loc.city}{loc.price > 0 ? ` · ${priceLevel(loc, lang)}` : ''}</p><h3>{name}</h3><span>{tx.categories?.[loc.category] || loc.category}</span>{foodService(loc) && <span className="ui-card-food">{({ meat: he ? 'בשרי' : 'Meat', dairy: he ? 'חלבי' : 'Dairy', pareve: he ? 'פרווה' : 'Pareve' })[foodService(loc)]}</span>}{marketOf(loc).id === 'ny' && isFoodVenue(loc) && !hasVerifiedKashrut(loc) && <span className="ui-footnote">{he ? 'כשרות לא מאומתת' : 'Kashrut unconfirmed'}</span>}{hasVerifiedKashrut(loc) && <span className="ui-verified"><Icon name="check" size={13} />{he ? 'כשרות מאומתת' : 'Kashrut verified'}</span>}</div>
    </a>
    {showSave && <button className="ui-place-save" aria-label={saved ? (he ? `הסרת ${name} מהשמורים` : `Unsave ${name}`) : (he ? `שמירת ${name}` : `Save ${name}`)} aria-pressed={saved} onClick={onToggleSave}><Icon name={saved ? 'check' : 'bookmark'} size={19} /></button>}
  </article>
}
