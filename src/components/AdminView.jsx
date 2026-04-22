import { useEffect, useMemo, useRef, useState } from 'react'
import { ADMIN_PIN } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { getDeploymentWarnings } from '../lib/appConfig'
import { usePending } from '../hooks/usePending'
import { SEED_LOCATIONS } from '../data/locations'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function makeEmptyPlan() {
  return {
    id: `plan-${Date.now()}`,
    slug: `plan-${Date.now()}`,
    title_en: '',
    title_he: '',
    identity_label_en: '',
    identity_label_he: '',
    when_tags: [],
    focus_tags: [],
    seriousness_tags: [],
    length_tags: [],
    city: '',
    region: '',
    narrative_en: '',
    narrative_he: '',
    start_time_text_en: '',
    start_time_text_he: '',
    duration_text_en: '',
    duration_text_he: '',
    budget_text_en: '',
    budget_text_he: '',
    share_summary_en: '',
    share_summary_he: '',
    featured: false,
    tonight_pick_weight: 1,
    stops: [
      {
        name_en: '',
        name_he: '',
        instruction_en: '',
        instruction_he: '',
        order_tip_en: '',
        order_tip_he: '',
        maps_query: '',
      },
    ],
  }
}

export default function AdminView({
  font,
  onBack,
  totalLocations,
  datePlans = [],
  onSaveDatePlans,
  onResetDatePlans,
}) {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [adminTab, setAdminTab] = useState('plans')
  const [toast, setToast] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const [imgLocs, setImgLocs] = useState([])
  const [imgLoading, setImgLoading] = useState(false)
  const [uploading, setUploading] = useState({})
  const [imgSearch, setImgSearch] = useState('')
  const fileRefs = useRef({})

  const [planSearch, setPlanSearch] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState(datePlans[0]?.id || null)
  const [planDraft, setPlanDraft] = useState(datePlans[0] ? clone(datePlans[0]) : null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsData, setAnalyticsData] = useState({
    events: [],
    impressions: [],
    outcomes: [],
    feedback: [],
  })
  const deploymentWarnings = getDeploymentWarnings()

  const { pending, approved, loading, approveSub, rejectSub } = usePending()

  useEffect(() => {
    if (adminTab !== 'images') return
    if (imgLocs.length > 0) return
    setImgLoading(true)
    if (supabase) {
      supabase
        .from('locations')
        .select('id, name, city, category, image_url')
        .order('name')
        .then(({ data }) => {
          setImgLocs(data || SEED_LOCATIONS)
          setImgLoading(false)
        })
    } else {
      setImgLocs(SEED_LOCATIONS)
      setImgLoading(false)
    }
  }, [adminTab, imgLocs.length])

  useEffect(() => {
    if (adminTab !== 'analytics' || !supabase) return

    let cancelled = false
    setAnalyticsLoading(true)

    Promise.all([
      supabase.from('analytics_events').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('recommendation_impressions').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('recommendation_outcomes').select('*').order('updated_at', { ascending: false }).limit(1000),
      supabase.from('user_feedback').select('*').order('updated_at', { ascending: false }).limit(500),
    ]).then(([eventsRes, impressionsRes, outcomesRes, feedbackRes]) => {
      if (cancelled) return

      if (eventsRes.error || impressionsRes.error || outcomesRes.error || feedbackRes.error) {
        showToast(
          eventsRes.error?.message ||
            impressionsRes.error?.message ||
            outcomesRes.error?.message ||
            feedbackRes.error?.message ||
            'Analytics query failed',
          'error'
        )
        setAnalyticsLoading(false)
        return
      }

      setAnalyticsData({
        events: eventsRes.data || [],
        impressions: impressionsRes.data || [],
        outcomes: outcomesRes.data || [],
        feedback: feedbackRes.data || [],
      })
      setAnalyticsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [adminTab])

  useEffect(() => {
    if (!datePlans.length) {
      setSelectedPlanId(null)
      setPlanDraft(null)
      return
    }

    if (selectedPlanId && datePlans.some((plan) => plan.id === selectedPlanId)) {
      return
    }

    const nextPlan = datePlans[0]
    setSelectedPlanId(nextPlan.id)
    setPlanDraft(clone(nextPlan))
  }, [datePlans, selectedPlanId])

  const filteredPlans = useMemo(() => {
    return datePlans.filter((plan) => {
      if (!planSearch) return true
      const haystack = [plan.title_en, plan.title_he, plan.city, plan.slug].join(' ').toLowerCase()
      return haystack.includes(planSearch.toLowerCase())
    })
  }, [datePlans, planSearch])

  const analyticsSummary = useMemo(() => buildAnalyticsSummary(analyticsData, datePlans), [analyticsData, datePlans])

  const inputStyle = {
    background: '#0D1117',
    border: '1px solid #2A2F3E',
    borderRadius: 8,
    padding: '9px 14px',
    color: '#E8DCC8',
    fontSize: 13,
    width: '100%',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const btnStyle = (color = '#C9A84C') => ({
    background: color,
    color: '#0D1117',
    border: 'none',
    borderRadius: 8,
    padding: '9px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
  })

  const ghostBtnStyle = {
    background: '#1F2937',
    color: '#E8DCC8',
    border: '1px solid #374151',
    borderRadius: 8,
    padding: '9px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleUpload(loc, file) {
    if (!supabase) return showToast('Supabase not connected - images tab requires live DB', 'error')
    setUploading((state) => ({ ...state, [loc.id]: true }))
    try {
      const ext = file.name.split('.').pop().toLowerCase() || 'jpg'
      const path = `${loc.id}.${ext}`
      const { error: uploadError } = await supabase.storage.from('location-images').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const {
        data: { publicUrl },
      } = supabase.storage.from('location-images').getPublicUrl(path)
      const { error: dbError } = await supabase.from('locations').update({ image_url: publicUrl }).eq('id', loc.id)
      if (dbError) throw dbError
      setImgLocs((state) => state.map((item) => (item.id === loc.id ? { ...item, image_url: publicUrl } : item)))
      showToast(`Photo saved for "${loc.name}"`)
    } catch (error) {
      showToast(error.message || 'Upload failed', 'error')
    }
    setUploading((state) => ({ ...state, [loc.id]: false }))
  }

  const handleApprove = async (submission) => {
    if (!window.confirm(`Approve "${submission.name}"?`)) return
    await approveSub(submission)
    showToast(`"${submission.name}" approved and added to locations`)
  }

  const handleReject = async (id, name) => {
    if (!window.confirm(`Reject "${name}"?`)) return
    await rejectSub(id)
    showToast(`"${name}" rejected`, 'error')
  }

  const handleSync = async () => {
    if (!supabase) return showToast('Supabase not connected - add env vars to sync', 'error')
    setSyncing(true)
    const rows = SEED_LOCATIONS.map(({ needs_verification, slug, region, ...rest }) => ({
      ...rest,
      slug: slug ?? null,
      region: region ?? null,
      needs_verification: needs_verification ?? false,
    }))
    const { error } = await supabase.from('locations').upsert(rows, { onConflict: 'id' })
    if (error) showToast(`Sync failed: ${error.message}`, 'error')
    else showToast(`${rows.length} locations synced to Supabase`)
    setSyncing(false)
  }

  const updateDraft = (key, value) => {
    setPlanDraft((state) => ({ ...state, [key]: value }))
  }

  const updateArrayField = (key, value) => {
    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    updateDraft(key, items)
  }

  const updateStop = (index, key, value) => {
    setPlanDraft((state) => ({
      ...state,
      stops: state.stops.map((stop, stopIndex) => (stopIndex === index ? { ...stop, [key]: value } : stop)),
    }))
  }

  const addStop = () => {
    setPlanDraft((state) => ({
      ...state,
      stops: [
        ...state.stops,
        {
          name_en: '',
          name_he: '',
          instruction_en: '',
          instruction_he: '',
          order_tip_en: '',
          order_tip_he: '',
          maps_query: '',
        },
      ],
    }))
  }

  const removeStop = (index) => {
    setPlanDraft((state) => ({
      ...state,
      stops: state.stops.filter((_, stopIndex) => stopIndex !== index),
    }))
  }

  const saveDraft = () => {
    if (!planDraft?.title_en || !planDraft.city) {
      showToast('Title and city are required for a plan', 'error')
      return
    }

    const nextPlan = {
      ...planDraft,
      slug: slugify(planDraft.slug || planDraft.title_en),
      tonight_pick_weight: Number(planDraft.tonight_pick_weight) || 1,
    }

    const nextPlans = datePlans.some((plan) => plan.id === nextPlan.id)
      ? datePlans.map((plan) => (plan.id === nextPlan.id ? nextPlan : plan))
      : [...datePlans, nextPlan]

    onSaveDatePlans(nextPlans)
    setSelectedPlanId(nextPlan.id)
    setPlanDraft(clone(nextPlan))
    showToast(`Saved plan "${nextPlan.title_en}"`)
  }

  const addNewPlan = () => {
    const nextPlan = makeEmptyPlan()
    setSelectedPlanId(nextPlan.id)
    setPlanDraft(nextPlan)
  }

  const deletePlan = (planId) => {
    const current = datePlans.find((plan) => plan.id === planId)
    if (!current) return
    if (!window.confirm(`Delete "${current.title_en}"?`)) return
    const nextPlans = datePlans.filter((plan) => plan.id !== planId)
    onSaveDatePlans(nextPlans)
    showToast(`Deleted "${current.title_en}"`, 'error')
  }

  const restoreDefaults = () => {
    if (!window.confirm('Reset all date plans back to defaults?')) return
    onResetDatePlans()
    showToast('Date plans reset to defaults')
  }

  const selectPlan = (planId) => {
    const nextPlan = datePlans.find((plan) => plan.id === planId)
    if (!nextPlan) return
    setSelectedPlanId(nextPlan.id)
    setPlanDraft(clone(nextPlan))
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D1117', color: '#E8DCC8', fontFamily: font, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>🔐</div>
        <h2 style={{ fontSize: 22, fontWeight: 400, marginBottom: 8 }}>Admin Access</h2>
        <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 28 }}>Enter your PIN to continue</p>
        <input
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && setUnlocked(pin === ADMIN_PIN)}
          placeholder="PIN"
          style={{ ...inputStyle, width: 160, letterSpacing: '0.3em', textAlign: 'center', marginBottom: 12 }}
        />
        <button onClick={() => setUnlocked(pin === ADMIN_PIN)} style={btnStyle()}>
          Enter
        </button>
        {pin.length > 0 && pin !== ADMIN_PIN ? <p style={{ color: '#F87171', fontSize: 13, marginTop: 12 }}>Incorrect PIN.</p> : null}
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', marginTop: 20, fontSize: 13, fontFamily: font }}>
          ← Back
        </button>
      </div>
    )
  }

  const tabs = [
    ['plans', `Date Plans (${datePlans.length})`],
    ['analytics', 'Analytics'],
    ['pending', `Pending (${pending.length})`],
    ['approved', `Approved (${approved.length})`],
    ['sync', 'Sync DB'],
    ['images', 'Images'],
    ['sql', 'SQL'],
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0D1117', color: '#E8DCC8', fontFamily: font }}>
      {toast ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.type === 'error' ? '#7F1D1D' : '#14532D',
            color: toast.type === 'error' ? '#FCA5A5' : '#86EFAC',
            border: `1px solid ${toast.type === 'error' ? '#DC2626' : '#16A34A'}`,
            borderRadius: 10,
            padding: '12px 20px',
            fontSize: 13,
            fontWeight: 500,
            zIndex: 9999,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {toast.msg}
        </div>
      ) : null}

      <div style={{ background: '#161B27', borderBottom: '1px solid #2A2F3E', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#C9A84C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
          ← Back
        </button>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Admin Dashboard</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: supabase ? '#4ADE80' : '#F87171' }}>{supabase ? '● Supabase connected' : '● Supabase not connected'}</span>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            ['Date Plans', datePlans.length, '#C9A84C'],
            ['Total Locations', totalLocations, '#60A5FA'],
            ['Pending Review', pending.length, '#F472B6'],
            ['Featured Plans', datePlans.filter((plan) => plan.featured).length, '#4ADE80'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color }}>{value}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {deploymentWarnings.length ? (
          <div style={{ background: '#3A1A1A', border: '1px solid #DC2626', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FCA5A5', marginBottom: 8 }}>Deployment Warnings</div>
            <div style={{ display: 'grid', gap: 6, color: '#FDE68A', fontSize: 13, lineHeight: 1.6 }}>
              {deploymentWarnings.map((warning) => (
                <div key={warning}>• {warning}</div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
          {tabs.map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setAdminTab(tab)}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, background: adminTab === tab ? '#C9A84C' : '#1F2937', color: adminTab === tab ? '#0D1117' : '#9CA3AF' }}
            >
              {label}
            </button>
          ))}
        </div>

        {adminTab === 'plans' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
            <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 14, alignSelf: 'start' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button onClick={addNewPlan} style={btnStyle()}>
                  Add Plan
                </button>
                <button onClick={restoreDefaults} style={ghostBtnStyle}>
                  Reset Defaults
                </button>
              </div>
              <input value={planSearch} onChange={(event) => setPlanSearch(event.target.value)} placeholder="Search plans..." style={{ ...inputStyle, marginBottom: 12 }} />

              <div style={{ display: 'grid', gap: 8, maxHeight: 760, overflowY: 'auto' }}>
                {filteredPlans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => selectPlan(plan.id)}
                    style={{
                      textAlign: 'left',
                      background: selectedPlanId === plan.id ? '#1D2635' : '#121722',
                      color: '#E8DCC8',
                      border: `1px solid ${selectedPlanId === plan.id ? '#C9A84C' : '#232A39'}`,
                      borderRadius: 10,
                      padding: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{plan.title_en}</div>
                    <div style={{ fontSize: 11, color: '#C9A84C', marginBottom: 4 }}>{plan.city}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{plan.when_tags.join(', ') || 'No timing tags'}</div>
                  </button>
                ))}
              </div>
            </section>

            <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 16 }}>
              {planDraft ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!datePlans.some((plan) => plan.id === planDraft.id) ? (
                      <span
                        style={{
                          alignSelf: 'center',
                          background: '#1A2A1A',
                          border: '1px solid #2D6A4F',
                          color: '#86EFAC',
                          borderRadius: 999,
                          padding: '6px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        New plan draft
                      </span>
                    ) : null}
                    <button onClick={saveDraft} style={btnStyle()}>
                      Save Plan
                    </button>
                    <button onClick={addNewPlan} style={ghostBtnStyle}>
                      Add Another Plan
                    </button>
                    {datePlans.some((plan) => plan.id === planDraft.id) ? (
                      <button onClick={() => deletePlan(planDraft.id)} style={btnStyle('#F87171')}>
                        Delete Plan
                      </button>
                    ) : null}
                  </div>

                  <Section title="Core">
                    <TwoCol>
                      <Field label="Title EN">
                        <input value={planDraft.title_en} onChange={(event) => updateDraft('title_en', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Title HE">
                        <input value={planDraft.title_he} onChange={(event) => updateDraft('title_he', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Slug">
                        <input value={planDraft.slug} onChange={(event) => updateDraft('slug', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="City">
                        <input value={planDraft.city} onChange={(event) => updateDraft('city', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Region">
                        <input value={planDraft.region || ''} onChange={(event) => updateDraft('region', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Tonight Pick Weight">
                        <input type="number" min="0" value={planDraft.tonight_pick_weight} onChange={(event) => updateDraft('tonight_pick_weight', event.target.value)} style={inputStyle} />
                      </Field>
                    </TwoCol>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#E8DCC8' }}>
                      <input type="checkbox" checked={!!planDraft.featured} onChange={(event) => updateDraft('featured', event.target.checked)} />
                      Featured plan
                    </label>
                  </Section>

                  <Section title="Identity and Matching">
                    <TwoCol>
                      <Field label="Identity EN">
                        <input value={planDraft.identity_label_en} onChange={(event) => updateDraft('identity_label_en', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Identity HE">
                        <input value={planDraft.identity_label_he} onChange={(event) => updateDraft('identity_label_he', event.target.value)} style={inputStyle} />
                      </Field>
                            <Field label="When Tags">
                              <input value={(planDraft.when_tags || []).join(', ')} onChange={(event) => updateArrayField('when_tags', event.target.value)} placeholder="tonight, thursday-night" style={inputStyle} />
                            </Field>
                            <Field label="Focus Tags">
                              <input value={(planDraft.focus_tags || []).join(', ')} onChange={(event) => updateArrayField('focus_tags', event.target.value)} placeholder="atmosphere, food-drink" style={inputStyle} />
                            </Field>
                            <Field label="Seriousness Tags">
                              <input value={(planDraft.seriousness_tags || []).join(', ')} onChange={(event) => updateArrayField('seriousness_tags', event.target.value)} placeholder="just-met, getting-to-know" style={inputStyle} />
                            </Field>
                            <Field label="Length Tags">
                              <input value={(planDraft.length_tags || []).join(', ')} onChange={(event) => updateArrayField('length_tags', event.target.value)} placeholder="short, medium, long" style={inputStyle} />
                            </Field>
                          </TwoCol>
                        </Section>

                  <Section title="Copy">
                    <Field label="Narrative EN">
                      <textarea value={planDraft.narrative_en} onChange={(event) => updateDraft('narrative_en', event.target.value)} rows={3} style={inputStyle} />
                    </Field>
                    <Field label="Narrative HE">
                      <textarea value={planDraft.narrative_he} onChange={(event) => updateDraft('narrative_he', event.target.value)} rows={3} style={inputStyle} />
                    </Field>
                    <TwoCol>
                      <Field label="Start Time EN">
                        <input value={planDraft.start_time_text_en} onChange={(event) => updateDraft('start_time_text_en', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Start Time HE">
                        <input value={planDraft.start_time_text_he} onChange={(event) => updateDraft('start_time_text_he', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Duration EN">
                        <input value={planDraft.duration_text_en} onChange={(event) => updateDraft('duration_text_en', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Duration HE">
                        <input value={planDraft.duration_text_he} onChange={(event) => updateDraft('duration_text_he', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Budget EN">
                        <input value={planDraft.budget_text_en} onChange={(event) => updateDraft('budget_text_en', event.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Budget HE">
                        <input value={planDraft.budget_text_he} onChange={(event) => updateDraft('budget_text_he', event.target.value)} style={inputStyle} />
                      </Field>
                    </TwoCol>
                    <Field label="Share Summary EN">
                      <textarea value={planDraft.share_summary_en} onChange={(event) => updateDraft('share_summary_en', event.target.value)} rows={2} style={inputStyle} />
                    </Field>
                    <Field label="Share Summary HE">
                      <textarea value={planDraft.share_summary_he} onChange={(event) => updateDraft('share_summary_he', event.target.value)} rows={2} style={inputStyle} />
                    </Field>
                  </Section>

                  <Section title="Stops">
                    <div style={{ display: 'grid', gap: 12 }}>
                      {planDraft.stops.map((stop, index) => (
                        <div key={`${planDraft.id}-stop-${index}`} style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 10, padding: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Stop {index + 1}</div>
                            {planDraft.stops.length > 1 ? (
                              <button onClick={() => removeStop(index)} style={btnStyle('#F87171')}>
                                Remove
                              </button>
                            ) : null}
                          </div>
                          <TwoCol>
                            <Field label="Name EN">
                              <input value={stop.name_en} onChange={(event) => updateStop(index, 'name_en', event.target.value)} style={inputStyle} />
                            </Field>
                            <Field label="Name HE">
                              <input value={stop.name_he} onChange={(event) => updateStop(index, 'name_he', event.target.value)} style={inputStyle} />
                            </Field>
                            <Field label="Instruction EN">
                              <textarea value={stop.instruction_en} onChange={(event) => updateStop(index, 'instruction_en', event.target.value)} rows={3} style={inputStyle} />
                            </Field>
                            <Field label="Instruction HE">
                              <textarea value={stop.instruction_he} onChange={(event) => updateStop(index, 'instruction_he', event.target.value)} rows={3} style={inputStyle} />
                            </Field>
                            <Field label="Order Tip EN">
                              <textarea value={stop.order_tip_en || ''} onChange={(event) => updateStop(index, 'order_tip_en', event.target.value)} rows={2} style={inputStyle} />
                            </Field>
                            <Field label="Order Tip HE">
                              <textarea value={stop.order_tip_he || ''} onChange={(event) => updateStop(index, 'order_tip_he', event.target.value)} rows={2} style={inputStyle} />
                            </Field>
                            <Field label="Maps Query">
                              <input value={stop.maps_query || ''} onChange={(event) => updateStop(index, 'maps_query', event.target.value)} style={inputStyle} />
                            </Field>
                          </TwoCol>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <button onClick={addStop} style={ghostBtnStyle}>
                        Add Stop
                      </button>
                    </div>
                  </Section>
                </div>
              ) : (
                <div style={{ color: '#6B7280', textAlign: 'center', padding: '60px 0', display: 'grid', gap: 14, justifyItems: 'center' }}>
                  <div>No plan selected.</div>
                  <button onClick={addNewPlan} style={btnStyle()}>
                    Add Plan
                  </button>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {adminTab === 'analytics' ? (
          !supabase ? (
            <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 24, color: '#9CA3AF', lineHeight: 1.7 }}>
              Connect Supabase to view app-wide analytics. Once connected, this tab will show funnel health, top plans, quiz answer patterns, and recent feedback.
            </div>
          ) : analyticsLoading ? (
            <div style={{ color: '#6B7280', textAlign: 'center', padding: '40px 0' }}>Loading analytics...</div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12 }}>
                {analyticsSummary.kpis.map((card) => (
                  <div key={card.label} style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{card.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 300, color: card.color }}>{card.value}</div>
                    {card.subtext ? <div style={{ marginTop: 6, fontSize: 12, color: '#9CA3AF' }}>{card.subtext}</div> : null}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', marginBottom: 12 }}>Last 7 Days</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {analyticsSummary.dailyRows.map((row) => (
                      <div key={row.day} style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 10, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{row.dayLabel}</div>
                          <div style={{ fontSize: 12, color: '#6B7280' }}>{row.resultViews} result views</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, fontSize: 12 }}>
                          <MiniMetric label="Quiz" value={row.quizCompleted} />
                          <MiniMetric label="Saves" value={row.planSaved} />
                          <MiniMetric label="Shares" value={row.planShared} />
                          <MiniMetric label="Feedback" value={row.feedback} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', marginBottom: 12 }}>Planner Funnel</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {analyticsSummary.funnel.map((step) => (
                      <div key={step.label} style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 10, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{step.label}</div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{step.subtext}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 24, color: '#E8DCC8', lineHeight: 1 }}>{step.value}</div>
                            {step.rate ? <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{step.rate}</div> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', marginBottom: 12 }}>Top Plans</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {analyticsSummary.topPlans.length ? (
                      analyticsSummary.topPlans.map((plan) => (
                        <div key={plan.id} style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 10, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{plan.title}</div>
                              <div style={{ fontSize: 12, color: '#C9A84C', marginTop: 4 }}>{plan.city || 'No city set'}</div>
                            </div>
                            <div style={{ fontSize: 12, color: '#9CA3AF' }}>{plan.views} views</div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 10, fontSize: 12 }}>
                            <MiniMetric label="Saved" value={plan.saves} />
                            <MiniMetric label="Shared" value={plan.shares} />
                            <MiniMetric label="Went" value={plan.went} />
                            <MiniMetric label="Avg ★" value={plan.avgRating} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#6B7280', fontSize: 13 }}>No plan analytics yet.</div>
                    )}
                  </div>
                </section>

                <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', marginBottom: 12 }}>Quiz Patterns</div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {analyticsSummary.answerBreakdowns.map((group) => (
                      <div key={group.label} style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 12, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{group.label}</div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {group.items.length ? (
                            group.items.map((item) => (
                              <div key={`${group.label}-${item.key}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                                <span>{item.label}</span>
                                <span style={{ color: '#C9A84C' }}>{item.count}</span>
                              </div>
                            ))
                          ) : (
                            <div style={{ fontSize: 12, color: '#6B7280' }}>No data yet.</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', marginBottom: 12 }}>City Performance</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {analyticsSummary.cityPerformance.length ? (
                      analyticsSummary.cityPerformance.map((city) => (
                        <div key={city.city} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, background: '#121722', border: '1px solid #232A39', borderRadius: 10, padding: 12 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{city.city}</div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{city.views} result views</div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#9CA3AF' }}>
                            <div>{city.saves} saves</div>
                            <div style={{ marginTop: 4 }}>{city.ratings > 0 ? `${city.avgRating} avg rating` : 'No ratings yet'}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#6B7280', fontSize: 13 }}>No city trend data yet.</div>
                    )}
                  </div>
                </section>

                <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', marginBottom: 12 }}>Recent Feedback</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {analyticsSummary.recentFeedback.length ? (
                      analyticsSummary.recentFeedback.map((item) => (
                        <div key={`${item.item_type}-${item.item_id}-${item.updated_at}`} style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 10, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</div>
                            <div style={{ fontSize: 11, color: '#6B7280' }}>{formatDate(item.updated_at)}</div>
                          </div>
                          <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6 }}>
                            Went: {item.went === true ? 'Yes' : item.went === false ? 'No' : '—'} · Rating: {item.rating || '—'} · Again: {item.would_do_again === true ? 'Yes' : item.would_do_again === false ? 'No' : '—'}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#6B7280', fontSize: 13 }}>No user feedback yet.</div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )
        ) : null}

        {adminTab === 'pending'
          ? loading
            ? <div style={{ color: '#6B7280', textAlign: 'center', padding: '40px 0' }}>Loading...</div>
            : pending.length === 0
              ? <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280', fontStyle: 'italic' }}>No pending submissions.</div>
              : <div style={{ display: 'grid', gap: 12 }}>
                  {pending.map((sub) => (
                    <div key={sub.id} style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10, padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 3 }}>{sub.name}</div>
                          <div style={{ fontSize: 12, color: '#C9A84C' }}>{sub.city} · {sub.category}</div>
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>{new Date(sub.submitted_at).toLocaleDateString()}</div>
                      </div>
                      {sub.kashrus ? <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>✓ Kashrus: <span style={{ color: '#E8DCC8' }}>{sub.kashrus}</span></div> : null}
                      {sub.why ? <div style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10 }}>"{sub.why}"</div> : null}
                      {sub.whatsapp ? <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>📱 {sub.whatsapp}</div> : null}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleApprove(sub)} style={btnStyle('#4ADE80')}>Approve</button>
                        <button onClick={() => handleReject(sub.id, sub.name)} style={btnStyle('#F87171')}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
          : null}

        {adminTab === 'approved'
          ? approved.length === 0
            ? <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280', fontStyle: 'italic' }}>No approved submissions yet.</div>
            : <div style={{ display: 'grid', gap: 8 }}>
                {approved.map((sub) => (
                  <div key={sub.id} style={{ background: '#161B27', border: '1px solid #1A3A2A', borderLeft: '3px solid #4ADE80', borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{sub.name}</div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>{sub.city} · {sub.category}</div>
                    </div>
                    <span style={{ background: '#1A3A2A', color: '#4ADE80', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>Live</span>
                  </div>
                ))}
              </div>
          : null}

        {adminTab === 'sync' ? (
          <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, marginTop: 0 }}>Sync Seed Data → Supabase</h3>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 8, lineHeight: 1.6 }}>
              Push all <strong style={{ color: '#C9A84C' }}>{SEED_LOCATIONS.length}</strong> locations from local seed data into Supabase.
            </p>
            {!supabase ? <div style={{ background: '#3A1A1A', border: '1px solid #DC2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#FCA5A5' }}>Supabase not connected. Add env vars to your .env file.</div> : null}
            <button onClick={handleSync} disabled={syncing || !supabase} style={{ ...btnStyle(), opacity: syncing || !supabase ? 0.5 : 1, cursor: syncing || !supabase ? 'not-allowed' : 'pointer' }}>
              {syncing ? 'Syncing...' : `Sync ${SEED_LOCATIONS.length} Locations`}
            </button>
          </div>
        ) : null}

        {adminTab === 'images' ? (
          <div>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 14, lineHeight: 1.6 }}>
              Upload a photo for each location. Images are stored in Supabase Storage in the <code style={{ color: '#C9A84C' }}>location-images</code> bucket.
            </p>
            <input value={imgSearch} onChange={(event) => setImgSearch(event.target.value)} placeholder="Filter locations..." style={{ ...inputStyle, marginBottom: 16 }} />
            {imgLoading
              ? <div style={{ color: '#6B7280', textAlign: 'center', padding: '40px 0' }}>Loading locations...</div>
              : <div style={{ display: 'grid', gap: 8 }}>
                  {imgLocs
                    .filter((loc) => !imgSearch || loc.name.toLowerCase().includes(imgSearch.toLowerCase()) || loc.city.toLowerCase().includes(imgSearch.toLowerCase()))
                    .map((loc) => (
                      <div key={loc.id} style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 64, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#0D1117', border: '1px solid #2A2F3E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {loc.image_url ? <img src={loc.image_url} alt={loc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(event) => { event.target.style.display = 'none' }} /> : <span style={{ fontSize: 20, opacity: 0.3 }}>📷</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#E8DCC8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</div>
                          <div style={{ fontSize: 11, color: '#6B7280' }}>{loc.city}</div>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          ref={(element) => {
                            fileRefs.current[loc.id] = element
                          }}
                          onChange={(event) => {
                            if (event.target.files[0]) handleUpload(loc, event.target.files[0])
                            event.target.value = ''
                          }}
                        />
                        <button onClick={() => fileRefs.current[loc.id]?.click()} disabled={uploading[loc.id]} style={{ background: loc.image_url ? '#1F2937' : '#1A2A1A', border: `1px solid ${loc.image_url ? '#374151' : '#2D6A4F'}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: loc.image_url ? '#9CA3AF' : '#4ADE80', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {uploading[loc.id] ? 'Uploading...' : loc.image_url ? 'Replace' : 'Add Photo'}
                        </button>
                      </div>
                    ))}
                </div>}
          </div>
        ) : null}

        {adminTab === 'sql' ? (
          <div style={{ background: '#0A0E1A', border: '1px solid #2A2F3E', borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12 }}>Paste into Supabase SQL Editor</div>
            <pre style={{ fontSize: 11, color: '#9CA3AF', margin: 0, overflow: 'auto', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{SQL}</pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </section>
  )
}

function TwoCol({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>{children}</div>
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  )
}

function MiniMetric({ label, value }) {
  return (
    <div style={{ background: '#0D1117', border: '1px solid #232A39', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#E8DCC8' }}>{value}</div>
    </div>
  )
}

function buildAnalyticsSummary(analyticsData, datePlans) {
  const events = analyticsData.events || []
  const impressions = analyticsData.impressions || []
  const outcomes = analyticsData.outcomes || []
  const feedback = analyticsData.feedback || []

  const planMap = new Map(datePlans.map((plan) => [plan.id, plan]))
  const impressionMap = new Map(impressions.map((item) => [String(item.id), item]))
  const outcomeMap = new Map(outcomes.map((item) => [String(item.recommendation_impression_id), item]))
  const eventCounts = countBy(events, (event) => event.event_name)

  const wentFeedback = feedback.filter((item) => item.went === true)
  const ratedFeedback = feedback.filter((item) => Number.isFinite(item.rating))
  const againFeedback = feedback.filter((item) => item.would_do_again === true)

  const dailyRows = buildDailyRows(events, feedback)
  const funnel = buildFunnel(eventCounts)
  const topPlans = buildTopPlans({ events, impressions, outcomes, planMap, impressionMap, outcomeMap })
  const answerBreakdowns = buildAnswerBreakdowns(events)
  const cityPerformance = buildCityPerformance({ events, impressions, outcomes, planMap, impressionMap, outcomeMap })
  const recentFeedback = feedback
    .slice()
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
    .slice(0, 8)
    .map((item) => ({
      ...item,
      title: item.item_type === 'plan' ? planMap.get(item.item_id)?.title_en || item.item_id : item.item_id,
    }))

  const kpis = [
    { label: 'Quiz Starts', value: eventCounts.quiz_started || 0, color: '#C9A84C' },
    { label: 'Quiz Completed', value: eventCounts.quiz_completed || 0, color: '#60A5FA' },
    { label: 'Plan Saves', value: eventCounts.plan_saved || 0, color: '#4ADE80' },
    { label: 'Shares', value: eventCounts.plan_shared || 0, color: '#F472B6' },
    {
      label: 'Went Rate',
      value: percentage(wentFeedback.length, feedback.length),
      color: '#F59E0B',
      subtext: `${wentFeedback.length}/${feedback.length || 0} feedback entries`,
    },
    {
      label: 'Avg Rating',
      value: ratedFeedback.length ? average(ratedFeedback.map((item) => item.rating)).toFixed(1) : '—',
      color: '#E8DCC8',
      subtext: againFeedback.length ? `${percentage(againFeedback.length, feedback.length)} would do again` : 'No repeat-signal yet',
    },
  ]

  return {
    kpis,
    dailyRows,
    funnel,
    topPlans,
    answerBreakdowns,
    cityPerformance,
    recentFeedback,
  }
}

function buildDailyRows(events, feedback) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return {
      day: key,
      dayLabel: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      quizCompleted: 0,
      resultViews: 0,
      planSaved: 0,
      planShared: 0,
      feedback: 0,
    }
  })

  const dayMap = new Map(days.map((day) => [day.day, day]))

  events.forEach((event) => {
    const key = (event.created_at || '').slice(0, 10)
    const row = dayMap.get(key)
    if (!row) return
    if (event.event_name === 'quiz_completed') row.quizCompleted += 1
    if (event.event_name === 'plan_result_viewed') row.resultViews += 1
    if (event.event_name === 'plan_saved') row.planSaved += 1
    if (event.event_name === 'plan_shared') row.planShared += 1
  })

  feedback.forEach((item) => {
    const key = (item.updated_at || item.created_at || '').slice(0, 10)
    const row = dayMap.get(key)
    if (row) row.feedback += 1
  })

  return days
}

function buildFunnel(eventCounts) {
  const starts = eventCounts.quiz_started || 0
  const completed = eventCounts.quiz_completed || 0
  const viewed = eventCounts.plan_result_viewed || 0
  const committed = (eventCounts.plan_saved || 0) + (eventCounts.plan_shared || 0) + (eventCounts.plan_maps_opened || 0)
  const feedback = eventCounts.feedback_submitted || 0

  return [
    { label: 'Quiz started', value: starts, subtext: 'People entered the planning flow' },
    { label: 'Quiz completed', value: completed, subtext: 'Reached a complete answer set', rate: starts ? percentage(completed, starts) : null },
    { label: 'Result viewed', value: viewed, subtext: 'Saw a full recommended plan', rate: completed ? percentage(viewed, completed) : null },
    { label: 'Commit signals', value: committed, subtext: 'Saved, shared, or opened maps', rate: viewed ? percentage(committed, viewed) : null },
    { label: 'Feedback sent', value: feedback, subtext: 'Closed the loop after the date', rate: viewed ? percentage(feedback, viewed) : null },
  ]
}

function buildTopPlans({ events, impressions, outcomes, planMap, impressionMap }) {
  const planStats = new Map()

  impressions.forEach((impression) => {
    const key = impression.primary_plan_id
    if (!planStats.has(key)) {
      planStats.set(key, { id: key, views: 0, saves: 0, shares: 0, went: 0, ratings: [], city: planMap.get(key)?.city || '' })
    }
    planStats.get(key).views += 1
  })

  events.forEach((event) => {
    if (!event.item_id || !planStats.has(event.item_id)) return
    if (event.event_name === 'plan_saved') planStats.get(event.item_id).saves += 1
    if (event.event_name === 'plan_shared') planStats.get(event.item_id).shares += 1
  })

  outcomes.forEach((outcome) => {
    const impression = impressionMap.get(String(outcome.recommendation_impression_id))
    if (!impression) return
    const stats = planStats.get(impression.primary_plan_id)
    if (!stats) return
    if (outcome.went) stats.went += 1
    if (Number.isFinite(outcome.rating)) stats.ratings.push(outcome.rating)
  })

  return Array.from(planStats.values())
    .map((stats) => ({
      ...stats,
      title: planMap.get(stats.id)?.title_en || stats.id,
      avgRating: stats.ratings.length ? average(stats.ratings).toFixed(1) : '—',
      score: stats.views * 2 + stats.saves * 4 + stats.shares * 5 + stats.went * 6,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

function buildAnswerBreakdowns(events) {
  const completed = events.filter((event) => event.event_name === 'quiz_completed')
  const groups = [
    ['When', 'when'],
    ['Length', 'length'],
    ['Focus', 'focus'],
    ['Seriousness', 'seriousness'],
    ['City', 'city'],
  ]

  return groups.map(([label, key]) => {
    const counts = countBy(completed, (event) => normalizeLabel(event.properties?.[key]))
    return {
      label,
      items: Array.from(counts.entries())
        .map(([itemLabel, count]) => ({ key: itemLabel, label: itemLabel, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }
  })
}

function buildCityPerformance({ events, impressions, outcomes, planMap, impressionMap }) {
  const byCity = new Map()
  const ensure = (city) => {
    const key = city || 'Unknown'
    if (!byCity.has(key)) {
      byCity.set(key, { city: key, views: 0, saves: 0, ratings: 0, ratingValues: [] })
    }
    return byCity.get(key)
  }

  impressions.forEach((impression) => {
    const city = planMap.get(impression.primary_plan_id)?.city || 'Unknown'
    ensure(city).views += 1
  })

  events.forEach((event) => {
    if (event.event_name !== 'plan_saved') return
    const city = planMap.get(event.item_id)?.city || 'Unknown'
    ensure(city).saves += 1
  })

  outcomes.forEach((outcome) => {
    const impression = impressionMap.get(String(outcome.recommendation_impression_id))
    if (!impression) return
    const city = planMap.get(impression.primary_plan_id)?.city || 'Unknown'
    const bucket = ensure(city)
    if (Number.isFinite(outcome.rating)) {
      bucket.ratings += 1
      bucket.ratingValues.push(outcome.rating)
    }
  })

  return Array.from(byCity.values())
    .map((city) => ({
      ...city,
      avgRating: city.ratingValues.length ? average(city.ratingValues).toFixed(1) : '—',
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6)
}

function countBy(items, getKey) {
  const counts = new Map()
  items.forEach((item) => {
    const key = getKey(item)
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return counts
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
}

function percentage(part, whole) {
  if (!whole) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}

function normalizeLabel(value) {
  if (!value) return 'Not set'
  if (typeof value !== 'string') return String(value)
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const SQL = `-- Core tables the app already expects:
create table if not exists analytics_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  session_id text not null,
  event_name text not null,
  item_type text,
  item_id text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_name_idx on analytics_events(event_name);
create index if not exists analytics_events_user_id_idx on analytics_events(user_id);
create index if not exists analytics_events_created_at_idx on analytics_events(created_at desc);

create table if not exists user_feedback (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('plan', 'place')),
  item_id text not null,
  went boolean,
  rating int check (rating between 1 and 5),
  would_do_again boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create index if not exists user_feedback_user_id_idx on user_feedback(user_id);
create index if not exists user_feedback_item_idx on user_feedback(item_type, item_id);

create table if not exists recommendation_impressions (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  session_id text not null,
  quiz_answers jsonb not null default '{}'::jsonb,
  primary_plan_id text not null,
  backup_location_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_impressions_user_id_idx on recommendation_impressions(user_id);
create index if not exists recommendation_impressions_created_at_idx on recommendation_impressions(created_at desc);

create table if not exists recommendation_outcomes (
  id bigserial primary key,
  recommendation_impression_id bigint not null references recommendation_impressions(id) on delete cascade,
  saved boolean not null default false,
  shared boolean not null default false,
  maps_opened boolean not null default false,
  reminder_set boolean not null default false,
  went boolean,
  rating int check (rating between 1 and 5),
  would_do_again boolean,
  updated_at timestamptz not null default now(),
  unique (recommendation_impression_id)
);

create index if not exists recommendation_outcomes_impression_idx on recommendation_outcomes(recommendation_impression_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_feedback_set_updated_at on user_feedback;
create trigger user_feedback_set_updated_at
before update on user_feedback
for each row execute procedure set_updated_at();

drop trigger if exists recommendation_outcomes_set_updated_at on recommendation_outcomes;
create trigger recommendation_outcomes_set_updated_at
before update on recommendation_outcomes
for each row execute procedure set_updated_at();

alter table analytics_events enable row level security;
alter table user_feedback enable row level security;
alter table recommendation_impressions enable row level security;
alter table recommendation_outcomes enable row level security;

drop policy if exists "analytics insert" on analytics_events;
create policy "analytics insert" on analytics_events
for insert with check (true);

drop policy if exists "analytics read own" on analytics_events;
create policy "analytics read own" on analytics_events
for select using (auth.uid() = user_id or user_id is null);

drop policy if exists "feedback own rows" on user_feedback;
create policy "feedback own rows" on user_feedback
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "impressions insert" on recommendation_impressions;
create policy "impressions insert" on recommendation_impressions
for insert with check (true);

drop policy if exists "impressions read own" on recommendation_impressions;
create policy "impressions read own" on recommendation_impressions
for select using (auth.uid() = user_id or user_id is null);

drop policy if exists "outcomes insert update" on recommendation_outcomes;
create policy "outcomes insert update" on recommendation_outcomes
for all using (true) with check (true);

-- Optional next tables for preference learning:
-- user_preference_profile
-- user_location_affinity
-- location_ratings_rollups
`
