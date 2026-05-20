const APP_BG = '#0D1117'
const APP_PANEL = '#161B27'
const APP_BORDER = '#2A2F3E'
const APP_TEXT = '#E8DCC8'
const APP_ACCENT = '#C9A84C'
const APP_MUTED = '#6B7280'

const SECTIONS_EN = [
  {
    title: 'What We Collect',
    body: `When you use HaMakom we may collect:
• Your email address, when you sign in via email link or Google OAuth.
• Anonymous session identifiers, stored in your browser's local storage.
• Quiz answers (date stage, city preference, focus, timing) — only to generate recommendations.
• Which plans and locations you save, view, or interact with.
• Voluntary feedback you choose to submit (ratings, whether you went on a date).
• Location suggestions you submit through the "Suggest a Place" form.

We do not collect passwords, payment information, phone location data, or any sensitive personal information beyond the above.`,
  },
  {
    title: 'How We Use Your Data',
    body: `We use collected data exclusively to:
• Deliver personalised date plan recommendations.
• Improve the quality and relevance of our recommendations over time.
• Operate the app and diagnose technical issues.
• Respond to location suggestions you submit.

We do not sell, rent, or share your personal data with third parties for marketing purposes. We do not use your data for automated profiling that produces legal effects.`,
  },
  {
    title: 'Data Storage & Third Parties',
    body: `HaMakom is built on the following infrastructure:
• Supabase (supabase.com) — database and authentication. Data is stored on servers in the EU. Supabase is GDPR-compliant.
• Vercel (vercel.com) — hosting and content delivery. CDN nodes are globally distributed.
• Browser localStorage — non-sensitive preferences (language, saved items) are stored locally on your device and are not transmitted to our servers unless you sign in.

We do not use advertising networks, social trackers, or third-party analytics SDKs.`,
  },
  {
    title: 'Analytics',
    body: `With your consent, we record anonymous usage events (e.g. "quiz started", "plan saved") to understand how the app is being used. These events are tied to a random session ID — not to your email address unless you are signed in. You can withdraw consent at any time in your Profile settings. Withdrawing consent stops future event recording and removes your session ID from local storage.`,
  },
  {
    title: 'Your Rights',
    body: `Under Israeli Privacy Protection Law (5741-1981) and GDPR (where applicable), you have the right to:
• Access the personal data we hold about you.
• Correct inaccurate data.
• Request deletion of your account and all associated data — use the "Delete Account" option in your Profile.
• Withdraw analytics consent at any time.
• Object to processing of your personal data.

To exercise any of these rights, contact us at: privacy@hamakom.app`,
  },
  {
    title: 'Data Retention',
    body: `We retain your data for as long as your account is active. If you delete your account, all personal data associated with it is permanently deleted within 30 days. Anonymous analytics events (not linked to your identity) may be retained for up to 24 months for product improvement purposes.`,
  },
  {
    title: 'Security',
    body: `We apply industry-standard security measures including row-level access controls on our database (Supabase RLS), HTTPS-only connections, and secure authentication via OAuth and one-time email links. No method of transmission over the internet is 100% secure, but we take reasonable precautions.`,
  },
  {
    title: 'Changes to This Policy',
    body: `We may update this privacy policy from time to time. We will notify you of material changes by updating the "Last updated" date below. Continued use of the app after a policy change constitutes acceptance of the new policy.`,
  },
  {
    title: 'Contact',
    body: `For any privacy-related questions or requests:
Email: privacy@hamakom.app
HaMakom · hamakom.app`,
  },
]

const SECTIONS_HE = [
  {
    title: 'מה אנחנו אוספים',
    body: `כאשר אתם משתמשים ב-HaMakom אנחנו עשויים לאסוף:
• כתובת האימייל שלכם, כאשר אתם נכנסים דרך קישור אימייל או Google.
• מזהי סשן אנונימיים, השמורים ב-local storage של הדפדפן שלכם.
• תשובות לשאלון (שלב הדייט, עיר מועדפת, מיקוד, תזמון) — רק לצורך יצירת המלצות.
• אילו תוכניות ומקומות שמרתם, צפיתם בהם או אינטרקציה עשיתם.
• פידבק שבחרתם לשלוח (דירוג, האם הלכתם לדייט).
• הצעות מקומות ששלחתם דרך טופס "הצע מקום".`,
  },
  {
    title: 'כיצד אנחנו משתמשים בנתונים',
    body: `אנחנו משתמשים בנתונים שנאספו אך ורק כדי:
• לספק המלצות תוכניות דייט מותאמות אישית.
• לשפר את איכות ורלוונטיות ההמלצות שלנו לאורך זמן.
• להפעיל את האפליקציה ולאבחן בעיות טכניות.
• להגיב להצעות מקומות שאתם שולחים.

אנחנו לא מוכרים, משכירים או משתפים את הנתונים האישיים שלכם עם צדדים שלישיים למטרות שיווק.`,
  },
  {
    title: 'אחסון נתונים וצדדים שלישיים',
    body: `HaMakom נבנה על התשתית הבאה:
• Supabase — מסד נתונים ואימות. הנתונים מאוחסנים בשרתים באיחוד האירופי.
• Vercel — אחסון ואספקת תוכן. צמתי CDN מופצים גלובלית.
• localStorage בדפדפן — העדפות לא-רגישות (שפה, פריטים שמורים) מאוחסנות מקומית במכשיר שלכם.

אנחנו לא משתמשים ברשתות פרסום, עוקבים חברתיים, או SDK ניתוח צד שלישי.`,
  },
  {
    title: 'אנליטיקה',
    body: `בהסכמתכם, אנחנו מתעדים אירועי שימוש אנונימיים (למשל "שאלון התחיל", "תוכנית נשמרה") כדי להבין כיצד האפליקציה משמשת. תוכלו לבטל את ההסכמה בכל עת בהגדרות הפרופיל שלכם.`,
  },
  {
    title: 'הזכויות שלכם',
    body: `על פי חוק הגנת הפרטיות הישראלי (תשמ"א-1981) ו-GDPR (במקרים רלוונטיים), יש לכם זכות:
• לגשת לנתונים האישיים שאנחנו מחזיקים עליכם.
• לתקן נתונים שגויים.
• לבקש מחיקת החשבון וכל הנתונים הקשורים אליו — השתמשו באפשרות "מחק חשבון" בפרופיל.
• לבטל הסכמה לאנליטיקה בכל עת.

לכל שאלה או בקשה: privacy@hamakom.app`,
  },
  {
    title: 'יצירת קשר',
    body: `לכל שאלה הקשורה לפרטיות:
אימייל: privacy@hamakom.app
HaMakom · hamakom.app`,
  },
]

export default function PrivacyPage({ lang, font, onBack }) {
  const isHe = lang === 'he'
  const sections = isHe ? SECTIONS_HE : SECTIONS_EN
  const dir = isHe ? 'rtl' : 'ltr'

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: APP_BG, color: APP_TEXT, fontFamily: font }}>
      <div style={{ background: APP_PANEL, borderBottom: `1px solid ${APP_BORDER}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: APP_ACCENT, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
          {isHe ? '→ חזרה' : '← Back'}
        </button>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{isHe ? 'מדיניות פרטיות' : 'Privacy Policy'}</span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, margin: '0 0 6px' }}>{isHe ? 'מדיניות פרטיות' : 'Privacy Policy'}</h1>
        <p style={{ color: APP_MUTED, fontSize: 13, margin: '0 0 36px' }}>{isHe ? 'עודכן לאחרונה: מאי 2026' : 'Last updated: May 2026'}</p>

        <p style={{ color: '#C8BDA8', fontSize: 15, lineHeight: 1.7, margin: '0 0 32px' }}>
          {isHe
            ? 'HaMakom ("אנחנו") מכבדת את פרטיותכם. מסמך זה מסביר אילו נתונים אנחנו אוספים, כיצד אנחנו משתמשים בהם, ומהן הזכויות שלכם.'
            : 'HaMakom ("we", "us") respects your privacy. This document explains what data we collect, how we use it, and what rights you have.'}
        </p>

        {sections.map((s) => (
          <section key={s.title} style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${APP_BORDER}` }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px', color: APP_ACCENT }}>{s.title}</h2>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: '#C8BDA8', whiteSpace: 'pre-line' }}>{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  )
}
