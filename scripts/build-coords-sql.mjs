#!/usr/bin/env node
/**
 * Generates SQL UPDATE statements with lat/lng for all locations.
 * Run: node scripts/build-coords-sql.mjs > scripts/add-coordinates.sql
 */

// Neighborhood centroids (lat, lng) — used to assign venue-level coordinates
const AREAS = {
  // ── Jerusalem ──────────────────────────────────────────────────────────────
  jlm_mahane:     [31.7845, 35.2155], // Mahane Yehuda / Shuk
  jlm_nachlaot:   [31.7826, 35.2133], // Nachlaot
  jlm_kikar:      [31.7831, 35.2182], // Kikar Musica / Paris Square
  jlm_center:     [31.7787, 35.2196], // Ben Yehuda / City Center
  jlm_rehavia:    [31.7767, 35.2024], // Rehavia / Talbieh
  jlm_german:     [31.7609, 35.2118], // German Colony / Emek Refaim
  jlm_first_stn:  [31.7638, 35.2177], // First Station / Tachana
  jlm_tayelet:    [31.7488, 35.2300], // Haas Promenade / Talpiot
  jlm_ein_kerem:  [31.7636, 35.1508], // Ein Kerem
  jlm_botanical:  [31.7617, 35.1990], // Botanical Garden / Givat Ram
  jlm_french_hill:[31.8012, 35.2344], // French Hill / Hebrew U
  jlm_old_city:   [31.7767, 35.2345], // Old City / Jaffa Gate
  jlm_mamilla:    [31.7787, 35.2251], // Mamilla
  jlm_talpiot:    [31.7476, 35.2264], // Talpiot
  jlm_baka:       [31.7542, 35.2175], // Baka / Katamon
  jlm_gilo:       [31.7269, 35.1736], // Gilo
  jlm_ramot:      [31.8225, 35.1770], // Ramot
  jlm_tzova:      [31.7791, 35.1064], // Kibbutz Tzuba area
  jlm_tzur:       [31.7967, 35.1543], // Mevaseret / Tzur Hadassah area
  jlm_hadassah:   [31.7678, 35.1572], // Hadassah Hospital / Ein Kerem area
  jlm_general:    [31.7683, 35.2137], // Jerusalem fallback

  // ── Tel Aviv ───────────────────────────────────────────────────────────────
  ta_port:        [32.0970, 34.7747], // Tel Aviv Port / Namal
  ta_yarkon:      [32.0982, 34.7912], // Yarkon Park north
  ta_dizengoff:   [32.0797, 34.7797], // Dizengoff / North TA
  ta_rothschild:  [32.0650, 34.7750], // Rothschild Blvd
  ta_neve_tzedek: [32.0578, 34.7634], // Neve Tzedek
  ta_florentin:   [32.0548, 34.7681], // Florentin
  ta_jaffa:       [32.0524, 34.7527], // Jaffa / Old Jaffa
  ta_sarona:      [32.0718, 34.7900], // Sarona
  ta_carmel:      [32.0608, 34.7700], // Carmel Market area
  ta_general:     [32.0853, 34.7818], // Tel Aviv fallback

  // ── Modi'in ────────────────────────────────────────────────────────────────
  modiin:         [31.8969, 35.0095],

  // ── Other cities ──────────────────────────────────────────────────────────
  beit_shemesh:   [31.7458, 34.9942],
  ramat_bs:       [31.7208, 35.0056],
  tzur_hadassah:  [31.7283, 35.0653],
  herzliya:       [32.1663, 34.8437],
  netanya:        [32.3215, 34.8532],
  raanana:        [32.1840, 34.8709],
  ashdod:         [31.8044, 34.6553],
  holon:          [32.0108, 34.7732],
  bat_yam:        [32.0233, 34.7511],
  rishon:         [31.9730, 34.7925],
  petah_tikva:    [32.0870, 34.8878],
  ramat_gan:      [32.0701, 34.8238],
  or_yehuda:      [32.0289, 34.8615],
  yehud:          [31.9947, 34.8878],
  hod_hasharon:   [32.1500, 34.8900],
  kfar_yona:      [32.3153, 34.9314],
  binyamina:      [32.5167, 34.9500],
  savyon:         [31.9969, 34.8511],
  tzoffit:        [32.1900, 34.9500],
  tzur_yigal:     [32.1900, 34.9833],
  beer_yaakov:    [31.9350, 34.8350],
  moshav_hamad:   [31.9725, 34.8864],
  shefayim:       [32.2381, 34.8264],
  ganey_tal:      [31.7200, 34.7500],
  ein_carmel:     [32.6000, 35.0167],
  givat_koah:     [32.2000, 34.9500],
  caesarea:       [32.4961, 34.8971],
  haifa:          [32.7940, 34.9896],
  haifa_german:   [32.8094, 34.9932],
  haifa_dado:     [32.8017, 34.9850],
  haifa_carmel:   [32.7678, 34.9703],
  eilat:          [29.5577, 34.9519],
  eilat_coral:    [29.5100, 34.9167],
  tiberias:       [32.7940, 35.5300],
  akko:           [32.9233, 35.0686],
  zichron:        [32.5700, 34.9456],
  mitzpe_ramon:   [30.6100, 34.8010],
  dead_sea:       [31.5000, 35.4500],
  masada:         [31.3156, 35.3536],
  beer_sheva:     [31.2518, 34.7915],
  rehovot:        [31.8928, 34.8113],
  latrun:         [31.8383, 34.9786],
  gush_etzion:    [31.6500, 35.1167],
  ein_gedi:       [31.4581, 35.3862],
  sataf:          [31.7767, 35.1367],
  nes_harim:      [31.7417, 35.0750],
  rosh_hanikra:   [33.0833, 35.1000],
  banias:         [33.2480, 35.6950],
  hula:           [33.0600, 35.6100],
  mitzpe_yericho: [31.8483, 35.3893],
  jordan_valley:  [31.9500, 35.5000],
  various:        [32.0000, 34.8000], // generic Israel center
}

// Per-location coordinate overrides keyed by location ID
// lat/lng nudged within neighborhood to give variety
const COORDS = {
  // ── Parks & Outdoors — Jerusalem ──────────────────────────────────────────
  1:  [31.7792, 35.2108], // Gan Sacher
  2:  [31.7617, 35.1984], // Gazelle Valley
  3:  [31.7723, 35.2160], // Rose Garden (Wohl)
  4:  [31.7742, 35.2173], // Liberty Bell Park
  5:  [31.7484, 35.2302], // Haas Tayelet
  6:  [31.7638, 35.2177], // First Station
  7:  [31.7751, 35.2345], // Old City walls walk
  8:  [31.7803, 35.2129], // Nachlaot walk

  // ── Parks & Outdoors — other cities ──────────────────────────────────────
  9:  [31.8006, 34.6514], // Park Hayam Ashdod
  10: [32.0970, 34.7747], // Tel Aviv Port
  11: [32.0982, 34.7912], // Yarkon Park
  12: [32.0834, 34.7697], // Gordon Beach
  13: [32.0578, 34.7592], // Jaffa Promenade
  14: [32.0960, 34.7740], // Tel Aviv Port (Namal)
  15: [32.3215, 34.8532], // Netanya Tayelet
  16: [32.1690, 34.8436], // Herzliya Marina
  17: [31.8044, 34.6553], // Ashdod Tayelet
  18: [32.8017, 34.9850], // Dado Beach Haifa
  19: [31.4581, 35.3862], // Ein Gedi
  20: [31.7767, 35.1367], // Sataf
  21: [31.7791, 35.1064], // Kibbutz Tzuba
  22: [31.8383, 34.9786], // Latrun
  23: [31.7878, 35.1549], // Soreq Cave
  24: [31.6500, 35.1167], // Gush Etzion lookout
  25: [33.2480, 35.6950], // Banias waterfall
  26: [33.0833, 35.1000], // Rosh HaNikra
  27: [33.0600, 35.6100], // Hula Valley
  28: [30.6100, 34.8010], // Mitzpe Ramon crater
  29: [31.3156, 35.3536], // Masada
  30: [31.5000, 35.4500], // Dead Sea Ein Bokek

  // ── Activities ────────────────────────────────────────────────────────────
  31: [31.7791, 35.1064], // Tzuba Winery activities
  32: [31.7791, 35.1064], // Tzuba climbing
  33: [32.0853, 34.7818], // Urban cycling TA
  34: [32.0853, 34.7818], // Escape room TA
  35: [31.7683, 35.2137], // Escape room Jerusalem
  36: [32.9233, 35.0686], // Sea kayaking Akko
  37: [29.5100, 34.9167], // Eilat snorkeling coral
  38: [32.0718, 34.7900], // Sarona activities
  39: [31.7683, 35.2137], // Jerusalem activity general
  40: [31.7791, 35.1064], // Chocolate Factory Tzuba

  // ── Cafés & Restaurants — Jerusalem ──────────────────────────────────────
  41: [31.7831, 35.2155], // Café Machane Yehuda
  42: [31.7845, 35.2162], // Village Green Mahane
  43: [31.7821, 35.2181], // Adom Wine Bar
  44: [31.7638, 35.2177], // Cafeneto First Station
  45: [31.7638, 35.2167], // Azura Mahane (actually near market)
  46: [31.7609, 35.2126], // Emek Refaim café
  47: [31.7631, 35.2102], // German Colony café
  48: [31.7851, 35.2152], // Machneyuda restaurant
  49: [31.7836, 35.2148], // Wine & Friends Mahane
  50: [31.7788, 35.2202], // Bezalel/city center

  51: [31.7767, 35.2024], // Rehavia café
  52: [31.7631, 35.2110], // HaTzar German Colony
  53: [31.7800, 35.2188], // Kikar Musica area
  54: [31.7840, 35.2140], // Shuk area café
  55: [31.7831, 35.2155], // Mahane market café
  56: [31.7609, 35.2118], // German Colony restaurant
  57: [31.7787, 35.2196], // City center restaurant
  58: [31.7826, 35.2133], // Nachlaot restaurant
  59: [31.7767, 35.2024], // Rehavia restaurant
  60: [31.7638, 35.2177], // First Station restaurant

  61: [31.7609, 35.2118], // German Colony restaurant 2
  62: [31.7787, 35.2196], // Ben Yehuda area
  63: [31.7831, 35.2182], // Kikar Musica restaurant
  64: [31.7636, 35.1508], // Ein Kerem restaurant
  65: [31.7826, 35.2133], // Nachlaot café
  66: [31.7745, 35.2152], // Central Jerusalem
  67: [31.7800, 35.2200], // City center café
  68: [31.7617, 35.1990], // Botanical Garden café
  69: [31.7609, 35.2118], // Emek Refaim
  70: [31.7840, 35.2140], // Mahane Yehuda area

  71: [31.7826, 35.2133], // Nachlaot wine
  72: [31.7831, 35.2182], // Paris Square
  73: [31.7787, 35.2196], // Center café
  74: [31.7609, 35.2118], // German Colony
  75: [31.7609, 35.2110], // Emek Refaim café
  76: [31.7638, 35.2177], // First Station café
  77: [31.7845, 35.2155], // Mahane area
  78: [31.7826, 35.2133], // Nachlaot café
  79: [31.7609, 35.2118], // German Colony
  80: [31.7787, 35.2180], // City center café

  81: [31.7800, 35.2200], // Café Rimon dairy
  82: [31.7800, 35.2200], // Café Rimon meaty
  83: [31.7730, 35.2358], // Café Denya (views east)
  84: [31.7609, 35.2118], // Café Gan Sipur Jerusalem
  85: [31.7800, 35.2200], // Bagel Café
  86: [31.7787, 35.2196], // Powerworks Coffee
  87: [31.7636, 35.1508], // HaTzar Ein Kerem
  88: [31.7787, 35.2196], // Café Greg's Jerusalem
  89: [31.7787, 35.2196], // Tal Bagel
  90: [31.7831, 35.2182], // Piccolino Kikar Musica

  91: [31.7800, 35.2200], // Ice Story
  92: [31.7787, 35.2196], // Grand Café
  93: [31.7617, 35.1990], // Cafit Botanical Gardens
  94: [31.7787, 35.2196], // Kadosh Café
  95: [31.7787, 35.2196], // Sam's Bagels
  96: [31.7800, 35.2200], // Waffle Bar
  97: [31.8012, 35.2344], // Chalav uDvash French Hill
  98: [31.7800, 35.2196], // La Piedra Jerusalem
  99: [31.7800, 35.2196], // Muscat Jerusalem

  // ── Hotels & Lounges — Jerusalem ──────────────────────────────────────────
  100: [31.7787, 35.2251], // Mamilla Hotel rooftop
  101: [31.7787, 35.2251], // Mamilla area lounge
  102: [31.7800, 35.2200], // Jerusalem lounge

  // ── Tel Aviv — Cafés & Restaurants ────────────────────────────────────────
  103: [32.0650, 34.7750], // Rothschild restaurant
  104: [32.0608, 34.7700], // Carmel Market area
  105: [32.0578, 34.7634], // Neve Tzedek restaurant
  106: [32.0524, 34.7527], // Jaffa restaurant
  107: [32.0797, 34.7797], // North TA café
  108: [32.0650, 34.7750], // Rothschild café
  109: [32.0548, 34.7681], // Florentin café
  110: [32.0650, 34.7750], // Rothschild wine bar
  111: [32.0578, 34.7634], // Neve Tzedek café
  112: [32.0524, 34.7527], // Old Jaffa restaurant

  113: [32.0650, 34.7750], // TA restaurant
  114: [32.0608, 34.7700], // Carmel area
  115: [32.0578, 34.7634], // Neve Tzedek
  116: [32.0797, 34.7797], // Dizengoff area
  117: [32.0650, 34.7750], // Rothschild
  118: [32.0524, 34.7527], // Jaffa
  119: [32.0608, 34.7700], // Carmel area
  120: [32.0650, 34.7750], // TA center
  121: [32.0578, 34.7634], // Neve Tzedek
  122: [32.0548, 34.7681], // Florentin

  123: [32.0650, 34.7750], // Rothschild area
  124: [32.0718, 34.7900], // Sarona
  125: [32.0578, 34.7634], // Neve Tzedek
  126: [32.0970, 34.7747], // Port area
  127: [32.0650, 34.7750], // TA center
  128: [32.0524, 34.7527], // Jaffa
  129: [32.0608, 34.7700], // Carmel
  130: [32.0650, 34.7750], // Rothschild
  131: [32.0548, 34.7681], // Florentin
  132: [32.0578, 34.7634], // Neve Tzedek

  133: [32.0718, 34.7900], // Sarona area
  134: [32.0718, 34.7900], // Biga Sarona Market
  135: [32.0970, 34.7747], // Port restaurant
  136: [32.0970, 34.7747], // Café Café Port
  137: [32.0650, 34.7750], // Rothschild
  138: [32.0548, 34.7681], // Florentin
  139: [32.0578, 34.7634], // Neve Tzedek
  140: [32.0524, 34.7527], // Old Jaffa

  // ── Haifa ─────────────────────────────────────────────────────────────────
  141: [32.8017, 34.9850], // Dado Beach
  142: [32.8094, 34.9932], // German Colony Haifa
  143: [32.7887, 34.9895], // Carmel area
  144: [32.8094, 34.9932], // Ben Gurion Blvd
  145: [32.7940, 34.9896], // Haifa center
  146: [32.8017, 34.9850], // Haifa port area
  147: [32.7678, 34.9703], // Upper Carmel
  148: [32.8094, 34.9932], // German Colony café

  // ── Modi'in ───────────────────────────────────────────────────────────────
  149: [31.8969, 35.0095], // Modi'in café
  150: [31.8950, 35.0095], // Modi'in restaurant
  151: [31.8969, 35.0095], // Modi'in park
  152: [31.8950, 35.0085], // Modi'in activities
  153: [31.8969, 35.0095], // Modi'in café 2
  154: [31.8950, 35.0100], // Modi'in restaurant 2

  // ── Beit Shemesh / RBS ────────────────────────────────────────────────────
  155: [31.7458, 34.9942], // Beit Shemesh café
  156: [31.7208, 35.0056], // Ramat Beit Shemesh
  157: [31.7458, 34.9942], // Beit Shemesh restaurant
  158: [31.7458, 34.9942], // Beit Shemesh park
  159: [31.7458, 34.9942], // Beit Shemesh 5
  160: [31.7458, 34.9942], // Beit Shemesh 6

  // ── Eilat ─────────────────────────────────────────────────────────────────
  161: [29.5577, 34.9519], // Eilat lounge
  162: [29.5577, 34.9519], // Eilat restaurant
  163: [29.5100, 34.9167], // Eilat Coral Beach
  164: [29.5577, 34.9519], // Eilat café
  165: [29.5577, 34.9519], // Eilat lounge 2
  166: [29.5577, 34.9519], // Eilat park
  167: [29.5100, 34.9167], // Eilat activities
  168: [29.5577, 34.9519], // Eilat restaurant 2
  169: [29.5577, 34.9519], // Eilat hotel
  170: [29.5100, 34.9167], // Eilat snorkel
  171: [29.5577, 34.9519], // Eilat kite
  172: [29.5100, 34.9167], // Eilat snorkeling coral
  173: [29.5577, 34.9519], // Eilat general

  // ── Gush Etzion / Jerusalem Hills ─────────────────────────────────────────
  174: [31.7417, 35.0750], // Nes Harim area
  175: [31.6500, 35.1167], // Gush Etzion
  176: [31.6500, 35.1167], // Gush Etzion 2
  177: [31.7417, 35.0750], // Jerusalem hills winery
  178: [31.7283, 35.0653], // Tzur Hadassah
  179: [31.7283, 35.0653], // Tzur Hadassah 2
  180: [31.7283, 35.0653], // Tzur Hadassah 3

  // ── North / Galilee ───────────────────────────────────────────────────────
  181: [32.7940, 35.5300], // Tiberias
  182: [32.7940, 35.5300], // Tiberias 2
  183: [33.2480, 35.6950], // Banias
  184: [33.0600, 35.6100], // Hula valley
  185: [32.9233, 35.0686], // Akko
  186: [32.9233, 35.0686], // Akko 2
  187: [32.8094, 34.9932], // German Colony Haifa café row
  188: [32.5700, 34.9456], // Zichron Yaakov
  189: [32.5700, 34.9456], // Zichron 2
  190: [32.5700, 34.9456], // Zichron winery
  191: [32.5700, 34.9456], // Zichron 4
  192: [32.5700, 34.9456], // Zichron 5
  193: [32.4961, 34.8971], // Caesarea port
  194: [32.0970, 34.7747], // Kitchen Market TA port
  195: [31.8483, 35.3893], // Mitzpe Yericho
  196: [31.8483, 35.3893], // Mitzpe Yericho 2
  197: [31.7767, 35.1367], // Sataf nature
  198: [31.7791, 35.1064], // Tzuba area
  199: [31.7417, 35.0750], // Nes Harim winery
  200: [31.7417, 35.0750], // Jerusalem hills 2
  201: [31.7417, 35.0750], // Hadassah Ein Kerem area
  202: [31.7417, 35.0750], // Jaffa Winery Nes Harim

  // Wineries — Judean Hills / North
  203: [31.6883, 34.9483], // Ella Valley Vineyards
  204: [31.7500, 35.0400], // Nevo Winery Mata
  205: [31.7417, 35.0750], // Katlav Winery Nes Harim
  206: [31.6500, 34.9400], // Maresha Winery Zekharia
  207: [31.7683, 35.0900], // Ollo Winery Jerusalem area
  208: [31.7938, 35.0786], // Domaine du Castel Yad HaShmona
  209: [32.5700, 34.9456], // Somek Estate Zichron Yaakov
  210: [32.5700, 34.9456], // Tishbi Winery Zichron
  211: [33.2100, 35.5300], // Galil Mountain Winery Yiron
  212: [33.1000, 35.7000], // Pelter Winery Ein Zivan Golan
  213: [32.7400, 35.4200], // Netofa Winery Lower Galilee
  214: [32.7940, 35.5300], // Berenice Winery Tiberias

  // Tzur Hadassah
  215: [31.7283, 35.0653], // Tzur Hadassah Urban Park
  216: [31.7283, 35.0653], // Jeppeto Pizza Tzur Hadassah

  // ── New locations (221+) ──────────────────────────────────────────────────
  // Modi'in new
  221: [31.8954, 35.0094], // Belle & Charlie Modi'in
  222: [31.8965, 35.0102], // Jeppeto Bar Modi'in
  223: [31.8972, 35.0098], // Portofino Modi'in
  224: [31.8960, 35.0090], // O'Sullivan's Modi'in

  // Tel Aviv new
  225: [32.0530, 34.7521], // Poupée Old Jaffa
  226: [32.0528, 34.7516], // Setai Old Jaffa
  227: [32.0641, 34.7744], // Jome Rothschild
  228: [32.0638, 34.7741], // Malka by Eyal Shani
  229: [32.0971, 34.7749], // Fish Market TA Port
  230: [32.0647, 34.7752], // Esther HaMalka
  231: [32.0653, 34.7755], // Qumran Bar
  232: [32.0644, 34.7748], // ALALI
  233: [32.0655, 34.7760], // Ola Ola
  234: [32.0640, 34.7742], // Le Miel
  235: [32.0648, 34.7753], // Yain BaHatzer
  236: [32.0645, 34.7750], // Kanki Sushi

  // Rishon LeZion
  237: [31.9738, 34.7935], // People
  238: [31.9730, 34.7925], // Sorento
  239: [31.9732, 34.7928], // Campania
  240: [31.9735, 34.7930], // Luciana Rishon
  241: [31.9728, 34.7922], // HaBeer Bar
  242: [31.9733, 34.7927], // Umino Sushi
  243: [31.9736, 34.7932], // Titi Martin
  244: [31.9729, 34.7924], // Alina
  245: [31.9731, 34.7926], // Amulola

  // Multi-city
  246: [32.0870, 34.8878], // Patrick's Petah Tikva
  247: [31.9730, 34.7925], // Patrick's Rishon
  248: [32.0108, 34.7732], // Patrick's Holon
  249: [32.0653, 34.7759], // Memphis Tel Aviv
  250: [32.0870, 34.8878], // Memphis Petah Tikva
  251: [32.0870, 34.8878], // Jem's Petah Tikva
  252: [32.1663, 34.8437], // Jem's Herzliya
  253: [32.0289, 34.8615], // Café Lyon Or Yehuda
  254: [32.0289, 34.8615], // Samarkand Or Yehuda
  255: [32.0647, 34.7752], // Samarkand Tel Aviv
  256: [32.0870, 34.8878], // Café Gan Sipur Petah Tikva
  257: [31.9730, 34.7925], // Café Gan Sipur Rishon

  // Petah Tikva
  258: [32.0870, 34.8878], // Pitmaster
  259: [32.0872, 34.8876], // Kalma
  260: [32.0868, 34.8880], // Baba Challa
  261: [32.0871, 34.8879], // Tamara
  262: [32.0869, 34.8877], // Café Lago
  263: [32.1083, 34.9617], // Pakish Café Sha'arei Tikva
  264: [32.0873, 34.8881], // Dreamery
  265: [32.0875, 34.8883], // Nini Choo
  266: [32.0867, 34.8875], // Marionella
  267: [32.0870, 34.8878], // VIVINO Wine Bar
  268: [32.0874, 34.8882], // Bukeria
  269: [32.0866, 34.8874], // Bleecker Bakery
  270: [32.0876, 34.8884], // Café Be'alma
  271: [32.0864, 34.8872], // Yarkafe
  272: [32.0878, 34.8886], // EATALIA
  273: [32.0880, 34.8888], // Margaux Brasserie

  // Ramat Gan
  274: [32.0701, 34.8238], // Sheldon
  275: [32.0703, 34.8240], // G27
  276: [32.0699, 34.8236], // Café Shaket
  277: [32.0705, 34.8242], // Gana
  278: [31.9969, 34.8511], // Nuli Coffee Cart Savyon

  // Other cities
  279: [32.0108, 34.7732], // Noah Holon
  280: [32.0233, 34.7511], // Gorilla Bat Yam
  281: [31.8928, 34.8113], // Sphera Rehovot
  282: [32.1500, 34.8900], // Saporito Hod HaSharon
  283: [32.0289, 34.8615], // Turkish Grill Or Yehuda
  284: [32.0289, 34.8615], // Oved BaKfar Or Yehuda
  285: [32.0289, 34.8615], // Abdullah Or Yehuda
  286: [32.0289, 34.8615], // Carmela Or Yehuda
  287: [32.4961, 34.8971], // Kalima Caesarea
  288: [32.4955, 34.8965], // Aristo Caesarea
  289: [32.2000, 34.9500], // Damati 67 Winery
  290: [31.7800, 35.2200], // Miss & Mr Jerusalem
  291: [31.7800, 35.2200], // Pastateria Jerusalem
  292: [31.7767, 35.2024], // Sifta San Simon Jerusalem
  293: [31.7944, 35.1061], // Jerusalem Street Café (Ein Hemed forest)

  // Hidden Gems / Moshavim
  294: [31.9350, 34.8350], // Olives Café Beer Yaakov
  295: [31.9725, 34.8864], // Bakery in Farm Moshav Hamad
  296: [32.2381, 34.8264], // Café Yam Shefayim
  297: [32.0300, 34.8200], // Ivri BaPark Sharon Park
  298: [31.5800, 34.6100], // Galita Moshav Shuva
  299: [32.0200, 34.9000], // La Farina Ganei Tikva
  300: [31.9800, 34.9200], // Stella Moshav Magshimim
  301: [31.9947, 34.8878], // Café Bartel Yehud
  302: [32.0000, 34.9200], // Café Le Bustan Moshav Mazor
  303: [32.1200, 35.0200], // Nina Coffee Cart Hagor
  304: [32.1900, 34.8500], // Daylight Beach Café Neorim
  305: [32.1900, 34.9500], // Shosha Tzoffit
  306: [31.9800, 34.9200], // HaFukhot Café Magshimim
  307: [32.1900, 34.9833], // Café Shu'al Tzur Yigal
  308: [32.3153, 34.9314], // Dasha Garden Kfar Yona
  309: [31.5500, 34.7200], // Etzel Shugi Alikim
  310: [31.7200, 34.7500], // Café Flora Ganey Tal
  311: [31.7200, 34.7500], // Ruhama Café Ganey Tal
  312: [31.9500, 34.9500], // Daniela Farmers Market
  313: [31.9200, 34.9100], // Shevet Café Moshav Bnia
  314: [32.5167, 34.9500], // Café Daz Binyamina
  315: [32.6000, 35.0167], // Café Tov Ein Carmel
  316: [32.5500, 35.0000], // Brutta Megidim
  317: [32.5200, 35.5000], // Ayina Ein HaNetziv
  318: [32.2500, 35.1000], // Café Moise HaZore'im
  319: [31.7944, 35.1061], // Ora Valley Jerusalem hills
  320: [31.6900, 34.8600], // Flora BaChava Sede Moshe
  321: [31.3800, 34.6500], // Geula Meshek Tkuma
  322: [31.6300, 34.7000], // Barbara Moshav Brachya
  323: [31.6100, 34.7200], // Café HaNahal Ein Tzurim
  324: [32.0500, 35.5000], // Café Zulato Jordan Valley
  325: [31.5500, 35.3000], // Café Barkai Dead Sea
  326: [32.4700, 35.0000], // Café Daniel Kfar HaRoeh
}

// Read and output
const entries = Object.entries(COORDS)

console.log('-- HaMakom: venue coordinates migration')
console.log('-- Generated by scripts/build-coords-sql.mjs')
console.log('-- Run in Supabase SQL editor\n')

for (const [id, [lat, lng]] of entries) {
  console.log(`UPDATE locations SET lat = ${lat}, lng = ${lng} WHERE id = ${id};`)
}

console.log(`\n-- Total: ${entries.length} locations updated`)
