const APP_BG = '#F7F2E8'
const APP_PANEL = '#FFFFFF'
const APP_BORDER = '#EBE2D0'
const APP_TEXT = '#241E16'
const APP_ACCENT = '#C9A84C'
const APP_MUTED = '#A99A85'

const SECTIONS_EN = [
  {
    title: 'What We Collect',
    body: `When you use HaMakom we may collect:
• Your email address, when you sign in via email link or Google OAuth.
• Random session identifiers, stored in your browser's local storage.
• Quiz answers and optional preferences (date stage, city, timing, budget and food requirements) to generate recommendations. Signed-in answers may be saved to your account.
• Which plans and locations you save, view, or interact with.
• Voluntary feedback you choose to submit (ratings, whether you went on a date).
• Location suggestions you submit through the "Suggest a Place" form.

Account authentication is handled by Supabase. The map uses your device location only when you request nearby places.`,
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
• Supabase (supabase.com) — database and authentication. Our database project is hosted in Seoul, South Korea.
• Vercel (vercel.com) — hosting and content delivery. CDN nodes are globally distributed.
• Browser localStorage — saved items and preferences are stored on your device. Signed-in saves synchronize to your account; usage events require analytics consent.
• OpenStreetMap — supplies map tiles. Loading a map makes requests to its tile servers. Google Maps and venue menus open external sites when you follow their links.
• Sentry — technical error diagnostics may be sent when error monitoring is configured.

Optional usage analytics are stored in our Supabase database. We do not record browsing sessions.`,
  },
  {
    title: 'Analytics',
    body: `With your consent, we record usage events (e.g. "quiz started", "plan saved") to understand how the app is being used. Events use a random session ID and may be linked to your account when you are signed in. You can withdraw consent at any time in your Profile settings. Withdrawing consent stops future event recording and removes your session ID from local storage.`,
  },
  {
    title: 'Your Rights',
    body: `Under Israeli Privacy Protection Law (5741-1981) and GDPR (where applicable), you have the right to:
• Access the personal data we hold about you.
• Correct inaccurate data.
• Request deletion of your account and all associated data — use the "Delete account & data" option in your Profile, or visit hamakom.app/delete-account.
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
    title: 'App Store Data Safety (Google Play / Apple)',
    body: `Summary for store listings — last reviewed September 2026:

Data collected (optional unless noted):
• Email address — account sign-in (optional; app works without an account for browsing).
• App activity — quiz answers, saved plans/places, usage events (with consent).
• Approximate location — only when you tap "Near me" on the map; never collected in the background.

Data NOT collected:
• Precise background location, contacts, photos, financial info, or government IDs.

Data sharing: We do not sell personal data. Infrastructure processors (Supabase, Vercel) store/host data under contract.

Security: HTTPS, database row-level security, OAuth / magic-link auth.

Deletion: In-app "Delete Account" removes personal data within 30 days.

Children: Not directed at children under 13.

Contact: privacy@hamakom.app`,
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
• תשובות לשאלון והעדפות לבחירתכם (שלב הדייט, עיר, תזמון, תקציב וצרכים תזונתיים) לצורך המלצות. תשובות של משתמשים מחוברים עשויות להישמר בחשבון.
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
• Supabase — מסד נתונים ואימות. פרויקט מסד הנתונים שלנו מאוחסן בסיאול, דרום קוריאה.
• Vercel — אחסון ואספקת תוכן. צמתי CDN מופצים גלובלית.
• localStorage בדפדפן — פריטים שמורים והעדפות נשמרים במכשיר. שמירות של משתמשים מחוברים מסונכרנות לחשבון; אירועי שימוש דורשים הסכמה לאנליטיקה.
• OpenStreetMap — מספקת אריחי מפה. טעינת מפה שולחת בקשות לשרתי המפות. קישורים ל-Google Maps ולתפריטים פותחים אתרים חיצוניים.
• Sentry — מידע טכני על תקלות עשוי להישלח כאשר ניטור תקלות מוגדר.

נתוני השימוש האופציונליים נשמרים במסד הנתונים שלנו ב-Supabase. אנחנו לא מקליטים סשנים של גלישה.`,
  },
  {
    title: 'אנליטיקה',
    body: `בהסכמתכם, אנחנו מתעדים אירועי שימוש (למשל "שאלון התחיל", "תוכנית נשמרה") כדי להבין כיצד האפליקציה משמשת. תוכלו לבטל את ההסכמה בכל עת בהגדרות הפרופיל שלכם.`,
  },
  {
    title: 'הזכויות שלכם',
    body: `על פי חוק הגנת הפרטיות הישראלי (תשמ"א-1981) ו-GDPR (במקרים רלוונטיים), יש לכם זכות:
• לגשת לנתונים האישיים שאנחנו מחזיקים עליכם.
• לתקן נתונים שגויים.
• לבקש מחיקת החשבון וכל הנתונים הקשורים אליו — השתמשו באפשרות "מחיקת חשבון ונתונים" בפרופיל או היכנסו ל-hamakom.app/delete-account.
• לבטל הסכמה לאנליטיקה בכל עת.

לכל שאלה או בקשה: privacy@hamakom.app`,
  },
  {
    title: 'בטיחות נתונים לחנויות האפליקציות',
    body: `סיכום לרישום ב-Google Play / App Store — עודכן ספטמבר 2026:

נתונים שנאספים (רובם אופציונליים):
• אימייל — כניסה לחשבון (אופציונלי; האפליקציה עובדת גם בלי חשבון).
• פעילות באפליקציה — תשובות שאלון, תוכניות/מקומות שמורים, אירועי שימוש (בהסכמה).
• מיקום משוער — רק כשלוחצים "מקומות לידי" במפה; לא נאסף ברקע.

לא נאסף:
• מיקום מדויק ברקע, אנשי קשר, תמונות, פרטי תשלום או מזהים ממשלתיים.

שיתוף: לא מוכרים נתונים אישיים. Supabase ו-Vercel מעבדים נתונים תחת חוזה.

אבטחה: HTTPS, הרשאות מסד נתונים, OAuth / קישור אימייל.

מחיקה: "מחק חשבון" באפליקציה מוחק נתונים אישיים תוך 30 יום.

ילדים: לא מיועד לילדים מתחת לגיל 13.

יצירת קשר: privacy@hamakom.app`,
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
      <div style={{ background: APP_PANEL, borderBottom: `1px solid ${APP_BORDER}`, paddingTop: 'calc(16px + var(--hm-sat, 0px))', paddingBottom: 16, paddingLeft: 20, paddingRight: 20, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: APP_ACCENT, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
          {isHe ? '→ חזרה' : '← Back'}
        </button>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{isHe ? 'מדיניות פרטיות' : 'Privacy Policy'}</span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, margin: '0 0 6px' }}>{isHe ? 'מדיניות פרטיות' : 'Privacy Policy'}</h1>
        <p style={{ color: APP_MUTED, fontSize: 13, margin: '0 0 36px' }}>{isHe ? 'עודכן לאחרונה: ספטמבר 2026' : 'Last updated: September 2026'}</p>

        <p style={{ color: '#6E6450', fontSize: 15, lineHeight: 1.7, margin: '0 0 32px' }}>
          {isHe
            ? 'HaMakom ("אנחנו") מכבדת את פרטיותכם. מסמך זה מסביר אילו נתונים אנחנו אוספים, כיצד אנחנו משתמשים בהם, ומהן הזכויות שלכם.'
            : 'HaMakom ("we", "us") respects your privacy. This document explains what data we collect, how we use it, and what rights you have.'}
        </p>

        {sections.map((s) => (
          <section key={s.title} style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${APP_BORDER}` }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px', color: APP_ACCENT }}>{s.title}</h2>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: '#6E6450', whiteSpace: 'pre-line' }}>{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  )
}
