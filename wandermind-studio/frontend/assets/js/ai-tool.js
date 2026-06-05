/* ═══════════════════════════════════════════════════════════════════════
   WanderMind Studio · AI Tool · Phase 1
   - 6 AI agents chat with backend /api/chat
   - Destination switcher (5 destinations)
   - 5-language UI
   - Quick action buttons (toast for Phase 2 features)
   ═══════════════════════════════════════════════════════════════════════ */

/* Same-origin deployment on Render — relative path works.
   If ever deployed elsewhere, set window.WM_BACKEND = 'https://agentstrip.onrender.com'
   in a <script> tag before this file loads. */
const BACKEND_BASE = (typeof window !== 'undefined' && window.WM_BACKEND) || '';

/* ─────────────────── AGENT PERSONAS ─────────────────── */
const AGENTS = {
  planner: {
    icon: 'fa-map-o',
    cls: 'planner',
    color: '#0e7c6b',
    suffix: '\n\n作为旅程规划师，我的建议基于最优路线和节奏设计。'
  },
  hotel: {
    icon: 'fa-bed',
    cls: 'hotel',
    color: '#2563eb',
    suffix: '\n\n作为住宿顾问，我的建议特别关注住宿的性价比、位置和特色体验。'
  },
  food: {
    icon: 'fa-coffee',
    cls: 'food',
    color: '#ea580c',
    suffix: '\n\n作为美食探索家，我会特别挖掘本地人才知道的隐藏美食。'
  },
  activity: {
    icon: 'fa-compass',
    cls: 'activity',
    color: '#7c3aed',
    suffix: '\n\n作为活动策划师，我的建议侧重于独特体验和难忘时刻的创造。'
  },
  budget: {
    icon: 'fa-line-chart',
    cls: 'budget',
    color: '#d97706',
    suffix: '\n\n作为预算管家，我会给出具体的价格区间和省钱小技巧。'
  },
  search: {
    icon: 'fa-globe',
    cls: 'search',
    color: '#059669',
    suffix: ''
  }
};

/* ─────────────────── AGENT i18n DISPLAY NAMES ─────────────────── */
const AGENT_NAMES = {
  zh: { planner:'旅程规划师', hotel:'住宿顾问', food:'美食探索家', activity:'活动策划师', budget:'预算管家', search:'实时搜索' },
  en: { planner:'Trip Planner', hotel:'Hotel Advisor', food:'Food Explorer', activity:'Activity Curator', budget:'Budget Manager', search:'Live Search' },
  ja: { planner:'旅程プランナー', hotel:'宿泊アドバイザー', food:'グルメ探検家', activity:'アクティビティ企画', budget:'予算マネージャー', search:'リアルタイム検索' },
  ko: { planner:'여행 플래너', hotel:'숙박 어드바이저', food:'미식 탐험가', activity:'액티비티 큐레이터', budget:'예산 매니저', search:'실시간 검색' },
  id: { planner:'Perencana Perjalanan', hotel:'Penasihat Hotel', food:'Penjelajah Kuliner', activity:'Kurator Aktivitas', budget:'Manajer Anggaran', search:'Pencarian Langsung' }
};
const AGENT_ROLES = {
  zh: { planner:'路线·节奏', hotel:'住宿·体验', food:'风味·人文', activity:'体验·主题', budget:'成本·控制', search:'实时·实情' },
  en: { planner:'Routes & pace', hotel:'Stay & vibe', food:'Local flavour', activity:'Experiences', budget:'Cost control', search:'Live intel' },
  ja: { planner:'ルート·ペース', hotel:'宿泊·体験', food:'地元の味', activity:'体験·テーマ', budget:'コスト管理', search:'最新情報' },
  ko: { planner:'경로·페이스', hotel:'숙박·체험', food:'현지 맛', activity:'체험·테마', budget:'비용 관리', search:'실시간 정보' },
  id: { planner:'Rute & ritme', hotel:'Akomodasi', food:'Rasa lokal', activity:'Pengalaman', budget:'Kontrol biaya', search:'Info langsung' }
};

/* ─────────────────── DESTINATIONS (compact, sufficient for Phase 1 UI) ─────────────────── */
const DESTS = {
  bali: {
    flagFa: 'fa-pagelines',
    titles: {
      zh: '巴厘岛 · 神之岛<em>深度旅行</em>',
      en: 'Bali · Island of Gods<em>Deep Journey</em>',
      ja: 'バリ島 · 神の島<em>深い旅</em>',
      ko: '발리 · 신의 섬<em>깊은 여행</em>',
      id: 'Bali · Pulau Dewata<em>Perjalanan Mendalam</em>'
    },
    eyebrows: { zh:'正在规划', en:'Planning', ja:'計画中', ko:'계획 중', id:'Merencanakan' },
    weather: {
      temp: '29°C', icon: 'fa-cloud',
      cond: { zh:'巴厘岛 · 乌布 · 晴间多云', en:'Bali · Ubud · Partly Cloudy', ja:'バリ島 · ウブド · 晴れ時々曇り', ko:'발리 · 우붓 · 구름 조금', id:'Bali · Ubud · Sebagian Berawan' },
      details: '72% · 14km/h · 06:14'
    },
    rate: '¥1≈2,200',
    season: { zh:'旺季', en:'Peak Season', ja:'ピークシーズン', ko:'성수기', id:'Musim Puncak' },
    seasonDesc: { zh:'6月为旱季', en:'June is dry season', ja:'6月は乾季', ko:'6월은 건기', id:'Juni adalah musim kemarau' },
    chips: {
      zh: ['6月 出发','7 天','2 人','¥18,000'],
      en: ['Jun departure','7 days','2 people','$2,500'],
      ja: ['6月出発','7日間','2人','¥18,000'],
      ko: ['6월 출발','7일','2명','¥18,000'],
      id: ['Berangkat Jun','7 hari','2 orang','$2.500']
    },
    regions: [
      { name:'Ubud',     cls:'tag-blue',
        tag:{ zh:'文化中心',en:'Cultural Hub',ja:'文化の中心',ko:'문화 중심지',id:'Pusat Budaya' },
        desc:{ zh:'梯田、艺术、瑜伽、精神探索',en:'Rice terraces, art, yoga & spirit',ja:'棚田、芸術、ヨガ、精神探求',ko:'계단식 논, 예술, 요가, 영적 탐구',id:'Sawah terasering, seni, yoga, spiritual' } },
      { name:'Seminyak', cls:'tag-amber',
        tag:{ zh:'最热门',en:'Most Popular',ja:'最人気',ko:'가장 인기',id:'Paling Populer' },
        desc:{ zh:'时尚海滩、精品酒店、日落酒吧',en:'Trendy beach, boutique hotels, sunset bars',ja:'おしゃれビーチ、ブティックホテル、サンセットバー',ko:'트렌디 비치, 부티크 호텔, 선셋 바',id:'Pantai trendi, hotel butik, bar saat sunset' } },
      { name:'Uluwatu',  cls:'tag-amber',
        tag:{ zh:'冲浪圣地',en:'Surf Paradise',ja:'サーフィン聖地',ko:'서핑 성지',id:'Surga Surfing' },
        desc:{ zh:'顶级冲浪、悬崖神庙、凯撒火舞',en:'World-class surf, clifftop temple, Kecak fire dance',ja:'世界クラスのサーフ、断崖の寺院、ケチャック火の踊り',ko:'세계적 서핑, 절벽 사원, 케착 불춤',id:'Surfing kelas dunia, pura tebing, tari Kecak api' } },
    ],
    tips: [
      { cls:'tag-blue', title:{ zh:'签证',en:'Visa',ja:'ビザ',ko:'비자',id:'Visa' }, tag:{ zh:'中国护照',en:'CN Passport',ja:'中国パスポート',ko:'중국 여권',id:'Paspor CN' },
        desc:{ zh:'落地签约 $35，备美元现金',en:'Visa on arrival ~$35, bring USD cash',ja:'到着ビザ約$35、米ドル現金を準備',ko:'도착 비자 약 $35, USD 현금 준비',id:'VOA ~$35, siapkan USD tunai' } },
      { cls:'tag-green', driver: true, title:{ zh:'司机推荐 · Dicky',en:'Driver · Dicky',ja:'ドライバー · Dicky',ko:'운전기사 · Dicky',id:'Driver · Dicky' }, tag:{ zh:'亲测靠谱',en:'Trusted',ja:'信頼済み',ko:'검증됨',id:'Terpercaya' },
        desc:{ zh:'本地司机 · 英语 · 机场接送 · 包车',en:'Local · English-speaking · Transfers · Tours',ja:'ローカル · 英語 · 空港送迎 · 貸切',ko:'현지 · 영어 · 픽업 · 전세 투어',id:'Lokal · Bisa Inggris · Jemput · Tur privat' } }
    ],
    suggestions: {
      zh: [{l:'乌布精品民宿', q:'推荐乌布最好的精品民宿，预算中等'},{l:'冲浪地点推荐', q:'巴厘岛最佳冲浪地点和适合新手的冲浪课'},{l:'必吃美食清单', q:'巴厘岛必吃地道美食清单'},{l:'预算规划', q:'两人7天巴厘岛旅行，分节俭/舒适/豪华三档预算'}],
      en: [{l:'Ubud boutique stays', q:'Recommend the best mid-budget boutique stays in Ubud'},{l:'Surf spots', q:'Top Bali surf spots and beginner classes'},{l:'Must-try food', q:'Must-try authentic Balinese food'},{l:'Budget plan', q:'7-day Bali trip for 2: thrifty/comfort/luxury budget tiers'}],
      ja: [{l:'ウブドのブティック宿', q:'ウブドの中予算ブティック宿を推薦'},{l:'サーフスポット', q:'バリの一流サーフスポットと初心者レッスン'},{l:'必食グルメ', q:'バリの必食グルメ'},{l:'予算プラン', q:'2人7日間のバリ旅行、節約／快適／豪華の3段階予算'}],
      ko: [{l:'우붓 부티크 숙소', q:'우붓 중간 예산 부티크 숙소 추천'},{l:'서핑 스팟', q:'발리 최고 서핑 스팟과 초보자 강습'},{l:'필수 음식', q:'발리 필수 현지 음식'},{l:'예산 계획', q:'2인 7일 발리 여행 절약/편안/럭셔리 예산'}],
      id: [{l:'Penginapan butik Ubud', q:'Rekomendasi penginapan butik Ubud kelas menengah'},{l:'Spot surfing', q:'Spot surfing terbaik Bali & kelas pemula'},{l:'Kuliner wajib', q:'Kuliner Bali asli yang wajib dicoba'},{l:'Rencana anggaran', q:'Perjalanan Bali 7 hari untuk 2: anggaran hemat/nyaman/mewah'}]
    }
  },
  kyoto: {
    flagFa: 'fa-leaf',
    titles: {
      zh: '京都 · 千年古都<em>文化之旅</em>',
      en: 'Kyoto · Ancient Capital<em>Cultural Journey</em>',
      ja: '京都 · 千年の古都<em>文化の旅</em>',
      ko: '교토 · 천년 고도<em>문화 여행</em>',
      id: 'Kyoto · Ibu Kota Kuno<em>Perjalanan Budaya</em>'
    },
    eyebrows: { zh:'正在规划', en:'Planning', ja:'計画中', ko:'계획 중', id:'Merencanakan' },
    weather: { temp:'24°C', icon:'fa-sun-o', cond:{ zh:'京都 · 晴天',en:'Kyoto · Sunny',ja:'京都 · 晴れ',ko:'교토 · 맑음',id:'Kyoto · Cerah' }, details:'58% · 8km/h · 05:02' },
    rate: '¥1≈21',
    season: { zh:'初夏',en:'Early Summer',ja:'初夏',ko:'초여름',id:'Awal Musim Panas' },
    seasonDesc: { zh:'6月微雨季节',en:'June light-rain',ja:'6月は小雨',ko:'6월은 가벼운 비',id:'Juni hujan ringan' },
    chips: {
      zh:['6月 出发','7 天','2 人','¥21,000'], en:['Jun departure','7 days','2 people','$3,000'],
      ja:['6月出発','7日間','2人','¥21,000'], ko:['6월 출발','7일','2명','¥21,000'], id:['Berangkat Jun','7 hari','2 orang','$3.000']
    },
    regions: [
      { name:'Arashiyama', cls:'tag-green', tag:{ zh:'自然胜地',en:'Nature',ja:'自然',ko:'자연',id:'Alam' }, desc:{ zh:'竹林、渡月桥、岚山温泉',en:'Bamboo grove, Togetsukyo bridge, onsen',ja:'竹林、渡月橋、温泉',ko:'대나무 숲, 도게츠교, 온천',id:'Hutan bambu, Togetsukyo, onsen' } },
      { name:'Gion', cls:'tag-amber', tag:{ zh:'最热门',en:'Most Popular',ja:'最人気',ko:'가장 인기',id:'Paling Populer' }, desc:{ zh:'艺伎文化、花见小路、日式茶屋',en:'Geisha culture, Hanamikoji, tea houses',ja:'芸者文化、花見小路、茶屋',ko:'게이샤, 하나미코지, 다실',id:'Budaya geisha, Hanamikoji, rumah teh' } },
      { name:'Fushimi Inari', cls:'tag-amber', tag:{ zh:'网红打卡',en:'Instagram',ja:'インスタ映え',ko:'인스타',id:'Hits Foto' }, desc:{ zh:'千本鸟居、稻荷山徒步',en:'Thousand torii, Inari hike',ja:'千本鳥居、稲荷山',ko:'천 개 도리이, 이나리 산',id:'Seribu torii, pendakian Inari' } }
    ],
    tips: [
      { cls:'tag-blue', title:{ zh:'签证',en:'Visa',ja:'ビザ',ko:'비자',id:'Visa' }, tag:{ zh:'需提前办',en:'Apply Early',ja:'事前申請',ko:'사전 신청',id:'Ajukan Awal' }, desc:{ zh:'日本旅游签证，建议提前1个月',en:'Japan tourist visa, 1 month in advance',ja:'日本観光ビザ、1ヶ月前推奨',ko:'일본 관광 비자, 1개월 전 권장',id:'Visa wisata Jepang, 1 bulan sebelumnya' } },
      { cls:'tag-green', title:{ zh:'交通',en:'Transport',ja:'交通',ko:'교통',id:'Transportasi' }, tag:{ zh:'实用',en:'Practical',ja:'便利',ko:'실용적',id:'Praktis' }, desc:{ zh:'购ICOCA卡，公交地铁通用',en:'Get ICOCA card for bus & subway',ja:'ICOCAカード購入、バス・地下鉄共通',ko:'ICOCA 카드 구매, 버스 지하철 공통',id:'Beli kartu ICOCA untuk bus & subway' } }
    ],
    suggestions: {
      zh:[{l:'神社寺庙推荐', q:'京都最值得游览的神社和寺庙'},{l:'怀石料理', q:'京都怀石料理和传统美食餐厅推荐'},{l:'历史文化', q:'京都历史文化景点完整攻略'},{l:'预算规划', q:'两人7天京都旅行预算'}],
      en:[{l:'Shrines & temples', q:'Top Kyoto shrines and temples to visit'},{l:'Kaiseki dining', q:'Recommend Kyoto kaiseki restaurants'},{l:'History & culture', q:'Kyoto history & culture full guide'},{l:'Budget plan', q:'7-day Kyoto trip for 2 budget plan'}],
      ja:[{l:'神社·寺院', q:'京都の必見神社·寺院'},{l:'懐石料理', q:'京都の懐石料理レストランを推薦'},{l:'歴史·文化', q:'京都歴史文化完全ガイド'},{l:'予算プラン', q:'2人7日間京都予算プラン'}],
      ko:[{l:'신사·사원', q:'교토 최고의 신사와 사원'},{l:'가이세키', q:'교토 가이세키 식당 추천'},{l:'역사·문화', q:'교토 역사·문화 가이드'},{l:'예산 계획', q:'2인 7일 교토 예산'}],
      id:[{l:'Kuil & shrine', q:'Kuil & shrine terbaik di Kyoto'},{l:'Kaiseki', q:'Rekomendasi restoran kaiseki Kyoto'},{l:'Sejarah & budaya', q:'Panduan sejarah & budaya Kyoto'},{l:'Anggaran', q:'Anggaran 2 orang 7 hari Kyoto'}]
    }
  },
  paris: {
    flagFa: 'fa-paper-plane',
    titles: {
      zh:'巴黎 · 光之城<em>浪漫之旅</em>', en:'Paris · City of Light<em>Romantic Journey</em>',
      ja:'パリ · 光の都<em>ロマンチックな旅</em>', ko:'파리 · 빛의 도시<em>낭만 여행</em>', id:'Paris · Kota Cahaya<em>Perjalanan Romantis</em>'
    },
    eyebrows:{ zh:'正在规划',en:'Planning',ja:'計画中',ko:'계획 중',id:'Merencanakan' },
    weather:{ temp:'21°C', icon:'fa-cloud', cond:{ zh:'巴黎 · 部分多云',en:'Paris · Partly Cloudy',ja:'パリ · 曇り時々晴れ',ko:'파리 · 구름 조금',id:'Paris · Sebagian Berawan' }, details:'65% · 12km/h · 06:01' },
    rate: '¥1≈0.13€',
    season:{ zh:'旺季',en:'Peak Season',ja:'ピークシーズン',ko:'성수기',id:'Musim Puncak' },
    seasonDesc:{ zh:'6月最佳',en:'June — best month',ja:'6月最高',ko:'6월 최적',id:'Juni terbaik' },
    chips:{ zh:['6月 出发','7 天','2 人','¥35,000'],en:['Jun departure','7 days','2 people','$4,800'],ja:['6月出発','7日間','2人','¥35,000'],ko:['6월 출발','7일','2명','¥35,000'],id:['Berangkat Jun','7 hari','2 orang','$4.800'] },
    regions:[
      { name:'Le Marais', cls:'tag-blue', tag:{ zh:'文艺潮流',en:'Artsy',ja:'おしゃれ',ko:'예술',id:'Seni' }, desc:{ zh:'历史建筑、设计师店、画廊',en:'Historic, designer boutiques, galleries',ja:'歴史的建造物、デザイナーブティック',ko:'역사적 건축, 디자이너 부티크',id:'Arsitektur historis, butik desainer' } },
      { name:'Montmartre', cls:'tag-amber', tag:{ zh:'艺术圣地',en:'Artists Hill',ja:'芸術の丘',ko:'예술가 언덕',id:'Bukit Seniman' }, desc:{ zh:'圣心堂、艺术家广场、全景',en:'Sacré-Cœur, Place du Tertre, view',ja:'サクレクール、テルトル広場、眺望',ko:'사크레쾨르, 테르트르 광장',id:'Sacré-Cœur, Place du Tertre' } },
      { name:'Saint-Germain', cls:'tag-blue', tag:{ zh:'文学气息',en:'Literary',ja:'文学的',ko:'문학적',id:'Sastra' }, desc:{ zh:'双叟咖啡馆、书摊、塞纳河',en:'Les Deux Magots, booksellers, Seine',ja:'カフェ、古本屋、セーヌ川',ko:'카페, 헌책 서점, 센강',id:'Kafe, penjual buku, Sungai Seine' } }
    ],
    tips:[
      { cls:'tag-blue', title:{ zh:'签证',en:'Visa',ja:'ビザ',ko:'비자',id:'Visa' }, tag:{ zh:'申根',en:'Schengen',ja:'シェンゲン',ko:'솅겐',id:'Schengen' }, desc:{ zh:'申根签证，提前2个月',en:'Schengen visa, 2 months ahead',ja:'シェンゲンビザ、2ヶ月前',ko:'솅겐 비자, 2개월 전',id:'Visa Schengen, 2 bulan sebelumnya' } },
      { cls:'tag-amber', title:{ zh:'安全',en:'Safety',ja:'安全',ko:'안전',id:'Keamanan' }, tag:{ zh:'注意',en:'Warning',ja:'注意',ko:'주의',id:'Perhatian' }, desc:{ zh:'埃菲尔铁塔、卢浮宫注意扒手',en:'Watch pickpockets near Eiffel & Louvre',ja:'エッフェル・ルーブル周辺はスリ注意',ko:'에펠탑·루브르 근처 소매치기 주의',id:'Waspadai copet di Eiffel & Louvre' } }
    ],
    suggestions:{
      zh:[{l:'景点攻略', q:'巴黎主要景点参观顺序和购票攻略'},{l:'法式美食', q:'巴黎必吃法式美食和米其林推荐'},{l:'购物指南', q:'巴黎奢侈品和跳蚤市场购物攻略'},{l:'预算规划', q:'两人7天巴黎预算'}],
      en:[{l:'Sights guide', q:'Paris top sights order & ticket tips'},{l:'French cuisine', q:'Must-eat French food & Michelin picks Paris'},{l:'Shopping guide', q:'Paris luxury & flea-market shopping'},{l:'Budget plan', q:'7-day Paris trip for 2 budget'}],
      ja:[{l:'観光ガイド', q:'パリ主要観光地の順番とチケット攻略'},{l:'フランス料理', q:'パリの必食フレンチとミシュラン'},{l:'ショッピング', q:'パリのラグジュアリーと蚤の市'},{l:'予算', q:'2人7日間パリ予算'}],
      ko:[{l:'명소 가이드', q:'파리 주요 명소 순서와 티켓 팁'},{l:'프랑스 요리', q:'파리 필수 프랑스 음식과 미슐랭'},{l:'쇼핑 가이드', q:'파리 명품·벼룩시장 쇼핑'},{l:'예산', q:'2인 7일 파리 예산'}],
      id:[{l:'Panduan wisata', q:'Urutan wisata Paris & tips tiket'},{l:'Kuliner Prancis', q:'Kuliner Prancis wajib & Michelin Paris'},{l:'Belanja', q:'Belanja mewah & flea market Paris'},{l:'Anggaran', q:'Anggaran 2 orang 7 hari Paris'}]
    }
  },
  santorini: {
    flagFa: 'fa-anchor',
    titles: {
      zh:'圣托里尼 · 爱琴海<em>蓝白梦境</em>', en:'Santorini · Aegean<em>Blue & White Dream</em>',
      ja:'サントリーニ · エーゲ海<em>白と青の夢</em>', ko:'산토리니 · 에게해<em>파랑과 흰색의 꿈</em>', id:'Santorini · Laut Aegea<em>Mimpi Biru & Putih</em>'
    },
    eyebrows:{ zh:'正在规划',en:'Planning',ja:'計画中',ko:'계획 중',id:'Merencanakan' },
    weather:{ temp:'26°C', icon:'fa-sun-o', cond:{ zh:'圣托里尼 · 晴朗',en:'Santorini · Clear & Sunny',ja:'サントリーニ · 快晴',ko:'산토리니 · 맑음',id:'Santorini · Cerah' }, details:'55% · 18km/h · 06:24' },
    rate:'¥1≈0.13€', season:{ zh:'旺季',en:'Peak Season',ja:'ピーク',ko:'성수기',id:'Puncak' }, seasonDesc:{ zh:'6–8月最美',en:'Jun–Aug at peak',ja:'6〜8月最高',ko:'6~8월 최고',id:'Jun–Agu puncak' },
    chips:{ zh:['6月 出发','6 天','2 人','¥30,000'],en:['Jun departure','6 days','2 people','$4,200'],ja:['6月出発','6日間','2人','¥30,000'],ko:['6월 출발','6일','2명','¥30,000'],id:['Berangkat Jun','6 hari','2 orang','$4.200'] },
    regions:[
      { name:'Fira', cls:'tag-blue', tag:{ zh:'主要城镇',en:'Main Town',ja:'メイン',ko:'주요',id:'Utama' }, desc:{ zh:'悬崖首府，精品店、全景餐厅',en:'Clifftop capital, boutiques, panoramic dining',ja:'断崖の州都、ブティック、パノラマレストラン',ko:'절벽 수도, 부티크, 파노라마 식당',id:'Ibu kota tebing, butik, restoran panoramik' } },
      { name:'Oia', cls:'tag-amber', tag:{ zh:'最美日落',en:'Best Sunset',ja:'最高夕日',ko:'최고 일몰',id:'Sunset Terbaik' }, desc:{ zh:'世界最美日落，蓝顶教堂',en:'World famous sunset, blue domes',ja:'世界一の夕日、青いドーム',ko:'세계 최고 일몰, 파란 돔',id:'Sunset terbaik dunia, kubah biru' } },
      { name:'Perissa', cls:'tag-green', tag:{ zh:'黑沙滩',en:'Black Sand',ja:'黒砂',ko:'검은 모래',id:'Pasir Hitam' }, desc:{ zh:'火山黑沙滩、水上活动',en:'Volcanic black sand, water sports',ja:'火山性黒砂、ウォータースポーツ',ko:'화산 검은 모래, 수상 활동',id:'Pasir hitam vulkanik, olahraga air' } }
    ],
    tips:[
      { cls:'tag-blue', title:{ zh:'签证',en:'Visa',ja:'ビザ',ko:'비자',id:'Visa' }, tag:{ zh:'申根',en:'Schengen',ja:'シェンゲン',ko:'솅겐',id:'Schengen' }, desc:{ zh:'申根签证，提前2个月',en:'Schengen visa, 2 months ahead',ja:'シェンゲン、2ヶ月前',ko:'솅겐, 2개월 전',id:'Schengen, 2 bulan' } },
      { cls:'tag-green', title:{ zh:'岛内交通',en:'Island Transport',ja:'島内交通',ko:'섬 교통',id:'Transport Pulau' }, tag:{ zh:'实用',en:'Practical',ja:'便利',ko:'실용',id:'Praktis' }, desc:{ zh:'巴士+ATV最灵活，约€20/天',en:'Bus + ATV most flexible, ~€20/day',ja:'バス+ATV、€20/日',ko:'버스+ATV, €20/일',id:'Bus+ATV paling fleksibel, €20/hari' } }
    ],
    suggestions:{
      zh:[{l:'日落攻略', q:'圣托里尼最佳日落观赏地点和拍摄技巧'},{l:'出海游览', q:'圣托里尼火山岛出海一日游攻略'},{l:'希腊美食', q:'圣托里尼特色希腊美食'},{l:'拍照打卡', q:'圣托里尼最佳拍照地点和时间'}],
      en:[{l:'Sunset guide', q:'Best Santorini sunset spots & photo tips'},{l:'Sea tour', q:'Santorini volcano sea tour guide'},{l:'Greek food', q:'Santorini Greek specialties'},{l:'Photo spots', q:'Best Santorini photo spots & timing'}],
      ja:[{l:'夕日ガイド', q:'サントリーニ最高の夕日スポットと撮影'},{l:'クルーズ', q:'サントリーニ火山島クルーズ攻略'},{l:'ギリシャ料理', q:'サントリーニのギリシャ料理'},{l:'撮影スポット', q:'サントリーニ撮影スポットとタイミング'}],
      ko:[{l:'일몰 가이드', q:'산토리니 최고 일몰 명소와 사진 팁'},{l:'세일링', q:'산토리니 화산섬 세일링 가이드'},{l:'그리스 음식', q:'산토리니 그리스 특선 요리'},{l:'사진 명소', q:'산토리니 사진 명소와 시간'}],
      id:[{l:'Sunset guide', q:'Spot sunset terbaik Santorini & tips foto'},{l:'Sea tour', q:'Panduan tur laut gunung berapi Santorini'},{l:'Kuliner Yunani', q:'Hidangan khas Yunani di Santorini'},{l:'Spot foto', q:'Spot foto terbaik & waktunya Santorini'}]
    }
  },
  any: {
    flagFa: 'fa-globe',
    titles:{ zh:'任意目的地<em>定制规划</em>',en:'Any Destination<em>Custom Planning</em>',ja:'任意の目的地<em>カスタム企画</em>',ko:'모든 목적지<em>맞춤 계획</em>',id:'Destinasi Apa Saja<em>Perencanaan Kustom</em>' },
    eyebrows:{ zh:'告诉我你想去哪里',en:'Tell me where',ja:'行きたい場所を教えて',ko:'어디로 가고 싶나요',id:'Beri tahu tujuanmu' },
    weather:{ temp:'—', icon:'fa-compass', cond:{ zh:'输入目的地后激活',en:'Enter a destination',ja:'目的地を入力',ko:'목적지 입력',id:'Masukkan tujuan' }, details:'—' },
    rate:'—', season:{ zh:'—',en:'—',ja:'—',ko:'—',id:'—' }, seasonDesc:{ zh:'',en:'',ja:'',ko:'',id:'' },
    chips:{ zh:['未设置','—','—','—'],en:['Unset','—','—','—'],ja:['未設定','—','—','—'],ko:['미설정','—','—','—'],id:['Belum diset','—','—','—'] },
    regions:[],
    tips:[
      { cls:'tag-blue', title:{ zh:'告诉我目的地',en:'Tell me where',ja:'目的地を教えて',ko:'목적지를 알려주세요',id:'Beri tahu tujuanmu' }, tag:{ zh:'开始',en:'Start',ja:'スタート',ko:'시작',id:'Mulai' }, desc:{ zh:'我可以为全球任何城市规划行程',en:'I can plan trips to any city in the world',ja:'世界のどの都市の旅程も計画できます',ko:'세계 어느 도시든 여행 계획 가능',id:'Saya bisa merencanakan perjalanan ke kota mana pun' } }
    ],
    suggestions:{
      zh:[{l:'冰岛极光', q:'冰岛极光观赏7日完整规划'},{l:'摩洛哥沙漠', q:'摩洛哥撒哈拉沙漠经典路线'},{l:'秘鲁马丘比丘', q:'秘鲁马丘比丘印加古道徒步'},{l:'埃及金字塔', q:'埃及金字塔历史文化7日'}],
      en:[{l:'Iceland aurora', q:'7-day Iceland aurora viewing plan'},{l:'Morocco desert', q:'Morocco Sahara classic route'},{l:'Machu Picchu', q:'Inca Trail to Machu Picchu trek'},{l:'Egypt pyramids', q:'Egypt pyramid history 7-day'}],
      ja:[{l:'アイスランドオーロラ', q:'アイスランドオーロラ7日プラン'},{l:'モロッコ砂漠', q:'モロッコ・サハラ砂漠の定番ルート'},{l:'マチュピチュ', q:'インカ道マチュピチュトレッキング'},{l:'エジプトピラミッド', q:'エジプトピラミッド歴史7日'}],
      ko:[{l:'아이슬란드 오로라', q:'아이슬란드 오로라 7일 계획'},{l:'모로코 사막', q:'모로코 사하라 클래식 루트'},{l:'마추픽추', q:'잉카 트레일 마추픽추 트레킹'},{l:'이집트 피라미드', q:'이집트 피라미드 역사 7일'}],
      id:[{l:'Aurora Islandia', q:'Rencana 7 hari melihat aurora di Islandia'},{l:'Padang pasir Maroko', q:'Rute klasik gurun Sahara Maroko'},{l:'Machu Picchu', q:'Trekking Jalur Inca ke Machu Picchu'},{l:'Piramida Mesir', q:'Sejarah piramida Mesir 7 hari'}]
    }
  }
};

/* ─────────────────── i18n strings for the AI tool page ─────────────────── */
const TOOL_I18N = {
  zh: {
    topChat:'AI 对话', topItinerary:'行程规划', topMap:'探索地图', topBudget:'预算管理', topDiary:'游记生成',
    sideMyTrips:'我的行程', sideNewTrip:'＋ 新建行程', sideAgents:'智能体团队',
    tripEmpty:'还没有行程<br>点击下方新建一个',
    askAll:'问全队', modePrecise:'精准', modeFast:'快速',
    quickMultiverse:'平行宇宙预览', quickMap:'探索地图', quickBudgetCalc:'预算计算器',
    quickItinerary:'生成完整行程', quickLatest:'最新资讯', quickHotels:'住宿推荐',
    inputPh:'告诉我你想去哪里 · 想要什么样的体验…',
    panelDest:'目的地', panelCompare:'比价', panelItinerary:'行程', panelBudget:'预算', panelLog:'日志',
    sectionWeather:'实时情报', sectionRegions:'热门区域', sectionTips:'实用贴士',
    rateLbl:'实时汇率', seasonLbl:'季节',
    comingTitle:'即将在 Phase 2 上线',
    comingDesc:'此模块功能正在迁移中，将与现有 H5 完全等价但视觉为 Studio 风格。',
    greetTitle:'你好，旅行者 👋', greetSub:'我是 WanderMind 旅程规划师 —— 告诉我你想去哪里、什么时候、和谁一起，我会和我的 5 个 AI 同事联手为你设计完整方案。',
    toastPhase2:'此功能将在 Phase 2 上线',
    welcomeUnknown:'欢迎选择目的地开始规划。',
    sendErr:'抱歉，请求出错了。请稍后重试或检查后端是否在线。'
  },
  en: {
    topChat:'Chat', topItinerary:'Itinerary', topMap:'Map', topBudget:'Budget', topDiary:'Diary',
    sideMyTrips:'My Trips', sideNewTrip:'+ New Trip', sideAgents:'Agent Team',
    tripEmpty:'No trips yet<br>Click below to create one',
    askAll:'Ask the Team', modePrecise:'Precise', modeFast:'Fast',
    quickMultiverse:'Multiverse Preview', quickMap:'Explore Map', quickBudgetCalc:'Budget Calculator',
    quickItinerary:'Generate Full Itinerary', quickLatest:'Latest News', quickHotels:'Hotel Picks',
    inputPh:'Tell me where you want to go · what kind of experience…',
    panelDest:'Place', panelCompare:'Compare', panelItinerary:'Plan', panelBudget:'Budget', panelLog:'Log',
    sectionWeather:'Live Intel', sectionRegions:'Top Areas', sectionTips:'Practical Tips',
    rateLbl:'Live FX', seasonLbl:'Season',
    comingTitle:'Coming in Phase 2',
    comingDesc:'This module is being migrated — full feature parity with the existing H5, restyled to Studio.',
    greetTitle:'Hello traveller 👋', greetSub:'I am the WanderMind Trip Planner. Tell me where, when and with whom — my five AI colleagues and I will draft a complete plan together.',
    toastPhase2:'This feature lands in Phase 2',
    welcomeUnknown:'Pick a destination to start planning.',
    sendErr:'Sorry, the request failed. Please retry or check that the backend is online.'
  },
  ja: {
    topChat:'チャット', topItinerary:'旅程', topMap:'地図', topBudget:'予算', topDiary:'紀行',
    sideMyTrips:'マイトリップ', sideNewTrip:'＋ 新規旅行', sideAgents:'エージェントチーム',
    tripEmpty:'まだ旅行がありません<br>下のボタンで作成',
    askAll:'チームに聞く', modePrecise:'精密', modeFast:'高速',
    quickMultiverse:'パラレルプレビュー', quickMap:'地図を探索', quickBudgetCalc:'予算計算機',
    quickItinerary:'フル旅程生成', quickLatest:'最新情報', quickHotels:'宿泊おすすめ',
    inputPh:'行きたい場所·体験を教えて…',
    panelDest:'目的地', panelCompare:'比較', panelItinerary:'旅程', panelBudget:'予算', panelLog:'ログ',
    sectionWeather:'リアル情報', sectionRegions:'人気エリア', sectionTips:'実用ヒント',
    rateLbl:'為替', seasonLbl:'シーズン',
    comingTitle:'Phase 2 で公開予定',
    comingDesc:'このモジュールは移行中です。既存H5と機能同等、Studio風にリスタイル。',
    greetTitle:'こんにちは、旅人 👋', greetSub:'私はWanderMind旅程プランナーです。行きたい場所·時期·同行者を教えて。5人のAI同僚と一緒に完全プランを設計します。',
    toastPhase2:'この機能はPhase 2で公開',
    welcomeUnknown:'目的地を選んで計画を開始。',
    sendErr:'リクエストに失敗しました。バックエンドの状態を確認してください。'
  },
  ko: {
    topChat:'챗', topItinerary:'일정', topMap:'지도', topBudget:'예산', topDiary:'기행문',
    sideMyTrips:'내 여행', sideNewTrip:'＋ 새 여행', sideAgents:'에이전트 팀',
    tripEmpty:'아직 여행이 없습니다<br>아래에서 만들기',
    askAll:'팀에 묻기', modePrecise:'정밀', modeFast:'빠름',
    quickMultiverse:'평행 우주 미리보기', quickMap:'지도 탐색', quickBudgetCalc:'예산 계산기',
    quickItinerary:'전체 일정 생성', quickLatest:'최신 정보', quickHotels:'숙소 추천',
    inputPh:'어디로 가고 싶은지·어떤 경험을…',
    panelDest:'목적지', panelCompare:'비교', panelItinerary:'일정', panelBudget:'예산', panelLog:'로그',
    sectionWeather:'실시간 정보', sectionRegions:'인기 지역', sectionTips:'실용 팁',
    rateLbl:'환율', seasonLbl:'시즌',
    comingTitle:'Phase 2 출시 예정',
    comingDesc:'이 모듈은 마이그레이션 중. 기존 H5와 동등하며 Studio 스타일.',
    greetTitle:'안녕하세요, 여행자 👋', greetSub:'저는 WanderMind 여행 플래너입니다. 어디로, 언제, 누구와 — 5명의 AI 동료와 함께 완전한 계획을 설계합니다.',
    toastPhase2:'이 기능은 Phase 2에서 제공',
    welcomeUnknown:'계획을 시작할 목적지를 선택하세요.',
    sendErr:'요청 실패. 백엔드 상태를 확인하세요.'
  },
  id: {
    topChat:'Chat', topItinerary:'Rencana', topMap:'Peta', topBudget:'Anggaran', topDiary:'Cerita',
    sideMyTrips:'Perjalanan Saya', sideNewTrip:'＋ Perjalanan Baru', sideAgents:'Tim Agen',
    tripEmpty:'Belum ada perjalanan<br>Klik di bawah untuk membuat',
    askAll:'Tanya Tim', modePrecise:'Presisi', modeFast:'Cepat',
    quickMultiverse:'Pratinjau Paralel', quickMap:'Jelajah Peta', quickBudgetCalc:'Kalkulator Anggaran',
    quickItinerary:'Buat Rencana Penuh', quickLatest:'Berita Terbaru', quickHotels:'Pilihan Hotel',
    inputPh:'Beri tahu kemana & pengalaman seperti apa…',
    panelDest:'Tempat', panelCompare:'Banding', panelItinerary:'Rencana', panelBudget:'Anggaran', panelLog:'Log',
    sectionWeather:'Info Langsung', sectionRegions:'Area Populer', sectionTips:'Tips Praktis',
    rateLbl:'Kurs', seasonLbl:'Musim',
    comingTitle:'Hadir di Fase 2',
    comingDesc:'Modul ini sedang dimigrasikan — fitur setara H5, gaya Studio.',
    greetTitle:'Halo traveler 👋', greetSub:'Saya Perencana WanderMind. Beri tahu ke mana, kapan, dengan siapa — bersama 5 rekan AI saya, kami buat rencana lengkap.',
    toastPhase2:'Fitur ini hadir di Fase 2',
    welcomeUnknown:'Pilih tujuan untuk mulai merencanakan.',
    sendErr:'Permintaan gagal. Periksa apakah backend online.'
  }
};

/* ─────────────────── STATE ─────────────────── */
let currentLang = localStorage.getItem('wm_studio_lang') || 'en';
let currentDest = localStorage.getItem('wm_studio_dest') || 'bali';
let currentAgent = 'planner';
let currentMode = localStorage.getItem('wm_studio_mode') || 'precise';
let messages = []; // {role:'user'|'ai'|'system', agent, text, ts}
let isSending = false;
let sessionId = localStorage.getItem('wm_studio_session') || ('anon_' + Math.random().toString(36).slice(2, 11));
localStorage.setItem('wm_studio_session', sessionId);

/* ─────────────────── HELPERS ─────────────────── */
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
function t() { return TOOL_I18N[currentLang] || TOOL_I18N.en; }
function dest() { return DESTS[currentDest] || DESTS.bali; }
function agent() { return AGENTS[currentAgent]; }
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function showToast(msg, icon = 'fa-info-circle') {
  let el = $('#ws-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ws-toast';
    el.className = 'ws-toast';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span class="fa ${icon}"></span><span>${escapeHtml(msg)}</span>`;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ─────────────────── RENDER: top tabs / sidebar / header ─────────────────── */
function renderTopTabs() {
  const tabs = [
    { id:'chat',      icon:'fa-comments-o',  label: t().topChat },
    { id:'itinerary', icon:'fa-calendar-o',  label: t().topItinerary },
    { id:'map',       icon:'fa-map-marker',  label: t().topMap },
    { id:'budget',    icon:'fa-credit-card', label: t().topBudget },
    { id:'diary',     icon:'fa-book',        label: t().topDiary }
  ];
  $('#ws-top-tabs').innerHTML = tabs.map((tab, i) => `
    <button class="ws-top-tab ${i === 0 ? 'active' : ''}" data-toptab="${tab.id}">
      <span class="fa ${tab.icon}"></span>
      <span>${escapeHtml(tab.label)}</span>
    </button>
  `).join('');
  $$('#ws-top-tabs .ws-top-tab').forEach(btn => {
    btn.onclick = () => handleTopTab(btn.dataset.toptab, btn);
  });
}

function handleTopTab(id, btn) {
  $$('#ws-top-tabs .ws-top-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (id === 'chat') {
    switchPanelTab('dest');
  } else if (id === 'itinerary') {
    switchPanelTab('itinerary');
  } else if (id === 'map') {
    openMapModal();
  } else if (id === 'budget') {
    switchPanelTab('budget');
  } else if (id === 'diary') {
    generateDiary();
  }
}

function renderSidebar() {
  // Trips
  $('#ws-trip-title').textContent = t().sideMyTrips;
  $('#ws-trip-empty').innerHTML = t().tripEmpty;
  $('#ws-newtrip-label').textContent = t().sideNewTrip;
  $('#ws-agents-title').textContent = t().sideAgents;

  const agentList = $('#ws-agent-list');
  agentList.innerHTML = Object.keys(AGENTS).map(key => {
    const a = AGENTS[key];
    return `
      <div class="ws-agent-item ${key === currentAgent ? 'active' : ''}" data-agent="${key}">
        <div class="ws-agent-icon ${a.cls}"><span class="fa ${a.icon}"></span></div>
        <div class="ws-agent-meta">
          <div class="ws-agent-name">${escapeHtml(AGENT_NAMES[currentLang][key])}</div>
          <div class="ws-agent-role">${escapeHtml(AGENT_ROLES[currentLang][key])}</div>
        </div>
      </div>
    `;
  }).join('');
  $$('#ws-agent-list .ws-agent-item').forEach(el => {
    el.onclick = () => switchAgent(el.dataset.agent);
  });
}

function renderChatHeader() {
  const d = dest();
  $('#ws-dest-eyebrow').innerHTML = `<span class="fa ${d.flagFa}"></span> ${escapeHtml(d.eyebrows[currentLang] || d.eyebrows.en)}`;
  $('#ws-dest-title').innerHTML = d.titles[currentLang] || d.titles.en;

  const chips = d.chips[currentLang] || d.chips.en;
  $('#ws-dest-chips').innerHTML = chips.map(c => `<span class="ws-dest-chip">${escapeHtml(c)}</span>`).join('');

  // destination switcher pills
  const dests = ['bali','kyoto','paris','santorini','any'];
  const labels = {
    bali:{ zh:'巴厘岛',en:'Bali',ja:'バリ',ko:'발리',id:'Bali' },
    kyoto:{ zh:'京都',en:'Kyoto',ja:'京都',ko:'교토',id:'Kyoto' },
    paris:{ zh:'巴黎',en:'Paris',ja:'パリ',ko:'파리',id:'Paris' },
    santorini:{ zh:'圣托里尼',en:'Santorini',ja:'サントリーニ',ko:'산토리니',id:'Santorini' },
    any:{ zh:'其他',en:'Any',ja:'その他',ko:'기타',id:'Lainnya' }
  };
  $('#ws-dest-switch').innerHTML = dests.map(k => `
    <button class="ws-dest-pill ${k === currentDest ? 'active' : ''}" data-dest="${k}">
      <span class="fa ${DESTS[k].flagFa}"></span> ${escapeHtml(labels[k][currentLang] || labels[k].en)}
    </button>
  `).join('');
  $$('#ws-dest-switch .ws-dest-pill').forEach(p => {
    p.onclick = () => switchDest(p.dataset.dest);
  });
}

function renderControlsAndQuick() {
  $('#ws-askall').innerHTML = `<span class="fa fa-bolt"></span> ${escapeHtml(t().askAll)}`;
  $('#ws-mode-label').textContent = currentMode === 'precise' ? t().modePrecise : t().modeFast;

  // Quick buttons (6 from the H5 quickBtns array)
  const quicks = [
    { icon:'fa-clone',        label: t().quickMultiverse,  action: 'multiverse' },
    { icon:'fa-map-marker',   label: t().quickMap,         action: 'map' },
    { icon:'fa-calculator',   label: t().quickBudgetCalc,  action: 'budgetcalc' },
    { icon:'fa-calendar-o',   label: t().quickItinerary,   action: 'itinerary' },
    { icon:'fa-rss',          label: t().quickLatest,      action: 'latest' },
    { icon:'fa-bed',          label: t().quickHotels,      action: 'hotels' }
  ];
  $('#ws-quick-row').innerHTML = quicks.map(q => `
    <button class="ws-quick-btn" data-quick="${q.action}">
      <span class="fa ${q.icon}"></span> ${escapeHtml(q.label)}
    </button>
  `).join('');
  $$('#ws-quick-row .ws-quick-btn').forEach(b => {
    b.onclick = () => handleQuick(b.dataset.quick);
  });

  $('#ws-input').placeholder = t().inputPh;
}

function handleQuick(action) {
  if (action === 'itinerary') {
    switchPanelTab('itinerary');
    addLog('info', 'fa-calendar-o', t().logJumpItin);
    return;
  }
  if (action === 'map') { openMapModal(); return; }
  if (action === 'budgetcalc') { switchPanelTab('budget'); addLog('info', 'fa-credit-card', t().logJumpBudget); return; }
  if (action === 'multiverse') {
    const queries = { zh:'帮我生成本目的地 3 个预算档（节俭/舒适/奢享）的对比方案', en:'Generate 3 budget-tier comparison plans (thrifty/comfort/luxury) for this destination', ja:'本目的地の3予算プラン（節約/快適/豪華）を比較生成', ko:'이 목적지의 3가지 예산 계획 (절약/편안/럭셔리) 비교 생성', id:'Buat 3 rencana perbandingan anggaran (hemat/nyaman/mewah) untuk tujuan ini' };
    sendMessage(queries[currentLang] || queries.en);
    return;
  }
  if (action === 'hotels') {
    switchPanelTab('compare');
    setTimeout(() => switchCompareSub('hotels'), 80);
    return;
  }
  if (action === 'latest') {
    const queries = { zh:'查询此目的地最新的旅游资讯、天气和签证政策', en:'Look up the latest travel news, weather and visa policy for this destination', ja:'この目的地の最新旅行情報·天気·ビザ政策を調べて', ko:'이 목적지의 최신 여행 정보·날씨·비자 정책을 조회', id:'Cari berita perjalanan, cuaca, dan kebijakan visa terbaru untuk tujuan ini' };
    sendMessage(queries[currentLang] || queries.en);
    return;
  }
}

/* ─────────────────── RIGHT PANEL ─────────────────── */
function renderPanelTabs() {
  const panelTabs = [
    { id:'dest',      icon:'fa-compass',     label: t().panelDest },
    { id:'compare',   icon:'fa-balance-scale', label: t().panelCompare },
    { id:'itinerary', icon:'fa-calendar-o',  label: t().panelItinerary },
    { id:'budget',    icon:'fa-credit-card', label: t().panelBudget },
    { id:'log',       icon:'fa-list-alt',    label: t().panelLog }
  ];
  $('#ws-panel-tabs').innerHTML = panelTabs.map((p, i) => `
    <button class="ws-panel-tab ${i === 0 ? 'active' : ''}" data-paneltab="${p.id}">
      <span class="fa ${p.icon}"></span>
      <span>${escapeHtml(p.label)}</span>
    </button>
  `).join('');
  $$('#ws-panel-tabs .ws-panel-tab').forEach(t => {
    t.onclick = () => switchPanelTab(t.dataset.paneltab);
  });
}

function switchPanelTab(id) {
  $$('#ws-panel-tabs .ws-panel-tab').forEach(t => t.classList.toggle('active', t.dataset.paneltab === id));
  $$('.ws-panel-content').forEach(c => c.classList.toggle('active', c.dataset.panel === id));
}

function renderPanelDest() {
  const d = dest();
  const w = d.weather;
  $('#ws-section-weather').textContent = t().sectionWeather;
  $('#ws-section-regions').textContent = t().sectionRegions;
  $('#ws-section-tips').textContent = t().sectionTips;
  $('#ws-rate-lbl').textContent = t().rateLbl;
  $('#ws-season-lbl').textContent = t().seasonLbl;

  $('#ws-w-temp').textContent = w.temp;
  $('#ws-w-cond').textContent = w.cond[currentLang] || w.cond.en;
  $('#ws-w-icon').className = 'ws-weather-icon fa ' + w.icon;
  $('#ws-w-details').textContent = w.details;
  $('#ws-s-rate').textContent = d.rate;
  $('#ws-s-season').textContent = d.season[currentLang] || d.season.en;

  // Regions
  $('#ws-region-list').innerHTML = (d.regions || []).map(r => `
    <div class="ws-region-card" data-region="${escapeHtml(r.name)}">
      <div class="ws-region-head">
        <span class="ws-region-name">${escapeHtml(r.name)}</span>
        <span class="ws-region-tag ${r.cls}">${escapeHtml(r.tag[currentLang] || r.tag.en)}</span>
      </div>
      <div class="ws-region-desc">${escapeHtml(r.desc[currentLang] || r.desc.en)}</div>
    </div>
  `).join('') || `<div class="ws-coming" style="padding:20px"><p>—</p></div>`;
  $$('#ws-region-list .ws-region-card').forEach(c => {
    c.onclick = () => {
      const queries = { zh:`深入介绍${c.dataset.region}的景点、住宿、美食和活动`, en:`Tell me about ${c.dataset.region}: sights, stays, food, activities`, ja:`${c.dataset.region}の観光·宿泊·グルメ·アクティビティを詳しく`, ko:`${c.dataset.region}의 명소·숙박·음식·활동을 상세히`, id:`Ceritakan ${c.dataset.region}: wisata, akomodasi, kuliner, aktivitas` };
      sendMessage(queries[currentLang] || queries.en);
    };
  });

  // Tips
  $('#ws-tip-list').innerHTML = (d.tips || []).map(tip => `
    <div class="ws-tip ${tip.driver ? 'driver' : ''}">
      <div class="ws-tip-head">
        <span class="ws-tip-title">${escapeHtml(tip.title[currentLang] || tip.title.en)}</span>
        <span class="ws-tip-tag ${tip.cls}">${escapeHtml(tip.tag[currentLang] || tip.tag.en)}</span>
      </div>
      <div class="ws-tip-desc">${escapeHtml(tip.desc[currentLang] || tip.desc.en)}</div>
    </div>
  `).join('');
}

function renderPanelComing(panelId, iconClass, titleSuffix) {
  $(`.ws-panel-content[data-panel="${panelId}"]`).innerHTML = `
    <div class="ws-coming">
      <span class="fa ${iconClass}"></span>
      <h4>${escapeHtml(t().comingTitle)} · ${escapeHtml(titleSuffix)}</h4>
      <p>${escapeHtml(t().comingDesc)}</p>
    </div>
  `;
}

/* ─────────────────── MESSAGES ─────────────────── */
function renderMessages() {
  const wrap = $('#ws-messages');
  if (messages.length === 0) {
    wrap.innerHTML = `
      <div class="ws-msg ai">
        <div class="ws-msg-avatar ws-agent-icon ${AGENTS.planner.cls}"><span class="fa ${AGENTS.planner.icon}"></span></div>
        <div>
          <div class="ws-msg-meta">${escapeHtml(AGENT_NAMES[currentLang].planner)}</div>
          <div class="ws-msg-body"><strong>${escapeHtml(t().greetTitle)}</strong><br><br>${escapeHtml(t().greetSub)}</div>
        </div>
      </div>
    `;
    return;
  }
  wrap.innerHTML = messages.map(m => {
    if (m.role === 'system') {
      return `<div class="ws-msg system"><div class="ws-msg-body">${escapeHtml(m.text)}</div></div>`;
    }
    if (m.role === 'user') {
      return `
        <div class="ws-msg user">
          <div class="ws-msg-avatar"><span class="fa fa-user"></span></div>
          <div>
            <div class="ws-msg-body">${escapeHtml(m.text).replace(/\n/g,'<br>')}</div>
          </div>
        </div>
      `;
    }
    // AI message
    const ag = AGENTS[m.agent] || AGENTS.planner;
    const name = AGENT_NAMES[currentLang][m.agent] || AGENT_NAMES[currentLang].planner;
    let body;
    if (m.text === '__typing__') {
      body = `<div class="ws-msg-typing"><span></span><span></span><span></span></div>`;
    } else {
      body = escapeHtml(m.text).replace(/\n/g, '<br>');
    }
    return `
      <div class="ws-msg ai">
        <div class="ws-msg-avatar ws-agent-icon ${ag.cls}"><span class="fa ${ag.icon}"></span></div>
        <div>
          <div class="ws-msg-meta">${escapeHtml(name)}</div>
          <div class="ws-msg-body">${body}</div>
        </div>
      </div>
    `;
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

function pushMsg(m) {
  messages.push(m);
  renderMessages();
}

/* ─────────────────── SEND TO BACKEND ─────────────────── */
async function sendMessage(text) {
  text = (text || $('#ws-input').value).trim();
  if (!text || isSending) return;
  $('#ws-input').value = '';
  $('#ws-input').style.height = '46px';
  isSending = true;
  $('#ws-send-btn').disabled = true;

  pushMsg({ role:'user', text, ts: Date.now() });
  const aiPlaceholder = { role:'ai', agent: currentAgent, text:'__typing__', ts: Date.now() };
  pushMsg(aiPlaceholder);

  try {
    const r = await fetch(BACKEND_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        agent: currentAgent,
        destination: currentDest,
        lang: currentLang,
        mode: currentMode,
        session_id: sessionId,
        history: messages.filter(m => m.role !== 'system' && m.text !== '__typing__').slice(-12).map(m => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text
        }))
      })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const reply = (data && (data.reply || data.message || data.content)) || (t().sendErr);
    // Replace typing placeholder
    const idx = messages.indexOf(aiPlaceholder);
    if (idx >= 0) messages[idx] = { role:'ai', agent: currentAgent, text: reply, ts: Date.now() };
    renderMessages();
  } catch (err) {
    console.error('[ai-tool] chat failed', err);
    const idx = messages.indexOf(aiPlaceholder);
    const errMsg = t().sendErr + ' (' + (err.message || err) + ')';
    if (idx >= 0) messages[idx] = { role:'system', text: errMsg, ts: Date.now() };
    renderMessages();
  } finally {
    isSending = false;
    $('#ws-send-btn').disabled = false;
    $('#ws-input').focus();
  }
}

/* ─────────────────── SWITCHERS ─────────────────── */
function switchAgent(key) {
  if (!AGENTS[key]) return;
  currentAgent = key;
  $$('#ws-agent-list .ws-agent-item').forEach(el => el.classList.toggle('active', el.dataset.agent === key));
}

function switchDest(key) {
  if (!DESTS[key]) return;
  currentDest = key;
  localStorage.setItem('wm_studio_dest', key);
  renderChatHeader();
  renderPanelDest();
}

function toggleMode() {
  currentMode = currentMode === 'precise' ? 'fast' : 'precise';
  localStorage.setItem('wm_studio_mode', currentMode);
  $('#ws-mode-label').textContent = currentMode === 'precise' ? t().modePrecise : t().modeFast;
}

/* ─────────────────── LANGUAGE INTEGRATION ─────────────────── */
// Hook into the existing Studio i18n.js: listen for its language change & re-render
function onLangChange(newLang) {
  currentLang = newLang;
  renderTopTabs();
  renderSidebar();
  renderChatHeader();
  renderControlsAndQuick();
  renderPanelTabs();
  renderPanelDest();
  renderPanelCompare();
  renderPanelItinerary();
  renderPanelBudget();
  renderPanelLog();
  renderMessages();
}

/* Watch the lang picker (i18n.js writes localStorage on change) */
function attachLangWatcher() {
  const picker = document.getElementById('langPicker');
  if (picker) {
    picker.addEventListener('change', () => {
      setTimeout(() => onLangChange(picker.value), 50);
    });
  }
  // also poll storage in case another tab changed it
  window.addEventListener('storage', e => {
    if (e.key === 'wm_studio_lang' && e.newValue && e.newValue !== currentLang) onLangChange(e.newValue);
  });
}

/* ─────────────────── INIT ─────────────────── */
function init() {
  renderTopTabs();
  renderSidebar();
  renderChatHeader();
  renderControlsAndQuick();
  renderPanelTabs();
  renderPanelDest();
  renderPanelCompare();
  renderPanelItinerary();
  renderPanelBudget();
  renderPanelLog();
  renderMessages();

  // Wire input
  const input = $('#ws-input');
  input.addEventListener('input', () => {
    input.style.height = '46px';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  $('#ws-send-btn').onclick = () => sendMessage();
  $('#ws-mode-toggle').onclick = toggleMode;
  $('#ws-askall').onclick = askTeam;
  $('#ws-newtrip-btn').onclick = () => showToast(t().toastPhase3 + ' · ' + t().sideNewTrip, 'fa-plus-circle');

  // Seed first log
  addLog('info', 'fa-power-off', t().logBooted);

  // Mobile drawers
  const mLeftBtn = document.getElementById('ws-mob-left');
  const mRightBtn = document.getElementById('ws-mob-right');
  if (mLeftBtn) mLeftBtn.onclick = () => document.querySelector('.ws-sidebar').classList.toggle('mobile-open');
  if (mRightBtn) mRightBtn.onclick = () => document.querySelector('.ws-rightpanel').classList.toggle('mobile-open');

  attachLangWatcher();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ═══════════════════════════════════════════════════════════════════════
   PHASE 2 EXTENSIONS — Compare / Itinerary / Budget / Log / Modals
   ═══════════════════════════════════════════════════════════════════════ */

/* —— Phase 2 i18n additions —— */
Object.assign(TOOL_I18N.en, {
  toastPhase3:'This feature lands in Phase 3',
  // Compare
  compareSubHotels:'Hotels', compareSubFlights:'Flights',
  hotelAreaLabel:'Stay area', hotelCheckIn:'Check-in', hotelCheckOut:'Check-out', hotelAdults:'Adults', hotelSearchBtn:'Find hotels',
  hotelSearching:'Searching hotels…', hotelNoResults:'No hotels found — try different dates.',
  hotelBookBtn:'Book',
  flightTripRound:'Round-trip', flightTripOneway:'One-way',
  flightFrom:'From', flightDepart:'Depart', flightReturn:'Return', flightAdults:'Adults', flightSearchBtn:'Find flights',
  flightSearching:'Searching flights…', flightNoResults:'No flights found — try different dates.',
  flightDirect:'Direct', flightStops1:'1 stop', flightStops2:'2 stops',
  flightOriginPrompt:'Pick or type your origin city / IATA code (e.g. PVG, LAX, LHR)',
  flightFromCustom:'Custom city / code…',
  // Itinerary
  itinHeading:'Day-by-day plan', itinAiBtn:'AI deep-customize itinerary', itinExportBtn:'Export to PDF',
  itinEmpty:'No itinerary available — start a chat to plan one.',
  // Budget
  budgetTotal:'Estimated total', budgetSub:'2 people · 7 days · personalised',
  budgetCatLodging:'Lodging', budgetCatFood:'Food', budgetCatTransport:'Transport', budgetCatActivities:'Activities', budgetCatMisc:'Miscellaneous',
  budgetNoteLodging:'Mid-range hotel · breakfast included', budgetNoteFood:'Mix of local + 2 nice dinners',
  budgetNoteTransport:'Local transit + airport transfers', budgetNoteActivities:'2-3 paid experiences',
  budgetNoteMisc:'Tips, SIM, contingency',
  // Log
  logTitle:'Activity log', logEmpty:'No activity yet.', logClear:'Clear',
  logBooted:'AI Tool ready. <strong>6 agents</strong> standing by.',
  logChatSent:'Sent question to <strong>{agent}</strong>', logChatRecv:'Reply received from <strong>{agent}</strong> · {n} chars',
  logSwitchDest:'Switched destination to <strong>{dest}</strong>',
  logSwitchAgent:'Switched to <strong>{agent}</strong>',
  logHotelSearch:'Searching hotels in <strong>{dest}</strong>', logHotelDone:'Found <strong>{n}</strong> hotels',
  logFlightSearch:'Searching flights <strong>{o} → {d}</strong>', logFlightDone:'Found <strong>{n}</strong> flights',
  logJumpItin:'Opened itinerary panel', logJumpBudget:'Opened budget panel',
  logAskTeam:'Broadcasting to the AI team…', logAskTeamDone:'Team consensus received · {n} chars',
  logMapOpen:'Opened explore map', logDiaryStart:'Generating travel diary from chat history…', logDiaryDone:'Travel diary ready · {n} chars',
  logItinAi:'Requesting deep-customized itinerary…', logItinDone:'AI itinerary ready · {n} chars',
  logExportPdf:'Opening PDF export dialog',
  // Modals
  mapTitle:'Explore map', mapClose:'Close',
  mapRegionHeading:'Regions in {dest}',
  diaryTitle:'Travel diary', diaryClose:'Close', diarySaveBtn:'Save as PDF',
  diaryNeedChat:'Start a chat first — your diary draws on the journey we plan together.',
  diaryThinking:'Drafting your diary…',
  teamThinking:'Three experts thinking in parallel…',
  newTripTodo:'Trip saving — sign in (Phase 3) to keep this trip.',
  qPlanItinerary:'Plan me a full day-by-day itinerary for {dest}, including suggested timings, meals and rest pacing.'
});
Object.assign(TOOL_I18N.zh, {
  toastPhase3:'此功能将在 Phase 3 上线',
  compareSubHotels:'酒店', compareSubFlights:'机票',
  hotelAreaLabel:'住宿区域', hotelCheckIn:'入住', hotelCheckOut:'退房', hotelAdults:'人数', hotelSearchBtn:'查酒店价格',
  hotelSearching:'正在搜索酒店…', hotelNoResults:'暂无结果，请更换日期重试',
  hotelBookBtn:'查看订房',
  flightTripRound:'往返', flightTripOneway:'单程',
  flightFrom:'出发', flightDepart:'起飞日', flightReturn:'返回日', flightAdults:'人数', flightSearchBtn:'查机票价格',
  flightSearching:'正在搜索机票…', flightNoResults:'暂无航班，请更换日期重试',
  flightDirect:'直飞', flightStops1:'1 次中转', flightStops2:'2 次中转',
  flightOriginPrompt:'选择或输入出发城市 / IATA 代码（如 PVG / PEK / HKG）',
  flightFromCustom:'自定义城市 / 代码…',
  itinHeading:'每日行程', itinAiBtn:'AI 深度定制行程', itinExportBtn:'导出行程 PDF',
  itinEmpty:'暂无行程，开始对话即可规划',
  budgetTotal:'预算总额', budgetSub:'2 人 · 7 天 · 个性化估算',
  budgetCatLodging:'住宿', budgetCatFood:'餐饮', budgetCatTransport:'交通', budgetCatActivities:'活动', budgetCatMisc:'杂项',
  budgetNoteLodging:'中端酒店 · 含早', budgetNoteFood:'本地餐 + 2 顿大餐',
  budgetNoteTransport:'本地交通 + 接送机', budgetNoteActivities:'2-3 项付费体验',
  budgetNoteMisc:'小费 / 电话卡 / 备用',
  logTitle:'活动日志', logEmpty:'暂无活动', logClear:'清空',
  logBooted:'AI Tool 已就绪 · <strong>6 位智能体</strong>待命',
  logChatSent:'向 <strong>{agent}</strong> 提问', logChatRecv:'<strong>{agent}</strong> 回复 · {n} 字',
  logSwitchDest:'切换到 <strong>{dest}</strong>',
  logSwitchAgent:'切换到 <strong>{agent}</strong>',
  logHotelSearch:'搜索 <strong>{dest}</strong> 酒店', logHotelDone:'找到 <strong>{n}</strong> 家酒店',
  logFlightSearch:'搜索机票 <strong>{o} → {d}</strong>', logFlightDone:'找到 <strong>{n}</strong> 个航班',
  logJumpItin:'打开行程面板', logJumpBudget:'打开预算面板',
  logAskTeam:'正在向智能体团队广播…', logAskTeamDone:'团队回应 · {n} 字',
  logMapOpen:'打开探索地图', logDiaryStart:'根据对话历史生成游记…', logDiaryDone:'游记完成 · {n} 字',
  logItinAi:'请求 AI 深度定制行程…', logItinDone:'AI 行程完成 · {n} 字',
  logExportPdf:'打开 PDF 导出对话框',
  mapTitle:'探索地图', mapClose:'关闭',
  mapRegionHeading:'{dest} 区域',
  diaryTitle:'旅行游记', diaryClose:'关闭', diarySaveBtn:'保存为 PDF',
  diaryNeedChat:'先和 AI 对话规划行程，游记会基于你们的旅程一起写出来。',
  diaryThinking:'正在撰写游记…',
  teamThinking:'三位专家并行思考中…',
  newTripTodo:'行程保存 —— 登录后（Phase 3）可永久保存此行程',
  qPlanItinerary:'为我设计{dest}的完整每日行程，包括时间安排、用餐和节奏建议'
});
Object.assign(TOOL_I18N.ja, {
  toastPhase3:'この機能はPhase 3で公開',
  compareSubHotels:'ホテル', compareSubFlights:'フライト',
  hotelAreaLabel:'宿泊エリア', hotelCheckIn:'チェックイン', hotelCheckOut:'チェックアウト', hotelAdults:'人数', hotelSearchBtn:'ホテルを探す',
  hotelSearching:'ホテルを検索中…', hotelNoResults:'結果なし。日付を変更してください。',
  hotelBookBtn:'予約を見る',
  flightTripRound:'往復', flightTripOneway:'片道',
  flightFrom:'出発地', flightDepart:'出発日', flightReturn:'帰着日', flightAdults:'人数', flightSearchBtn:'フライトを探す',
  flightSearching:'フライトを検索中…', flightNoResults:'フライトなし。日付を変更してください。',
  flightDirect:'直行', flightStops1:'1回乗継', flightStops2:'2回乗継',
  flightOriginPrompt:'出発都市/IATAコードを選択または入力（例: NRT, HND）',
  flightFromCustom:'カスタム都市/コード…',
  itinHeading:'日別プラン', itinAiBtn:'AI 詳細カスタマイズ', itinExportBtn:'PDF エクスポート',
  itinEmpty:'旅程なし — チャットを始めて計画',
  budgetTotal:'予算合計', budgetSub:'2人·7日·パーソナル見積もり',
  budgetCatLodging:'宿泊', budgetCatFood:'食事', budgetCatTransport:'交通', budgetCatActivities:'体験', budgetCatMisc:'その他',
  budgetNoteLodging:'中級ホテル·朝食付き', budgetNoteFood:'地元料理+2回ディナー',
  budgetNoteTransport:'公共交通+送迎', budgetNoteActivities:'2-3つの有料体験',
  budgetNoteMisc:'チップ·SIM·予備費',
  logTitle:'アクティビティログ', logEmpty:'アクティビティなし', logClear:'クリア',
  logBooted:'AI Tool 起動済み · <strong>6 エージェント</strong>待機',
  logChatSent:'<strong>{agent}</strong>に質問', logChatRecv:'<strong>{agent}</strong>から返答 · {n}文字',
  logSwitchDest:'目的地を<strong>{dest}</strong>に切替',
  logSwitchAgent:'<strong>{agent}</strong>に切替',
  logHotelSearch:'<strong>{dest}</strong>のホテル検索', logHotelDone:'<strong>{n}</strong>件のホテル発見',
  logFlightSearch:'フライト検索 <strong>{o} → {d}</strong>', logFlightDone:'<strong>{n}</strong>件のフライト発見',
  logJumpItin:'旅程パネルを開く', logJumpBudget:'予算パネルを開く',
  logAskTeam:'チームに広報中…', logAskTeamDone:'チーム回答 · {n}文字',
  logMapOpen:'探索地図を開く', logDiaryStart:'チャット履歴から紀行文生成…', logDiaryDone:'紀行文完成 · {n}文字',
  logItinAi:'AI 詳細旅程をリクエスト…', logItinDone:'AI 旅程完成 · {n}文字',
  logExportPdf:'PDF エクスポートを開く',
  mapTitle:'探索マップ', mapClose:'閉じる',
  mapRegionHeading:'{dest} の地域',
  diaryTitle:'紀行文', diaryClose:'閉じる', diarySaveBtn:'PDF として保存',
  diaryNeedChat:'先にAIと対話してください。紀行文はその旅程に基づきます。',
  diaryThinking:'紀行文を起草中…',
  teamThinking:'3 人の専門家が並行思考中…',
  newTripTodo:'旅行保存 —— ログインで永続保存（Phase 3）',
  qPlanItinerary:'{dest} の完全な日程を設計してください'
});
Object.assign(TOOL_I18N.ko, {
  toastPhase3:'이 기능은 Phase 3에 출시',
  compareSubHotels:'호텔', compareSubFlights:'항공',
  hotelAreaLabel:'숙박 지역', hotelCheckIn:'체크인', hotelCheckOut:'체크아웃', hotelAdults:'인원', hotelSearchBtn:'호텔 찾기',
  hotelSearching:'호텔 검색 중…', hotelNoResults:'결과 없음, 날짜를 변경해 주세요',
  hotelBookBtn:'예약 보기',
  flightTripRound:'왕복', flightTripOneway:'편도',
  flightFrom:'출발지', flightDepart:'출발일', flightReturn:'귀국일', flightAdults:'인원', flightSearchBtn:'항공권 찾기',
  flightSearching:'항공권 검색 중…', flightNoResults:'결과 없음, 날짜를 변경해 주세요',
  flightDirect:'직항', flightStops1:'1회 경유', flightStops2:'2회 경유',
  flightOriginPrompt:'출발 도시/IATA 코드 선택 또는 입력 (예: ICN)',
  flightFromCustom:'사용자 정의 도시/코드…',
  itinHeading:'일별 일정', itinAiBtn:'AI 맞춤 일정', itinExportBtn:'PDF 내보내기',
  itinEmpty:'일정 없음 — 채팅을 시작해 계획',
  budgetTotal:'예산 총액', budgetSub:'2명·7일·개인 맞춤',
  budgetCatLodging:'숙박', budgetCatFood:'식사', budgetCatTransport:'교통', budgetCatActivities:'활동', budgetCatMisc:'기타',
  budgetNoteLodging:'중급 호텔·조식 포함', budgetNoteFood:'현지 음식+2회 만찬',
  budgetNoteTransport:'대중교통+공항 픽업', budgetNoteActivities:'2-3개 유료 체험',
  budgetNoteMisc:'팁·유심·예비비',
  logTitle:'활동 로그', logEmpty:'활동 없음', logClear:'지우기',
  logBooted:'AI Tool 준비 완료 · <strong>6 에이전트</strong> 대기',
  logChatSent:'<strong>{agent}</strong>에게 질문', logChatRecv:'<strong>{agent}</strong> 응답 · {n}자',
  logSwitchDest:'목적지를 <strong>{dest}</strong>로 전환',
  logSwitchAgent:'<strong>{agent}</strong>로 전환',
  logHotelSearch:'<strong>{dest}</strong> 호텔 검색', logHotelDone:'<strong>{n}</strong>개 호텔 발견',
  logFlightSearch:'항공권 검색 <strong>{o} → {d}</strong>', logFlightDone:'<strong>{n}</strong>개 항공편 발견',
  logJumpItin:'일정 패널 열기', logJumpBudget:'예산 패널 열기',
  logAskTeam:'팀에 방송 중…', logAskTeamDone:'팀 응답 · {n}자',
  logMapOpen:'탐험 지도 열기', logDiaryStart:'대화 기록으로 기행문 생성 중…', logDiaryDone:'기행문 완성 · {n}자',
  logItinAi:'AI 맞춤 일정 요청 중…', logItinDone:'AI 일정 완성 · {n}자',
  logExportPdf:'PDF 내보내기 대화상자 열기',
  mapTitle:'탐험 지도', mapClose:'닫기',
  mapRegionHeading:'{dest} 지역',
  diaryTitle:'기행문', diaryClose:'닫기', diarySaveBtn:'PDF로 저장',
  diaryNeedChat:'먼저 AI와 대화하세요. 기행문은 그 여정을 바탕으로 작성됩니다.',
  diaryThinking:'기행문 작성 중…',
  teamThinking:'세 전문가가 동시에 사고 중…',
  newTripTodo:'여행 저장 —— 로그인 시 영구 저장 (Phase 3)',
  qPlanItinerary:'{dest}의 전체 일정을 설계해 주세요'
});
Object.assign(TOOL_I18N.id, {
  toastPhase3:'Fitur ini hadir di Fase 3',
  compareSubHotels:'Hotel', compareSubFlights:'Penerbangan',
  hotelAreaLabel:'Area menginap', hotelCheckIn:'Check-in', hotelCheckOut:'Check-out', hotelAdults:'Dewasa', hotelSearchBtn:'Cari hotel',
  hotelSearching:'Mencari hotel…', hotelNoResults:'Tidak ada hasil, coba tanggal lain.',
  hotelBookBtn:'Lihat booking',
  flightTripRound:'PP', flightTripOneway:'Sekali jalan',
  flightFrom:'Dari', flightDepart:'Tgl berangkat', flightReturn:'Tgl pulang', flightAdults:'Dewasa', flightSearchBtn:'Cari tiket',
  flightSearching:'Mencari penerbangan…', flightNoResults:'Tidak ada penerbangan, coba tanggal lain.',
  flightDirect:'Langsung', flightStops1:'1 transit', flightStops2:'2 transit',
  flightOriginPrompt:'Pilih atau ketik kota asal/kode IATA (mis: CGK)',
  flightFromCustom:'Kota/kode kustom…',
  itinHeading:'Rencana harian', itinAiBtn:'AI sesuaikan mendalam', itinExportBtn:'Ekspor PDF',
  itinEmpty:'Belum ada rencana — mulai chat untuk merencanakan',
  budgetTotal:'Anggaran total', budgetSub:'2 orang · 7 hari · estimasi pribadi',
  budgetCatLodging:'Akomodasi', budgetCatFood:'Makanan', budgetCatTransport:'Transportasi', budgetCatActivities:'Aktivitas', budgetCatMisc:'Lain-lain',
  budgetNoteLodging:'Hotel menengah · sarapan', budgetNoteFood:'Lokal + 2 makan malam istimewa',
  budgetNoteTransport:'Transit lokal + jemput', budgetNoteActivities:'2-3 pengalaman berbayar',
  budgetNoteMisc:'Tip · SIM · cadangan',
  logTitle:'Log aktivitas', logEmpty:'Belum ada aktivitas', logClear:'Hapus',
  logBooted:'AI Tool siap · <strong>6 agen</strong> menunggu',
  logChatSent:'Bertanya ke <strong>{agent}</strong>', logChatRecv:'<strong>{agent}</strong> menjawab · {n} kar.',
  logSwitchDest:'Beralih tujuan ke <strong>{dest}</strong>',
  logSwitchAgent:'Beralih ke <strong>{agent}</strong>',
  logHotelSearch:'Mencari hotel <strong>{dest}</strong>', logHotelDone:'Ditemukan <strong>{n}</strong> hotel',
  logFlightSearch:'Mencari tiket <strong>{o} → {d}</strong>', logFlightDone:'Ditemukan <strong>{n}</strong> penerbangan',
  logJumpItin:'Buka panel rencana', logJumpBudget:'Buka panel anggaran',
  logAskTeam:'Menyiarkan ke tim AI…', logAskTeamDone:'Tim merespons · {n} kar.',
  logMapOpen:'Buka peta jelajah', logDiaryStart:'Menyusun cerita dari riwayat chat…', logDiaryDone:'Cerita siap · {n} kar.',
  logItinAi:'Meminta rencana detail AI…', logItinDone:'Rencana AI siap · {n} kar.',
  logExportPdf:'Buka dialog ekspor PDF',
  mapTitle:'Peta jelajah', mapClose:'Tutup',
  mapRegionHeading:'Area di {dest}',
  diaryTitle:'Cerita perjalanan', diaryClose:'Tutup', diarySaveBtn:'Simpan PDF',
  diaryNeedChat:'Mulai chat dulu. Cerita disusun dari rencana kita.',
  diaryThinking:'Menyusun cerita…',
  teamThinking:'Tiga ahli berpikir paralel…',
  newTripTodo:'Simpan perjalanan — login untuk menyimpan (Fase 3)',
  qPlanItinerary:'Rencanakan jadwal harian lengkap untuk {dest}'
});

/* —— State for Phase 2 features —— */
let _hotels = [];      // last hotel search results
let _flights = [];     // last flight search results
let _flightTripType = 'round';
let _selectedHotelArea = null;
let _compareSub = 'hotels';
let _itinAiContent = null;  // AI-customized itinerary text
let _logEntries = [];   // {level, icon, msg, ts}
let _diaryContent = null;

const ORIGIN_PRESETS = [
  { code:'PVG', label:'Shanghai · PVG' },
  { code:'PEK', label:'Beijing · PEK' },
  { code:'HKG', label:'Hong Kong · HKG' },
  { code:'SIN', label:'Singapore · SIN' },
  { code:'NRT', label:'Tokyo · NRT' },
  { code:'ICN', label:'Seoul · ICN' },
  { code:'BKK', label:'Bangkok · BKK' },
  { code:'CGK', label:'Jakarta · CGK' },
  { code:'LAX', label:'Los Angeles · LAX' },
  { code:'LHR', label:'London · LHR' },
  { code:'CDG', label:'Paris · CDG' }
];

const BUDGET_ICONS = { lodging:'fa-bed', food:'fa-coffee', transport:'fa-car', activities:'fa-compass', misc:'fa-ellipsis-h' };
const BUDGET_COLORS = { lodging:'#2563eb', food:'#ea580c', transport:'#0e7c6b', activities:'#7c3aed', misc:'#6b7280' };

function _interp(s, vars) {
  return String(s || '').replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));
}
function _addDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function _destNameForApi() {
  const labels = { bali:'Bali', kyoto:'Kyoto', paris:'Paris', santorini:'Santorini', any:'' };
  return labels[currentDest] || '';
}

/* ═════════════════ COMPARE PANEL ═════════════════ */
function renderPanelCompare() {
  const wrap = document.querySelector('.ws-panel-content[data-panel="compare"]');
  if (!wrap) return;
  const d = dest();
  const areas = (d.regions || []).map(r => r.name);

  wrap.innerHTML = `
    <div class="ws-subtabs">
      <button class="ws-subtab ${_compareSub==='hotels'?'active':''}" data-sub="hotels"><span class="fa fa-bed"></span> ${escapeHtml(t().compareSubHotels)}</button>
      <button class="ws-subtab ${_compareSub==='flights'?'active':''}" data-sub="flights"><span class="fa fa-plane"></span> ${escapeHtml(t().compareSubFlights)}</button>
    </div>
    <div id="ws-sub-hotels" style="display:${_compareSub==='hotels'?'block':'none'}">
      ${areas.length ? `
        <div class="ws-form-label">${escapeHtml(t().hotelAreaLabel)}</div>
        <div class="ws-area-chips" id="ws-hotel-areas">
          ${areas.map(a => `<button class="ws-area-chip ${_selectedHotelArea===a?'active':''}" data-area="${escapeHtml(a)}">${escapeHtml(a)}</button>`).join('')}
        </div>` : ''}
      <div class="ws-form-row">
        <div class="ws-form-field"><label class="ws-form-label">${escapeHtml(t().hotelCheckIn)}</label><input type="date" class="ws-form-input" id="ws-hotel-checkin" value="${_addDays(14)}"></div>
        <div class="ws-form-field"><label class="ws-form-label">${escapeHtml(t().hotelCheckOut)}</label><input type="date" class="ws-form-input" id="ws-hotel-checkout" value="${_addDays(21)}"></div>
      </div>
      <div class="ws-form-row">
        <div class="ws-form-field" style="max-width:90px;"><label class="ws-form-label">${escapeHtml(t().hotelAdults)}</label>
          <select class="ws-form-select" id="ws-hotel-adults">
            <option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option>
          </select>
        </div>
        <div class="ws-form-field"><label class="ws-form-label">&nbsp;</label>
          <button class="ws-search-btn" id="ws-hotel-search-btn"><span class="fa fa-search"></span> <span id="ws-hotel-btn-label">${escapeHtml(t().hotelSearchBtn)}</span></button>
        </div>
      </div>
      <div id="ws-hotel-results"></div>
    </div>
    <div id="ws-sub-flights" style="display:${_compareSub==='flights'?'block':'none'}">
      <div class="ws-trip-toggle">
        <button class="ws-trip-toggle-btn ${_flightTripType==='round'?'active':''}" data-trip="round">${escapeHtml(t().flightTripRound)}</button>
        <button class="ws-trip-toggle-btn ${_flightTripType==='oneway'?'active':''}" data-trip="oneway">${escapeHtml(t().flightTripOneway)}</button>
      </div>
      <div class="ws-form-row">
        <div class="ws-form-field"><label class="ws-form-label">${escapeHtml(t().flightFrom)}</label>
          <select class="ws-form-select" id="ws-flight-from-select" title="${escapeHtml(t().flightOriginPrompt)}">
            ${ORIGIN_PRESETS.map(o => `<option value="${o.code}">${escapeHtml(o.label)}</option>`).join('')}
            <option value="__custom__">${escapeHtml(t().flightFromCustom)}</option>
          </select>
          <input type="text" class="ws-form-input" id="ws-flight-from-input" style="display:none;margin-top:4px" placeholder="${escapeHtml(t().flightFromCustom)}">
        </div>
      </div>
      <div class="ws-form-row">
        <div class="ws-form-field"><label class="ws-form-label">${escapeHtml(t().flightDepart)}</label><input type="date" class="ws-form-input" id="ws-flight-depart" value="${_addDays(14)}"></div>
        <div class="ws-form-field" id="ws-flight-return-wrap" style="display:${_flightTripType==='round'?'flex':'none'}"><label class="ws-form-label">${escapeHtml(t().flightReturn)}</label><input type="date" class="ws-form-input" id="ws-flight-return" value="${_addDays(21)}"></div>
      </div>
      <div class="ws-form-row">
        <div class="ws-form-field" style="max-width:90px;"><label class="ws-form-label">${escapeHtml(t().flightAdults)}</label>
          <select class="ws-form-select" id="ws-flight-adults">
            <option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
          </select>
        </div>
        <div class="ws-form-field"><label class="ws-form-label">&nbsp;</label>
          <button class="ws-search-btn" id="ws-flight-search-btn"><span class="fa fa-search"></span> <span id="ws-flight-btn-label">${escapeHtml(t().flightSearchBtn)}</span></button>
        </div>
      </div>
      <div id="ws-flight-results"></div>
    </div>
  `;

  // Wire sub-tabs
  wrap.querySelectorAll('.ws-subtab').forEach(b => b.onclick = () => switchCompareSub(b.dataset.sub));
  // Area chips
  wrap.querySelectorAll('.ws-area-chip').forEach(c => c.onclick = () => {
    _selectedHotelArea = (_selectedHotelArea === c.dataset.area) ? null : c.dataset.area;
    wrap.querySelectorAll('.ws-area-chip').forEach(x => x.classList.toggle('active', x.dataset.area === _selectedHotelArea));
  });
  // Trip toggle
  wrap.querySelectorAll('.ws-trip-toggle-btn').forEach(b => b.onclick = () => {
    _flightTripType = b.dataset.trip;
    wrap.querySelectorAll('.ws-trip-toggle-btn').forEach(x => x.classList.toggle('active', x.dataset.trip === _flightTripType));
    document.getElementById('ws-flight-return-wrap').style.display = (_flightTripType === 'round' ? 'flex' : 'none');
  });
  // Flight origin custom toggle
  const fromSel = document.getElementById('ws-flight-from-select');
  const fromInp = document.getElementById('ws-flight-from-input');
  if (fromSel) fromSel.onchange = () => {
    if (fromSel.value === '__custom__') { fromInp.style.display = 'block'; fromInp.focus(); }
    else { fromInp.style.display = 'none'; fromInp.value = ''; }
  };
  // Search buttons
  document.getElementById('ws-hotel-search-btn').onclick = fetchHotels;
  document.getElementById('ws-flight-search-btn').onclick = fetchFlights;

  // Restore previous results if any
  if (_hotels.length) renderHotelResults(_hotels);
  if (_flights.length) renderFlightResults(_flights);
}

function switchCompareSub(sub) {
  _compareSub = sub;
  document.querySelectorAll('.ws-subtab').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  const h = document.getElementById('ws-sub-hotels');
  const f = document.getElementById('ws-sub-flights');
  if (h) h.style.display = (sub === 'hotels' ? 'block' : 'none');
  if (f) f.style.display = (sub === 'flights' ? 'block' : 'none');
  switchPanelTab('compare');
}

async function fetchHotels() {
  const destName = _destNameForApi();
  if (!destName && currentDest !== 'any') return;
  const area = _selectedHotelArea;
  const queryDest = area ? `${destName} ${area}` : destName;
  const checkIn = document.getElementById('ws-hotel-checkin').value;
  const checkOut = document.getElementById('ws-hotel-checkout').value;
  const adults = parseInt(document.getElementById('ws-hotel-adults').value) || 2;
  if (!checkIn || !checkOut) return;
  if (checkOut <= checkIn) { showToast('Check-out must be after check-in', 'fa-exclamation-triangle'); return; }

  const btn = document.getElementById('ws-hotel-search-btn');
  const lbl = document.getElementById('ws-hotel-btn-label');
  const out = document.getElementById('ws-hotel-results');
  btn.disabled = true;
  lbl.textContent = t().hotelSearching;
  out.innerHTML = `<div class="ws-loading"><span class="fa fa-circle-o-notch"></span><div>${escapeHtml(t().hotelSearching)}</div></div>`;
  addLog('info', 'fa-bed', _interp(t().logHotelSearch, { dest: queryDest }));

  try {
    const r = await fetch(BACKEND_BASE + '/api/search/hotels', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ destination: queryDest, check_in: checkIn, check_out: checkOut, adults, lang: currentLang })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'HTTP ' + r.status);
    _hotels = data.hotels || [];
    renderHotelResults(_hotels);
    addLog('success', 'fa-check-circle', _interp(t().logHotelDone, { n: _hotels.length }));
  } catch (err) {
    out.innerHTML = `<div class="ws-error"><span class="fa fa-exclamation-circle"></span> ${escapeHtml(err.message || String(err))}</div>`;
    addLog('error', 'fa-exclamation-circle', escapeHtml(err.message || String(err)));
  } finally {
    btn.disabled = false;
    lbl.textContent = t().hotelSearchBtn;
  }
}

function renderHotelResults(hotels) {
  const out = document.getElementById('ws-hotel-results');
  if (!out) return;
  if (!hotels || !hotels.length) {
    out.innerHTML = `<div class="ws-empty"><span class="fa fa-bed"></span><div>${escapeHtml(t().hotelNoResults)}</div></div>`;
    return;
  }
  out.innerHTML = hotels.map(h => {
    const thumb = h.thumbnail ? `<img class="ws-hotel-thumb" src="${escapeHtml(h.thumbnail)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=ws-hotel-thumb-ph><span class=fa fa-bed></span></div>'">` : `<div class="ws-hotel-thumb-ph"><span class="fa fa-bed"></span></div>`;
    const rating = h.rating ? `<span class="ws-hotel-rating"><span class="fa fa-star"></span> ${h.rating}</span>` : '';
    const reviews = h.reviews ? `<span>${Number(h.reviews).toLocaleString()}</span>` : '';
    const amen = (h.amenities||[]).slice(0,3).join(' · ');
    const link = h.link || '#';
    return `<div class="ws-hotel-card" onclick="window.open('${escapeHtml(link)}','_blank')">
      ${thumb}
      <div class="ws-hotel-body">
        <div class="ws-hotel-name" title="${escapeHtml(h.name||'')}">${escapeHtml(h.name||'Hotel')}</div>
        <div class="ws-hotel-meta">${rating}${reviews}${h.price ? `<span class="ws-hotel-price">${escapeHtml(h.price)}<span class="per">/${t().hotelCheckIn==='Check-in'?'nt':'晚'}</span></span>` : ''}</div>
        ${amen ? `<div class="ws-hotel-amen">${escapeHtml(amen)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function fetchFlights() {
  const sel = document.getElementById('ws-flight-from-select');
  const inp = document.getElementById('ws-flight-from-input');
  const origin = (sel.value === '__custom__') ? inp.value.trim() : sel.value;
  if (!origin) { showToast(t().flightOriginPrompt, 'fa-exclamation-triangle'); return; }
  const destName = _destNameForApi();
  if (!destName) { showToast('Pick a destination first', 'fa-exclamation-triangle'); return; }
  const departDate = document.getElementById('ws-flight-depart').value;
  const returnDate = (_flightTripType === 'round') ? document.getElementById('ws-flight-return').value : '';
  const adults = parseInt(document.getElementById('ws-flight-adults').value) || 1;
  if (!departDate) return;
  if (_flightTripType === 'round' && returnDate && returnDate <= departDate) {
    showToast('Return must be after depart', 'fa-exclamation-triangle'); return;
  }

  const btn = document.getElementById('ws-flight-search-btn');
  const lbl = document.getElementById('ws-flight-btn-label');
  const out = document.getElementById('ws-flight-results');
  btn.disabled = true;
  lbl.textContent = t().flightSearching;
  out.innerHTML = `<div class="ws-loading"><span class="fa fa-circle-o-notch"></span><div>${escapeHtml(t().flightSearching)}</div></div>`;
  addLog('info', 'fa-plane', _interp(t().logFlightSearch, { o: origin, d: destName }));

  try {
    const r = await fetch(BACKEND_BASE + '/api/search/flights', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ origin, destination: destName, depart_date: departDate, return_date: returnDate, adults, lang: currentLang })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'HTTP ' + r.status);
    _flights = data.flights || [];
    renderFlightResults(_flights, data.booking_url || '');
    addLog('success', 'fa-check-circle', _interp(t().logFlightDone, { n: _flights.length }));
  } catch (err) {
    out.innerHTML = `<div class="ws-error"><span class="fa fa-exclamation-circle"></span> ${escapeHtml(err.message || String(err))}</div>`;
    addLog('error', 'fa-exclamation-circle', escapeHtml(err.message || String(err)));
  } finally {
    btn.disabled = false;
    lbl.textContent = t().flightSearchBtn;
  }
}

function renderFlightResults(flights, bookingUrl) {
  const out = document.getElementById('ws-flight-results');
  if (!out) return;
  if (!flights || !flights.length) {
    out.innerHTML = `<div class="ws-empty"><span class="fa fa-plane"></span><div>${escapeHtml(t().flightNoResults)}</div></div>`;
    return;
  }
  const fmtTime = s => { if (!s) return ''; const m = String(s).match(/\d{1,2}:\d{2}/); return m ? m[0] : s; };
  const fmtDur = m => { if (!m) return ''; const h = Math.floor(m/60); const mn = m%60; return (h?h+'h ':'') + (mn?mn+'m':''); };
  out.innerHTML = flights.map(f => {
    const logo = f.airline_logo ? `<img class="ws-flight-logo" src="${escapeHtml(f.airline_logo)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=ws-flight-logo-ph><span class=fa fa-plane></span></div>'">` : `<div class="ws-flight-logo-ph"><span class="fa fa-plane"></span></div>`;
    let stops = '';
    if (f.stops === 0) stops = `<span class="ws-flight-stops direct">${escapeHtml(t().flightDirect)}</span>`;
    else if (f.stops === 1) stops = `<span class="ws-flight-stops s1">${escapeHtml(t().flightStops1)}</span>`;
    else if (f.stops >= 2) stops = `<span class="ws-flight-stops s2">${escapeHtml(t().flightStops2)}</span>`;
    const depTime = fmtTime(f.depart_time || f.departure);
    const arrTime = fmtTime(f.arrive_time || f.arrival);
    const route = `${escapeHtml(f.origin_code || f.origin || '')} → ${escapeHtml(f.destination_code || f.destination || '')}`;
    const dur = fmtDur(f.duration_minutes || f.duration);
    const price = f.price ? `<span class="ws-flight-price">${escapeHtml(f.price)}</span>` : '';
    const link = f.booking_link || bookingUrl || '#';
    return `<div class="ws-flight-card" onclick="window.open('${escapeHtml(link)}','_blank')">
      <div class="ws-flight-row">
        ${logo}
        <div style="flex:1">
          <div class="ws-flight-times">${escapeHtml(depTime)} — ${escapeHtml(arrTime)}</div>
          <div class="ws-flight-route">${escapeHtml(f.airline || '')} · ${route}</div>
        </div>
        ${price}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
        ${stops}
        ${dur ? `<span class="ws-flight-dur">${escapeHtml(dur)}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ═════════════════ ITINERARY PANEL ═════════════════ */
function renderPanelItinerary() {
  const wrap = document.querySelector('.ws-panel-content[data-panel="itinerary"]');
  if (!wrap) return;
  const d = dest();
  const items = d.itinerary || (DESTS.bali.itinerary || []);
  const heading = t().itinHeading;

  if (!items.length && currentDest === 'any') {
    wrap.innerHTML = `<div class="ws-empty"><span class="fa fa-calendar-o"></span><div>${escapeHtml(t().itinEmpty)}</div></div>`;
    return;
  }

  // Use bali's itinerary as fallback shape if dest has none
  const fallback = [
    { icon:'fa-plane',    color:'#0e7c6b', dayLabel:'Day 1', title:'Arrival & settle in', desc:'Airport transfer, check-in, gentle first stroll' },
    { icon:'fa-camera',   color:'#7c3aed', dayLabel:'Day 2', title:'Headline sights',    desc:'Highest-impact landmarks while energy is fresh' },
    { icon:'fa-cutlery',  color:'#ea580c', dayLabel:'Day 3', title:'Food + neighbourhoods', desc:'Local eats, slower exploration, optional class' },
    { icon:'fa-leaf',     color:'#10b981', dayLabel:'Day 4', title:'Nature day',           desc:'Day trip — beach / mountain / temple route' },
    { icon:'fa-shopping-bag', color:'#fcbf1e', dayLabel:'Day 5', title:'Markets & rest',  desc:'Shopping, café-hopping, spa or downtime' },
    { icon:'fa-suitcase', color:'#2563eb', dayLabel:'Day 6', title:'Free + departure',    desc:'Final highlights, pack up, transfer back' }
  ];
  const useItems = items.length ? items : fallback;

  // Static itinerary rendering
  const timelineHtml = useItems.map(item => {
    let iconClass = 'fa-calendar-o';
    // Map old emoji-based icon to a fa class if necessary
    if (item.icon && item.icon.startsWith('fa-')) iconClass = item.icon;
    else if (item.icon === '✈️') iconClass = 'fa-plane';
    else if (item.icon === '🌾') iconClass = 'fa-leaf';
    else if (item.icon === '🌋') iconClass = 'fa-fire';
    else if (item.icon === '🌊') iconClass = 'fa-tint';
    else if (item.icon === '🛥️') iconClass = 'fa-ship';
    else if (item.icon === '🌅') iconClass = 'fa-sun-o';
    else if (item.icon === '⛩️') iconClass = 'fa-torii-gate';
    else if (item.icon === '🏯') iconClass = 'fa-university';
    else if (item.icon === '🦊') iconClass = 'fa-paw';
    else if (item.icon === '🌸') iconClass = 'fa-leaf';
    else if (item.icon === '🚄') iconClass = 'fa-train';
    else if (item.icon === '🗼') iconClass = 'fa-building-o';
    else if (item.icon === '🎨') iconClass = 'fa-paint-brush';
    else if (item.icon === '⛪') iconClass = 'fa-building-o';
    else if (item.icon === '🏰') iconClass = 'fa-fort-awesome';
    else if (item.icon === '🛍️') iconClass = 'fa-shopping-bag';
    else if (item.icon === '🏖️') iconClass = 'fa-umbrella';
    else if (item.icon === '⛵') iconClass = 'fa-ship';
    else if (item.icon === '🏛️') iconClass = 'fa-university';
    else if (item.icon === '🍷') iconClass = 'fa-glass';
    const c = item.color || '#0e7c6b';
    return `<div class="ws-tl-item">
      <div class="ws-tl-icon" style="background:${c}"><span class="fa ${iconClass}"></span></div>
      <div class="ws-tl-body">
        <div class="ws-tl-day">${escapeHtml(item.dayLabel || '')}</div>
        <div class="ws-tl-title">${escapeHtml(item.title || '')}</div>
        <div class="ws-tl-desc">${escapeHtml(item.desc || '')}</div>
      </div>
    </div>`;
  }).join('');

  const aiHtml = _itinAiContent ? `
    <div class="ws-tl-item" style="background:linear-gradient(135deg,rgba(252,191,30,.10),rgba(252,191,30,.02));border-color:rgba(252,191,30,.3)">
      <div class="ws-tl-icon" style="background:var(--ws-amber)"><span class="fa fa-magic"></span></div>
      <div class="ws-tl-body">
        <div class="ws-tl-day">AI · ${escapeHtml(currentLang.toUpperCase())}</div>
        <div class="ws-tl-desc" style="white-space:pre-wrap">${escapeHtml(_itinAiContent)}</div>
      </div>
    </div>` : '';

  wrap.innerHTML = `
    <div class="ws-panel-section-title">${escapeHtml(heading)}</div>
    <div class="ws-timeline ws-print-target">
      <h2 style="display:none">${escapeHtml(d.titles[currentLang] || d.titles.en || '').replace(/<[^>]+>/g,'')}</h2>
      ${timelineHtml}
      ${aiHtml}
    </div>
    <button class="ws-action-btn" id="ws-itin-ai-btn"><span class="fa fa-magic"></span> ${escapeHtml(t().itinAiBtn)}</button>
    <button class="ws-action-btn secondary" id="ws-itin-pdf-btn"><span class="fa fa-file-pdf-o"></span> ${escapeHtml(t().itinExportBtn)}</button>
  `;
  document.getElementById('ws-itin-ai-btn').onclick = aiCustomizeItinerary;
  document.getElementById('ws-itin-pdf-btn').onclick = exportItineraryPdf;
}

async function aiCustomizeItinerary() {
  const destName = _destNameForApi() || 'this destination';
  const btn = document.getElementById('ws-itin-ai-btn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="fa fa-circle-o-notch fa-spin"></span> …`;
  addLog('info', 'fa-magic', t().logItinAi);
  try {
    const prompt = _interp(t().qPlanItinerary, { dest: destName });
    const r = await fetch(BACKEND_BASE + '/api/generate', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ prompt, max_tokens: 1500, lang: currentLang })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'HTTP ' + r.status);
    _itinAiContent = data.content || data.text || data.reply || '';
    addLog('success', 'fa-check-circle', _interp(t().logItinDone, { n: _itinAiContent.length }));
    renderPanelItinerary();
  } catch (err) {
    addLog('error', 'fa-exclamation-circle', escapeHtml(err.message || String(err)));
    showToast(err.message || String(err), 'fa-exclamation-triangle');
  } finally {
    if (document.getElementById('ws-itin-ai-btn')) document.getElementById('ws-itin-ai-btn').innerHTML = orig;
    if (document.getElementById('ws-itin-ai-btn')) document.getElementById('ws-itin-ai-btn').disabled = false;
  }
}

function exportItineraryPdf() {
  addLog('info', 'fa-file-pdf-o', t().logExportPdf);
  window.print();
}

/* ═════════════════ BUDGET PANEL ═════════════════ */
function renderPanelBudget() {
  const wrap = document.querySelector('.ws-panel-content[data-panel="budget"]');
  if (!wrap) return;
  const d = dest();
  const chips = d.chips[currentLang] || d.chips.en;
  const total = chips[3] || '—';
  const sub = `${chips[2] || ''} · ${chips[1] || ''} · ${chips[0] || ''}`.replace(/^ · | · $|·  ·/g, '');

  const cats = [
    { key:'lodging',    val:'40%', note:t().budgetNoteLodging },
    { key:'food',       val:'20%', note:t().budgetNoteFood },
    { key:'transport',  val:'15%', note:t().budgetNoteTransport },
    { key:'activities', val:'18%', note:t().budgetNoteActivities },
    { key:'misc',       val:'7%',  note:t().budgetNoteMisc }
  ];

  wrap.innerHTML = `
    <div class="ws-budget-total">
      <div class="ws-budget-amount">${escapeHtml(total)}</div>
      <div class="ws-budget-sub">${escapeHtml(t().budgetSub)}</div>
    </div>
    <div class="ws-budget-rows">
      ${cats.map(c => `
        <div class="ws-budget-row">
          <div class="ws-budget-icon" style="background:${BUDGET_COLORS[c.key]}"><span class="fa ${BUDGET_ICONS[c.key]}"></span></div>
          <div class="ws-budget-info">
            <div class="ws-budget-cat">${escapeHtml(t()['budgetCat'+c.key.charAt(0).toUpperCase()+c.key.slice(1)])}</div>
            <div class="ws-budget-note">${escapeHtml(c.note)}</div>
          </div>
          <div class="ws-budget-val">${escapeHtml(c.val)}</div>
        </div>
      `).join('')}
    </div>
    <button class="ws-action-btn" id="ws-budget-refine"><span class="fa fa-magic"></span> ${escapeHtml(t().itinAiBtn).replace(/Itinerary|行程|일정|旅程|Rencana/,'Budget')}</button>
  `;
  const refineBtn = document.getElementById('ws-budget-refine');
  if (refineBtn) refineBtn.onclick = () => {
    const queries = { zh:'帮我把'+(_destNameForApi()||'此目的地')+'的预算按住宿/餐饮/交通/活动/杂项分项细化，给出本地货币金额', en:'Break down my '+(_destNameForApi()||'this destination')+' budget by lodging/food/transport/activities/misc with local-currency amounts', ja:_destNameForApi()+'の予算を宿泊/食事/交通/体験/その他に分解', ko:_destNameForApi()+'의 예산을 숙박/식사/교통/체험/기타로 분해', id:'Rincikan anggaran '+_destNameForApi()+' menjadi akomodasi/makan/transport/aktivitas/lain-lain' };
    sendMessage(queries[currentLang] || queries.en);
  };
}

/* ═════════════════ LOG PANEL ═════════════════ */
function addLog(level, icon, msgHtml) {
  _logEntries.unshift({ level: level || 'info', icon: icon || 'fa-info-circle', msg: msgHtml || '', ts: Date.now() });
  if (_logEntries.length > 200) _logEntries.length = 200;
  renderLogList();
}

function renderLogList() {
  const list = document.getElementById('ws-log-list');
  if (!list) return;
  if (!_logEntries.length) {
    list.innerHTML = `<div class="ws-empty"><span class="fa fa-list-alt"></span><div>${escapeHtml(t().logEmpty)}</div></div>`;
    return;
  }
  list.innerHTML = _logEntries.map(e => {
    const time = new Date(e.ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    return `<div class="ws-log-row ${e.level}">
      <span class="ws-log-icon fa ${e.icon}"></span>
      <div class="ws-log-msg">${e.msg}<div class="ws-log-time">${time}</div></div>
    </div>`;
  }).join('');
}

function renderPanelLog() {
  const wrap = document.querySelector('.ws-panel-content[data-panel="log"]');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="ws-panel-section-title" style="display:flex;align-items:center;justify-content:space-between">
      <span>${escapeHtml(t().logTitle)}</span>
      <button class="ws-log-clear" id="ws-log-clear-btn">${escapeHtml(t().logClear)}</button>
    </div>
    <div class="ws-log-list" id="ws-log-list"></div>
  `;
  document.getElementById('ws-log-clear-btn').onclick = () => { _logEntries = []; renderLogList(); };
  renderLogList();
}

/* ═════════════════ ASK-THE-TEAM (SSE) ═════════════════ */
async function askTeam() {
  if (isSending) return;
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) {
    const prompts = { zh:'先输入一个问题，然后点"问全队"让 3 位专家并行回答', en:'Type a question first, then tap Ask-the-Team to get 3 parallel expert answers', ja:'まず質問を入力してから「チームに聞く」をタップ', ko:'먼저 질문을 입력한 후 "팀에 묻기" 버튼을 누르세요', id:'Ketik pertanyaan dulu, lalu klik "Tanya Tim"' };
    showToast(prompts[currentLang] || prompts.en, 'fa-bolt');
    return;
  }
  isSending = true;
  $('#ws-send-btn').disabled = true;
  $('#ws-askall').disabled = true;
  addLog('info', 'fa-bolt', t().logAskTeam);

  const placeholder = { role:'ai', agent: 'planner', text:'__typing__', ts: Date.now(), isTeam: true };
  pushMsg(placeholder);

  const destName = _destNameForApi();
  const history = messages.filter(m => m.role !== 'system' && m.text !== '__typing__' && m.text !== '__typing__').slice(-12).map(m => ({
    role: m.role === 'ai' ? 'assistant' : 'user',
    content: m.text
  }));

  let fullText = '';
  try {
    const r = await fetch(BACKEND_BASE + '/api/chat/team', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ messages: history, agent:'team', destination: currentDest, lang: currentLang })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.detail || 'HTTP ' + r.status);
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const ev = JSON.parse(raw);
          if (ev.type === 'team_result') {
            fullText = ev.text || '';
            const idx = messages.indexOf(placeholder);
            if (idx >= 0) messages[idx] = { role:'ai', agent:'planner', text: fullText, ts: Date.now(), isTeam: true };
            renderMessages();
          } else if (ev.type === 'done') {
            // already updated above
          } else if (ev.type === 'error') {
            throw new Error(ev.message || 'team error');
          }
        } catch(e) { /* malformed SSE — ignore */ }
      }
    }
    addLog('success', 'fa-bolt', _interp(t().logAskTeamDone, { n: fullText.length }));
  } catch (err) {
    const idx = messages.indexOf(placeholder);
    if (idx >= 0) messages[idx] = { role:'system', text: (t().sendErr) + ' (' + (err.message || err) + ')', ts: Date.now() };
    renderMessages();
    addLog('error', 'fa-exclamation-circle', escapeHtml(err.message || String(err)));
  } finally {
    isSending = false;
    $('#ws-send-btn').disabled = false;
    $('#ws-askall').disabled = false;
  }
}

/* ═════════════════ MAP MODAL ═════════════════ */
function _ensureModal() {
  let el = document.getElementById('ws-modal');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'ws-modal';
  el.className = 'ws-modal-overlay';
  el.addEventListener('click', e => { if (e.target === el) closeModalEl(); });
  document.body.appendChild(el);
  return el;
}
function closeModalEl() {
  const el = document.getElementById('ws-modal');
  if (el) el.classList.remove('show');
}

function openMapModal() {
  const el = _ensureModal();
  const d = dest();
  const destLabel = (d.titles[currentLang] || d.titles.en).replace(/<[^>]+>/g,'').trim();
  const region = { zh:'印度尼西亚',en:'Indonesia',ja:'インドネシア',ko:'인도네시아',id:'Indonesia' };
  const regionLabel = currentDest === 'kyoto' ? { zh:'日本', en:'Japan', ja:'日本', ko:'일본', id:'Jepang' }[currentLang] || 'Japan'
                    : currentDest === 'paris' ? { zh:'法国', en:'France', ja:'フランス', ko:'프랑스', id:'Prancis' }[currentLang] || 'France'
                    : currentDest === 'santorini' ? { zh:'希腊', en:'Greece', ja:'ギリシャ', ko:'그리스', id:'Yunani' }[currentLang] || 'Greece'
                    : currentDest === 'bali' ? region[currentLang] || 'Indonesia'
                    : { zh:'全球任意目的地', en:'Anywhere', ja:'どこでも', ko:'어디든', id:'Mana saja' }[currentLang] || 'Anywhere';

  el.innerHTML = `
    <div class="ws-modal">
      <div class="ws-modal-head">
        <div class="ws-modal-title"><span class="fa fa-map-marker"></span> ${escapeHtml(t().mapTitle)}</div>
        <button class="ws-modal-close"><span class="fa fa-times"></span></button>
      </div>
      <div class="ws-modal-body">
        <div class="ws-map-grid">
          <div class="ws-map-visual">
            <div style="text-align:center">
              <span class="fa fa-globe ws-map-globe"></span>
              <span class="fa fa-map-marker ws-map-pin"></span>
              <div class="ws-map-dest-name">${escapeHtml(destLabel)}</div>
              <div class="ws-map-dest-region">${escapeHtml(regionLabel)}</div>
            </div>
          </div>
          <div>
            <div class="ws-panel-section-title" style="margin-bottom:10px">${escapeHtml(_interp(t().mapRegionHeading, { dest: destLabel }))}</div>
            <div class="ws-map-region-list">
              ${(d.regions || []).map(r => `
                <div class="ws-map-region" data-region="${escapeHtml(r.name)}">
                  <div class="ws-map-region-name">${escapeHtml(r.name)}</div>
                  <div class="ws-map-region-desc">${escapeHtml(r.desc[currentLang] || r.desc.en)}</div>
                </div>
              `).join('') || '<div class="ws-empty" style="padding:30px 12px"><span class="fa fa-compass"></span><div style="margin-top:8px">—</div></div>'}
            </div>
          </div>
        </div>
      </div>
      <div class="ws-modal-foot">
        <button class="ws-action-btn secondary" style="max-width:160px" onclick="document.getElementById('ws-modal').classList.remove('show')"><span class="fa fa-times"></span> ${escapeHtml(t().mapClose)}</button>
      </div>
    </div>
  `;
  el.querySelector('.ws-modal-close').onclick = closeModalEl;
  el.querySelectorAll('.ws-map-region').forEach(r => r.onclick = () => {
    const name = r.dataset.region;
    closeModalEl();
    const q = { zh:`详细介绍${name}`, en:`Tell me about ${name}`, ja:`${name}について詳しく`, ko:`${name}에 대해 자세히`, id:`Ceritakan tentang ${name}` };
    sendMessage(q[currentLang] || q.en);
  });
  el.classList.add('show');
  addLog('info', 'fa-map-marker', t().logMapOpen);
}

/* ═════════════════ DIARY MODAL ═════════════════ */
async function generateDiary() {
  const userMsgs = messages.filter(m => m.role === 'user' || m.role === 'ai').slice(-20);
  if (userMsgs.length < 2) {
    const el = _ensureModal();
    el.innerHTML = `
      <div class="ws-modal">
        <div class="ws-modal-head">
          <div class="ws-modal-title"><span class="fa fa-book"></span> ${escapeHtml(t().diaryTitle)}</div>
          <button class="ws-modal-close"><span class="fa fa-times"></span></button>
        </div>
        <div class="ws-modal-body">
          <div class="ws-empty" style="padding:40px 20px">
            <span class="fa fa-pencil"></span>
            <div style="margin-top:10px;font-size:13px">${escapeHtml(t().diaryNeedChat)}</div>
          </div>
        </div>
        <div class="ws-modal-foot">
          <button class="ws-action-btn secondary" style="max-width:160px" onclick="closeModalEl()"><span class="fa fa-times"></span> ${escapeHtml(t().diaryClose)}</button>
        </div>
      </div>`;
    el.querySelector('.ws-modal-close').onclick = closeModalEl;
    el.classList.add('show');
    return;
  }

  const el = _ensureModal();
  el.innerHTML = `
    <div class="ws-modal">
      <div class="ws-modal-head">
        <div class="ws-modal-title"><span class="fa fa-book"></span> ${escapeHtml(t().diaryTitle)}</div>
        <button class="ws-modal-close"><span class="fa fa-times"></span></button>
      </div>
      <div class="ws-modal-body" id="ws-diary-body">
        <div class="ws-loading"><span class="fa fa-pencil"></span><div>${escapeHtml(t().diaryThinking)}</div></div>
      </div>
      <div class="ws-modal-foot">
        <button class="ws-action-btn secondary" style="max-width:160px" id="ws-diary-close"><span class="fa fa-times"></span> ${escapeHtml(t().diaryClose)}</button>
        <button class="ws-action-btn" style="max-width:200px" id="ws-diary-save" disabled><span class="fa fa-file-pdf-o"></span> ${escapeHtml(t().diarySaveBtn)}</button>
      </div>
    </div>`;
  el.querySelector('.ws-modal-close').onclick = closeModalEl;
  el.querySelector('#ws-diary-close').onclick = closeModalEl;
  el.classList.add('show');
  addLog('info', 'fa-pencil', t().logDiaryStart);

  const destName = _destNameForApi() || 'the destination';
  const transcript = userMsgs.map(m => (m.role === 'user' ? 'Traveler' : 'Agent') + ': ' + m.text).join('\n\n');
  const prompts = {
    zh: `根据下面与 AI 旅行助手的对话历史，为这次${destName}之旅写一篇精美的旅行游记，第一人称，富有画面感和情感，200-400字：\n\n${transcript}`,
    en: `Based on the following chat history with an AI travel assistant, write an elegant first-person travel diary for this ${destName} trip — evocative, sensory, 200-400 words:\n\n${transcript}`,
    ja: `以下のAI旅行アシスタントとの会話履歴に基づいて、この${destName}旅行の一人称の美しい紀行文を書いてください（情景豊かで200-400字）：\n\n${transcript}`,
    ko: `다음 AI 여행 도우미와의 대화 기록을 바탕으로, 이 ${destName} 여행의 일인칭 우아한 기행문을 200-400자로 작성하세요:\n\n${transcript}`,
    id: `Berdasarkan riwayat percakapan dengan asisten perjalanan AI berikut, tulis sebuah cerita perjalanan elegan orang pertama untuk perjalanan ${destName} ini — penuh suasana, 200-400 kata:\n\n${transcript}`
  };

  try {
    const r = await fetch(BACKEND_BASE + '/api/generate', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ prompt: prompts[currentLang] || prompts.en, max_tokens: 1200, lang: currentLang })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'HTTP ' + r.status);
    _diaryContent = data.content || data.text || data.reply || '';
    const today = new Date().toLocaleDateString([], { year:'numeric', month:'long', day:'numeric' });
    document.getElementById('ws-diary-body').innerHTML = `
      <div class="ws-diary-content ws-print-target">
        <h2>${escapeHtml(destName)} · ${escapeHtml(today)}</h2>
        <div class="ws-diary-meta">${escapeHtml(t().diaryTitle)} · WanderMind Studio</div>
        ${_diaryContent.split('\n').filter(p => p.trim()).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
      </div>`;
    const saveBtn = document.getElementById('ws-diary-save');
    saveBtn.disabled = false;
    saveBtn.onclick = () => window.print();
    addLog('success', 'fa-book', _interp(t().logDiaryDone, { n: _diaryContent.length }));
  } catch (err) {
    document.getElementById('ws-diary-body').innerHTML = `<div class="ws-error"><span class="fa fa-exclamation-circle"></span> ${escapeHtml(err.message || String(err))}</div>`;
    addLog('error', 'fa-exclamation-circle', escapeHtml(err.message || String(err)));
  }
}

/* ═════════════════ HOOK: log on chat send/recv/switch ═════════════════ */
const _origSendMessage = sendMessage;
sendMessage = async function(text) {
  const before = messages.length;
  const t0 = Date.now();
  const _name = AGENT_NAMES[currentLang][currentAgent] || currentAgent;
  const _text = (text || $('#ws-input').value || '').trim();
  if (_text) addLog('info', 'fa-paper-plane', _interp(t().logChatSent, { agent: _name }));
  const r = await _origSendMessage(text);
  // Wait microtask so the AI reply is in messages
  setTimeout(() => {
    const lastAi = [...messages].reverse().find(m => m.role === 'ai' && m.text && m.text !== '__typing__');
    if (lastAi && lastAi.ts >= t0) addLog('success', 'fa-comments-o', _interp(t().logChatRecv, { agent: _name, n: lastAi.text.length }));
  }, 100);
  return r;
};

const _origSwitchAgent = switchAgent;
switchAgent = function(key) {
  _origSwitchAgent(key);
  const nm = AGENT_NAMES[currentLang][key] || key;
  addLog('info', 'fa-user', _interp(t().logSwitchAgent, { agent: nm }));
};

const _origSwitchDest = switchDest;
switchDest = function(key) {
  _origSwitchDest(key);
  const labels = { bali:'Bali', kyoto:'Kyoto', paris:'Paris', santorini:'Santorini', any:'Anywhere' };
  addLog('info', 'fa-map-marker', _interp(t().logSwitchDest, { dest: labels[key] || key }));
  // Repaint compare + itinerary + budget panels for the new dest
  renderPanelCompare();
  renderPanelItinerary();
  renderPanelBudget();
};
