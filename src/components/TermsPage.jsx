const APP_BG = '#F7F2E8'
const APP_PANEL = '#FFFFFF'
const APP_BORDER = '#EBE2D0'
const APP_TEXT = '#241E16'
const APP_ACCENT = '#C9A84C'
const APP_MUTED = '#A99A85'

const SECTIONS_EN = [
  {
    title: '1. Acceptance of Terms',
    body: `By accessing or using HaMakom ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.

These terms apply to all visitors, registered users, and anyone who accesses or uses the Service.`,
  },
  {
    title: '2. Description of Service',
    body: `HaMakom is a date ideas and location discovery platform designed for Jewish singles in Israel. We provide personalised date plan recommendations, curated location browsing, and a community-driven location suggestion feature.

The Service is provided free of charge. We may introduce optional paid features in the future, which will be governed by separate pricing terms.`,
  },
  {
    title: '3. Eligibility',
    body: `You must be at least 18 years of age to use HaMakom. By using the Service, you represent and warrant that you are 18 or older.`,
  },
  {
    title: '4. User Accounts',
    body: `You may use most features of HaMakom without creating an account. An account (via Google OAuth or email link) is required to save plans and places across devices.

You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account. Notify us immediately at support@hamakom.app if you suspect unauthorised use.`,
  },
  {
    title: '5. User-Submitted Content',
    body: `When you submit a location suggestion, you grant HaMakom a non-exclusive, worldwide, royalty-free licence to use, display, and incorporate that content into the Service.

You represent that your submission is accurate to the best of your knowledge and does not infringe the rights of any third party. We reserve the right to accept, reject, or modify any submission at our discretion.`,
  },
  {
    title: '6. Prohibited Conduct',
    body: `You agree not to:
• Use the Service for any unlawful purpose.
• Submit false, misleading, or defamatory content.
• Attempt to access, tamper with, or disrupt the Service's infrastructure.
• Scrape, copy, or redistribute our curated content without written permission.
• Impersonate any person or entity.
• Use automated means to access or interact with the Service.`,
  },
  {
    title: '7. Disclaimer of Warranties',
    body: `The Service is provided "as is" and "as available" without any warranties of any kind, express or implied. We do not guarantee that recommendations will meet your expectations, that the Service will be uninterrupted or error-free, or that any location information is current, complete, or accurate.

We are not responsible for the quality, safety, availability, or suitability of any third-party venues, services, or experiences listed in the Service.`,
  },
  {
    title: '8. Limitation of Liability',
    body: `To the fullest extent permitted by applicable law, HaMakom and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, even if we have been advised of the possibility of such damages.

Our total liability for any claim arising from these terms shall not exceed the amount you paid us in the 12 months preceding the claim (or ILS 100 if no payment was made).`,
  },
  {
    title: '9. Changes to the Service',
    body: `We reserve the right to modify, suspend, or discontinue any part of the Service at any time without notice. We will not be liable to you or any third party for any such modification, suspension, or discontinuation.`,
  },
  {
    title: '10. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with the laws of the State of Israel. Any dispute arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in Jerusalem, Israel.`,
  },
  {
    title: '11. Changes to These Terms',
    body: `We may update these Terms from time to time. We will notify users of material changes by updating the "Last updated" date. Your continued use of the Service after any changes constitutes your acceptance of the revised Terms.`,
  },
  {
    title: '12. Contact',
    body: `For questions about these Terms:
Email: support@hamakom.app
HaMakom · hamakom.app`,
  },
]

const SECTIONS_HE = [
  {
    title: '1. קבלת התנאים',
    body: `על ידי גישה לשימוש ב-HaMakom ("השירות"), אתם מסכימים להיות כפופים לתנאי שירות אלה. אם אינכם מסכימים, אנא אל תשתמשו בשירות.`,
  },
  {
    title: '2. תיאור השירות',
    body: `HaMakom הוא פלטפורמת רעיונות לדייט וגילוי מקומות המיועדת לרווקים יהודים בישראל. אנחנו מספקים המלצות תוכניות דייט מותאמות אישית, גלישה במקומות מאורגנים, ותכונת הצעת מקומות על ידי הקהילה.

השירות ניתן ללא תשלום. ייתכן שנציג בעתיד תכונות בתשלום אופציונליות.`,
  },
  {
    title: '3. זכאות',
    body: `יש להיות בגיל 18 לפחות כדי להשתמש ב-HaMakom. על ידי שימוש בשירות, אתם מצהירים שאתם בני 18 ומעלה.`,
  },
  {
    title: '4. חשבונות משתמשים',
    body: `ניתן להשתמש ברוב תכונות HaMakom ללא יצירת חשבון. נדרש חשבון כדי לשמור תוכניות ומקומות על פני מכשירים.

אתם אחראים לשמירת סודיות החשבון שלכם. צרו קשר ב-support@hamakom.app אם אתם חושדים בשימוש לא מורשה.`,
  },
  {
    title: '5. תוכן שנשלח על ידי משתמשים',
    body: `כאשר אתם שולחים הצעת מקום, אתם מעניקים ל-HaMakom רישיון להשתמש, להציג ולשלב תוכן זה בשירות. אתם מצהירים שההגשה שלכם מדויקת ואינה פוגעת בזכויות של צד שלישי כלשהו.`,
  },
  {
    title: '6. התנהגות אסורה',
    body: `אתם מסכימים לא:
• להשתמש בשירות לכל מטרה בלתי חוקית.
• להגיש תוכן כוזב, מטעה או משמיץ.
• לנסות לגשת, לפגוע או לשבש את תשתית השירות.
• להתחזות לאדם או ישות כלשהם.`,
  },
  {
    title: '7. הגבלת אחריות',
    body: `השירות ניתן "כפי שהוא" ללא כל אחריות. איננו אחראים לאיכות, בטיחות, זמינות או התאמה של מקומות, שירותים או חוויות צד שלישי המפורטים בשירות.`,
  },
  {
    title: '8. דין חל',
    body: `תנאים אלה יחולו ויפורשו בהתאם לדיני מדינת ישראל. כל מחלוקת שתתעורר תהיה כפופה לסמכות השיפוט הבלעדית של בתי המשפט בירושלים, ישראל.`,
  },
  {
    title: '9. יצירת קשר',
    body: `לשאלות לגבי תנאים אלה:
אימייל: support@hamakom.app
HaMakom · hamakom.app`,
  },
]

export default function TermsPage({ lang, font, onBack }) {
  const isHe = lang === 'he'
  const sections = isHe ? SECTIONS_HE : SECTIONS_EN
  const dir = isHe ? 'rtl' : 'ltr'

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: APP_BG, color: APP_TEXT, fontFamily: font }}>
      <div style={{ background: APP_PANEL, borderBottom: `1px solid ${APP_BORDER}`, padding: 'calc(16px + var(--hm-sat, 0px)) 20px 16px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: APP_ACCENT, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
          {isHe ? '→ חזרה' : '← Back'}
        </button>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{isHe ? 'תנאי שירות' : 'Terms of Service'}</span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, margin: '0 0 6px' }}>{isHe ? 'תנאי שירות' : 'Terms of Service'}</h1>
        <p style={{ color: APP_MUTED, fontSize: 13, margin: '0 0 36px' }}>{isHe ? 'עודכן לאחרונה: מאי 2026' : 'Last updated: May 2026'}</p>

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
