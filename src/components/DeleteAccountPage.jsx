import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const APP_BG = '#F7F2E8'
const APP_PANEL = '#FFFFFF'
const APP_BORDER = '#EBE2D0'
const APP_TEXT = '#241E16'
const APP_ACCENT = '#C9A84C'
const APP_MUTED = '#A99A85'

const SUPPORT_EMAIL = 'privacy@hamakom.app'

const COPY = {
  en: {
    dir: 'ltr',
    back: '← Back',
    heading: 'Delete Your Account',
    lastUpdated: 'Last updated: July 2026',
    intro:
      'You can permanently delete your HaMakom account and all associated data at any time. This action is irreversible.',
    whatSectionTitle: 'What gets deleted',
    whatItems: [
      'Your account (email address and Supabase user ID).',
      'Saved date plans and saved places tied to your account.',
      'Quiz answers stored on your profile.',
      'Feedback and ratings you submitted.',
      'Analytics events linked to your session ID.',
    ],
    whatSuffix:
      'Anonymous, aggregated data that is not linked to your identity may be retained for up to 24 months for product improvement.',
    retentionTitle: 'Retention',
    retentionBody:
      'Personal data is deleted immediately when you use the button below. Backups are purged within 30 days.',
    signedInHeading: "You're signed in as",
    signedInHelp:
      'Tap the button to delete your account right now. You will be signed out after deletion.',
    deleteButton: 'Delete my account permanently',
    deleting: 'Deleting…',
    confirm:
      'This will permanently delete your account and all your data. Are you sure?',
    deletedTitle: 'Account deleted',
    deletedBody:
      'Your HaMakom account and personal data have been deleted. Thanks for using HaMakom.',
    error:
      'Something went wrong deleting your account. Please email us at ',
    signedOutHeading: 'Not signed in?',
    signedOutBody:
      'You have two options to request deletion:',
    optionSignIn:
      '1. Sign in to HaMakom and use the button above (fastest — instant).',
    optionEmail:
      '2. Email us at ',
    optionEmailSuffix:
      ' from the address you signed up with. We will confirm and delete your account within 30 days.',
    emailButton: 'Email deletion request',
    emailSubject: 'Delete my HaMakom account',
    emailBody:
      'Hello,\n\nPlease delete my HaMakom account and all associated personal data.\n\nThe email address on the account is: [YOUR SIGN-IN EMAIL HERE]\n\nThank you.',
    contactTitle: 'Questions?',
    contactBody: 'Contact us at ',
  },
  he: {
    dir: 'rtl',
    back: '→ חזרה',
    heading: 'מחיקת חשבון',
    lastUpdated: 'עודכן: יולי 2026',
    intro:
      'אפשר למחוק את חשבון HaMakom שלך ואת כל הנתונים הקשורים אליו בכל עת. הפעולה בלתי הפיכה.',
    whatSectionTitle: 'מה נמחק',
    whatItems: [
      'החשבון (אימייל ומזהה משתמש ב-Supabase).',
      'תוכניות דייט ומקומות שמורים המשויכים לחשבון.',
      'תשובות השאלון השמורות בפרופיל.',
      'פידבק ודירוגים ששלחת.',
      'אירועי אנליטיקה המקושרים למזהה הסשן.',
    ],
    whatSuffix:
      'נתונים אנונימיים ומצטברים שאינם מזוהים אתכם עשויים להישמר עד 24 חודשים לצורך שיפור המוצר.',
    retentionTitle: 'תקופת שמירה',
    retentionBody:
      'הנתונים האישיים נמחקים מיידית עם הלחיצה על הכפתור. גיבויים נמחקים תוך 30 יום.',
    signedInHeading: 'אתם מחוברים כ',
    signedInHelp:
      'לחצו על הכפתור כדי למחוק את החשבון עכשיו. תנותקו לאחר המחיקה.',
    deleteButton: 'מחקו את החשבון שלי לצמיתות',
    deleting: 'מוחק…',
    confirm:
      'פעולה זו תמחק את החשבון ואת כל הנתונים שלכם לצמיתות. להמשיך?',
    deletedTitle: 'החשבון נמחק',
    deletedBody:
      'החשבון והנתונים האישיים שלכם נמחקו מ-HaMakom. תודה שהשתמשתם ב-HaMakom.',
    error:
      'משהו השתבש במחיקת החשבון. שלחו לנו מייל ל-',
    signedOutHeading: 'לא מחוברים?',
    signedOutBody: 'שתי אפשרויות לבקש מחיקה:',
    optionSignIn:
      '1. היכנסו ל-HaMakom והשתמשו בכפתור למעלה (הכי מהיר — מיידי).',
    optionEmail: '2. שלחו לנו מייל ל-',
    optionEmailSuffix:
      ' מהכתובת שאיתה נרשמתם. נאשר ונמחק את החשבון תוך 30 יום.',
    emailButton: 'שליחת בקשת מחיקה במייל',
    emailSubject: 'בקשת מחיקת חשבון HaMakom',
    emailBody:
      'שלום,\n\nאבקש למחוק את חשבון HaMakom שלי ואת כל הנתונים האישיים המשויכים אליו.\n\nהאימייל הרשום בחשבון: [האימייל שלכם כאן]\n\nתודה.',
    contactTitle: 'שאלות?',
    contactBody: 'צרו קשר ב-',
  },
}

export default function DeleteAccountPage({ lang, font, onBack }) {
  const c = COPY[lang === 'he' ? 'he' : 'en']
  const [authUser, setAuthUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    if (!supabase) {
      setChecking(false)
      return () => { active = false }
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setAuthUser(data.session?.user ?? null)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!active) return
      setAuthUser(session?.user ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const handleDelete = async () => {
    if (!supabase) return
    const confirmed = window.confirm(c.confirm)
    if (!confirmed) return
    setDeleting(true)
    setError(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setDeleting(false)
        setError(true)
        return
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('delete failed')
      await supabase.auth.signOut()
      try { localStorage.clear() } catch { /* ignore */ }
      setDone(true)
    } catch {
      setError(true)
    } finally {
      setDeleting(false)
    }
  }

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(c.emailSubject)}&body=${encodeURIComponent(c.emailBody)}`

  return (
    <div dir={c.dir} style={{ minHeight: '100vh', background: APP_BG, color: APP_TEXT, fontFamily: font }}>
      <div
        style={{
          background: APP_PANEL,
          borderBottom: `1px solid ${APP_BORDER}`,
          paddingTop: 'calc(16px + var(--hm-sat, 0px))',
          paddingBottom: 16,
          paddingLeft: 20,
          paddingRight: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: APP_ACCENT, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}
        >
          {c.back}
        </button>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{c.heading}</span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, margin: '0 0 6px' }}>{c.heading}</h1>
        <p style={{ color: APP_MUTED, fontSize: 13, margin: '0 0 24px' }}>{c.lastUpdated}</p>

        <p style={{ color: '#6E6450', fontSize: 15, lineHeight: 1.7, margin: '0 0 28px' }}>{c.intro}</p>

        {done ? (
          <section
            style={{
              background: '#E9F0E4',
              border: '1px solid #C7DCBC',
              borderRadius: 12,
              padding: 18,
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2F6B3F', marginBottom: 6 }}>{c.deletedTitle}</div>
            <div style={{ fontSize: 14, color: '#3D5F3A', lineHeight: 1.6 }}>{c.deletedBody}</div>
          </section>
        ) : null}

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: APP_ACCENT, margin: '0 0 10px' }}>{c.whatSectionTitle}</h2>
          <ul style={{ margin: 0, paddingInlineStart: 20, color: '#6E6450', fontSize: 14, lineHeight: 1.8 }}>
            {c.whatItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p style={{ margin: '10px 0 0', color: APP_MUTED, fontSize: 13, lineHeight: 1.65 }}>{c.whatSuffix}</p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: APP_ACCENT, margin: '0 0 10px' }}>{c.retentionTitle}</h2>
          <p style={{ margin: 0, color: '#6E6450', fontSize: 14, lineHeight: 1.7 }}>{c.retentionBody}</p>
        </section>

        {!checking && authUser ? (
          <section style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 14, padding: 18, marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: APP_MUTED, marginBottom: 4 }}>{c.signedInHeading}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: APP_TEXT, marginBottom: 12, wordBreak: 'break-all' }}>{authUser.email || authUser.id}</div>
            <p style={{ fontSize: 13, color: '#6E6450', margin: '0 0 14px', lineHeight: 1.6 }}>{c.signedInHelp}</p>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || done}
              style={{
                width: '100%',
                background: done ? '#9DB88C' : '#B84A3A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 10,
                padding: '13px 16px',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: deleting || done ? 'default' : 'pointer',
                opacity: deleting ? 0.7 : 1,
              }}
            >
              {deleting ? c.deleting : c.deleteButton}
            </button>
            {error ? (
              <p style={{ marginTop: 12, fontSize: 13, color: '#B84A3A', lineHeight: 1.55 }}>
                {c.error}
                <a href={mailtoHref} style={{ color: '#B84A3A', fontWeight: 700 }}>{SUPPORT_EMAIL}</a>
                .
              </p>
            ) : null}
          </section>
        ) : null}

        <section style={{ background: '#FBF7EE', border: `1px solid ${APP_BORDER}`, borderRadius: 14, padding: 18, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: APP_ACCENT, margin: '0 0 10px' }}>{c.signedOutHeading}</h2>
          <p style={{ fontSize: 14, color: '#6E6450', lineHeight: 1.7, margin: '0 0 8px' }}>{c.signedOutBody}</p>
          <p style={{ fontSize: 14, color: '#6E6450', lineHeight: 1.7, margin: '0 0 4px' }}>{c.optionSignIn}</p>
          <p style={{ fontSize: 14, color: '#6E6450', lineHeight: 1.7, margin: '0 0 14px' }}>
            {c.optionEmail}
            <a href={mailtoHref} style={{ color: APP_ACCENT, fontWeight: 700 }}>{SUPPORT_EMAIL}</a>
            {c.optionEmailSuffix}
          </p>
          <a
            href={mailtoHref}
            style={{
              display: 'inline-block',
              background: APP_ACCENT,
              color: APP_TEXT,
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              fontFamily: 'inherit',
            }}
          >
            {c.emailButton}
          </a>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: APP_ACCENT, margin: '0 0 8px' }}>{c.contactTitle}</h2>
          <p style={{ margin: 0, color: '#6E6450', fontSize: 14, lineHeight: 1.7 }}>
            {c.contactBody}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: APP_ACCENT, fontWeight: 700 }}>{SUPPORT_EMAIL}</a>
          </p>
        </section>
      </div>
    </div>
  )
}
