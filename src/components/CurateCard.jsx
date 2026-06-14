import { useMemo, useState } from 'react'

const VIBE_TAGS = [
  'romantic', 'cozy', 'intimate', 'lively', 'late-night',
  'first-date', 'group-friendly', 'quiet', 'scenic',
  'activity-based', 'upscale', 'casual', 'hidden-gem',
]
const BEST_TIME    = ['morning', 'afternoon', 'evening', 'night']
const WEATHER_FIT  = ['any', 'sunny', 'rainy', 'cold', 'hot']
const INDOOR_OUT   = ['indoor', 'outdoor', 'both']

const CURATED_FIELDS = [
  'vibe_tags', 'indoor_outdoor', 'best_time', 'weather_fit',
  'romantic_score', 'conversation_score', 'energy_score', 'quietness_score',
  'activity_vs_food_score', 'group_vs_intimate_score',
  'duration_min', 'duration_max', 'notes_internal',
]

const SCORE_FIELDS = [
  ['romantic_score',           'Romantic',          'not at all',    'extremely romantic'],
  ['conversation_score',       'Conversation',      'loud / hard',   'easy to talk'],
  ['energy_score',             'Energy',            'sleepy',        'high energy'],
  ['quietness_score',          'Quietness',         'noisy',         'silent'],
  ['activity_vs_food_score',   'Activity ↔ Food',   'pure food',     'pure activity'],
  ['group_vs_intimate_score',  'Intimate ↔ Group',  'intimate',      'group-friendly'],
]

// Presets fill 8-10 of the 13 fields with sensible defaults. The curator can
// nudge any value before saving. Massive throughput win for the common case
// where a row clearly matches one archetype.
const PRESETS = [
  {
    key: 'first-date-cafe',
    label: '☕ First-date café',
    patch: {
      vibe_tags: ['casual', 'first-date', 'cozy', 'quiet'],
      indoor_outdoor: 'indoor',
      best_time: ['morning', 'afternoon'],
      weather_fit: ['any'],
      romantic_score: 35, conversation_score: 80, energy_score: 35, quietness_score: 70,
      activity_vs_food_score: 25, group_vs_intimate_score: 35,
      duration_min: 45, duration_max: 90,
    },
  },
  {
    key: 'romantic-dinner',
    label: '🕯 Romantic dinner',
    patch: {
      vibe_tags: ['romantic', 'intimate', 'upscale', 'cozy'],
      indoor_outdoor: 'indoor',
      best_time: ['evening', 'night'],
      weather_fit: ['any'],
      romantic_score: 85, conversation_score: 75, energy_score: 45, quietness_score: 65,
      activity_vs_food_score: 15, group_vs_intimate_score: 15,
      duration_min: 90, duration_max: 150,
    },
  },
  {
    key: 'wine-bar',
    label: '🍷 Wine bar',
    patch: {
      vibe_tags: ['romantic', 'intimate', 'cozy'],
      indoor_outdoor: 'indoor',
      best_time: ['evening', 'night'],
      weather_fit: ['any'],
      romantic_score: 75, conversation_score: 80, energy_score: 40, quietness_score: 65,
      activity_vs_food_score: 20, group_vs_intimate_score: 20,
      duration_min: 60, duration_max: 120,
    },
  },
  {
    key: 'lively-restaurant',
    label: '🔥 Lively spot',
    patch: {
      vibe_tags: ['lively', 'group-friendly', 'casual'],
      indoor_outdoor: 'indoor',
      best_time: ['evening', 'night'],
      weather_fit: ['any'],
      romantic_score: 40, conversation_score: 50, energy_score: 80, quietness_score: 25,
      activity_vs_food_score: 25, group_vs_intimate_score: 75,
      duration_min: 75, duration_max: 150,
    },
  },
  {
    key: 'outdoor-scenic',
    label: '🌳 Outdoor / scenic',
    patch: {
      vibe_tags: ['scenic', 'casual'],
      indoor_outdoor: 'outdoor',
      best_time: ['morning', 'afternoon'],
      weather_fit: ['sunny'],
      romantic_score: 55, conversation_score: 70, energy_score: 50, quietness_score: 60,
      activity_vs_food_score: 70, group_vs_intimate_score: 40,
      duration_min: 60, duration_max: 180,
    },
  },
  {
    key: 'activity',
    label: '🎯 Activity',
    patch: {
      vibe_tags: ['activity-based', 'lively', 'first-date'],
      indoor_outdoor: 'both',
      best_time: ['afternoon', 'evening'],
      weather_fit: ['any'],
      romantic_score: 35, conversation_score: 55, energy_score: 70, quietness_score: 30,
      activity_vs_food_score: 90, group_vs_intimate_score: 55,
      duration_min: 60, duration_max: 120,
    },
  },
]

// Fields whose absence most damages recommendation quality.
const CRITICAL_FIELDS = ['vibe_tags', 'indoor_outdoor', 'romantic_score', 'energy_score']

function missingCritical(draft) {
  return CRITICAL_FIELDS.filter(f => {
    const v = draft[f]
    if (Array.isArray(v)) return v.length === 0
    return v == null
  })
}

// eslint-disable-next-line react-refresh/only-export-components
export function curationCompleteness(loc) {
  const checks = [
    loc.vibe_tags?.length > 0,
    loc.indoor_outdoor != null,
    loc.best_time?.length > 0,
    loc.weather_fit?.length > 0,
    loc.romantic_score != null,
    loc.conversation_score != null,
    loc.energy_score != null,
    loc.quietness_score != null,
    loc.activity_vs_food_score != null,
    loc.group_vs_intimate_score != null,
    loc.duration_min != null,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// eslint-disable-next-line react-refresh/only-export-components
export function isRecommendationReady(loc) {
  return loc.vibe_tags?.length > 0
    && loc.indoor_outdoor != null
    && loc.romantic_score != null
    && loc.energy_score != null
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#C9A84C' : '#1F2937',
        color: active ? '#0D1117' : '#9CA3AF',
        border: `1px solid ${active ? '#C9A84C' : '#374151'}`,
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 11,
        fontFamily: 'inherit',
        cursor: 'pointer',
        fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  )
}

function ScoreSlider({ label, leftLabel, rightLabel, value, onChange }) {
  const isSet = value != null
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: '#E8DCC8', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: isSet ? '#C9A84C' : '#4B5563', fontVariantNumeric: 'tabular-nums' }}>
          {isSet ? value : '—'}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value ?? 50}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ width: '100%', accentColor: '#C9A84C', opacity: isSet ? 1 : 0.5 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6B7280' }}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}

export default function CurateCard({ loc, inputStyle, btnStyle, ghostBtnStyle, onSave, onSkip, onFlag }) {
  const [draft, setDraft] = useState(() => ({
    vibe_tags:               loc.vibe_tags || [],
    indoor_outdoor:          loc.indoor_outdoor || null,
    best_time:               loc.best_time || [],
    weather_fit:             loc.weather_fit || [],
    romantic_score:          loc.romantic_score ?? null,
    conversation_score:      loc.conversation_score ?? null,
    energy_score:            loc.energy_score ?? null,
    quietness_score:         loc.quietness_score ?? null,
    activity_vs_food_score:  loc.activity_vs_food_score ?? null,
    group_vs_intimate_score: loc.group_vs_intimate_score ?? null,
    duration_min:            loc.duration_min ?? null,
    duration_max:            loc.duration_max ?? null,
    notes_internal:          loc.notes_internal || '',
  }))
  const [saving, setSaving] = useState(false)

  const update = (k, v) => setDraft((prev) => ({ ...prev, [k]: v }))
  const toggle = (k, value) => setDraft((prev) => {
    const arr = prev[k] || []
    return { ...prev, [k]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] }
  })
  const applyPreset = (patch) => setDraft((prev) => ({ ...prev, ...patch }))

  const missing = missingCritical(draft)

  const completenessBefore = useMemo(() => curationCompleteness(loc), [loc])
  const completenessAfter  = curationCompleteness(draft)
  const ready              = isRecommendationReady(draft)

  // Diff: only fields whose effective value changed get included in the save patch
  // (and only those go into manual_edits.fields).
  const changedKeys = useMemo(() => {
    const ks = []
    for (const k of CURATED_FIELDS) {
      const before = loc[k]
      const after  = draft[k]
      const beforeNorm = Array.isArray(before) ? JSON.stringify(before) : (before ?? null)
      const afterNorm  = Array.isArray(after)  ? JSON.stringify(after)  : (after  ?? null)
      if (beforeNorm !== afterNorm) ks.push(k)
    }
    return ks
  }, [draft, loc])

  async function handleSave() {
    if (!changedKeys.length) return onSkip(loc.id)
    setSaving(true)
    const patch = {}
    for (const k of changedKeys) patch[k] = draft[k]
    await onSave(loc.id, patch, changedKeys)
    setSaving(false)
  }

  return (
    <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
      {/* Read-only context */}
      <div>
        <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', background: '#0D1117', border: '1px solid #2A2F3E', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          {loc.image_url
            ? <img src={loc.image_url} alt={loc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none' }} />
            : <span style={{ fontSize: 28, opacity: 0.3 }}>📷</span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#E8DCC8', marginBottom: 2 }}>{loc.name}</div>
        <div style={{ fontSize: 11, color: '#C9A84C', marginBottom: 8 }}>{loc.city} · {loc.category}</div>

        <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>API-sourced (read-only)</div>
        <div style={{ display: 'grid', gap: 3, fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
          {loc.google_rating != null && <div>⭐ {loc.google_rating} (Google)</div>}
          {loc.price != null && <div>{'$'.repeat(loc.price)} (price)</div>}
          {loc.business_status && <div style={{ color: loc.business_status === 'OPERATIONAL' ? '#4ADE80' : '#F87171' }}>● {loc.business_status}</div>}
          {loc.confidence_score != null && <div>conf {loc.confidence_score}/100</div>}
        </div>

        {loc.description && (
          <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4, marginBottom: 10, maxHeight: 80, overflow: 'auto' }}>
            {loc.description}
          </div>
        )}

        <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Completeness</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, background: '#1F2937', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${completenessAfter}%`, height: '100%', background: ready ? '#4ADE80' : '#C9A84C', transition: 'width 0.2s' }} />
          </div>
          <span style={{ fontSize: 11, color: '#E8DCC8', fontVariantNumeric: 'tabular-nums' }}>{completenessAfter}%</span>
        </div>
        {completenessAfter !== completenessBefore && (
          <div style={{ fontSize: 10, color: '#4ADE80', marginTop: 4 }}>+{completenessAfter - completenessBefore}% pending save</div>
        )}
        <div style={{ fontSize: 10, color: ready ? '#4ADE80' : '#6B7280', marginTop: 4 }}>
          {ready ? '✓ recommendation-ready' : '⏳ needs vibe + indoor/outdoor + romantic + energy'}
        </div>
      </div>

      {/* Curator inputs */}
      <div style={{ display: 'grid', gap: 14 }}>
        {/* Presets — one-click fill, curator can still nudge */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Preset:</span>
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => applyPreset(p.patch)} style={{ background: '#1F2937', color: '#E8DCC8', border: '1px solid #374151', borderRadius: 999, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              {p.label}
            </button>
          ))}
        </div>

        {missing.length > 0 && (
          <div style={{ background: '#1A1505', border: '1px solid #C9A84C44', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#C9A84C' }}>
            <strong>Missing critical:</strong> {missing.join(', ')} — required for the recommendation engine to use this row.
          </div>
        )}

        <div>
          <div style={{ fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Vibe tags <span style={{ color: '#6B7280' }}>(multi)</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {VIBE_TAGS.map(tag => (
              <Chip key={tag} active={draft.vibe_tags.includes(tag)} onClick={() => toggle('vibe_tags', tag)}>{tag}</Chip>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Indoor / Outdoor</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {INDOOR_OUT.map(v => (
                <Chip key={v} active={draft.indoor_outdoor === v} onClick={() => update('indoor_outdoor', draft.indoor_outdoor === v ? null : v)}>{v}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Best time <span style={{ color: '#6B7280' }}>(multi)</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {BEST_TIME.map(v => (
                <Chip key={v} active={draft.best_time.includes(v)} onClick={() => toggle('best_time', v)}>{v}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Weather fit <span style={{ color: '#6B7280' }}>(multi)</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {WEATHER_FIT.map(v => (
                <Chip key={v} active={draft.weather_fit.includes(v)} onClick={() => toggle('weather_fit', v)}>{v}</Chip>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {SCORE_FIELDS.map(([key, label, left, right]) => (
            <ScoreSlider
              key={key}
              label={label}
              leftLabel={left}
              rightLabel={right}
              value={draft[key]}
              onChange={(v) => update(key, v)}
            />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Min duration (min)</span>
            <input type="number" min={0} step={15} value={draft.duration_min ?? ''} onChange={(e) => update('duration_min', e.target.value === '' ? null : parseInt(e.target.value))} style={{ ...inputStyle, padding: '6px 8px' }} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Max duration (min)</span>
            <input type="number" min={0} step={15} value={draft.duration_max ?? ''} onChange={(e) => update('duration_max', e.target.value === '' ? null : parseInt(e.target.value))} style={{ ...inputStyle, padding: '6px 8px' }} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Internal notes</span>
            <input value={draft.notes_internal} onChange={(e) => update('notes_internal', e.target.value)} placeholder="why curated this way…" style={{ ...inputStyle, padding: '6px 8px' }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid #2A2F3E', paddingTop: 12 }}>
          <button onClick={handleSave} disabled={saving} style={btnStyle()}>{saving ? 'Saving…' : `Save & Next  (${changedKeys.length} changed)`}</button>
          <button onClick={() => onSkip(loc.id)} style={ghostBtnStyle}>Skip</button>
          <button onClick={() => onFlag(loc.id)} style={{ ...ghostBtnStyle, color: '#F87171', borderColor: '#7F1D1D' }}>Needs review</button>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6B7280' }}>
            {loc.last_curated_at ? `last curated ${new Date(loc.last_curated_at).toLocaleDateString()}` : 'never curated'}
          </span>
        </div>
      </div>
    </div>
  )
}
