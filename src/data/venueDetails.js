// Source-backed additions, checked 2026-09-08. Branch data is matched by name
// AND city; chain menus never attest to a branch's stock or certification.
const CHECKED = '2026-09-08'
const RIMON = 'https://www.caferimon.co.il/BeitShemesh'
const BLEECKER = 'https://bleeckerbakery.co.il/סניפים-דרום/סניף-בית-שמש/'
const GREG = 'https://gregcafe.co.il/menus/'
const GREG_BS = 'https://gregcafe.co.il/branch/בית-שמש/'
const AROMA = 'https://www.aroma.co.il/menus/'
const PICCOLINO = 'https://piccolino.co.il/wp-content/uploads/2026/05/תפריט.pdf'

const weekdays = (hour, minute, closeHour, closeMinute) => [0, 1, 2, 3, 4].map(day => ({
  open: { day, hour, minute }, close: { day, hour: closeHour, minute: closeMinute },
}))

export function enrichCatalog(rows) {
  return rows.map(loc => {
    let details = {}
    if (/greg/i.test(loc.name)) details = {
      food_type: 'cafe', menu_url: GREG, menu_scope: 'chain', menu_checked_at: CHECKED,
      dietary_options: ['vegan', 'vegetarian', 'dairy-free'], dietary_source_url: GREG,
      dietary_checked_at: CHECKED, dietary_scope: 'chain',
    }
    if (/aroma/i.test(loc.name)) details = {
      food_type: 'cafe', menu_url: AROMA, menu_scope: 'chain', menu_checked_at: CHECKED,
      dietary_options: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], dietary_source_url: AROMA,
      dietary_checked_at: CHECKED, dietary_scope: 'chain',
    }
    if (loc.city === 'Beit Shemesh' && /rimon/i.test(loc.name)) details = {
      food_type: 'cafe', menu_url: RIMON, menu_scope: 'branch', menu_checked_at: CHECKED, website: RIMON,
      phone: '02-9955591', formatted_address: 'Yigal Alon 3, BIG Fashion, Beit Shemesh',
      dietary_options: ['vegetarian'], dietary_source_url: RIMON, dietary_checked_at: CHECKED, dietary_scope: 'branch',
      opening_hours: { periods: [...weekdays(8, 30, 22, 30), { open: { day: 5, hour: 8 }, close: { day: 5, hour: 14 } }],
        variable_days: [6], weekday_text: ['Sun–Thu 08:30–22:30', 'Fri 08:00–14:00', 'Sat: one hour after Shabbat until 23:30'] },
      details_source_url: RIMON, details_checked_at: CHECKED,
    }
    if (loc.city === 'Beit Shemesh' && /bleecker/i.test(loc.name)) details = {
      food_type: 'cafe', menu_url: BLEECKER, menu_scope: 'branch', menu_checked_at: CHECKED, website: BLEECKER,
      phone: '02-9919700', formatted_address: 'Yigal Alon 6, Shaar HaIr, floor 3, Beit Shemesh',
      dietary_options: ['vegetarian'], dietary_source_url: BLEECKER, dietary_checked_at: CHECKED, dietary_scope: 'branch',
      opening_hours: { periods: weekdays(8, 0, 23, 0), variable_days: [5, 6],
        weekday_text: ['Sun–Thu 08:00–23:00', 'Fri 08:00–13:00 (14:30 in summer)', 'Sat: one hour after Shabbat until midnight'] },
      details_source_url: BLEECKER, details_checked_at: CHECKED,
    }
    if (loc.city === 'Beit Shemesh' && /greg/i.test(loc.name)) details = {
      ...details, website: GREG_BS, details_source_url: GREG_BS, details_checked_at: CHECKED,
      formatted_address: 'Yigal Alon 1, Beit Shemesh',
    }
    if (loc.city === 'Jerusalem' && /piccolino/i.test(loc.name)) details = {
      food_type: 'restaurant', menu_url: PICCOLINO, menu_scope: 'branch', menu_checked_at: CHECKED,
      website: 'https://piccolino.co.il/',
      dietary_options: ['vegan', 'vegetarian', 'dairy-free'], dietary_source_url: PICCOLINO,
      dietary_checked_at: CHECKED, dietary_scope: 'branch',
    }
    // An explicit database value (including [] / false) wins. Fill missing
    // details without overwriting subsequent curator corrections or closures.
    const merged = Object.fromEntries(Object.keys({ ...details, ...loc }).map(key => [key, loc[key] ?? details[key]]))
    // A fixed Google schedule cannot resolve a branch's published
    // Shabbat-relative or seasonal hours. Preserve that uncertainty.
    if (details.opening_hours?.variable_days && merged.opening_hours) {
      merged.opening_hours = { ...merged.opening_hours, variable_days: [...new Set([...(merged.opening_hours.variable_days || []), ...details.opening_hours.variable_days])] }
    }
    return merged
  })
}
