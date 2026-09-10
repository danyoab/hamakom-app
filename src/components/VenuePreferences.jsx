import { DIETARY_OPTIONS } from '../lib/venuePreferences.js'

const inputStyle = { width: '100%', minWidth: 0, padding: '11px 10px', color: 'var(--ui-text)', background: '#fff', border: '1px solid var(--ui-border)', borderRadius: 10, font: 'inherit', fontSize: 14, boxSizing: 'border-box' }

export default function VenuePreferences({ lang, value, onChange, planning = false }) {
  const he = lang === 'he'
  const set = (key, v) => onChange({ ...value, [key]: v })
  const selected = value.dietary || []
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{he ? 'אוכל שמתאים לכם' : 'Food that works for you'}</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DIETARY_OPTIONS.map(o => <button key={o.value} type="button" aria-pressed={selected.includes(o.value)} onClick={() => set('dietary', selected.includes(o.value) ? selected.filter(v => v !== o.value) : [...selected, o.value])}
            style={{ minHeight: 44, padding: '9px 12px', borderRadius: 999, border: '1px solid var(--ui-border)', background: selected.includes(o.value) ? 'var(--ui-accent)' : '#fff', color: selected.includes(o.value) ? '#fff' : 'var(--ui-accent)', cursor: 'pointer', font: 'inherit', fontSize: 13 }}>
            {o[lang] || o.en}
          </button>)}
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ui-muted)', margin: '9px 0 0' }}>{he
          ? 'מציגים אפשרויות שפורסמו במקור מזוהה. מידע חסר לא נחשב להתאמה. לצליאק, אלרגיות או שילוב צרכים, בדקו עם הסניף גם הכנה נפרדת. פארקים ופעילויות נשארים זמינים.'
          : 'Matches need a published source. Missing information does not count as a match. For coeliac disease, allergies or combined needs, confirm ingredients and preparation with the branch. Parks and activities remain available.'}</p>
      </fieldset>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>{he ? 'כשרות' : 'Kashrut'}
          <select value={value.kosher || 'any'} onChange={e => set('kosher', e.target.value)} style={inputStyle}>
            <option value="any">{he ? 'אבדוק את הפרטים בעצמי' : 'I’ll check the details'}</option>
            <option value="verified">{he ? 'רק כשרות מאומתת' : 'Verified kosher only'}</option>
            <option value="mehadrin">{he ? 'רק מהדרין מאומת' : 'Verified mehadrin only'}</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>{he ? 'רמת מחיר' : 'Price level'}
          <select value={value.budget || 'any'} onChange={e => set('budget', e.target.value)} style={inputStyle}>
            <option value="any">{he ? 'הכול' : 'Any price'}</option>
            <option value="budget">{he ? 'עד ₪₪ — נוח לכיס' : 'Up to ₪₪ — budget friendly'}</option>
            <option value="moderate">{he ? 'עד ₪₪₪' : 'Up to ₪₪₪'}</option>
          </select>
        </label>
        {planning && <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>{he ? 'כמה זמן יש לכם?' : 'Time available'}
          <select value={value.length || ''} onChange={e => set('length', e.target.value)} style={inputStyle}>
            <option value="">{he ? 'גמיש — התאימו לי' : 'Flexible — suggest a pace'}</option>
            <option value="short">{he ? 'עד שעתיים' : 'Up to 2 hours'}</option>
            <option value="medium">{he ? 'עד 3 שעות' : 'Up to 3 hours'}</option>
            <option value="long">{he ? 'ללא הגבלת זמן' : 'No time limit'}</option>
          </select>
        </label>}
        {planning && <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>{he ? 'בין המקומות' : 'Getting between places'}
          <select value={value.travelMode || 'walking'} onChange={e => set('travelMode', e.target.value)} style={inputStyle}>
            <option value="walking">{he ? 'ברגל' : 'Walking'}</option>
            <option value="driving">{he ? 'נסיעה קצרה אפשרית' : 'Short drive is okay'}</option>
          </select>
        </label>}
        {planning && <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>{he ? 'תאריך (לא חובה)' : 'Date (optional)'}
          <input type="date" value={value.date || ''} onChange={e => set('date', e.target.value)} style={inputStyle} />
        </label>}
        {planning && <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>{he ? 'שעת התחלה בישראל (לא חובה)' : 'Start time in Israel (optional)'}
          <input type="time" value={value.startTime || ''} onChange={e => set('startTime', e.target.value)} style={inputStyle} />
        </label>}
      </div>
      <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={Boolean(value.menuOnly)} onChange={e => set('menuOnly', e.target.checked)} />{he ? 'רק מקומות עם קישור לתפריט' : 'Only places with a menu link'}</label>
    </div>
  )
}
