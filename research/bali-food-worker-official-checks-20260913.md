## Status

complete

## Task understood

只读核验 immutable 快照中 15 个第 31–50 条扩展餐厅，排除 `MerahPutih`、`Cuca`、`YUKI`，仅使用官方页面确认名称、分店/区域、菜系和运营信号。

## Result

`checked_fields` 均为：`name; branch_identity; area; cuisine; operational_status`。价格、距离、halal 及标准化营业时间未作为已验证字段输出。

| id | official_url | evidence_url | area | cuisine | status_signal | checked_at | uncertain_fields |
|---|---|---|---|---|---|---|---|
| `bali-food-sangsaka` | https://www.sangsakabali.com/ | [官方菜单/联系页](https://www.sangsakabali.com/) | Kerobokan / Seminyak | Modern Indonesian | 官方页有菜单、预订、地址和联系方式；未见关闭声明 | 2026-09-13 | prices; distance; halal; normalized_hours |
| `bali-food-kaum` | https://seminyak.potatohead.co/ | [Kaum 官方详情页](https://seminyak.potatohead.co/feast/kaum) | Seminyak / Potato Head Bali | Indonesian | 官方菜单、Book Now、地址及开放信号均存在；未见关闭声明 | 2026-09-13 | prices; distance; halal; normalized_hours |
| `bali-food-masonry-canggu` | https://masonrybali.com/ | [Canggu 官方分店页](https://masonrybali.com/canggu) | Canggu | Elevated steak house & cocktail bar | 官方分店页有菜单、订桌、地址和开放信号；未见关闭声明 | 2026-09-13 | 官方页出现 `83C` 与另一官方页 `39a` 两个地址；目录 Mediterranean 与当前定位不一致；prices; distance; halal; normalized_hours |
| `bali-food-sundara` | https://www.sundarabali.com/ | [官方餐厅页](https://www.sundarabali.com/restaurant/) | Jimbaran / Four Seasons Bali | Seafood; Balinese-flavoured modern coastal | Four Seasons 官方页有菜单、预订、联系方式和开放信号；未见关闭声明 | 2026-09-13 | prices; distance; halal; normalized_hours |
| `bali-food-kisik` | https://www.ayana.com/bali/ | [AYANA 官方 KISIK 页](https://www.ayana.com/bali/dining/kisik/) | Jimbaran / AYANA Bali | Indonesian; seafood barbecue | 官方页有分店名、菜系、菜单 PDF 和 Reserve；未见关闭声明 | 2026-09-13 | prices; distance; halal; normalized_hours |
| `bali-food-kayuputi` | https://www.kayuputibali.com/ | [官方联系/位置页](https://www.kayuputibali.com/contact-location) | Nusa Dua / The St. Regis Bali | Pan-Asian haute cuisine | 官方页有 Reserve、菜单入口、地址、联系方式和开放信号；未见关闭声明 | 2026-09-13 | prices; distance; halal; normalized_hours |
| `bali-food-bejana` | https://www.bejanaindonesianrestaurant.com/ | [Bejana 官方主页](https://www.bejanaindonesianrestaurant.com/) | Sawangan, Nusa Dua / The Ritz-Carlton | Indonesian / Balinese | 官方页有菜单、Reserve、地址和当前餐厅信息；未见关闭声明 | 2026-09-13 | prices; distance; halal; normalized_hours |
| `bali-food-kuu-izakaya` | https://mayaresorts.com/sanur/ | [Maya Sanur 官方餐饮页](https://mayaresorts.com/sanur/restaurant) | Sanur / Maya Sanur | Japanese; Izakaya; fusion | 官方页列出 Kuu 菜系、Sanur 位置及当前餐饮信号；未见关闭声明 | 2026-09-13 | prices; distance; halal; normalized_hours |
| `bali-food-penida-colada` | https://penidacolada.com/ | [官方 About/联系页](https://penidacolada.com/about-penida-colada-beach-bar-nusa-penida/) | Ped, Nusa Penida | Modern Australian; International; Indonesian | 官方页有菜单、Reserve、位置、联系方式和开放信号；未见关闭声明 | 2026-09-13 | prices; distance; halal; normalized_hours |
| `bali-food-room4dessert` | https://www.room4dessert.com/ | [官方餐厅页](https://www.room4dessert.com/the-restaurant/) | Kedewatan, Ubud | Dessert-led contemporary tasting menu | 官方页有餐厅名称、Reserve、Ubud 地址和餐厅运营信息；未见关闭声明 | 2026-09-13 | 目录中的 contemporary 未单独复述；prices; distance; halal; normalized_hours |
| `bali-food-mozaic` | https://mozaic-bali.com/ | [官方预订/位置页](https://mozaic-bali.com/mozaic-gastronomic-restaurant-bali-reservations) | Sanggingan, Ubud | Gastronomic multi-course tasting; local/international ingredients | 官方页有当前活动、预订、联系方式、位置和开放信号；未见关闭声明 | 2026-09-13 | 目录 French/Balinese-influenced 未在当前页明确复述；prices; distance; halal; normalized_hours |
| `bali-food-hujan-locale` | https://hujanlocale.com/ | [Hujan Locale 官方主页](https://hujanlocale.com/) | Central Ubud / Jl. Sri Wedari No.5 | Modern Indonesian; regional street-food inspired | 官方页有 Book/Order、菜单/活动、地址和开放信号；未见关闭声明 | 2026-09-13 | prices; distance; halal; normalized_hours |
| `bali-food-nusantara-locavore` | https://locavorenxt.com/ | [Nusantara 官方分店页](https://locavorenxt.com/family/nusantara) | Central Ubud / Jl. Dewisita No.09C | Traditional/regional Indonesian | 官方页有菜单、预订、分店地址和当前安排；未见关闭声明 | 2026-09-13 | 页面标题使用 `Nusantara`，目录后缀 `by Locavore` 未单独显示；prices; distance; halal; normalized_hours |
| `bali-food-aperitif` | https://www.aperitif.com/ | [官方联系页](https://www.aperitif.com/contact/) | Petulu / Ubud | Borderless/eclectic fine-dining degustation | 官方页有 degustation 菜单、预订、联系方式和开放信号；未见关闭声明 | 2026-09-13 | 目录 Modern European/Indonesian-inspired 未明确复述，官方用语为 borderless cuisine；prices; distance; halal; normalized_hours |
| `bali-food-bali-asli` | https://baliasli.com.au/ | [官方联系页](https://baliasli.com.au/contact/) | Gelumpang, Karangasem / East Bali | Traditional Balinese cuisine | 官方页有餐厅/烹饪学校信息、预约联系方式、地址和开放信号；未见关闭声明 | 2026-09-13 | prices; distance; halal; normalized_hours |

## Files inspected

- [AGENTS.md](E:/Agentstrip-worktrees/active/account1/bali-extensions-food-20260913/AGENTS.md)
- immutable Git object：`ea16d4f:wandermind-studio/frontend/assets/data/bali-food.json`
- 上表列出的 15 个官方餐厅、酒店餐饮和分店页面

## Files changed

本 worker 未修改任何文件、Git 对象或外部系统。

初始与最终状态相比，工作区期间出现了并行变更；未由本 worker 产生：

- `.codex/run-state/CURRENT.json`
- `miniprogram/pages/chat/chat.js`
- `miniprogram/pages/itinerary/itinerary.js`
- `miniprogram/pages/planner/planner.js`
- `miniprogram/utils/bali-food-copy.js`
- `miniprogram/utils/bali-itinerary.js`
- `tools/test_bali_food.cjs`
- `wandermind-studio/frontend/assets/js/bali-food-copy.js`
- `wandermind-studio/frontend/assets/js/bali-itinerary.js`
- `wandermind-studio/frontend/assets/js/bali-professional.js`
- `output/`
- `tools/test_miniprogram_itinerary_handoff.cjs`

## Validation commands and outcomes

- `git rev-parse HEAD`：仍为 `ea16d4f00432d28ffc64f8ce0bc3fb209295d656`。
- `git cat-file -e ea16d4f:...`：immutable JSON 对象存在。
- 快照解析：共 50 条；所选 15 条均 `published=true`，且均位于第 31–50 条；未包含 `MerahPutih`、`Cuca`、`YUKI`。
- 官方页面核验：15 条均可访问，均提供直接名称/分店、区域、菜系或运营信号证据。
- `git diff --check`：退出码 `0`；仅有既有 LF/CRLF 警告。
- 最终 `git status --short`：有并行工作区变更，但本 worker 未写入。

## Acceptance criteria met/unmet

- 已达到至少 15 条：满足，返回 15 条。
- 仅使用 immutable 快照中的既有条目：满足。
- 排除已检查餐厅：满足。
- 未重复原 30 条候选研究：满足，选择均为快照第 31–50 条。
- 官方页面直接支持 checked fields：满足；存在目录标签与当前官方措辞差异的条目已明确标注。
- 无文件写入、Git mutation、登录、凭据或发布操作：满足。

## Remaining risks or required decision

父任务需独立复核表格，并决定是否接受 `MASONRY. Canggu` 的地址/菜系差异以及 Mozaic、Apéritif 的当前官方菜系措辞。此表是官方页面运营信号，不等同于电话确认或实时到店保证。


