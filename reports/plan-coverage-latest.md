# Plan coverage audit

Generated: 2026-05-26T00:43:25.874Z

Locations in DB: 317

Combinations tested: 672


## Verdict tally

| Verdict | Count |
| --- | --- |
| pass | 541 |
| code-bug | 123 |
| inventory-gap | 8 |

## Worst city × focus combinations (lowest pass rate)

| Combo | Pass | Code bugs | Inventory | Total |
| --- | --- | --- | --- | --- |
| Herzliya × activity | 0 | 12 | 0 | 12 |
| Ra'anana × atmosphere | 0 | 12 | 0 | 12 |
| Ra'anana × food-drink | 0 | 12 | 0 | 12 |
| Ra'anana × activity | 0 | 12 | 0 | 12 |
| Netanya × activity | 0 | 12 | 0 | 12 |
| Zichron Yaakov × activity | 0 | 12 | 0 | 12 |
| Tzur Hadassah × activity | 1 | 11 | 0 | 12 |
| Petach Tikva × outdoors | 1 | 11 | 0 | 12 |
| Haifa × activity | 4 | 8 | 0 | 12 |
| flexible × activity | 5 | 7 | 0 | 12 |
| Zichron Yaakov × food-drink | 7 | 5 | 0 | 12 |
| Givat Shmuel × outdoors | 8 | 0 | 4 | 12 |
| Petach Tikva × activity | 9 | 3 | 0 | 12 |
| Tel Aviv × outdoors | 10 | 2 | 0 | 12 |
| Modi'in × outdoors | 10 | 2 | 0 | 12 |
| Givat Shmuel × activity | 10 | 0 | 2 | 12 |
| Modi'in × food-drink | 11 | 1 | 0 | 12 |
| Givat Shmuel × atmosphere | 11 | 0 | 1 | 12 |
| Givat Shmuel × food-drink | 11 | 0 | 1 | 12 |
| Caesarea × activity | 11 | 1 | 0 | 12 |

## Code bugs

### stops [Parks & Outdoors,Cafes & Restaurants] don't match focus=activity (25)
- `{"city":"Tzur Hadassah","seriousness":"just-met","focus":"activity","length":"short"}` — top city=Tzur Hadassah, stops=2
- `{"city":"Tzur Hadassah","seriousness":"just-met","focus":"activity","length":"medium"}` — top city=Tzur Hadassah, stops=2
- `{"city":"Tzur Hadassah","seriousness":"just-met","focus":"activity","length":"long"}` — top city=Tzur Hadassah, stops=2
- `{"city":"Tzur Hadassah","seriousness":"just-met","focus":"activity"}` — top city=Tzur Hadassah, stops=2
- `{"city":"Tzur Hadassah","seriousness":"getting-to-know","focus":"activity","length":"short"}` — top city=Tzur Hadassah, stops=2
### stops [Parks & Outdoors] don't match focus=atmosphere (12)
- `{"city":"Ra'anana","seriousness":"just-met","focus":"atmosphere","length":"short"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"just-met","focus":"atmosphere","length":"medium"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"just-met","focus":"atmosphere","length":"long"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"just-met","focus":"atmosphere"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"getting-to-know","focus":"atmosphere","length":"short"}` — top city=Ra'anana, stops=1
### stops [Parks & Outdoors] don't match focus=food-drink (12)
- `{"city":"Ra'anana","seriousness":"just-met","focus":"food-drink","length":"short"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"just-met","focus":"food-drink","length":"medium"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"just-met","focus":"food-drink","length":"long"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"just-met","focus":"food-drink"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"getting-to-know","focus":"food-drink","length":"short"}` — top city=Ra'anana, stops=1
### stops [Parks & Outdoors] don't match focus=activity (12)
- `{"city":"Ra'anana","seriousness":"just-met","focus":"activity","length":"short"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"just-met","focus":"activity","length":"medium"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"just-met","focus":"activity","length":"long"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"just-met","focus":"activity"}` — top city=Ra'anana, stops=1
- `{"city":"Ra'anana","seriousness":"getting-to-know","focus":"activity","length":"short"}` — top city=Ra'anana, stops=1
### stops [Cafes & Restaurants,Cafes & Restaurants,Cafes & Restaurants] don't match focus=outdoors (8)
- `{"city":"Modi'in","seriousness":"getting-serious","focus":"outdoors","length":"long"}` — top city=Modi'in, stops=3
- `{"city":"Modi'in","seriousness":"getting-serious","focus":"outdoors"}` — top city=Modi'in, stops=3
- `{"city":"Petach Tikva","seriousness":"just-met","focus":"outdoors","length":"long"}` — top city=Petach Tikva, stops=3
- `{"city":"Petach Tikva","seriousness":"getting-to-know","focus":"outdoors","length":"long"}` — top city=Petach Tikva, stops=3
- `{"city":"Petach Tikva","seriousness":"getting-to-know","focus":"outdoors"}` — top city=Petach Tikva, stops=3
### stops [Cafes & Restaurants,Parks & Outdoors] don't match focus=activity (6)
- `{"city":"Herzliya","seriousness":"just-met","focus":"activity","length":"short"}` — top city=Herzliya, stops=2
- `{"city":"Herzliya","seriousness":"just-met","focus":"activity"}` — top city=Herzliya, stops=2
- `{"city":"Netanya","seriousness":"just-met","focus":"activity","length":"medium"}` — top city=Netanya, stops=2
- `{"city":"Netanya","seriousness":"just-met","focus":"activity","length":"long"}` — top city=Netanya, stops=2
- `{"city":"Netanya","seriousness":"getting-to-know","focus":"activity","length":"short"}` — top city=Netanya, stops=2
### stops [Parks & Outdoors,Cafes & Restaurants,Cafes & Restaurants] don't match focus=activity (5)
- `{"city":"Herzliya","seriousness":"just-met","focus":"activity","length":"medium"}` — top city=Herzliya, stops=3
- `{"city":"Herzliya","seriousness":"getting-to-know","focus":"activity","length":"medium"}` — top city=Herzliya, stops=3
- `{"city":"Herzliya","seriousness":"getting-to-know","focus":"activity","length":"long"}` — top city=Herzliya, stops=3
- `{"city":"Herzliya","seriousness":"getting-to-know","focus":"activity"}` — top city=Herzliya, stops=3
- `{"city":"Herzliya","seriousness":"getting-serious","focus":"activity","length":"medium"}` — top city=Herzliya, stops=3
### stops [Parks & Outdoors,Cafes & Restaurants,Parks & Outdoors] don't match focus=activity (4)
- `{"city":"Haifa","seriousness":"just-met","focus":"activity","length":"medium"}` — top city=Haifa, stops=3
- `{"city":"Zichron Yaakov","seriousness":"getting-to-know","focus":"activity","length":"medium"}` — top city=Zichron Yaakov, stops=3
- `{"city":"Zichron Yaakov","seriousness":"getting-to-know","focus":"activity","length":"long"}` — top city=Zichron Yaakov, stops=3
- `{"city":"Zichron Yaakov","seriousness":"getting-to-know","focus":"activity"}` — top city=Zichron Yaakov, stops=3
### stops [Cafes & Restaurants,Cafes & Restaurants] don't match focus=outdoors (4)
- `{"city":"Petach Tikva","seriousness":"just-met","focus":"outdoors","length":"short"}` — top city=Petach Tikva, stops=2
- `{"city":"Petach Tikva","seriousness":"just-met","focus":"outdoors"}` — top city=Petach Tikva, stops=2
- `{"city":"Petach Tikva","seriousness":"getting-to-know","focus":"outdoors","length":"short"}` — top city=Petach Tikva, stops=2
- `{"city":"Petach Tikva","seriousness":"getting-serious","focus":"outdoors","length":"short"}` — top city=Petach Tikva, stops=2
### stops [Wineries,Parks & Outdoors] don't match focus=food-drink (4)
- `{"city":"Zichron Yaakov","seriousness":"just-met","focus":"food-drink","length":"short"}` — top city=Zichron Yaakov, stops=2
- `{"city":"Zichron Yaakov","seriousness":"just-met","focus":"food-drink"}` — top city=Zichron Yaakov, stops=2
- `{"city":"Zichron Yaakov","seriousness":"getting-to-know","focus":"food-drink","length":"short"}` — top city=Zichron Yaakov, stops=2
- `{"city":"Zichron Yaakov","seriousness":"getting-serious","focus":"food-drink","length":"short"}` — top city=Zichron Yaakov, stops=2
### stops [Wineries,Cafes & Restaurants] don't match focus=activity (4)
- `{"city":"Zichron Yaakov","seriousness":"just-met","focus":"activity","length":"short"}` — top city=Zichron Yaakov, stops=2
- `{"city":"Zichron Yaakov","seriousness":"just-met","focus":"activity"}` — top city=Zichron Yaakov, stops=2
- `{"city":"Zichron Yaakov","seriousness":"getting-to-know","focus":"activity","length":"short"}` — top city=Zichron Yaakov, stops=2
- `{"city":"Zichron Yaakov","seriousness":"getting-serious","focus":"activity","length":"short"}` — top city=Zichron Yaakov, stops=2
### stops [Hotels & Lounges,Cafes & Restaurants,Parks & Outdoors] don't match focus=activity (3)
- `{"city":"Haifa","seriousness":"getting-serious","focus":"activity","length":"medium"}` — top city=Haifa, stops=3
- `{"city":"Haifa","seriousness":"getting-serious","focus":"activity","length":"long"}` — top city=Haifa, stops=3
- `{"city":"Haifa","seriousness":"getting-serious","focus":"activity"}` — top city=Haifa, stops=3
### stops [Cafes & Restaurants,Cafes & Restaurants,Parks & Outdoors] don't match focus=activity (3)
- `{"city":"Herzliya","seriousness":"just-met","focus":"activity","length":"long"}` — top city=Herzliya, stops=3
- `{"city":"Herzliya","seriousness":"getting-serious","focus":"activity","length":"long"}` — top city=Herzliya, stops=3
- `{"city":"Herzliya","seriousness":"getting-serious","focus":"activity"}` — top city=Herzliya, stops=3
### stops [Cafes & Restaurants,Cafes & Restaurants,Cafes & Restaurants] don't match focus=activity (3)
- `{"city":"Petach Tikva","seriousness":"getting-serious","focus":"activity","length":"medium"}` — top city=Petach Tikva, stops=3
- `{"city":"Petach Tikva","seriousness":"getting-serious","focus":"activity","length":"long"}` — top city=Petach Tikva, stops=3
- `{"city":"Petach Tikva","seriousness":"getting-serious","focus":"activity"}` — top city=Petach Tikva, stops=3
### stops [Cafes & Restaurants,Wineries,Parks & Outdoors] don't match focus=activity (3)
- `{"city":"Zichron Yaakov","seriousness":"getting-serious","focus":"activity","length":"medium"}` — top city=Zichron Yaakov, stops=3
- `{"city":"Zichron Yaakov","seriousness":"getting-serious","focus":"activity","length":"long"}` — top city=Zichron Yaakov, stops=3
- `{"city":"Zichron Yaakov","seriousness":"getting-serious","focus":"activity"}` — top city=Zichron Yaakov, stops=3
### leg 91.5km > 6 (3)
- `{"city":"flexible","seriousness":"getting-serious","focus":"activity","length":"medium"}` — top city=Various, stops=3
- `{"city":"flexible","seriousness":"getting-serious","focus":"activity","length":"long"}` — top city=Various, stops=3
- `{"city":"flexible","seriousness":"getting-serious","focus":"activity"}` — top city=Various, stops=3
### stops [Cafes & Restaurants,Hotels & Lounges,Cafes & Restaurants] don't match focus=outdoors (2)
- `{"city":"Tel Aviv","seriousness":"getting-serious","focus":"outdoors","length":"long"}` — top city=Tel Aviv, stops=3
- `{"city":"Tel Aviv","seriousness":"getting-serious","focus":"outdoors"}` — top city=Tel Aviv, stops=3
### stops [Wineries,Cafes & Restaurants,Parks & Outdoors] don't match focus=activity (2)
- `{"city":"Zichron Yaakov","seriousness":"just-met","focus":"activity","length":"medium"}` — top city=Zichron Yaakov, stops=3
- `{"city":"Zichron Yaakov","seriousness":"just-met","focus":"activity","length":"long"}` — top city=Zichron Yaakov, stops=3
### leg 97.4km > 6 (2)
- `{"city":"flexible","seriousness":"getting-to-know","focus":"activity","length":"long"}` — top city=Various, stops=3
- `{"city":"flexible","seriousness":"getting-to-know","focus":"activity"}` — top city=Various, stops=3
### leg 46.2km > 6 (1)
- `{"city":"Modi'in","seriousness":"getting-to-know","focus":"food-drink","length":"short"}` — top city=Modi'in, stops=2
### stops [Cafes & Restaurants,Cafes & Restaurants] don't match focus=activity (1)
- `{"city":"Herzliya","seriousness":"getting-serious","focus":"activity","length":"short"}` — top city=Herzliya, stops=2
### stops [Activities & Experiences,Cafes & Restaurants,Cafes & Restaurants] don't match focus=outdoors (1)
- `{"city":"Petach Tikva","seriousness":"just-met","focus":"outdoors","length":"medium"}` — top city=Petach Tikva, stops=3
### stops [Wineries,Parks & Outdoors,Parks & Outdoors] don't match focus=food-drink (1)
- `{"city":"Zichron Yaakov","seriousness":"just-met","focus":"food-drink","length":"medium"}` — top city=Zichron Yaakov, stops=3
### leg 15.1km > 6 (1)
- `{"city":"flexible","seriousness":"getting-to-know","focus":"activity","length":"short"}` — top city=Various, stops=2
### leg 6.1km > 6 (1)
- `{"city":"flexible","seriousness":"getting-serious","focus":"activity","length":"short"}` — top city=Tiberias, stops=2