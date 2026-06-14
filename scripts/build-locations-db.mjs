#!/usr/bin/env node
/**
 * Builds src/data/locations.json:
 *   - Takes all 322 existing SEED_LOCATIONS
 *   - Adds missing fields: rating, hidden_gem, featured, notes
 *   - Remaps 'Wineries' category → 'Activities & Experiences'
 *   - Appends ~19 locations genuinely not yet in the database
 * Run: node scripts/build-locations-db.mjs
 */
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { SEED_LOCATIONS } from '../src/data/locations.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const root  = join(__dir, '..')

// ── Per-ID overrides for original 139 entries ─────────────────────────────────
// [rating, hidden_gem(0/1), featured(0/1), notes]
const U = {
   1:[3,0,0,''],  2:[4,1,0,'Best at dusk when gazelles are active.'],
   3:[4,0,0,'Best in spring when roses bloom.'],  4:[2,0,0,''],
   5:[5,0,1,'Magical at sunset and night. Combine with Sherover walk.'],
   6:[4,0,0,'Connects to Tayelet promenade.'],
   7:[4,1,0,'Entrance ~35 NIS. Cafit café inside. Underrated date spot.'],
   8:[3,0,0,'Musical fountain shows on summer evenings.'],
   9:[3,0,0,''], 10:[2,0,0,''], 11:[4,0,0,''], 12:[3,0,0,''],
  13:[3,0,0,''], 14:[4,0,0,'Best Friday/Saturday evenings.'],
  15:[4,0,0,'Beautiful at sunset.'], 16:[4,0,0,''],
  17:[2,0,0,''], 18:[5,1,1,'Bring homemade food. Incredible desert sunset views.'],
  19:[3,0,0,''], 20:[2,0,0,''], 21:[2,0,0,''], 22:[1,0,0,''],
  23:[5,0,1,'Reserve ahead for evenings.'], 24:[4,0,0,''],
  25:[4,0,0,'Ask for terrace seating.'], 26:[4,0,0,''],
  27:[3,0,0,''], 28:[4,0,0,''], 29:[4,0,0,''], 30:[3,0,0,''],
  31:[5,0,1,'Check hours. Dead Sea Scrolls + sculpture garden.'],
  32:[4,0,0,'Interactive — great for breaking the ice.'],
  33:[3,1,0,'Small, niche — perfect for music lovers.'],
  34:[5,0,1,'Book online. Huge hit in observant community.'],
  35:[4,1,0,'Tours need booking. See jewelry made live.'],
  36:[4,0,0,''], 37:[4,0,0,'Free entry. New building 2022. Café inside.'],
  38:[3,0,0,''],
  39:[5,0,1,'Book online. Allow 1-2 hrs. Stunning natural cave.'],
  40:[4,0,0,'Book ahead. Great couples activity.'], 41:[3,0,0,''],
  42:[4,0,1,'Classic creative date. Book ahead.'],
  43:[4,0,0,''], 44:[3,0,0,''], 45:[3,0,0,''],
  46:[3,0,0,''], 47:[2,0,0,''], 48:[2,0,0,''],
  49:[3,0,0,''], 50:[4,0,0,''], 51:[4,0,0,''], 52:[4,0,0,''],
  53:[3,0,0,''], 54:[4,0,0,''],
  55:[5,0,1,'Pack water and snacks. Check trail conditions.'],
  56:[4,1,0,'Book in advance. Spring/summer only.'],
  57:[5,0,1,'Book ahead. Wet option = wading in water.'],
  58:[4,0,1,'Plan ahead — busy on chol hamoed.'],
  59:[3,0,0,''], 60:[3,0,0,''],
  61:[3,1,0,'Scenic location. Underrated date spot.'],
  62:[2,0,0,''], 63:[2,0,0,''], 64:[3,0,0,''],
  65:[3,1,0,'Seasonal activity — check times of year.'],
  66:[3,1,0,''], 67:[4,1,0,''],
  68:[4,0,0,''], 69:[4,0,0,''],
  70:[3,1,0,'Pick items for your dream home — great conversation starter.'],
  71:[5,1,0,'Volunteer together. Deeply meaningful for values-driven couples.'],
  72:[4,0,0,''], 73:[3,0,0,''],
  74:[4,0,0,'Check schedule for live music events.'],
  75:[3,0,0,''], 76:[3,0,0,''], 77:[2,0,0,''],
  78:[2,0,0,''], 79:[3,0,0,''],
  80:[3,0,0,''], 81:[3,0,0,'Multiple locations. Reliable.'],
  82:[3,0,0,''], 83:[4,0,1,'Reserve window seat for views.'],
  84:[4,0,0,'Fairy lights in garden. Atmospheric evenings.'],
  85:[2,0,0,''], 86:[3,1,0,'Specialty coffee. Small, intimate.'],
  87:[5,1,1,'Reserve ahead. Very romantic setting.'],
  88:[2,0,0,''], 89:[2,0,0,''], 90:[3,0,0,''],
  91:[3,0,0,''], 92:[4,0,0,''],
  93:[4,0,0,'Inside Botanical Gardens. Beautiful setting.'],
  94:[5,0,1,'Classic Jerusalem institution. Reserve for busy nights.'],
  95:[3,0,0,''], 96:[3,0,0,''],
  97:[3,1,0,'French Hill hidden gem. Quiet for conversation.'],
  98:[3,0,0,''], 99:[4,0,0,''],
 100:[4,1,1,'Intimate wine-focused. Great for 2nd+ date.'],
 101:[3,0,0,''], 102:[4,0,0,''], 103:[2,0,0,''],
 104:[4,1,0,'In the Jewish Quarter. Unique atmosphere.'],
 105:[3,0,0,''], 106:[4,0,0,''], 107:[2,0,0,''],
 108:[2,0,0,''], 109:[4,0,0,''], 110:[4,0,0,''],
 111:[4,0,0,''], 112:[3,0,0,''], 113:[2,0,0,''],
 114:[2,0,0,''], 115:[3,1,0,'On Emek Refaim strip.'],
 116:[3,0,0,''],
 117:[5,1,1,'15 min from Jerusalem. Reserve ahead. Exceptional for special dates.'],
 118:[4,1,0,'Vineyard dining near Jerusalem. Reserve.'],
 119:[2,0,0,''], 120:[2,0,0,''], 121:[1,0,0,''],
 122:[2,0,0,''], 123:[2,0,0,''], 124:[2,0,0,''],
 125:[3,0,0,''], 126:[3,0,0,''], 127:[2,0,0,''],
 128:[2,0,0,''], 129:[2,0,0,''], 130:[1,0,0,''],
 131:[3,0,0,''], 132:[3,0,0,''], 133:[3,0,0,''],
 134:[4,1,0,'Artisan bakery at Sarona. Great coffee and pastries.'],
 135:[2,0,0,''], 136:[3,0,0,''], 137:[2,0,0,''],
 138:[4,0,0,''], 139:[2,0,0,''],
}

// ── Category shorthand ────────────────────────────────────────────────────────
const C = {
  P:'Parks & Outdoors', H:'Hotels & Lounges', M:'Museums & Culture',
  A:'Activities & Experiences', R:'Cafés & Restaurants',
}

function loc(id, name, name_he, city, city_he, cat, occ, price, stages,
             desc, desc_he, maps_q, kashrus, featured, rating, gem, notes) {
  return {
    id, name, name_he, city, city_he, category: C[cat],
    occasion: occ, price, date_stage: stages,
    description: desc, description_he: desc_he,
    maps_query: maps_q, kashrus,
    featured: !!featured, status: 'approved',
    rating, hidden_gem: !!gem, notes,
  }
}

// ── Locations genuinely missing from the existing 322 ────────────────────────
const NEW = [
  loc(327,'Tmol Shilshom','תמול שלשום','Jerusalem','ירושלים','R',
    ['romantic','casual','unique','creative'],3,[2,3],
    'Beloved literary café in a Jerusalem alley. Bookshelves, live music, magical atmosphere.',
    'בית קפה ספרותי אהוב בסמטה ירושלמית. ספרים, מוזיקה חיה ואווירה ייחודית.',
    'Tmol Shilshom cafe Jerusalem',null,1,5,0,'Book ahead Thu–Sat. Live music some nights.'),

  loc(328,'Ein Karem Village Walk','טיול בעין כרם','Jerusalem','ירושלים','P',
    ['romantic','casual','unique','creative'],1,[1,2],
    "Charming artists' village on Jerusalem's edge. Galleries, gardens, and cozy cafés.",
    'כפר אמנים קסום בקצה ירושלים. גלריות, גנים ובתי קפה אינטימיים.',
    'Ein Karem Jerusalem village',null,0,4,0,'Best on weekday mornings. Combine with HaTzar restaurant.'),

  loc(329,'Yemin Moshe + Windmill','ימין משה וטחנת הרוח','Jerusalem','ירושלים','P',
    ['romantic','views','unique','casual'],1,[1,2],
    "Historic neighborhood with Montefiore's windmill and breathtaking Old City views.",
    'שכונה היסטורית עם טחנת הרוח של מונטיפיורי ונוף מרהיב לעיר העתיקה.',
    'Yemin Moshe Jerusalem Montefiore windmill',null,0,4,1,'Free to stroll. Beautiful at sunset.'),

  loc(330,'Hansen House','בית חנסן','Jerusalem','ירושלים','M',
    ['creative','casual','unique','first date'],1,[1,2],
    'Stunning Ottoman-era building repurposed as a creative campus. Exhibitions, café, courtyard.',
    "בניין עות'מאני מרהיב שהפך לקמפוס יצירתי. תערוכות, בית קפה וחצר יפהפה.",
    'Hansen House Jerusalem creative campus',null,0,4,1,'Free courtyard entry. Near Liberty Bell Park.'),

  loc(331,'Lifta Abandoned Village','ליפתא','Jerusalem','ירושלים','P',
    ['unique','adventurous','romantic','casual'],1,[2,3],
    "Mysterious 1948 abandoned village at Jerusalem's entrance. Stone houses, natural spring pool.",
    'כפר נטוש ומסתורי מ-1948 בכניסה לירושלים. בתי אבן ובריכת מעיין.',
    'Lifta Jerusalem abandoned village',null,0,4,1,'Access near Begin Expressway. ~30 min walk. Unique conversation starter.'),

  loc(332,'ANU – Museum of the Jewish People','אנו – מוזיאון העם היהודי','Tel Aviv','תל אביב','M',
    ['unique','casual','first date','creative'],3,[1,2],
    'Completely redesigned world-class museum at Tel Aviv University. Moving and fascinating.',
    'מוזיאון העם היהודי שחודש לחלוטין. עולמי, מרגש ומרתק.',
    'ANU Museum of the Jewish People Tel Aviv',null,1,5,0,'Book tickets online. Allow 2+ hours.'),

  loc(333,'Suzanne Dellal Center','מרכז סוזן דלל','Tel Aviv','תל אביב','A',
    ['romantic','evening','creative','unique'],3,[2,3],
    "Neve Tzedek's dance and performance center. Beautiful plaza with fig trees and fountain.",
    'מרכז הריקוד בנווה צדק. כיכר יפהפה עם עצי תאנה ומזרקה.',
    'Suzanne Dellal Center Tel Aviv Neve Tzedek',null,0,4,0,'Check performance schedule. Plaza is free.'),

  loc(334,'Neve Tzedek Stroll','טיול בנווה צדק','Tel Aviv','תל אביב','P',
    ['romantic','casual','unique','first date'],1,[1,2],
    "Tel Aviv's most romantic neighborhood — charming streets, boutiques, cafés.",
    'השכונה הרומנטית ביותר של תל אביב — רחובות קסומים, בוטיקים ובתי קפה.',
    'Neve Tzedek Tel Aviv neighborhood',null,0,4,0,'Best on Friday mornings. Combine with Suzanne Dellal.'),

  loc(335,'Jaffa Port','נמל יפו','Jaffa','יפו','P',
    ['romantic','casual','unique','views'],1,[1,2],
    'Ancient fishing port with charming cafés, street art, and stunning Mediterranean sunsets.',
    'נמל דייגים עתיק עם בתי קפה, אמנות רחוב ושקיעות ים תיכוניות מרהיבות.',
    'Jaffa Port Israel',null,0,4,1,'Quieter than Tel Aviv waterfront. Great for sunset.'),

  loc(336,'HaTachana (Old Station)','התחנה – מתחם','Tel Aviv','תל אביב','P',
    ['casual','romantic','evening','unique'],1,[1,2],
    'Renovated Ottoman railway station turned into a charming boutique and restaurant complex.',
    "תחנת הרכבת העות'מאנית שהפכה למתחם בוטיקים ומסעדות קסום.",
    'HaTachana Old Station Tel Aviv',null,0,4,0,'Free to walk. Many kosher dining options inside.'),

  loc(337,'Bat Galim Promenade','טיילת בת גלים','Haifa','חיפה','P',
    ['romantic','casual','active','views'],1,[1,2],
    'Old-school Haifa seaside neighborhood with cafés, beach, and nostalgic promenade feel.',
    'שכונת חוף ישנה בחיפה עם בתי קפה, חוף ים ואווירת טיילת נוסטלגית.',
    'Bat Galim Haifa promenade',null,0,3,1,'Very different vibe from Tel Aviv or Jerusalem.'),

  loc(338,'Rosh Pinna Old Town','ראש פינה העתיקה','Rosh Pinna','ראש פינה','P',
    ['romantic','casual','unique','evening'],2,[2,3],
    "Israel's first Zionist moshava with cobblestone streets, boutique hotels, and mountain views.",
    "מושבת ציון הראשונה בישראל עם רחובות אבן, מלונות בוטיק ונוף הרים.",
    'Rosh Pinna old town Israel',null,0,4,0,'Best as a day/night trip. Excellent wineries nearby.'),

  loc(339,'Acre (Akko) Old City','עכו העתיקה','Acre','עכו','M',
    ['unique','casual','romantic','creative'],2,[1,2],
    'UNESCO World Heritage city — crusader tunnels, Ottoman market, and harbor with sea walls.',
    "עיר מורשת עולמית עם מנהרות צלבניות, שוק עות'מאני וחומות ים.",
    'Acre Akko old city Israel',null,0,4,0,'Allow 3–4 hrs. Combine with Rosh Hanikra.'),

  loc(340,'Ein Hod Artists Village','עין הוד כפר האמנים','Ein Hod','עין הוד','A',
    ['creative','unique','casual','romantic'],1,[1,2],
    "Quirky Carmel Mountain artists' village — galleries, studios, outdoor sculptures, and café.",
    'כפר אמנים ציורי בהר הכרמל עם גלריות, סטודיות ופסלים בחוץ.',
    'Ein Hod artists village Israel',null,0,4,1,'Free to walk. Combine with Carmel hike.'),

  loc(341,'Latrun Monastery Winery','יקב לטרון (מנזר)','Latrun','לטרון','A',
    ['romantic','unique','upscale','casual'],2,[2,3],
    'Wines made by monks since 1890 — monastery grounds, tasting room, and olive orchards.',
    'יין שנוצר על ידי נזירים מאז 1890. מתחם מנזר, חדר טעימות וכרמים.',
    'Latrun Winery Trappist Monastery Israel',null,0,4,1,'Unique and memorable. Near Armored Corps Museum.'),

  loc(342,'Benyamini Ceramics Center','מרכז בנימיני לקרמיקה','Tel Aviv','תל אביב','A',
    ['creative','fun','unique','romantic'],3,[2,3],
    "The best ceramics studio in Tel Aviv — make something beautiful together on the potter's wheel.",
    "מרכז הקרמיקה הטוב ביותר בתל אביב. ליצור ביחד על גלגל היוצר.",
    'Benyamini Ceramics Center Tel Aviv',null,1,5,1,'Book well in advance. Beginner-friendly.'),

  loc(343,'Safed (Tzfat) Old City','צפת העתיקה','Safed','צפת','M',
    ['romantic','unique','creative','evening'],1,[2,3],
    "Mystical Kabbalist city with cobalt-blue alleyways, artists' galleries, and ancient synagogues.",
    'עיר מיסטית עם סמטאות כחולות, גלריות אמנים ובתי כנסת עתיקים.',
    'Safed Tzfat old city Israel',null,1,5,1,'Magical after Shabbat. Artists quarter open most days.'),

  loc(344,'Mitzpe Ramon & Ramon Crater','מצפה רמון ומכתש רמון','Mitzpe Ramon','מצפה רמון','P',
    ['romantic','unique','adventurous','views'],2,[2,3],
    "World's largest erosion crater — desert silence, stargazing, and jaw-dropping landscapes.",
    'הרוס הגדול ביותר בעולם. דממת מדבר, כוכבים ונוף עוצר נשימה.',
    'Mitzpe Ramon crater Israel',null,1,5,0,'Plan overnight for stargazing. Many hiking trails.'),

  loc(345,'Gan HaShlosha (Sachne)','גן השלושה (שחנה)',"Beit She'an",'בית שאן','P',
    ['romantic','active','unique','adventurous'],2,[2,3],
    "Natural warm-water spring pools surrounded by lush greenery. One of Israel's most beautiful parks.",
    'בריכות מים חמים טבעיות בנוף ירוק עצום. אחד הפארקים היפים ביותר בישראל.',
    'Gan HaShlosha Sachne National Park Israel',null,1,5,0,'Book ahead on weekends. Bring towels and food.'),
]

// ── Enrich existing entries + fix 'Wineries' category ─────────────────────────
const enriched = SEED_LOCATIONS.map(l => {
  const [rating, gem, featured, notes] = U[l.id] || [3, 0, 0, '']
  const category = l.category === 'Wineries' ? 'Activities & Experiences' : l.category
  return {
    ...l,
    category,
    rating,
    hidden_gem: !!gem,
    featured:   l.featured || !!featured,
    notes,
  }
})

const all = [...enriched, ...NEW]

writeFileSync(
  join(root, 'src/data/locations.json'),
  JSON.stringify(all, null, 2) + '\n'
)
console.log(`✓ Written src/data/locations.json (${all.length} locations)`)
