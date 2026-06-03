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
    showToast(t().toastPhase2 + ' · ' + t().topMap, 'fa-map-marker');
  } else if (id === 'budget') {
    switchPanelTab('budget');
  } else if (id === 'diary') {
    showToast(t().toastPhase2 + ' · ' + t().topDiary, 'fa-book');
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
    // jump right panel to itinerary
    switchPanelTab('itinerary');
    showToast(t().toastPhase2 + ' · ' + t().topItinerary, 'fa-calendar-o');
    return;
  }
  // Other quick actions: send a prepared prompt for the chat
  if (action === 'hotels') {
    const d = dest();
    const sug = (d.suggestions[currentLang] || d.suggestions.en)[0];
    if (sug) { sendMessage(sug.q); return; }
  }
  if (action === 'latest') {
    const queries = { zh:'查询此目的地最新的旅游资讯、天气和签证政策', en:'Look up the latest travel news, weather and visa policy for this destination', ja:'この目的地の最新旅行情報·天気·ビザ政策を調べて', ko:'이 목적지의 최신 여행 정보·날씨·비자 정책을 조회', id:'Cari berita perjalanan, cuaca, dan kebijakan visa terbaru untuk tujuan ini' };
    sendMessage(queries[currentLang] || queries.en);
    return;
  }
  showToast(t().toastPhase2, 'fa-bolt');
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
  renderPanelComing('compare',   'fa-balance-scale', t().panelCompare);
  renderPanelComing('itinerary', 'fa-calendar-o',    t().panelItinerary);
  renderPanelComing('budget',    'fa-credit-card',   t().panelBudget);
  renderPanelComing('log',       'fa-list-alt',      t().panelLog);
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
  renderPanelComing('compare',   'fa-balance-scale', t().panelCompare);
  renderPanelComing('itinerary', 'fa-calendar-o',    t().panelItinerary);
  renderPanelComing('budget',    'fa-credit-card',   t().panelBudget);
  renderPanelComing('log',       'fa-list-alt',      t().panelLog);
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
  $('#ws-askall').onclick = () => showToast(t().toastPhase2 + ' · ' + t().askAll, 'fa-bolt');
  $('#ws-newtrip-btn').onclick = () => showToast(t().toastPhase2 + ' · ' + t().sideNewTrip, 'fa-plus-circle');

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
