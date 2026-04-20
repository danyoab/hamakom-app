import { useState, useMemo } from 'react'
import { ADMIN_PIN } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { usePending } from '../hooks/usePending'
import { SEED_LOCATIONS } from '../data/locations'

export default function AdminView({ lang, font, onBack, totalLocations, locations = [] }) {
  const [unlocked, setUnlocked]   = useState(false)
  const [pin, setPin]             = useState('')
  const [adminTab, setAdminTab]   = useState('pending')
  const [toast, setToast]         = useState(null)
  const [syncing, setSyncing]     = useState(false)
  const [imgSearch, setImgSearch] = useState('')
  const [imgLoc, setImgLoc]       = useState(null)
  const [imgUrl, setImgUrl]       = useState('')
  const [imgSaving, setImgSaving] = useState(false)

  const { pending, approved, loading, approveSub, rejectSub } = usePending()

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
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

  const handleSync = async () => {
    if (!supabase) return showToast('Supabase not connected — add env vars to sync', 'error')
    setSyncing(true)
    // Strip JS-only fields that may not exist in older DB deployments
    const rows = SEED_LOCATIONS.map(({ needs_verification, slug, region, ...rest }) => ({
      ...rest,
      slug: slug ?? null,
      region: region ?? null,
      needs_verification: needs_verification ?? false,
    }))
    const { error } = await supabase.from('locations').upsert(rows, { onConflict: 'id' })
    if (error) showToast(`Sync failed: ${error.message}`, 'error')
    else showToast(`✓ ${rows.length} locations synced to Supabase`)
    setSyncing(false)
  }

  const handleSaveImage = async () => {
    if (!supabase || !imgLoc) return
    setImgSaving(true)
    const { error } = await supabase
      .from('locations')
      .update({ image_url: imgUrl || null })
      .eq('id', imgLoc.id)
    if (error) showToast(`Save failed: ${error.message}`, 'error')
    else { showToast(`✓ Image updated for "${imgLoc.name}"`); setImgLoc(null); setImgUrl('') }
    setImgSaving(false)
  }

  const imgLocations = useMemo(() => {
    if (!imgSearch.trim()) return locations.slice(0, 40)
    const q = imgSearch.toLowerCase()
    return locations.filter(l =>
      l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q)
    ).slice(0, 40)
  }, [locations, imgSearch])

  const inputStyle = { background:'#0D1117', border:'1px solid #2A2F3E', borderRadius:8, padding:'9px 14px', color:'#E8DCC8', fontSize:13, width:'100%', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const btnStyle   = (col='#C9A84C') => ({ background:col, color:'#0D1117', border:'none', borderRadius:8, padding:'9px 20px', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' })

  if (!unlocked) return (
    <div style={{ minHeight:'100vh', background:'#0D1117', color:'#E8DCC8', fontFamily:font, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
      <div style={{ fontSize:40, marginBottom:20 }}>🔐</div>
      <h2 style={{ fontSize:22, fontWeight:400, marginBottom:8 }}>Admin Access</h2>
      <p style={{ color:'#6B7280', fontSize:13, marginBottom:28 }}>Enter your PIN to continue</p>
      <input
        type="password" value={pin} onChange={e => setPin(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && setUnlocked(pin === ADMIN_PIN)}
        placeholder="PIN"
        style={{ ...inputStyle, width:160, letterSpacing:'0.3em', textAlign:'center', marginBottom:12 }}
      />
      <button onClick={() => setUnlocked(pin === ADMIN_PIN)} style={btnStyle()}>Enter</button>
      {pin.length > 0 && pin !== ADMIN_PIN && (
        <p style={{ color:'#F87171', fontSize:13, marginTop:12 }}>Incorrect PIN.</p>
      )}
      <button onClick={onBack} style={{ background:'none', border:'none', color:'#6B7280', cursor:'pointer', marginTop:20, fontSize:13, fontFamily:font }}>← Back</button>
    </div>
  )

  const TABS = [
    ['pending',  `Pending (${pending.length})`],
    ['approved', `Approved (${approved.length})`],
    ['sync',     'Sync DB'],
    ['images',   'Images'],
    ['sql',      'SQL'],
  ]

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
        <span style={{ marginLeft:'auto', fontSize:11, color: supabase ? '#4ADE80' : '#F87171' }}>
          {supabase ? '● Supabase connected' : '● Supabase not connected'}
        </span>
      </div>

      <div style={{ maxWidth:700, margin:'0 auto', padding:'24px 20px' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
          {[
            ['Total Locations', totalLocations, '#C9A84C'],
            ['Pending Review',  pending.length, '#F472B6'],
            ['Seed Data',       SEED_LOCATIONS.length, '#60A5FA'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background:'#161B27', border:'1px solid #2A2F3E', borderRadius:10, padding:16, textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:300, color }}>{val}</div>
              <div style={{ fontSize:11, color:'#6B7280', marginTop:4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:20, flexWrap:'wrap' }}>
          {TABS.map(([tab, label]) => (
            <button key={tab} onClick={() => setAdminTab(tab)}
              style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13, background: adminTab===tab ? '#C9A84C' : '#1F2937', color: adminTab===tab ? '#0D1117' : '#9CA3AF' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Pending ─────────────────────────────────────────────────────── */}
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
                        <div style={{ fontSize:11, color:'#6B7280' }}>{new Date(sub.submitted_at).toLocaleDateString()}</div>
                      </div>
                      {sub.kashrus  && <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:6 }}>✓ Kashrus: <span style={{ color:'#E8DCC8' }}>{sub.kashrus}</span></div>}
                      {sub.why      && <div style={{ fontSize:13, color:'#9CA3AF', fontStyle:'italic', marginBottom:10 }}>"{sub.why}"</div>}
                      {sub.whatsapp && <div style={{ fontSize:12, color:'#6B7280', marginBottom:12 }}>📱 {sub.whatsapp}</div>}
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => handleApprove(sub)} style={btnStyle('#4ADE80')}>✓ Approve</button>
                        <button onClick={() => handleReject(sub.id, sub.name)} style={btnStyle('#F87171')}>✗ Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
        )}

        {/* ── Approved ────────────────────────────────────────────────────── */}
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

        {/* ── Sync DB ─────────────────────────────────────────────────────── */}
        {adminTab === 'sync' && (
          <div style={{ background:'#161B27', border:'1px solid #2A2F3E', borderRadius:10, padding:24 }}>
            <h3 style={{ fontSize:15, fontWeight:500, marginBottom:8, marginTop:0 }}>Sync Seed Data → Supabase</h3>
            <p style={{ fontSize:13, color:'#9CA3AF', marginBottom:8, lineHeight:1.6 }}>
              Pushes all <strong style={{ color:'#C9A84C' }}>{SEED_LOCATIONS.length}</strong> locations from the local seed file into your Supabase database.
              Safe to run multiple times — uses upsert (insert or update by ID).
            </p>
            {totalLocations < SEED_LOCATIONS.length && (
              <div style={{ background:'#1A2A1A', border:'1px solid #2D4A2D', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#86EFAC' }}>
                ⚠ Your DB has <strong>{totalLocations}</strong> locations but seed has <strong>{SEED_LOCATIONS.length}</strong> — sync will add the missing {SEED_LOCATIONS.length - totalLocations}.
              </div>
            )}
            {totalLocations >= SEED_LOCATIONS.length && (
              <div style={{ background:'#1A3A2A', border:'1px solid #16A34A', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#86EFAC' }}>
                ✓ DB is up to date ({totalLocations} locations).
              </div>
            )}
            {!supabase && (
              <div style={{ background:'#3A1A1A', border:'1px solid #DC2626', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#FCA5A5' }}>
                Supabase not connected. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your .env file.
              </div>
            )}
            <button
              onClick={handleSync}
              disabled={syncing || !supabase}
              style={{ ...btnStyle(), opacity: (syncing || !supabase) ? 0.5 : 1, cursor: (syncing || !supabase) ? 'not-allowed' : 'pointer' }}
            >
              {syncing ? 'Syncing…' : `Sync ${SEED_LOCATIONS.length} Locations to Supabase`}
            </button>
          </div>
        )}

        {/* ── Images ──────────────────────────────────────────────────────── */}
        {adminTab === 'images' && (
          <div>
            {!supabase ? (
              <div style={{ background:'#3A1A1A', border:'1px solid #DC2626', borderRadius:10, padding:24, textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>🔌</div>
                <div style={{ fontSize:15, color:'#FCA5A5', marginBottom:8 }}>Supabase not connected</div>
                <div style={{ fontSize:13, color:'#9CA3AF' }}>
                  Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> file to manage images.
                </div>
              </div>
            ) : imgLoc ? (
              <div style={{ background:'#161B27', border:'1px solid #2A2F3E', borderRadius:10, padding:24 }}>
                <button onClick={() => { setImgLoc(null); setImgUrl('') }} style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', fontSize:13, fontFamily:'inherit', padding:0, marginBottom:16 }}>← Back to list</button>
                <div style={{ fontSize:16, fontWeight:500, marginBottom:4 }}>{imgLoc.name}</div>
                <div style={{ fontSize:12, color:'#C9A84C', marginBottom:20 }}>{imgLoc.city} · {imgLoc.category}</div>
                {imgUrl && (
                  <img src={imgUrl} alt="" onError={e => e.target.style.display='none'}
                    style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:8, marginBottom:16, border:'1px solid #2A2F3E' }} />
                )}
                <label style={{ fontSize:12, color:'#6B7280', display:'block', marginBottom:6 }}>Image URL</label>
                <input
                  value={imgUrl}
                  onChange={e => setImgUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  style={{ ...inputStyle, marginBottom:16 }}
                />
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={handleSaveImage} disabled={imgSaving} style={{ ...btnStyle(), opacity: imgSaving ? 0.5 : 1 }}>
                    {imgSaving ? 'Saving…' : 'Save Image'}
                  </button>
                  {imgLoc.image_url && (
                    <button onClick={() => { setImgUrl(''); handleSaveImage() }} style={btnStyle('#F87171')}>Remove Image</button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <input
                  value={imgSearch}
                  onChange={e => setImgSearch(e.target.value)}
                  placeholder="Search location by name or city…"
                  style={{ ...inputStyle, marginBottom:16 }}
                />
                <div style={{ display:'grid', gap:8 }}>
                  {imgLocations.map(loc => (
                    <div
                      key={loc.id}
                      onClick={() => { setImgLoc(loc); setImgUrl(loc.image_url || '') }}
                      style={{ background:'#161B27', border:'1px solid #2A2F3E', borderRadius:10, padding:'14px 16px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                    >
                      <div>
                        <div style={{ fontSize:14, fontWeight:500 }}>{loc.name}</div>
                        <div style={{ fontSize:12, color:'#6B7280' }}>{loc.city} · {loc.category}</div>
                      </div>
                      {loc.image_url
                        ? <span style={{ fontSize:11, background:'#1A2A3A', color:'#60A5FA', padding:'3px 10px', borderRadius:20 }}>Has image ✓</span>
                        : <span style={{ fontSize:11, color:'#4B5563' }}>No image</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SQL ─────────────────────────────────────────────────────────── */}
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
create table if not exists locations (
  id                 bigint generated by default as identity primary key,
  name               text not null,
  name_he            text,
  city               text not null,
  city_he            text,
  category           text not null,
  occasion           text[] default '{}',
  price              int default 2,
  date_stage         int[] default '{}',
  description        text,
  description_he     text,
  maps_query         text,
  kashrus            text,
  featured           boolean default false,
  status             text default 'approved',
  slug               text,
  region             text,
  needs_verification boolean default false,
  image_url          text,
  created_at         timestamptz default now()
);

-- 2. Pending submissions table
create table if not exists pending_submissions (
  id           bigint generated by default as identity primary key,
  name         text not null,
  city         text not null,
  category     text not null,
  kashrus      text,
  why          text,
  whatsapp     text,
  date_stage   int[],
  price        int default 2,
  status       text default 'pending',
  submitted_at timestamptz default now()
);

-- 3. Row Level Security
alter table locations enable row level security;
create policy "public_read_approved" on locations for select using (status = 'approved');
create policy "anon_insert_locations" on locations for insert with check (true);
create policy "anon_update_locations" on locations for update using (true);

alter table pending_submissions enable row level security;
create policy "anon_insert_submissions" on pending_submissions for insert with check (true);
create policy "anon_read_submissions"   on pending_submissions for select using (true);
create policy "anon_update_submissions" on pending_submissions for update using (true);

-- 4. Migration (safe for existing DBs)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='locations' and column_name='slug') then
    alter table locations add column slug text; end if;
  if not exists (select 1 from information_schema.columns where table_name='locations' and column_name='region') then
    alter table locations add column region text; end if;
  if not exists (select 1 from information_schema.columns where table_name='locations' and column_name='needs_verification') then
    alter table locations add column needs_verification boolean default false; end if;
  if not exists (select 1 from information_schema.columns where table_name='locations' and column_name='image_url') then
    alter table locations add column image_url text; end if;
end $$;`
