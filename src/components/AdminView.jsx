import { useState } from 'react'
import { ADMIN_PIN } from '../lib/constants'
import { usePending } from '../hooks/usePending'

export default function AdminView({ lang, font, onBack, totalLocations }) {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin]           = useState('')
  const [adminTab, setAdminTab] = useState('pending')
  const [toast, setToast]       = useState(null)
  const { pending, approved, loading, approveSub, rejectSub } = usePending()

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleApprove = async (sub) => {
    if (!window.confirm(`Approve "${sub.name}"?`)) return
    await approveSub(sub)
    showToast(`✓ "${sub.name}" approved and added to locations`)
  }

  const handleReject = async (id, name) => {
    if (!window.confirm(`Reject "${name}"?`)) return
    await rejectSub(id)
    showToast(`"${name}" rejected`, 'error')
  }

  if (!unlocked) return (
    <div style={{ minHeight:'100vh', background:'#0D1117', color:'#E8DCC8', fontFamily:font, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
      <div style={{ fontSize:40, marginBottom:20 }}>🔐</div>
      <h2 style={{ fontSize:22, fontWeight:400, marginBottom:8 }}>Admin Access</h2>
      <p style={{ color:'#6B7280', fontSize:13, marginBottom:28 }}>Enter your PIN to continue</p>
      <input
        type="password"
        value={pin}
        onChange={e => setPin(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && setUnlocked(pin === ADMIN_PIN)}
        placeholder="PIN"
        style={{ background:'#161B27', border:'1px solid #2A2F3E', borderRadius:8, padding:'10px 16px', color:'#E8DCC8', fontSize:20, letterSpacing:'0.3em', width:160, textAlign:'center', outline:'none', marginBottom:12, fontFamily:font }}
      />
      <button
        onClick={() => setUnlocked(pin === ADMIN_PIN)}
        style={{ background:'#C9A84C', color:'#0D1117', border:'none', borderRadius:8, padding:'10px 24px', cursor:'pointer', fontSize:14, fontWeight:600, fontFamily:font }}
      >
        Enter
      </button>
      {pin.length > 0 && pin !== ADMIN_PIN && (
        <p style={{ color:'#F87171', fontSize:13, marginTop:12 }}>Incorrect PIN.</p>
      )}
      <button onClick={onBack} style={{ background:'none', border:'none', color:'#6B7280', cursor:'pointer', marginTop:20, fontSize:13, fontFamily:font }}>
        ← Back
      </button>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0D1117', color:'#E8DCC8', fontFamily:font }}>
      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background: toast.type==='error' ? '#7F1D1D' : '#14532D', color: toast.type==='error' ? '#FCA5A5' : '#86EFAC', border:`1px solid ${toast.type==='error'?'#DC2626':'#16A34A'}`, borderRadius:10, padding:'12px 20px', fontSize:13, fontWeight:500, zIndex:9999, whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}
      {/* Header */}
      <div style={{ background:'#161B27', borderBottom:'1px solid #2A2F3E', padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
        <button onClick={onBack} style={{ background:'none',border:'none',color:'#C9A84C',cursor:'pointer',fontSize:13,fontFamily:'inherit',padding:0 }}>← Back</button>
        <span style={{ fontSize:15, fontWeight:500 }}>Admin Dashboard</span>
        {pending.length > 0 && (
          <span style={{ background:'#F472B6', color:'#0D1117', borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
            {pending.length} pending
          </span>
        )}
      </div>

      <div style={{ maxWidth:700, margin:'0 auto', padding:'24px 20px' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
          {[
            ['Total Locations', totalLocations, '#C9A84C'],
            ['Pending Review', pending.length, '#F472B6'],
            ['Approved This Session', approved.length, '#4ADE80'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background:'#161B27', border:'1px solid #2A2F3E', borderRadius:10, padding:16, textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:300, color }}>{val}</div>
              <div style={{ fontSize:11, color:'#6B7280', marginTop:4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:20 }}>
          {[['pending',`Pending (${pending.length})`],['approved',`Approved (${approved.length})`],['sql','Supabase SQL']].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setAdminTab(tab)}
              style={{ padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13, background: adminTab===tab ? '#C9A84C' : '#1F2937', color: adminTab===tab ? '#0D1117' : '#9CA3AF' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pending */}
        {adminTab === 'pending' && (
          loading
            ? <div style={{ color:'#6B7280', textAlign:'center', padding:'40px 0' }}>Loading...</div>
            : pending.length === 0
              ? <div style={{ textAlign:'center', padding:'60px 0', color:'#6B7280', fontStyle:'italic' }}>No pending submissions. ✓</div>
              : <div style={{ display:'grid', gap:12 }}>
                  {pending.map(sub => (
                    <div key={sub.id} style={{ background:'#161B27', border:'1px solid #2A2F3E', borderRadius:10, padding:18 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:17, fontWeight:500, marginBottom:3 }}>{sub.name}</div>
                          <div style={{ fontSize:12, color:'#C9A84C' }}>{sub.city} · {sub.category}</div>
                        </div>
                        <div style={{ fontSize:11, color:'#6B7280' }}>
                          {new Date(sub.submitted_at).toLocaleDateString()}
                        </div>
                      </div>
                      {sub.kashrus && <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:6 }}>✓ Kashrus: <span style={{ color:'#E8DCC8' }}>{sub.kashrus}</span></div>}
                      {sub.why     && <div style={{ fontSize:13, color:'#9CA3AF', fontStyle:'italic', marginBottom:10 }}>"{sub.why}"</div>}
                      {sub.whatsapp && <div style={{ fontSize:12, color:'#6B7280', marginBottom:12 }}>📱 {sub.whatsapp}</div>}
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => handleApprove(sub)} style={{ background:'#4ADE80', color:'#0D1117', border:'none', borderRadius:8, padding:'7px 18px', cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:600 }}>✓ Approve</button>
                        <button onClick={() => handleReject(sub.id, sub.name)} style={{ background:'#F87171', color:'#0D1117', border:'none', borderRadius:8, padding:'7px 18px', cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:600 }}>✗ Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
        )}

        {/* Approved */}
        {adminTab === 'approved' && (
          approved.length === 0
            ? <div style={{ textAlign:'center', padding:'60px 0', color:'#6B7280', fontStyle:'italic' }}>No approved submissions yet.</div>
            : <div style={{ display:'grid', gap:8 }}>
                {approved.map(sub => (
                  <div key={sub.id} style={{ background:'#161B27', border:'1px solid #1A3A2A', borderLeft:'3px solid #4ADE80', borderRadius:10, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:500 }}>{sub.name}</div>
                      <div style={{ fontSize:12, color:'#6B7280' }}>{sub.city} · {sub.category}</div>
                    </div>
                    <span style={{ background:'#1A3A2A', color:'#4ADE80', fontSize:11, padding:'3px 10px', borderRadius:20 }}>Live ✓</span>
                  </div>
                ))}
              </div>
        )}

        {/* SQL */}
        {adminTab === 'sql' && (
          <div style={{ background:'#0A0E1A', border:'1px solid #2A2F3E', borderRadius:10, padding:20 }}>
            <div style={{ fontSize:11, letterSpacing:'0.15em', color:'#6B7280', textTransform:'uppercase', marginBottom:12 }}>
              Paste into Supabase → SQL Editor → Run
            </div>
            <pre style={{ fontSize:11, color:'#9CA3AF', margin:0, overflow:'auto', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{SQL}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

const SQL = `-- 1. Locations table
create table locations (
  id            bigint generated always as identity primary key,
  name          text not null,
  name_he       text,
  city          text not null,
  city_he       text,
  category      text not null,
  occasion      text[] not null default '{}',
  price         int not null default 1,
  date_stage    int[] not null default '{1,2}',
  description   text,
  description_he text,
  maps_query    text,
  kashrus       text,
  featured      boolean default false,
  status        text default 'approved',
  created_at    timestamptz default now()
);

-- 2. Pending submissions table
create table pending_submissions (
  id            bigint generated always as identity primary key,
  name          text not null,
  city          text not null,
  category      text not null,
  kashrus       text,
  why           text,
  whatsapp      text,
  date_stage    int[],
  price         int default 2,
  status        text default 'pending',
  submitted_at  timestamptz default now()
);

-- 3. Row Level Security
alter table locations enable row level security;
create policy "Public read approved"
  on locations for select using (status = 'approved');

alter table pending_submissions enable row level security;
create policy "Anyone can submit"
  on pending_submissions for insert with check (true);
create policy "Admin manages submissions"
  on pending_submissions for all
  using (auth.role() = 'authenticated');`
