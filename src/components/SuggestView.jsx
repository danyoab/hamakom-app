import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { DATE_STAGE_BADGE, CATEGORIES } from '../lib/constants'

const WHY_MAX = 300

export default function SuggestView({ lang, tx, font, onBack }) {
  const [form, setForm] = useState({
    name: '', city: '', category: '', kashrus: '', why: '',
    whatsapp: '', dateStage: [], price: 2,
  })
  const [touched, setTouch] = useState({})
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const set = (k, v) => { setForm(prev => ({ ...prev, [k]: v })); setTouch(prev => ({ ...prev, [k]: true })) }
  const toggleStage = (s) => setForm(prev => ({
    ...prev,
    dateStage: prev.dateStage.includes(s) ? prev.dateStage.filter(x => x !== s) : [...prev.dateStage, s],
  }))

  const fieldErr = (k) => {
    if (!touched[k]) return null
    if (k === 'name' && !form.name.trim()) return 'Required'
    if (k === 'city' && !form.city.trim()) return 'Required'
    if (k === 'category' && !form.category) return 'Required'
    return null
  }

  const handleSubmit = async () => {
    setTouch({ name: true, city: true, category: true })
    if (!form.name.trim() || !form.city.trim() || !form.category) {
      setError(tx.suggestRequired)
      return
    }
    setError('')
    setStatus('submitting')

    if (supabase) {
      const { error: sbError } = await supabase.from('pending_submissions').insert([{
        name:       form.name,
        city:       form.city,
        category:   form.category,
        kashrus:    form.kashrus || null,
        why:        form.why || null,
        whatsapp:   form.whatsapp || null,
        date_stage: form.dateStage.length ? form.dateStage : null,
        price:      form.price,
      }])
      if (sbError) { setError(tx.suggestError); setStatus('idle'); return }
    }
    setStatus('success')
  }

  const dir = tx.dir

  if (status === 'success') return (
    <div dir={dir} style={{ minHeight:'100vh', background:'#0D1117', color:'#E8DCC8', fontFamily:font, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, textAlign:'center' }}>
      <div style={{ fontSize:56, marginBottom:20 }}>🎉</div>
      <h2 style={{ fontSize:26, fontWeight:400, margin:'0 0 12px' }}>{tx.suggestSuccess}</h2>
      <p style={{ color:'#9CA3AF', fontSize:15, marginBottom:40 }}>{tx.suggestSuccessSub}</p>
      <button onClick={() => { setForm({ name:'',city:'',category:'',kashrus:'',why:'',whatsapp:'',dateStage:[],price:2 }); setTouch({}); setStatus('idle') }} style={btnStyle('#C9A84C','#0D1117')}>
        {tx.suggestAnother}
      </button>
      <button onClick={onBack} style={{ ...btnStyle('transparent','#9CA3AF'), border:'1px solid #374151', marginTop:10 }}>
        {tx.back}
      </button>
    </div>
  )

  return (
    <div dir={dir} style={{ minHeight:'100vh', background:'#0D1117', color:'#E8DCC8', fontFamily:font }}>
      <div style={{ background:'#161B27', borderBottom:'1px solid #2A2F3E', padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
        <button onClick={onBack} style={{ background:'none',border:'none',color:'#C9A84C',cursor:'pointer',fontSize:13,fontFamily:'inherit',padding:0 }}>{tx.back}</button>
        <span style={{ fontSize:15, fontWeight:500 }}>{tx.suggestTitle}</span>
      </div>

      <div style={{ maxWidth:560, margin:'0 auto', padding:'28px 20px' }}>
        <p style={{ color:'#9CA3AF', fontSize:14, marginBottom:28, fontStyle:'italic' }}>{tx.suggestSubtitle}</p>

        {/* Name + City — stacks on narrow screens */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:14, marginBottom:14 }}>
          <Field label={tx.suggestName} required error={fieldErr('name')}>
            <Input value={form.name} onChange={v => set('name',v)} placeholder={tx.suggestNamePH} dir={dir} hasError={!!fieldErr('name')} />
          </Field>
          <Field label={tx.suggestCity} required error={fieldErr('city')}>
            <Input value={form.city} onChange={v => set('city',v)} placeholder={tx.suggestCityPH} dir={dir} hasError={!!fieldErr('city')} />
          </Field>
        </div>

        <Field label={tx.suggestCategory} required error={fieldErr('category')} style={{ marginBottom:14 }}>
          <select
            value={form.category}
            onChange={e => set('category', e.target.value)}
            style={{ ...inputStyle, width:'100%', direction:dir, borderColor: fieldErr('category') ? '#F87171' : '#2A2F3E' }}
          >
            <option value="">—</option>
            {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label={tx.suggestKashrus} style={{ marginBottom:14 }}>
          <Input value={form.kashrus} onChange={v => set('kashrus',v)} placeholder={tx.suggestKashrusPH} dir={dir} />
        </Field>

        <Field label={tx.suggestWhy} style={{ marginBottom:14 }} hint={`${form.why.length}/${WHY_MAX}`}>
          <textarea
            value={form.why}
            onChange={e => set('why', e.target.value.slice(0, WHY_MAX))}
            placeholder={tx.suggestWhyPH}
            rows={3}
            style={{ ...inputStyle, width:'100%', resize:'vertical', direction:dir }}
          />
        </Field>

        <Field label={tx.suggestDateStage} style={{ marginBottom:14 }}>
          <div style={{ display:'flex', gap:8 }}>
            {[[1,'💬',tx.date1],[2,'😊',tx.date2],[3,'🔥',tx.date3]].map(([s,emoji,label]) => (
              <button key={s} onClick={() => toggleStage(s)} style={{
                flex:1, padding:'8px 4px', borderRadius:8, cursor:'pointer', fontSize:12, fontFamily:'inherit',
                background: form.dateStage.includes(s) ? DATE_STAGE_BADGE[s].bg : '#1F2937',
                color:      form.dateStage.includes(s) ? DATE_STAGE_BADGE[s].text : '#9CA3AF',
                border: '1px solid ' + (form.dateStage.includes(s) ? DATE_STAGE_BADGE[s].text : '#374151'),
                transition: 'all 0.15s',
              }}>
                {emoji} {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={tx.suggestPrice} style={{ marginBottom:14 }}>
          <div style={{ display:'flex', gap:8 }}>
            {[[1,'₪'],[2,'₪₪'],[3,'₪₪₪'],[4,'₪₪₪₪']].map(([p,label]) => (
              <button key={p} onClick={() => set('price',p)} style={{
                flex:1, padding:'8px 4px', borderRadius:8, cursor:'pointer', fontSize:13, fontFamily:'inherit',
                background: form.price===p ? '#C9A84C' : '#1F2937',
                color:      form.price===p ? '#0D1117'  : '#9CA3AF',
                border: '1px solid ' + (form.price===p ? '#C9A84C' : '#374151'),
                transition: 'all 0.15s',
              }}>
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={tx.suggestWhatsApp} style={{ marginBottom:24 }}>
          <Input value={form.whatsapp} onChange={v => set('whatsapp',v)} placeholder={tx.suggestWhatsAppPH} dir={dir} />
        </Field>

        {error && <div style={{ color:'#F87171', fontSize:13, marginBottom:14 }}>{error}</div>}

        <button onClick={handleSubmit} disabled={status==='submitting'} style={{ ...btnStyle('#C9A84C','#0D1117','100%'), opacity: status==='submitting' ? 0.7 : 1 }}>
          {status==='submitting' ? tx.suggestSubmitting : tx.suggestSubmit}
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, error, hint, children, style }) {
  return (
    <div style={style}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <label style={{ fontSize:11, letterSpacing:'0.1em', color: error ? '#F87171' : '#6B7280', textTransform:'uppercase' }}>
          {label}{required && <span style={{ color:'#F87171' }}> *</span>}
        </label>
        {hint && <span style={{ fontSize:10, color:'#4B5563' }}>{hint}</span>}
      </div>
      {children}
      {error && <div style={{ fontSize:11, color:'#F87171', marginTop:4 }}>{error}</div>}
    </div>
  )
}

function Input({ value, onChange, placeholder, dir, hasError }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, width:'100%', textAlign:dir==='rtl'?'right':'left', direction:dir, borderColor: hasError ? '#F87171' : '#2A2F3E' }}
    />
  )
}

const inputStyle = {
  background:'#161B27', border:'1px solid #2A2F3E', borderRadius:8,
  padding:'10px 12px', color:'#E8DCC8', fontSize:13,
  fontFamily:'inherit', outline:'none', boxSizing:'border-box',
}

function btnStyle(bg, color, width) {
  return { background:bg, color, border:'none', borderRadius:8, padding:'11px 20px', cursor:'pointer', fontSize:14, fontWeight:600, fontFamily:'inherit', width:width||undefined }
}
