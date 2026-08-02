# 快速档研究 03：路线运营、信任、安全与供应商约束

研究截止：2026-08-02
用途：为 WanderMind 的路线数据、司机报价、疗愈内容、商家信息与图片使用建立发布门槛。
边界：这是一份运营与产品控制框架，不构成法律、医疗或税务意见；不在证据不足时推断价格、评分、营业状态或疗效。

## 一、来源登记与质量

| ID | 来源 | 类型与质量 | 本研究使用范围 |
|---|---|---|---|
| S1 | `E:\Agentstrip\Wandermind_巴厘岛专业路线体系_完整分析与深化.docx`，V1.1，2026-08 | 项目一手产品决策；高相关性 | 地理事实层、六条主题路线层、扩展模块、现实约束和 `verification_status` |
| S2 | 印尼卫生部《Permenkes No. 15 Tahun 2018》，官方 JDIH：[原文](https://jdih.kemkes.go.id/common/dokumen/2018permenkes015.pdf) / [BPK 法规页](https://peraturan.bpk.go.id/Details/111834/permenkes-no-15-) | 印尼现行官方法规；高权威 | 传统/补充健康服务的安全、有效性、人员资质与执业边界 |
| S3 | WIPO Lex，印度尼西亚《Law No. 28 of 2014 on Copyright》：[法令页](https://www.wipo.int/wipolex/en/legislation/details/15600) | 法律原文的国际官方数据库；高权威 | 图片和创作内容默认受版权保护，商业再利用需要权利基础 |
| S4 | Google Maps Platform，Places API Policies and Attributions：[官方政策](https://developers.google.com/maps/documentation/places/web-service/policies) | 平台官方、可能更新；高操作相关性 | 商家照片、评分、评论、归因、来源链接和内容披露 |
| S5 | GetYourGuide Supplier Terms and Conditions，2026-01-12 版：[官方条款](https://www.getyourguide.com/c/supplier-terms-and-conditions/) | 平台官方供应商条款；高操作相关性 | 价格、费用、库存、内容权利、资质与安全的供应商责任；仅作行业控制参考 |

来源覆盖足以支持“先核验再发布”的控制设计，但不能替代对 Dicky/Gede、疗愈场所和图片权利人的直接核验。司机报价、实时营业、空位、即时评分均属于高漂移信息。

## 二、核心判断

### 1. 司机报价必须来自司机的可追溯确认

用户已经向 Dicky 询问本人和 Gede 的现行用车价格。在收到明确回复前，网站不得展示推测的“每日价格”“折扣价”或精确总价。可以先显示：

- `价格待司机确认`
- `提交行程后询价`
- `预估不含门票、船票、停车费等，最终以司机书面确认单为准`

行业控制参考 S5 要求供应商维护准确的价格和可用性，并将必须费用纳入公开价格。这不等于 WanderMind 已与司机形成同样的供应商协议，但说明产品不能只保存一个数字；必须同时保存费用边界、适用条件、有效期和确认来源。

建议司机报价记录：

```yaml
supplier_id: dicky | gede
vehicle_id: string
currency: IDR
rate_model: full_day | half_day | airport_transfer | custom
base_amount: null
included_hours: null
overtime_amount: null
included_items: []
excluded_items: []
coverage_regions: []
pickup_constraints: []
overnight_driver_fee: null
holiday_surcharge: null
effective_from: null
expires_at: null
source_channel: whatsapp | signed_rate_sheet | other
source_reference: null
confirmed_by: null
confirmed_at: null
verification_status: awaiting_supplier
```

发布规则：

1. 没有 `source_reference + confirmed_by + confirmed_at`，不能进入 `verified`。
2. 报价必须有币种和有效期；没有有效期时，最多按内部“短期可用”处理，并在下单前二次确认。
3. 路线总价应由“已确认计价规则 × 实际用车天数/时长 + 已披露附加项”计算，不允许模型凭经验补全空值。
4. 页面把“路线解锁价 ¥9.9”和“当地用车/活动费用”分开，避免用户误认为 ¥9.9 包含旅行服务。
5. 司机未确认可用性时，只能生成询价单，不能生成“已预订”状态。

### 2. 音疗、疗愈和瑜伽应描述为体验，不承诺医疗结果

S2 把传统补充健康服务置于“安全、质量、有效”以及人员资质、注册和执业许可的监管框架内。WanderMind 当前掌握的是旅游内容和场所公开资料，不足以核验某场所或导师具有医疗服务资质。因此，音浴、颂钵、冥想、瑜伽等默认归入：

```text
wellness_experience / relaxation / cultural_or_spiritual_activity
```

安全文案：

- 可写：“放松体验”“声音与冥想活动”“适合希望安排安静时段的旅行者”。
- 只有商家明确公开并可核验时，才可转述其课程名称、时长和参加条件，并链接官方页面。
- 不写：“治疗焦虑/失眠/抑郁”“排毒”“治愈创伤”“改善某种疾病”“保证疗效”。
- 不把平台或用户评分当作医疗有效性证据。
- 对孕期、心血管问题、癫痫、听觉敏感、近期手术等情况，不由模型给个体化医疗结论；提示用户向场所和合格医疗专业人员确认。

若商家明确把服务定位为医疗或补充治疗，新增核验字段：

```yaml
service_classification: wellness_experience | regulated_health_service | unknown
practitioner_name: null
credential_claim: null
credential_source_url: null
facility_license_claim: null
facility_license_source_url: null
medical_claim_review_status: not_applicable | pending | verified_by_qualified_reviewer
```

在这些字段未完成前，页面只能以非医疗旅游体验方式呈现。

### 3. 商家网站或平台上的图片不能因为“能下载”就复制到 WanderMind

S3 表明照片等创作内容通常受到版权保护。S4 进一步要求，若通过 Places API 展示照片或评论，应保留所需作者归因、Google Maps 归因，并让用户能够打开对应 Google Maps 来源；评分和评论也不能被伪装为 WanderMind 自有结论。S5 的内容许可只发生在供应商与 GetYourGuide 之间，不会自动转授权给 WanderMind；S5 的一般条款还禁止未经许可的自动抓取。

可接受的图片权利状态：

| 状态 | 可否本地发布 | 说明 |
|---|---:|---|
| `owned_by_wandermind` | 是 | 用户/团队自拍，保留原始文件和作者记录 |
| `written_supplier_license` | 是 | 商家书面授权，记录范围、期限、署名要求 |
| `licensed_stock` | 是 | 保存订单/许可证及允许的网站用途 |
| `places_api_runtime` | 条件允许 | 仅按 API 条款运行时展示，保留归因、来源链接和缓存限制 |
| `official_site_link_only` | 否 | 只链接官网或预订页，不复制其图 |
| `unknown` | 否 | 不发布、不进入构建产物 |

每张图至少记录：

```yaml
asset_id: string
source_type: owned | supplier | stock | places_api | unknown
source_url: null
creator: null
license_type: null
license_evidence_path: null
attribution_text: null
allowed_uses: []
expires_at: null
rights_status: unknown
```

因此，“搜到一家店并顺便下载店铺图片放到网站”不能作为默认流程。推荐流程是：先收录官方店铺/预订链接；页面图片使用用户自有照片、商家媒体包/书面授权素材，或严格依 API 运行时展示。

### 4. 路线可执行性必须建立在地理事实层，而不是主题文案

S1 已明确区分：

- 底层 `Geographic Truth Layer`：区域、节点、POI、交通、开放/预约、安全、司机可达性；
- 上层 `Experience Product Layer`：初见、疗愈、海洋、手作、挑战、视觉生活方式。

路线发布前至少检查：

```yaml
geo_region_verified: false
map_coordinates_verified: false
travel_time_source: null
opening_hours_checked_at: null
business_status_checked_at: null
reservation_required: unknown
supplier_availability_checked_at: null
driver_access_verified_by: null
weather_or_sea_dependency: none | low | high
physical_level: unknown
age_or_health_constraints: []
temple_or_cultural_rules_source: null
same_day_conflict_check: pending
fallback_module_id: null
```

执行原则：

1. 先显示区域停留顺序，再展开区域内 POI；不把主题相似但转场不合理的地点硬拼到同一天。
2. 佩妮达、海上活动、火山日出、北部瀑布等使用独立扩展模块，因为其交通、天气、起床时间和体力条件不同。
3. 营业时间、预约、价格、活动空位和评分都是有时效的数据，必须保存 `checked_at`，不能永久写死。
4. `driver_access_verified_by` 必须由司机或实地运营人员确认；地图可达不等于车辆实际可停靠或适合当天路线。
5. 高天气依赖模块必须有替代安排，且页面说明“行程可能因天气、海况或运营方决定调整”。

## 三、统一 `verification_status`

不要只用布尔值。建议对 POI、商家、活动、图片和司机报价使用同一枚举：

| 状态 | 含义 | 用户页面权限 |
|---|---|---|
| `draft` | 仅录入名称/想法 | 不展示 |
| `source_found` | 已找到来源，但未交叉核验 | 可在后台查看 |
| `awaiting_supplier` | 等待司机/商家/权利人回复 | 不显示价格、可用性或授权图片 |
| `partially_verified` | 地理/官网等已核验，运营信息仍缺失 | 可显示为“候选体验”，明确待确认 |
| `verified` | 核心字段、时间戳和证据齐全 | 可进入路线推荐 |
| `stale` | 超过复核周期或来源失效 | 降级为待确认，不参与确定性报价 |
| `rejected` | 信息错误、关闭、不可执行或无版权 | 不展示 |

建议附加字段：

```yaml
verification_status: draft
verification_scope: []
evidence_urls: []
evidence_files: []
verified_by: null
verified_at: null
review_due_at: null
known_unknowns: []
```

状态转换必须由证据触发，而不是由模型自信度触发。AI 可以建议“需要核验什么”，不能自行把记录改成 `verified`。

## 四、首版发布门槛

一条路线进入“专业推荐”前应同时满足：

- 区域与节点顺序已核验，且不存在明显跨区冲突；
- 核心 POI 的官方身份/地址和近期营业状态已有来源与检查日期；
- 需要预约的活动已标注预约方式，不能把第三方页面出现等同于实时可订；
- 高风险/高强度/海上模块有条件说明和替代模块；
- 司机可达性与报价分别核验；可达不等于有固定价；
- 商家图像的 `rights_status` 可发布，否则使用 WanderMind 自有图或链接；
- 疗愈内容没有医疗承诺，受监管的资质宣称可追溯；
- 用户能看见“信息核验日期”“最终以商家/司机确认为准”的适度披露。

## 五、对当前产品决策的直接建议

1. 现在可以搭建路线和报价数据结构，但 Dicky/Gede 回复前不要填任何推测价格。
2. ¥9.9 应命名为“路线内容解锁/AI 个性化路线生成”的产品价，与司机、门票、课程和酒店费用分账显示。
3. Ubud 音疗商家可先以“官方链接 + 非医疗体验简介 + 待核验状态”入库；评分必须写来源和抓取时间，不使用“巴厘岛最好”等无法证实的绝对表述。
4. 店铺图像先走权利台账。若没有授权，使用用户已拥有权利的路线环境图，不从官网或 GetYourGuide 批量下载。
5. 当前最重要的运营表不是“推荐店铺排行榜”，而是“区域节点—内容类型—路线角色—现实约束—证据—图片权利—核验状态”主表。

## 六、仍需一手确认

- Dicky 与 Gede 的车型、整天/半天口径、包含时长、超时费、跨区/过夜/节假日费用、包含与不包含项目、有效期。
- 每个活动商家的营业、预订、取消政策、年龄/健康限制、接送范围和当前价格。
- 用户上传图片的作者、人物肖像同意、商业使用授权及原图留存。
- 若要通过 Google Places 展示评分/照片：API 方案、归因 UI、来源跳转、缓存和隐私/条款页面。
- “专业路线”是否只包含 AI 生成，还是包含人工审核；两者成本和承诺必须分开。
