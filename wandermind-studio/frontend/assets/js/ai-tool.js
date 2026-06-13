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
      { cls:'tag-green', driver: true,
        title:{ zh:'司机推荐 · Dicky',en:'Driver · Dicky',ja:'ドライバー · Dicky',ko:'운전기사 · Dicky',id:'Driver Rekomendasi · Dicky' },
        tag:{ zh:'亲测靠谱',en:'Trusted',ja:'信頼済み',ko:'검증됨',id:'Terpercaya' },
        desc:{ zh:'本地司机 · 英语 · 机场接送 · 包车',en:'Local · English-speaking · Transfers · Tours',ja:'ローカル · 英語 · 空港送迎 · 貸切',ko:'현지 · 영어 · 픽업 · 전세 투어',id:'Driver lokal · Bisa bahasa Inggris · Jemput bandara · Tur privat' },
        contacts: [
          { icon:'fa-whatsapp', label:'WhatsApp', value:'+62 898-0532-230', href:'https://wa.me/628980532230' },
          { icon:'fa-book',     label:'Xiaohongshu', value:'Wander with ky (ID: 18613428065)', href:'https://www.xiaohongshu.com/user/profile/' },
          { icon:'fa-comment',  label:'WeChat',   value:'wxid_vkzbrp1iyg6t12', href:null }
        ]
      }
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
    sectionWeather:'目的地情报', sectionRegions:'热门区域', sectionTips:'实用贴士',
    rateLbl:'实时汇率', seasonLbl:'季节',
    comingTitle:'即将在 Phase 2 上线',
    comingDesc:'此模块功能正在迁移中，将与现有 H5 完全等价但视觉为 Studio 风格。',
    greetTitle:'你好，旅行者 👋', greetSub:'我是 WanderMind 旅程规划师 —— 告诉我你想去哪里、什么时候、和谁一起，我会和我的 5 个 AI 同事联手为你设计完整方案。',
    toastPhase2:'此功能将在 Phase 2 上线',
    welcomeUnknown:'欢迎选择目的地开始规划。',
    sendErr:'抱歉，请求出错了。请稍后重试或检查后端是否在线。',
    shareBtn:'分享', shareTip:'生成分享链接',
    shareModalTitle:'分享你的旅程', shareModalSub:'生成只读链接，朋友无需登录即可查看你的完整规划',
    shareLinkLabel:'你的分享链接', shareCopy:'复制', shareCopied:'已复制 ✓',
    shareNative:'系统分享…', shareRevoke:'取消分享',
    shareNothing:'还没有可分享的对话内容', shareErr:'生成分享链接失败',
    shareLoginReq:'请先登录后再生成分享链接', shareGenerating:'生成中…',
    sharedViews:'已被查看 {n} 次', sharedFrom:'分享自 {name}',
    sharedHero:'查看这份 WanderMind 旅程规划',
    sharedCta:'我也要规划一个'
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
    sectionWeather:'Destination Intel', sectionRegions:'Top Areas', sectionTips:'Practical Tips',
    rateLbl:'Live FX', seasonLbl:'Season',
    comingTitle:'Coming in Phase 2',
    comingDesc:'This module is being migrated — full feature parity with the existing H5, restyled to Studio.',
    greetTitle:'Hello traveller 👋', greetSub:'I am the WanderMind Trip Planner. Tell me where, when and with whom — my five AI colleagues and I will draft a complete plan together.',
    toastPhase2:'This feature lands in Phase 2',
    welcomeUnknown:'Pick a destination to start planning.',
    sendErr:'Sorry, the request failed. Please retry or check that the backend is online.',
    shareBtn:'Share', shareTip:'Generate share link',
    shareModalTitle:'Share your trip', shareModalSub:'Get a read-only link — friends can view your full plan without signing in',
    shareLinkLabel:'Your share link', shareCopy:'Copy', shareCopied:'Copied ✓',
    shareNative:'Share via…', shareRevoke:'Revoke share',
    shareNothing:'Start a conversation first — nothing to share yet', shareErr:'Failed to generate share link',
    shareLoginReq:'Please sign in to create a share link', shareGenerating:'Generating…',
    sharedViews:'Viewed {n} times', sharedFrom:'Shared by {name}',
    sharedHero:'View this WanderMind trip plan',
    sharedCta:'Plan my own trip'
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
    sectionWeather:'目的地情報', sectionRegions:'人気エリア', sectionTips:'実用ヒント',
    rateLbl:'為替', seasonLbl:'シーズン',
    comingTitle:'Phase 2 で公開予定',
    comingDesc:'このモジュールは移行中です。既存H5と機能同等、Studio風にリスタイル。',
    greetTitle:'こんにちは、旅人 👋', greetSub:'私はWanderMind旅程プランナーです。行きたい場所·時期·同行者を教えて。5人のAI同僚と一緒に完全プランを設計します。',
    toastPhase2:'この機能はPhase 2で公開',
    welcomeUnknown:'目的地を選んで計画を開始。',
    sendErr:'リクエストに失敗しました。バックエンドの状態を確認してください。',
    shareBtn:'共有', shareTip:'共有リンクを生成',
    shareModalTitle:'旅程を共有', shareModalSub:'読み取り専用リンク、ログイン不要で全プランを閲覧できます',
    shareLinkLabel:'共有リンク', shareCopy:'コピー', shareCopied:'コピー済み ✓',
    shareNative:'システム共有…', shareRevoke:'共有を取り消す',
    shareNothing:'まずチャットを開始してください', shareErr:'リンクの生成に失敗',
    shareLoginReq:'共有にはログインが必要です', shareGenerating:'生成中…',
    sharedViews:'{n}回閲覧されました', sharedFrom:'{name}さんが共有',
    sharedHero:'このWanderMind旅程プランを見る',
    sharedCta:'自分の旅程を計画する'
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
    sectionWeather:'목적지 정보', sectionRegions:'인기 지역', sectionTips:'실용 팁',
    rateLbl:'환율', seasonLbl:'시즌',
    comingTitle:'Phase 2 출시 예정',
    comingDesc:'이 모듈은 마이그레이션 중. 기존 H5와 동등하며 Studio 스타일.',
    greetTitle:'안녕하세요, 여행자 👋', greetSub:'저는 WanderMind 여행 플래너입니다. 어디로, 언제, 누구와 — 5명의 AI 동료와 함께 완전한 계획을 설계합니다.',
    toastPhase2:'이 기능은 Phase 2에서 제공',
    welcomeUnknown:'계획을 시작할 목적지를 선택하세요.',
    sendErr:'요청 실패. 백엔드 상태를 확인하세요.',
    shareBtn:'공유', shareTip:'공유 링크 생성',
    shareModalTitle:'여행 공유', shareModalSub:'읽기 전용 링크 — 친구는 로그인 없이 전체 계획을 볼 수 있음',
    shareLinkLabel:'공유 링크', shareCopy:'복사', shareCopied:'복사됨 ✓',
    shareNative:'시스템 공유…', shareRevoke:'공유 취소',
    shareNothing:'먼저 대화를 시작하세요', shareErr:'링크 생성 실패',
    shareLoginReq:'공유하려면 로그인하세요', shareGenerating:'생성 중…',
    sharedViews:'{n}회 조회됨', sharedFrom:'{name}님이 공유',
    sharedHero:'이 WanderMind 여행 계획 보기',
    sharedCta:'나도 여행 계획 시작'
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
    sectionWeather:'Info Destinasi', sectionRegions:'Area Populer', sectionTips:'Tips Praktis',
    rateLbl:'Kurs', seasonLbl:'Musim',
    comingTitle:'Hadir di Fase 2',
    comingDesc:'Modul ini sedang dimigrasikan — fitur setara H5, gaya Studio.',
    greetTitle:'Halo traveler 👋', greetSub:'Saya Perencana WanderMind. Beri tahu ke mana, kapan, dengan siapa — bersama 5 rekan AI saya, kami buat rencana lengkap.',
    toastPhase2:'Fitur ini hadir di Fase 2',
    welcomeUnknown:'Pilih tujuan untuk mulai merencanakan.',
    sendErr:'Permintaan gagal. Periksa apakah backend online.',
    shareBtn:'Bagikan', shareTip:'Buat link berbagi',
    shareModalTitle:'Bagikan perjalanan', shareModalSub:'Link hanya-baca — teman bisa lihat rencana lengkap tanpa login',
    shareLinkLabel:'Link Anda', shareCopy:'Salin', shareCopied:'Tersalin ✓',
    shareNative:'Bagikan via…', shareRevoke:'Cabut share',
    shareNothing:'Mulai percakapan dulu', shareErr:'Gagal membuat link',
    shareLoginReq:'Masuk dulu untuk berbagi', shareGenerating:'Membuat…',
    sharedViews:'Dilihat {n} kali', sharedFrom:'Dibagikan oleh {name}',
    sharedHero:'Lihat rencana WanderMind ini',
    sharedCta:'Rencanakan punyaku'
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
  $('#ws-newtrip-label').textContent = t().sideNewTrip;
  $('#ws-agents-title').textContent = t().sideAgents;

  // Trip list — only when logged in
  const listEl = $('#ws-trip-list');
  const emptyEl = $('#ws-trip-empty');
  if (typeof isLoggedIn === 'function' && isLoggedIn() && Array.isArray(tripList) && tripList.length) {
    listEl.innerHTML = tripList.map(trip => `
      <div class="ws-trip-item ${trip.id === currentTripId ? 'active' : ''}" data-trip="${escapeHtml(trip.id)}">
        <span class="fa fa-bookmark-o"></span>
        <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(trip.title || trip.dest || 'Trip')}</span>
        <span class="fa fa-times ws-trip-del" data-del="${escapeHtml(trip.id)}" title="${escapeHtml(t().tripDelete || 'Delete')}" style="opacity:.4;font-size:10px"></span>
      </div>
    `).join('');
    emptyEl.style.display = 'none';
    listEl.querySelectorAll('.ws-trip-item').forEach(el => {
      el.onclick = e => {
        if (e.target.classList.contains('ws-trip-del')) return;
        if (typeof loadTrip === 'function') loadTrip(el.dataset.trip);
      };
    });
    listEl.querySelectorAll('.ws-trip-del').forEach(x => {
      x.onclick = e => { e.stopPropagation(); if (typeof deleteTripById === 'function') deleteTripById(x.dataset.del); };
    });
  } else {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    emptyEl.innerHTML = (typeof isLoggedIn === 'function' && isLoggedIn()) ? t().tripEmpty : (t().tripLoginToSave || t().tripEmpty);
  }

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
  const shareLbl = $('#ws-share-label');
  if (shareLbl) shareLbl.textContent = t().shareBtn;
  const shareBtn = $('#ws-share-btn');
  if (shareBtn) shareBtn.setAttribute('title', t().shareTip || t().shareBtn);

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
  if (action === 'budgetcalc') { openBudgetCalcModal(); return; }
  if (action === 'multiverse') { openMultiverseModal(); return; }
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
  // Section title stays clean — the LIVE/SAMPLE badge is added by the
  // Phase 2.5 wrapper below (renderPanelDest override). Single source of truth.
  $('#ws-section-weather').textContent = t().sectionWeather;
  $('#ws-section-regions').textContent = t().sectionRegions;
  $('#ws-section-tips').textContent = t().sectionTips;
  $('#ws-rate-lbl').textContent = t().rateLbl;
  $('#ws-season-lbl').textContent = t().seasonLbl;

  $('#ws-w-temp').textContent = w.temp;
  $('#ws-w-cond').textContent = (w.cond && typeof w.cond === 'object') ? (w.cond[currentLang] || w.cond.en) : (w.cond || '');
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
  $('#ws-tip-list').innerHTML = (d.tips || []).map(tip => {
    const contactsHtml = (tip.contacts || []).map(c => {
      const inner = `<span class="fa ${escapeHtml(c.icon)}" aria-hidden="true"></span><span class="ws-tip-contact-text">${escapeHtml(c.value)}</span>`;
      return c.href
        ? `<a class="ws-tip-contact" href="${escapeHtml(c.href)}" target="_blank" rel="noopener" title="${escapeHtml(c.label)}">${inner}</a>`
        : `<div class="ws-tip-contact" title="${escapeHtml(c.label)}">${inner}</div>`;
    }).join('');
    return `
      <div class="ws-tip ${tip.driver ? 'driver' : ''}">
        <div class="ws-tip-head">
          <span class="ws-tip-title">${escapeHtml(tip.title[currentLang] || tip.title.en)}</span>
          <span class="ws-tip-tag ${tip.cls}">${escapeHtml(tip.tag[currentLang] || tip.tag.en)}</span>
        </div>
        <div class="ws-tip-desc">${escapeHtml(tip.desc[currentLang] || tip.desc.en)}</div>
        ${contactsHtml ? `<div class="ws-tip-contacts">${contactsHtml}</div>` : ''}
      </div>
    `;
  }).join('');
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
    // Build messages array matching backend ChatReq shape:
    // history (last 12 turns) + the new user message.
    const history = messages
      .filter(m => m.role !== 'system' && m.text !== '__typing__' && m !== aiPlaceholder)
      .slice(-12)
      .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
    history.push({ role: 'user', content: text });

    const langLabel = { zh:'Chinese', en:'English', ja:'Japanese', ko:'Korean', id:'Indonesian' }[currentLang] || 'English';
    const agentName = AGENT_NAMES[currentLang][currentAgent] || currentAgent;
    const destName = _destNameForApi ? (_destNameForApi() || currentDest) : currentDest;
    const systemPrompt =
      `You are WanderMind, a senior travel planner currently acting as the "${agentName}" specialist.\n` +
      `Current destination context: ${destName}.\n` +
      `IMPORTANT: respond ONLY in ${langLabel}. Never switch language mid-reply.\n` +
      `Be concrete, warm, and editorial. Use short paragraphs and occasional bullet lists when useful.`;

    const r = await fetch(BACKEND_BASE + '/api/chat/once', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        system: systemPrompt,
        agent: currentAgent,
        destination: currentDest,
        mode: currentMode === 'fast' ? 'fast' : 'pro',
        search: true
      })
    });
    if (!r.ok) {
      let detail = 'HTTP ' + r.status;
      try { const e = await r.json(); detail = e.detail || detail; } catch (_) {}
      throw new Error(detail);
    }
    const data = await r.json();
    const reply = (data && (data.text || data.reply || data.message || data.content)) || (t().sendErr);
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
  // Reset hotel area selection since chip lists differ per destination
  _selectedHotelArea = 'all';
  renderChatHeader();
  renderPanelDest();
  if (typeof renderPanelCompare === 'function') renderPanelCompare();
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
  $('#ws-newtrip-btn').onclick = () => { if (typeof createNewTrip === 'function') createNewTrip(); };
  const shareBtn = $('#ws-share-btn');
  if (shareBtn) shareBtn.onclick = openShareModal;

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

/* ═════════════════ HOTEL AREAS (per-destination) ═════════════════
   "key" — internal id, "q" — search keyword appended to dest for SerpAPI,
   "name" — localized chip label, "tag" — short subtitle hint.
   Bali 9 areas · Kyoto 5 · Paris 6 · Santorini 5 · Custom dynamic.       */
const HOTEL_AREAS = {
  bali: [
    {key:'all',         q:'',                name:{zh:'全部',en:'All',ja:'すべて',ko:'전체',id:'Semua'},                                 tag:{zh:'综合',en:'All',ja:'全',ko:'전체',id:'Semua'}},
    {key:'seminyak',    q:'Seminyak',        name:{zh:'水明漾',en:'Seminyak',ja:'スミニャック',ko:'스미냑',id:'Seminyak'},               tag:{zh:'时尚海滩',en:'Trendy beach',ja:'おしゃれビーチ',ko:'트렌디 비치',id:'Pantai trendi'}},
    {key:'canggu',      q:'Canggu',          name:{zh:'仓古',en:'Canggu',ja:'チャングー',ko:'창구',id:'Canggu'},                         tag:{zh:'数字游民',en:'Digital nomad',ja:'デジタルノマド',ko:'디지털 노마드',id:'Digital nomad'}},
    {key:'ubud',        q:'Ubud',            name:{zh:'乌布',en:'Ubud',ja:'ウブド',ko:'우붓',id:'Ubud'},                                 tag:{zh:'文化雨林',en:'Jungle culture',ja:'文化と森',ko:'문화 정글',id:'Budaya hutan'}},
    {key:'uluwatu',     q:'Uluwatu',         name:{zh:'乌鲁瓦图',en:'Uluwatu',ja:'ウルワトゥ',ko:'울루와뚜',id:'Uluwatu'},               tag:{zh:'蜜月悬崖',en:'Honeymoon cliff',ja:'ハネムーン断崖',ko:'허니문 절벽',id:'Tebing bulan madu'}},
    {key:'sanur',       q:'Sanur',           name:{zh:'沙努尔',en:'Sanur',ja:'サヌール',ko:'사누르',id:'Sanur'},                         tag:{zh:'家庭安静',en:'Family quiet',ja:'家族向け静か',ko:'가족 한적',id:'Keluarga tenang'}},
    {key:'jimbaran',    q:'Jimbaran',        name:{zh:'金巴兰',en:'Jimbaran',ja:'ジンバラン',ko:'짐바란',id:'Jimbaran'},                 tag:{zh:'海鲜悬崖',en:'Seafood cliff',ja:'海鮮と崖',ko:'해산물 절벽',id:'Tebing seafood'}},
    {key:'kuta',        q:'Kuta',            name:{zh:'库塔',en:'Kuta',ja:'クタ',ko:'쿠타',id:'Kuta'},                                   tag:{zh:'夜生活',en:'Nightlife',ja:'ナイトライフ',ko:'나이트라이프',id:'Nightlife'}},
    {key:'nusa-dua',    q:'Nusa Dua',        name:{zh:'努沙杜瓦',en:'Nusa Dua',ja:'ヌサドゥア',ko:'누사두아',id:'Nusa Dua'},             tag:{zh:'高端度假',en:'Luxury resort',ja:'高級リゾート',ko:'럭셔리 리조트',id:'Resor mewah'}},
    {key:'lembongan',   q:'Nusa Lembongan',  name:{zh:'蓝梦岛',en:'Nusa Lembongan',ja:'ヌサ・レンボンガン',ko:'누사 렘봉안',id:'Nusa Lembongan'}, tag:{zh:'离岛浮潜',en:'Island snorkeling',ja:'離島スノーケル',ko:'섬 스노클링',id:'Snorkeling pulau'}},
  ],
  kyoto: [
    {key:'all',           q:'',                     name:{zh:'全部',en:'All',ja:'すべて',ko:'전체',id:'Semua'},                tag:{zh:'综合',en:'All',ja:'全',ko:'전체',id:'Semua'}},
    {key:'gion',          q:'Gion',                 name:{zh:'祇园',en:'Gion',ja:'祇園',ko:'기온',id:'Gion'},                  tag:{zh:'传统茶屋',en:'Traditional',ja:'伝統茶屋',ko:'전통 다실',id:'Tradisional'}},
    {key:'kawaramachi',   q:'Kawaramachi Downtown', name:{zh:'河原町',en:'Kawaramachi',ja:'河原町',ko:'가와라마치',id:'Kawaramachi'}, tag:{zh:'市中心',en:'Downtown',ja:'繁華街',ko:'도심',id:'Pusat kota'}},
    {key:'higashiyama',   q:'Higashiyama',          name:{zh:'东山',en:'Higashiyama',ja:'東山',ko:'히가시야마',id:'Higashiyama'}, tag:{zh:'寺庙密集',en:'Temple zone',ja:'寺院密集',ko:'사찰 밀집',id:'Kawasan kuil'}},
    {key:'arashiyama',    q:'Arashiyama',           name:{zh:'嵐山',en:'Arashiyama',ja:'嵐山',ko:'아라시야마',id:'Arashiyama'}, tag:{zh:'竹林安静',en:'Bamboo quiet',ja:'竹林の静けさ',ko:'대나무 한적',id:'Bambu tenang'}},
    {key:'kyoto-station', q:'Kyoto Station',        name:{zh:'京都站',en:'Kyoto Station',ja:'京都駅',ko:'교토역',id:'Stasiun Kyoto'}, tag:{zh:'交通枢纽',en:'Transit hub',ja:'交通要所',ko:'교통 허브',id:'Transit'}},
  ],
  paris: [
    {key:'all',            q:'',                                    name:{zh:'全部',en:'All',ja:'すべて',ko:'전체',id:'Semua'},                                       tag:{zh:'综合',en:'All',ja:'全',ko:'전체',id:'Semua'}},
    {key:'marais',         q:'Le Marais 4th arrondissement',        name:{zh:'玛黑区',en:'Le Marais',ja:'マレ地区',ko:'마레',id:'Le Marais'},                         tag:{zh:'综合首选',en:'Top all-round',ja:'総合一番',ko:'올라운드 1위',id:'Pilihan utama'}},
    {key:'saint-germain',  q:'Saint-Germain-des-Pres 6th',          name:{zh:'圣日耳曼',en:'Saint-Germain',ja:'サンジェルマン',ko:'생제르맹',id:'Saint-Germain'},     tag:{zh:'文艺优雅',en:'Chic literary',ja:'文芸エレガント',ko:'문예 우아',id:'Sastra elegan'}},
    {key:'montmartre',     q:'Montmartre 18th arrondissement',      name:{zh:'蒙马特',en:'Montmartre',ja:'モンマルトル',ko:'몽마르트르',id:'Montmartre'},             tag:{zh:'电影感',en:'Cinematic',ja:'映画的',ko:'영화 분위기',id:'Sinematik'}},
    {key:'latin-quarter',  q:'Latin Quarter 5th arrondissement',    name:{zh:'拉丁区',en:'Latin Quarter',ja:'カルチエ・ラタン',ko:'라탱 지구',id:'Latin Quarter'},    tag:{zh:'性价比',en:'Value',ja:'コスパ',ko:'가성비',id:'Hemat'}},
    {key:'champs-elysees', q:'Champs-Elysees 8th arrondissement',   name:{zh:'香榭丽舍',en:'Champs-Élysées',ja:'シャンゼリゼ',ko:'샹젤리제',id:'Champs-Élysées'},    tag:{zh:'奢华商务',en:'Luxury',ja:'高級ビジネス',ko:'럭셔리 비즈니스',id:'Bisnis mewah'}},
    {key:'louvre',         q:'Louvre 1st arrondissement',           name:{zh:'卢浮宫',en:'Louvre 1st',ja:'ルーブル1区',ko:'루브르 1구',id:'Louvre 1'},               tag:{zh:'核心经典',en:'Core classic',ja:'中心クラシック',ko:'중심 클래식',id:'Pusat klasik'}},
  ],
  santorini: [
    {key:'all',         q:'',                  name:{zh:'全部',en:'All',ja:'すべて',ko:'전체',id:'Semua'},                              tag:{zh:'综合',en:'All',ja:'全',ko:'전체',id:'Semua'}},
    {key:'oia',         q:'Oia',               name:{zh:'伊亚',en:'Oia',ja:'イア',ko:'이아',id:'Oia'},                                   tag:{zh:'蜜月奢华',en:'Honeymoon',ja:'ハネムーン',ko:'허니문',id:'Bulan madu'}},
    {key:'fira',        q:'Fira',              name:{zh:'菲拉',en:'Fira',ja:'フィラ',ko:'피라',id:'Fira'},                                tag:{zh:'首都便利',en:'Capital',ja:'首都便利',ko:'수도 편리',id:'Ibu kota'}},
    {key:'imerovigli',  q:'Imerovigli',        name:{zh:'伊姆罗维利',en:'Imerovigli',ja:'イメロヴィグリ',ko:'이메로비글리',id:'Imerovigli'}, tag:{zh:'静奢悬崖',en:'Cliff calm',ja:'静かな崖',ko:'조용한 절벽',id:'Tebing tenang'}},
    {key:'kamari',      q:'Kamari',            name:{zh:'卡马里',en:'Kamari',ja:'カマリ',ko:'카마리',id:'Kamari'},                        tag:{zh:'黑沙海滩',en:'Black sand',ja:'黒砂浜',ko:'검은 모래',id:'Pasir hitam'}},
    {key:'perissa',     q:'Perissa',           name:{zh:'佩里萨',en:'Perissa',ja:'ペリッサ',ko:'페리사',id:'Perissa'},                    tag:{zh:'平价海滩',en:'Budget beach',ja:'格安ビーチ',ko:'저렴한 해변',id:'Pantai murah'}},
  ],
  custom: []  // dynamically populated when /api/dest_info returns hotelAreas for a new destination
};

function _hotelAreasFor(destKey) {
  if (destKey === 'any') return HOTEL_AREAS.custom || [];
  return HOTEL_AREAS[destKey] || [];
}

/* —— State for Phase 2 features —— */
let _hotels = [];      // last hotel search results
let _flights = [];     // last flight search results
let _flightTripType = 'round';
let _selectedHotelArea = 'all';   // chip key: 'all', 'seminyak', etc.
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
  const areas = _hotelAreasFor(currentDest);

  wrap.innerHTML = `
    <div class="ws-subtabs">
      <button class="ws-subtab ${_compareSub==='hotels'?'active':''}" data-sub="hotels"><span class="fa fa-bed"></span> ${escapeHtml(t().compareSubHotels)}</button>
      <button class="ws-subtab ${_compareSub==='flights'?'active':''}" data-sub="flights"><span class="fa fa-plane"></span> ${escapeHtml(t().compareSubFlights)}</button>
    </div>
    <div id="ws-sub-hotels" style="display:${_compareSub==='hotels'?'block':'none'}">
      ${areas.length ? `
        <div class="ws-form-label">${escapeHtml(t().hotelAreaLabel)}</div>
        <div class="ws-area-chips" id="ws-hotel-areas">
          ${areas.map(a => {
            const label = (a.name && (a.name[currentLang] || a.name.en)) || a.key;
            const subtag = (a.tag && (a.tag[currentLang] || a.tag.en)) || '';
            const isActive = _selectedHotelArea === a.key;
            return `<button class="ws-area-chip ${isActive?'active':''}" data-area-key="${escapeHtml(a.key)}" title="${escapeHtml(subtag)}">${escapeHtml(label)}</button>`;
          }).join('')}
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
  // Area chips — toggle by KEY (not display name) so localized labels still match
  wrap.querySelectorAll('.ws-area-chip').forEach(c => c.onclick = () => {
    _selectedHotelArea = (_selectedHotelArea === c.dataset.areaKey) ? 'all' : c.dataset.areaKey;
    wrap.querySelectorAll('.ws-area-chip').forEach(x => x.classList.toggle('active', x.dataset.areaKey === _selectedHotelArea));
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
  // Look up the selected area's SerpAPI keyword; 'all' or unknown → no suffix
  const areaList = _hotelAreasFor(currentDest);
  const areaObj = areaList.find(a => a.key === _selectedHotelArea);
  const areaQ = (areaObj && areaObj.q) || '';
  const queryDest = areaQ ? `${destName} ${areaQ}` : destName;
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

  // Language-aware default itinerary (used when the destination has no
  // pre-curated day-by-day data)
  const FALLBACK_ITIN = {
    en: [
      { icon:'fa-plane',        color:'#0e7c6b', dayLabel:'Day 1', title:'Arrival & settle in',  desc:'Airport transfer, check-in, gentle first stroll' },
      { icon:'fa-camera',       color:'#7c3aed', dayLabel:'Day 2', title:'Headline sights',      desc:'Highest-impact landmarks while energy is fresh' },
      { icon:'fa-cutlery',      color:'#ea580c', dayLabel:'Day 3', title:'Food & neighbourhoods', desc:'Local eats, slower exploration, optional class' },
      { icon:'fa-leaf',         color:'#10b981', dayLabel:'Day 4', title:'Nature day',           desc:'Day trip — beach / mountain / temple route' },
      { icon:'fa-shopping-bag', color:'#fcbf1e', dayLabel:'Day 5', title:'Markets & rest',       desc:'Shopping, café-hopping, spa or downtime' },
      { icon:'fa-suitcase',     color:'#2563eb', dayLabel:'Day 6', title:'Free time & departure',desc:'Final highlights, pack up, transfer back' }
    ],
    zh: [
      { icon:'fa-plane',        color:'#0e7c6b', dayLabel:'第 1 天', title:'抵达 · 安顿',           desc:'机场接送、入住、傍晚轻松漫步' },
      { icon:'fa-camera',       color:'#7c3aed', dayLabel:'第 2 天', title:'核心地标',             desc:'体力最好的一天打卡最具代表性的景点' },
      { icon:'fa-cutlery',      color:'#ea580c', dayLabel:'第 3 天', title:'美食 · 街区',          desc:'本地餐厅、慢节奏探索、可选体验课' },
      { icon:'fa-leaf',         color:'#10b981', dayLabel:'第 4 天', title:'自然一日',             desc:'郊外一日游 —— 海滩 / 山林 / 寺庙路线' },
      { icon:'fa-shopping-bag', color:'#fcbf1e', dayLabel:'第 5 天', title:'市集 · 放松',          desc:'购物、咖啡馆漫游、SPA 或休息' },
      { icon:'fa-suitcase',     color:'#2563eb', dayLabel:'第 6 天', title:'自由活动 · 返程',     desc:'最后回顾、收拾行李、机场送机' }
    ],
    ja: [
      { icon:'fa-plane',        color:'#0e7c6b', dayLabel:'1日目', title:'到着・落ち着く',         desc:'空港送迎、チェックイン、夕方の散歩' },
      { icon:'fa-camera',       color:'#7c3aed', dayLabel:'2日目', title:'主要観光地',             desc:'体力のあるうちに代表的なスポットへ' },
      { icon:'fa-cutlery',      color:'#ea580c', dayLabel:'3日目', title:'グルメ・街歩き',         desc:'地元の名店、ゆったり散策、体験講座も' },
      { icon:'fa-leaf',         color:'#10b981', dayLabel:'4日目', title:'自然デー',               desc:'郊外日帰り — ビーチ／山／寺院ルート' },
      { icon:'fa-shopping-bag', color:'#fcbf1e', dayLabel:'5日目', title:'市場・リフレッシュ',     desc:'ショッピング、カフェ巡り、スパ' },
      { icon:'fa-suitcase',     color:'#2563eb', dayLabel:'6日目', title:'自由時間・帰国',         desc:'ハイライト再訪、荷造り、空港へ' }
    ],
    ko: [
      { icon:'fa-plane',        color:'#0e7c6b', dayLabel:'1일차', title:'도착 · 적응',           desc:'공항 픽업, 체크인, 저녁 가벼운 산책' },
      { icon:'fa-camera',       color:'#7c3aed', dayLabel:'2일차', title:'대표 명소',             desc:'체력 좋은 첫 풀데이에 핵심 랜드마크' },
      { icon:'fa-cutlery',      color:'#ea580c', dayLabel:'3일차', title:'음식 · 동네',           desc:'현지 맛집, 느린 탐방, 선택형 클래스' },
      { icon:'fa-leaf',         color:'#10b981', dayLabel:'4일차', title:'자연 데이',             desc:'당일치기 — 해변 / 산 / 사원 코스' },
      { icon:'fa-shopping-bag', color:'#fcbf1e', dayLabel:'5일차', title:'시장 · 휴식',           desc:'쇼핑, 카페 투어, 스파 또는 휴식' },
      { icon:'fa-suitcase',     color:'#2563eb', dayLabel:'6일차', title:'자유 시간 · 출국',     desc:'마지막 하이라이트, 짐 정리, 공항 이동' }
    ],
    id: [
      { icon:'fa-plane',        color:'#0e7c6b', dayLabel:'Hari 1', title:'Tiba & menyesuaikan diri', desc:'Jemput bandara, check-in, jalan santai sore' },
      { icon:'fa-camera',       color:'#7c3aed', dayLabel:'Hari 2', title:'Landmark utama',         desc:'Tempat ikonik saat energi masih segar' },
      { icon:'fa-cutlery',      color:'#ea580c', dayLabel:'Hari 3', title:'Kuliner & lingkungan',   desc:'Tempat makan lokal, jelajah santai, kelas opsional' },
      { icon:'fa-leaf',         color:'#10b981', dayLabel:'Hari 4', title:'Hari alam',              desc:'Trip sehari — pantai / gunung / pura' },
      { icon:'fa-shopping-bag', color:'#fcbf1e', dayLabel:'Hari 5', title:'Pasar & istirahat',      desc:'Belanja, café-hopping, spa atau santai' },
      { icon:'fa-suitcase',     color:'#2563eb', dayLabel:'Hari 6', title:'Waktu bebas & pulang',  desc:'Tempat favorit terakhir, packing, antar bandara' }
    ]
  };
  const fallback = FALLBACK_ITIN[currentLang] || FALLBACK_ITIN.en;
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
    const langLabel = { zh:'Chinese', en:'English', ja:'Japanese', ko:'Korean', id:'Indonesian' }[currentLang] || 'English';
    const destName = _destNameForApi() || currentDest;
    const teamSys =
      `You are WanderMind, a multi-agent travel platform. Three specialists (Trip Planner, Activity Curator, Budget Manager) are answering in parallel.\n` +
      `Current destination context: ${destName}.\n` +
      `IMPORTANT: respond ONLY in ${langLabel}. Combine the three expert viewpoints into one consolidated reply.`;
    const r = await fetch(BACKEND_BASE + '/api/chat/team', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ messages: history, system: teamSys, agent:'team', destination: currentDest, mode:'pro', search:false })
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

/* ═════════════════ SHARE MODAL ═════════════════ */
async function openShareModal() {
  const T = t();
  // Need at least some content to share
  const realMsgs = messages.filter(m => (m.role === 'user' || m.role === 'ai') && m.text && m.text !== '__typing__');
  if (realMsgs.length === 0) {
    showToast(T.shareNothing || 'Nothing to share yet');
    return;
  }
  if (!isLoggedIn()) {
    showToast(T.shareLoginReq || 'Please sign in first');
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return;
  }

  const el = _ensureModal();
  el.innerHTML = `
    <div class="ws-modal" style="max-width:520px">
      <div class="ws-modal-head">
        <div class="ws-modal-title"><span class="fa fa-share-alt"></span> ${escapeHtml(T.shareModalTitle)}</div>
        <button class="ws-modal-close"><span class="fa fa-times"></span></button>
      </div>
      <div class="ws-modal-body">
        <p style="margin:0 0 14px;color:var(--ws-ink-3);font-size:13px">${escapeHtml(T.shareModalSub)}</p>
        <div class="ws-share-loading" id="ws-share-loading">
          <span class="fa fa-spinner"></span> ${escapeHtml(T.shareGenerating)}
        </div>
        <div id="ws-share-result" style="display:none"></div>
      </div>
    </div>
  `;
  el.querySelector('.ws-modal-close').onclick = closeModalEl;
  el.classList.add('show');

  // Build the snapshot payload
  const payload = {
    conv_id: currentTripId || null,
    title: (tripList.find(x => x.id === currentTripId) || {}).title || _autoTitle(),
    dest: currentDest,
    messages: realMsgs.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
      agent: m.agent || null
    })),
    trip_meta: currentTrip || {}
  };

  try {
    const r = await fetch(BACKEND_BASE + '/api/share/create', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const errData = await r.json().catch(() => ({}));
      throw new Error(errData.detail || T.shareErr);
    }
    const data = await r.json();
    const fullUrl = window.location.origin + data.url;
    _renderShareResult(fullUrl, data.token);
    addLog('success', 'fa-share-alt', `${T.shareBtn}: ${data.token}`);
  } catch (err) {
    const loadingEl = document.getElementById('ws-share-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `<span class="fa fa-exclamation-circle" style="color:#dc2626"></span> ${escapeHtml(err.message || T.shareErr)}`;
    }
  }
}

function _renderShareResult(url, token) {
  const T = t();
  const loadingEl = document.getElementById('ws-share-loading');
  const resultEl = document.getElementById('ws-share-result');
  if (!resultEl) return;
  if (loadingEl) loadingEl.style.display = 'none';
  resultEl.style.display = 'block';

  const hasNativeShare = typeof navigator.share === 'function';

  resultEl.innerHTML = `
    <div style="font-size:12.5px;font-weight:600;color:var(--ws-ink-2);margin-bottom:4px">${escapeHtml(T.shareLinkLabel)}</div>
    <div class="ws-share-link-row">
      <input type="text" class="ws-share-link-input" id="ws-share-link-input" value="${escapeHtml(url)}" readonly>
      <button class="ws-share-copy-btn" id="ws-share-copy"><span class="fa fa-copy"></span> <span>${escapeHtml(T.shareCopy)}</span></button>
    </div>
    <div class="ws-share-actions">
      ${hasNativeShare ? `<button class="ws-action-btn" id="ws-share-native"><span class="fa fa-paper-plane"></span> ${escapeHtml(T.shareNative)}</button>` : ''}
      <button class="ws-action-btn secondary" id="ws-share-revoke"><span class="fa fa-trash-o"></span> ${escapeHtml(T.shareRevoke)}</button>
    </div>
  `;

  const input = document.getElementById('ws-share-link-input');
  // Auto-select on focus for desktop usability
  input.onfocus = () => input.select();

  const copyBtn = document.getElementById('ws-share-copy');
  copyBtn.onclick = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        input.select();
        document.execCommand('copy');
      }
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = `<span class="fa fa-check"></span> <span>${escapeHtml(T.shareCopied)}</span>`;
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = `<span class="fa fa-copy"></span> <span>${escapeHtml(T.shareCopy)}</span>`;
      }, 1800);
    } catch (_) { /* silent */ }
  };

  const nativeBtn = document.getElementById('ws-share-native');
  if (nativeBtn) {
    nativeBtn.onclick = async () => {
      try {
        await navigator.share({
          title: 'WanderMind',
          text: T.sharedHero,
          url: url
        });
      } catch (_) { /* user cancelled */ }
    };
  }

  const revokeBtn = document.getElementById('ws-share-revoke');
  revokeBtn.onclick = async () => {
    if (!confirm(T.shareRevoke + '?')) return;
    try {
      await fetch(BACKEND_BASE + '/api/share/' + token, {
        method:'DELETE',
        headers: authHeaders()
      });
      closeModalEl();
      showToast(T.shareRevoke + ' ✓');
    } catch (_) { /* silent */ }
  };
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
  // Phase 2.5: fetch live data for the new destination (silent)
  if (typeof fetchDestInfo === 'function') fetchDestInfo(key);
};

/* ═══════════════════════════════════════════════════════════════════════
   PHASE 2.5 — Live destination data via /api/dest_info
   ═══════════════════════════════════════════════════════════════════════ */

Object.assign(TOOL_I18N.en, { liveTag:'LIVE', sampleTag:'SAMPLE', destLoading:'Loading live data…' });
Object.assign(TOOL_I18N.zh, { liveTag:'实时', sampleTag:'示例', destLoading:'加载实时数据…' });
Object.assign(TOOL_I18N.ja, { liveTag:'ライブ', sampleTag:'サンプル', destLoading:'リアル情報読込中…' });
Object.assign(TOOL_I18N.ko, { liveTag:'실시간', sampleTag:'샘플', destLoading:'실시간 데이터 로드 중…' });
Object.assign(TOOL_I18N.id, { liveTag:'LIVE', sampleTag:'SAMPLE', destLoading:'Memuat data langsung…' });

let _destInfoCache = {};
let _destIsLive = {};

const _DEST_API_NAMES = {
  bali:'Bali, Indonesia',
  kyoto:'Kyoto, Japan',
  paris:'Paris, France',
  santorini:'Santorini, Greece'
};

async function fetchDestInfo(key, force = false) {
  const apiDest = _DEST_API_NAMES[key];
  if (!apiDest) return;
  const cacheKey = key + ':' + currentLang;
  if (!force && _destInfoCache[cacheKey]) {
    _applyDestInfo(key, _destInfoCache[cacheKey]);
    return;
  }
  addLog('info', 'fa-cloud-download', _interp((currentLang==='zh'?'获取 {d} 实时数据':'Fetching live data for {d}'), { d: apiDest }));
  try {
    const r = await fetch(BACKEND_BASE + '/api/dest_info', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ destination: apiDest, lang: currentLang })
    });
    if (!r.ok) {
      let detail = 'HTTP ' + r.status;
      try { const e = await r.json(); detail = e.detail || detail; } catch(_) {}
      throw new Error(detail);
    }
    const data = await r.json();
    _destInfoCache[cacheKey] = data;
    _applyDestInfo(key, data);
    addLog('success', 'fa-cloud', _interp((currentLang==='zh'?'{d} · 实时数据已加载':'{d} · live data loaded'), { d: apiDest }));
  } catch (err) {
    addLog('warn', 'fa-cloud-download', _interp((currentLang==='zh'?'实时数据获取失败 · 使用示例: {e}':'Live fetch failed, using sample: {e}'), { e: err.message || err }));
  }
  // After dest_info, layer real-time weather on top (gracefully fails if no key)
  fetchLiveWeather(key);
}

// —— Live weather via OpenWeatherMap (backend /api/weather) ——
// Silently no-ops if the backend has no OPENWEATHER_API_KEY set.
async function fetchLiveWeather(key) {
  const apiDest = key;  // backend looks up alias internally
  try {
    const r = await fetch(BACKEND_BASE + '/api/weather?city=' + encodeURIComponent(apiDest) + '&lang=' + currentLang);
    if (!r.ok) {
      // 503 = no key configured — that's expected and silent
      if (r.status !== 503) {
        addLog('warn', 'fa-cloud-download', 'Live weather unavailable · HTTP ' + r.status);
      }
      return;
    }
    const w = await r.json();
    // Overwrite current dest's weather card with real data
    const d = DESTS[key];
    if (!d || !d.weather) return;
    d.weather.temp = w.temp;
    d.weather.details = w.details;
    d.weather.icon = w.icon;  // FA icon class (already mapped backend-side)
    d.weather.cond = { ...(d.weather.cond || {}), [currentLang]: w.cond };
    d._isLive = true;
    d._liveUpdatedAt = w.updated_at || Math.floor(Date.now() / 1000);
    // Repaint dest panel if it's the currently selected destination
    if (key === currentDest && typeof renderPanelDest === 'function') renderPanelDest();
    addLog('success', 'fa-thermometer-half', _interp((currentLang==='zh'?'{d} · 实时天气已更新':'{d} · live weather updated'), { d: apiDest }));
  } catch (_) {
    // Network error — silent (we have static fallback)
  }
}

function _applyDestInfo(key, data) {
  const d = DESTS[key];
  if (!d || !data) return;
  // Weather — backend returns strings already localised since we passed `lang`
  if (data.weather) {
    if (data.weather.temp) d.weather.temp = data.weather.temp;
    if (data.weather.details) d.weather.details = data.weather.details;
    if (data.weather.cond) d.weather.cond = { ...(d.weather.cond || {}), [currentLang]: data.weather.cond };
  }
  if (data.rate) d.rate = data.rate;
  if (data.season) d.season = { ...(d.season || {}), [currentLang]: data.season };
  if (data.seasonDesc) d.seasonDesc = { ...(d.seasonDesc || {}), [currentLang]: data.seasonDesc };
  if (Array.isArray(data.regions) && data.regions.length) {
    d.regions = data.regions.map(r => ({
      name: r.name || '—',
      cls: r.cls || 'tag-blue',
      tag: { [currentLang]: r.tag || '' },
      desc: { [currentLang]: r.desc || '' }
    }));
  }
  if (Array.isArray(data.tips) && data.tips.length) {
    // Preserve any driver/partner tips that exist in static data
    const driverTips = (d.tips || []).filter(tip => tip.driver);
    d.tips = [
      ...data.tips.map(tip => ({
        cls: tip.cls || 'tag-blue',
        title: { [currentLang]: tip.title || '' },
        tag: { [currentLang]: tip.tag || '' },
        desc: { [currentLang]: tip.desc || '' }
      })),
      ...driverTips
    ];
  }
  // Populate dynamic hotel areas for the "any city" destination
  if (key === 'any' && Array.isArray(data.hotelAreas) && data.hotelAreas.length > 0) {
    HOTEL_AREAS.custom = [
      { key:'all', q:'', name:{zh:'全部',en:'All',ja:'すべて',ko:'전체',id:'Semua'}, tag:{zh:'综合',en:'All',ja:'全',ko:'전체',id:'Semua'} },
      ...data.hotelAreas.map((a, idx) => ({
        key: (a.key || `area-${idx}`).toLowerCase().replace(/\s+/g, '-'),
        q: a.q || a.name || '',
        name: { [currentLang]: a.name || a.q || `Area ${idx+1}` },
        tag: { [currentLang]: a.tag || '' }
      }))
    ];
    _selectedHotelArea = 'all';
  }
  _destIsLive[key] = true;
  // Repaint UI surfaces that use this data
  if (currentDest === key) {
    renderPanelDest();
    renderChatHeader();
    if (typeof renderPanelCompare === 'function') renderPanelCompare();
  }
}

// Augment the destination section title with a LIVE chip after each render.
// Only shown when EITHER dest_info AI data OR OpenWeather real data succeeded.
// When data is sample (not live), the title stays clean with no badge.
const _origRenderPanelDest = renderPanelDest;
renderPanelDest = function() {
  _origRenderPanelDest();
  const titleEl = document.getElementById('ws-section-weather');
  if (!titleEl) return;
  const d = DESTS[currentDest] || {};
  const live = !!_destIsLive[currentDest] || !!d._isLive;
  // Always remove existing chip first (textContent was already reset by _orig)
  const existing = titleEl.querySelector('.ws-live-chip');
  if (existing) existing.remove();
  // Only show badge when data is actually live — no badge for sample data
  if (live) {
    titleEl.insertAdjacentHTML('beforeend',
      ` <span class="ws-live-chip" style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:8px;background:#10b981;color:#fff;letter-spacing:.05em;margin-left:6px;vertical-align:middle">${escapeHtml(t().liveTag)}</span>`);
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   PHASE 3a — Auth + Trip persistence
   ═══════════════════════════════════════════════════════════════════════ */

Object.assign(TOOL_I18N.en, {
  // New-trip wizard
  ntTitle:'New trip', ntIntro:'Fill in the basics — your AI team will plan the rest.',
  ntDest:'Destination', ntPeople:'People', ntStart:'Depart', ntEnd:'Return',
  ntBudget:'Total budget', ntBudgetPh:'e.g. 3000', ntStyle:'Style',
  ntStyleBudget:'Budget · backpack', ntStyleComfort:'Comfort · balanced', ntStyleLuxury:'Luxury · premium',
  ntSubmit:'Start planning', ntAnonNote:'Sign in afterwards to save this trip across devices.',
  ntCreatedToast:'New trip: {dest} · {n}d', ntChipDepart:'departure', ntChipDays:'{n} days', ntChipPeople:'{n} people',
  destBali:'Bali · Indonesia', destKyoto:'Kyoto · Japan', destParis:'Paris · France', destSantorini:'Santorini · Greece', destAny:'Anywhere',
  errDatesRequired:'Please pick both dates', errEndAfterStart:'Return date must be after depart', errBudgetRequired:'Please enter a budget',
  logTripCreated2:'Trip created · <strong>{dest}</strong> · {n} days',
  authLogin:'Sign in', authRegister:'Create account', authEmail:'Email', authPassword:'Password', authName:'Your name',
  authLogout:'Sign out', authLoginCta:'Save trips · sync prefs · access on any device.',
  authNeed:'Sign in to save this trip', tripLoginToSave:'Sign in to save your trips across devices.',
  tripDelete:'Delete', tripUntitled:'Untitled trip',
  newTripStarted:'New trip started — start chatting to save it',
  logLogin:'Signed in as <strong>{name}</strong>', logLogout:'Signed out',
  logTripSaved:'Trip saved · <strong>{title}</strong>',
  logTripLoaded:'Loaded trip · <strong>{title}</strong>',
  logTripCreated:'New trip created', logTripDeleted:'Trip deleted',
  errInvalidEmail:'Please enter a valid email', errShortPw:'Password must be at least 6 characters',
  errLoginFail:'Sign-in failed', errRegisterFail:'Sign-up failed',
  authForgotLink:'Forgot password?', authForgotTitle:'Reset your password',
  authForgotSub:'Enter your email and we will send you a reset link (valid 1 hour).',
  authForgotBtn:'Send reset link', authForgotSending:'Sending…',
  authForgotSent:'If that email is registered, a reset link has been sent. Check your inbox.',
  authForgotBack:'Back to sign in'
});
Object.assign(TOOL_I18N.zh, {
  ntTitle:'新建行程', ntIntro:'填上基础信息 —— 剩下的交给 AI 团队来规划',
  ntDest:'目的地', ntPeople:'人数', ntStart:'出发日期', ntEnd:'返回日期',
  ntBudget:'总预算', ntBudgetPh:'例：20000', ntStyle:'旅行风格',
  ntStyleBudget:'节俭穷游', ntStyleComfort:'舒适平衡', ntStyleLuxury:'奢享高端',
  ntSubmit:'开始规划行程', ntAnonNote:'之后登录即可跨设备保存此行程',
  ntCreatedToast:'新行程：{dest} · {n}天', ntChipDepart:'出发', ntChipDays:'{n} 天', ntChipPeople:'{n} 人',
  destBali:'巴厘岛 · 印尼', destKyoto:'京都 · 日本', destParis:'巴黎 · 法国', destSantorini:'圣托里尼 · 希腊', destAny:'任意目的地',
  errDatesRequired:'请选择出行日期', errEndAfterStart:'返回日期必须晚于出发日期', errBudgetRequired:'请填写预算金额',
  logTripCreated2:'新行程已创建 · <strong>{dest}</strong> · {n} 天',
  authLogin:'登录', authRegister:'注册', authEmail:'邮箱', authPassword:'密码', authName:'你的名字',
  authLogout:'退出', authLoginCta:'保存行程 · 同步偏好 · 多设备访问',
  authForgotLink:'忘记密码？', authForgotTitle:'重置你的密码',
  authForgotSub:'输入你的注册邮箱，我们会发送一封重置链接（1 小时内有效）。',
  authForgotBtn:'发送重置链接', authForgotSending:'发送中…',
  authForgotSent:'如果这个邮箱已注册，重置链接已发出。请查收邮箱（包括垃圾邮件）。',
  authForgotBack:'返回登录',
  authNeed:'请先登录以保存此行程', tripLoginToSave:'登录后可跨设备保存你的行程',
  tripDelete:'删除', tripUntitled:'未命名行程',
  newTripStarted:'新行程已开始 —— 开始对话即自动保存',
  logLogin:'已登录 · <strong>{name}</strong>', logLogout:'已退出登录',
  logTripSaved:'行程已保存 · <strong>{title}</strong>',
  logTripLoaded:'已载入行程 · <strong>{title}</strong>',
  logTripCreated:'新建行程成功', logTripDeleted:'行程已删除',
  errInvalidEmail:'请输入有效的邮箱', errShortPw:'密码至少 6 位',
  errLoginFail:'登录失败', errRegisterFail:'注册失败'
});
Object.assign(TOOL_I18N.ja, {
  ntTitle:'新規旅行', ntIntro:'基本情報を入力 — 残りはAIチームが計画',
  ntDest:'目的地', ntPeople:'人数', ntStart:'出発日', ntEnd:'帰着日',
  ntBudget:'総予算', ntBudgetPh:'例：300000', ntStyle:'旅スタイル',
  ntStyleBudget:'予算重視 · バックパック', ntStyleComfort:'快適 · バランス', ntStyleLuxury:'豪華 · プレミアム',
  ntSubmit:'プランニング開始', ntAnonNote:'後でログインすると端末間で保存可能',
  ntCreatedToast:'新規旅行: {dest} · {n}日', ntChipDepart:'出発', ntChipDays:'{n} 日', ntChipPeople:'{n} 人',
  destBali:'バリ · インドネシア', destKyoto:'京都 · 日本', destParis:'パリ · フランス', destSantorini:'サントリーニ · ギリシャ', destAny:'任意の目的地',
  errDatesRequired:'日付を両方選択してください', errEndAfterStart:'帰着日は出発日より後である必要', errBudgetRequired:'予算を入力してください',
  logTripCreated2:'新規旅行作成 · <strong>{dest}</strong> · {n} 日',
  authLogin:'ログイン', authRegister:'新規登録', authEmail:'メール', authPassword:'パスワード', authName:'お名前',
  authLogout:'ログアウト', authLoginCta:'旅程を保存・好みを同期・どの端末からも',
  authForgotLink:'パスワードをお忘れ？', authForgotTitle:'パスワードをリセット',
  authForgotSub:'登録メールを入力してください。リセットリンクを送信します（1時間有効）。',
  authForgotBtn:'リセットリンクを送信', authForgotSending:'送信中…',
  authForgotSent:'登録済みの場合、リセットリンクを送信しました。受信箱をご確認ください。',
  authForgotBack:'ログインに戻る',
  authNeed:'保存にはログインが必要', tripLoginToSave:'ログインで旅程を端末間同期',
  tripDelete:'削除', tripUntitled:'無題の旅行',
  newTripStarted:'新しい旅行を開始 — チャットすると自動保存',
  logLogin:'<strong>{name}</strong>としてログイン', logLogout:'ログアウト済み',
  logTripSaved:'旅行保存 · <strong>{title}</strong>',
  logTripLoaded:'旅行を読込 · <strong>{title}</strong>',
  logTripCreated:'新規旅行作成', logTripDeleted:'旅行削除',
  errInvalidEmail:'有効なメールを入力', errShortPw:'パスワードは6文字以上',
  errLoginFail:'ログイン失敗', errRegisterFail:'登録失敗'
});
Object.assign(TOOL_I18N.ko, {
  ntTitle:'새 여행', ntIntro:'기본 정보를 입력하세요 — 나머지는 AI 팀이 계획합니다',
  ntDest:'목적지', ntPeople:'인원', ntStart:'출발일', ntEnd:'귀국일',
  ntBudget:'총 예산', ntBudgetPh:'예: 3000000', ntStyle:'여행 스타일',
  ntStyleBudget:'알뜰 · 배낭', ntStyleComfort:'편안 · 균형', ntStyleLuxury:'럭셔리 · 프리미엄',
  ntSubmit:'계획 시작', ntAnonNote:'나중에 로그인하여 기기 간 저장 가능',
  ntCreatedToast:'새 여행: {dest} · {n}일', ntChipDepart:'출발', ntChipDays:'{n} 일', ntChipPeople:'{n} 명',
  destBali:'발리 · 인도네시아', destKyoto:'교토 · 일본', destParis:'파리 · 프랑스', destSantorini:'산토리니 · 그리스', destAny:'어디든',
  errDatesRequired:'날짜를 모두 선택하세요', errEndAfterStart:'귀국일은 출발일보다 늦어야 합니다', errBudgetRequired:'예산을 입력하세요',
  logTripCreated2:'새 여행 생성 · <strong>{dest}</strong> · {n} 일',
  authLogin:'로그인', authRegister:'회원가입', authEmail:'이메일', authPassword:'비밀번호', authName:'이름',
  authLogout:'로그아웃', authLoginCta:'여행 저장 · 선호 동기화 · 모든 기기',
  authForgotLink:'비밀번호를 잊으셨나요?', authForgotTitle:'비밀번호 재설정',
  authForgotSub:'가입한 이메일을 입력하시면 재설정 링크를 보내드립니다 (1시간 유효).',
  authForgotBtn:'재설정 링크 보내기', authForgotSending:'전송 중…',
  authForgotSent:'가입된 이메일이면 재설정 링크가 발송되었습니다. 받은편지함을 확인하세요.',
  authForgotBack:'로그인으로 돌아가기',
  authNeed:'저장하려면 로그인 필요', tripLoginToSave:'로그인하여 여행을 기기 간 동기화',
  tripDelete:'삭제', tripUntitled:'제목 없는 여행',
  newTripStarted:'새 여행 시작 — 대화 시 자동 저장',
  logLogin:'<strong>{name}</strong>(으)로 로그인', logLogout:'로그아웃됨',
  logTripSaved:'여행 저장 · <strong>{title}</strong>',
  logTripLoaded:'여행 로드 · <strong>{title}</strong>',
  logTripCreated:'새 여행 생성', logTripDeleted:'여행 삭제',
  errInvalidEmail:'유효한 이메일 입력', errShortPw:'비밀번호 6자 이상',
  errLoginFail:'로그인 실패', errRegisterFail:'가입 실패'
});
Object.assign(TOOL_I18N.id, {
  ntTitle:'Perjalanan baru', ntIntro:'Isi info dasar — sisanya direncanakan tim AI',
  ntDest:'Tujuan', ntPeople:'Orang', ntStart:'Berangkat', ntEnd:'Pulang',
  ntBudget:'Anggaran total', ntBudgetPh:'mis: 3000', ntStyle:'Gaya',
  ntStyleBudget:'Hemat · backpack', ntStyleComfort:'Nyaman · seimbang', ntStyleLuxury:'Mewah · premium',
  ntSubmit:'Mulai merencanakan', ntAnonNote:'Masuk nanti untuk menyimpan lintas perangkat',
  ntCreatedToast:'Perjalanan baru: {dest} · {n}h', ntChipDepart:'berangkat', ntChipDays:'{n} hari', ntChipPeople:'{n} orang',
  destBali:'Bali · Indonesia', destKyoto:'Kyoto · Jepang', destParis:'Paris · Prancis', destSantorini:'Santorini · Yunani', destAny:'Mana saja',
  errDatesRequired:'Pilih kedua tanggal', errEndAfterStart:'Tanggal pulang harus setelah berangkat', errBudgetRequired:'Masukkan anggaran',
  logTripCreated2:'Perjalanan baru · <strong>{dest}</strong> · {n} hari',
  authLogin:'Masuk', authRegister:'Daftar', authEmail:'Email', authPassword:'Kata sandi', authName:'Nama',
  authLogout:'Keluar', authLoginCta:'Simpan perjalanan · sinkron preferensi · semua perangkat',
  authForgotLink:'Lupa kata sandi?', authForgotTitle:'Reset kata sandi',
  authForgotSub:'Masukkan email terdaftar — kami akan mengirim link reset (berlaku 1 jam).',
  authForgotBtn:'Kirim link reset', authForgotSending:'Mengirim…',
  authForgotSent:'Jika email terdaftar, link reset telah dikirim. Cek inbox Anda.',
  authForgotBack:'Kembali ke masuk',
  authNeed:'Masuk untuk menyimpan perjalanan ini', tripLoginToSave:'Masuk untuk menyimpan perjalanan lintas perangkat',
  tripDelete:'Hapus', tripUntitled:'Perjalanan tanpa judul',
  newTripStarted:'Perjalanan baru dimulai — chat untuk menyimpan',
  logLogin:'Masuk sebagai <strong>{name}</strong>', logLogout:'Keluar',
  logTripSaved:'Perjalanan tersimpan · <strong>{title}</strong>',
  logTripLoaded:'Memuat perjalanan · <strong>{title}</strong>',
  logTripCreated:'Perjalanan baru dibuat', logTripDeleted:'Perjalanan dihapus',
  errInvalidEmail:'Masukkan email valid', errShortPw:'Kata sandi minimal 6 karakter',
  errLoginFail:'Gagal masuk', errRegisterFail:'Gagal daftar'
});

let authToken  = localStorage.getItem('wm_studio_token') || null;
let authUser   = (() => { try { return JSON.parse(localStorage.getItem('wm_studio_user') || 'null'); } catch(_) { return null; } })();
let tripList   = [];
let currentTripId = null;
let _saveTimer = null;

function isLoggedIn() { return !!authToken && !!authUser; }
function authHeaders() { return authToken ? { Authorization: 'Bearer ' + authToken } : {}; }

function _autoTitle() {
  const labels = { bali:'Bali', kyoto:'Kyoto', paris:'Paris', santorini:'Santorini', any:'Custom' };
  const firstUser = messages.find(m => m.role === 'user');
  const preview = firstUser ? (firstUser.text.slice(0, 24) + (firstUser.text.length > 24 ? '…' : '')) : (labels[currentDest] || 'Trip');
  return preview;
}

async function doLogin(email, password) {
  const r = await fetch(BACKEND_BASE + '/api/auth/login', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || t().errLoginFail);
  authToken = data.token;
  authUser  = data.user;
  localStorage.setItem('wm_studio_token', authToken);
  localStorage.setItem('wm_studio_user', JSON.stringify(authUser));
  updateAuthUI();
  await loadTrips();
  closeModalEl();
  addLog('success', 'fa-sign-in', _interp(t().logLogin, { name: authUser.name || authUser.email }));
}

async function doRegister(name, email, password) {
  const r = await fetch(BACKEND_BASE + '/api/auth/register', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || t().errRegisterFail);
  authToken = data.token;
  authUser  = data.user;
  localStorage.setItem('wm_studio_token', authToken);
  localStorage.setItem('wm_studio_user', JSON.stringify(authUser));
  updateAuthUI();
  await loadTrips();
  closeModalEl();
  addLog('success', 'fa-sign-in', _interp(t().logLogin, { name: authUser.name || authUser.email }));
}

function doLogout() {
  authToken = null;
  authUser  = null;
  currentTripId = null;
  tripList = [];
  messages = [];
  localStorage.removeItem('wm_studio_token');
  localStorage.removeItem('wm_studio_user');
  updateAuthUI();
  renderSidebar();
  renderMessages();
  addLog('info', 'fa-sign-out', t().logLogout);
}

function showAuthModal(tab = 'login') {
  const el = _ensureModal();
  const T = t();
  el.innerHTML = `
    <div class="ws-modal" style="max-width:440px">
      <div class="ws-modal-head">
        <div class="ws-modal-title"><span class="fa fa-user-circle-o"></span> ${escapeHtml(tab === 'login' ? T.authLogin : T.authRegister)}</div>
        <button class="ws-modal-close"><span class="fa fa-times"></span></button>
      </div>
      <div class="ws-modal-body">
        <p style="color:var(--ws-ink-3);font-size:13px;margin:0 0 18px;line-height:1.6">${escapeHtml(T.authLoginCta)}</p>
        <div class="ws-auth-tabs">
          <button class="ws-auth-tab ${tab==='login'?'active':''}" data-auth-tab="login">${escapeHtml(T.authLogin)}</button>
          <button class="ws-auth-tab ${tab==='register'?'active':''}" data-auth-tab="register">${escapeHtml(T.authRegister)}</button>
        </div>
        <div class="ws-auth-form" data-form="login" style="display:${tab==='login'?'block':'none'}">
          <input type="email" class="ws-form-input ws-auth-input" id="ws-li-email" placeholder="${escapeHtml(T.authEmail)}" autocomplete="email">
          <input type="password" class="ws-form-input ws-auth-input" id="ws-li-pw" placeholder="${escapeHtml(T.authPassword)}" autocomplete="current-password">
          <div class="ws-auth-error" id="ws-li-err"></div>
          <button class="ws-search-btn" id="ws-li-btn"><span class="fa fa-sign-in"></span> ${escapeHtml(T.authLogin)}</button>
          <div style="text-align:right;margin-top:10px">
            <a href="#" id="ws-li-forgot" style="font-size:12.5px;color:var(--ws-teal);text-decoration:none">${escapeHtml(T.authForgotLink)}</a>
          </div>
        </div>
        <div class="ws-auth-form" data-form="register" style="display:${tab==='register'?'block':'none'}">
          <input type="text" class="ws-form-input ws-auth-input" id="ws-rg-name" placeholder="${escapeHtml(T.authName)}" autocomplete="name">
          <input type="email" class="ws-form-input ws-auth-input" id="ws-rg-email" placeholder="${escapeHtml(T.authEmail)}" autocomplete="email">
          <input type="password" class="ws-form-input ws-auth-input" id="ws-rg-pw" placeholder="${escapeHtml(T.authPassword)} (6+)" autocomplete="new-password">
          <div class="ws-auth-error" id="ws-rg-err"></div>
          <button class="ws-search-btn" id="ws-rg-btn"><span class="fa fa-user-plus"></span> ${escapeHtml(T.authRegister)}</button>
        </div>
        <div class="ws-auth-form" data-form="forgot" style="display:none">
          <h3 style="font-size:16px;font-weight:700;margin:0 0 8px;color:var(--ws-ink)">${escapeHtml(T.authForgotTitle)}</h3>
          <p style="font-size:13px;color:var(--ws-ink-3);margin:0 0 14px;line-height:1.6">${escapeHtml(T.authForgotSub)}</p>
          <input type="email" class="ws-form-input ws-auth-input" id="ws-fp-email" placeholder="${escapeHtml(T.authEmail)}" autocomplete="email">
          <div class="ws-auth-error" id="ws-fp-msg"></div>
          <button class="ws-search-btn" id="ws-fp-btn"><span class="fa fa-paper-plane"></span> ${escapeHtml(T.authForgotBtn)}</button>
          <div style="text-align:center;margin-top:10px">
            <a href="#" id="ws-fp-back" style="font-size:12.5px;color:var(--ws-ink-3);text-decoration:none">← ${escapeHtml(T.authForgotBack)}</a>
          </div>
        </div>
      </div>
    </div>
  `;
  el.querySelector('.ws-modal-close').onclick = closeModalEl;
  el.querySelectorAll('.ws-auth-tab').forEach(b => b.onclick = () => {
    el.querySelectorAll('.ws-auth-tab').forEach(x => x.classList.toggle('active', x.dataset.authTab === b.dataset.authTab));
    el.querySelectorAll('.ws-auth-form').forEach(f => f.style.display = (f.dataset.form === b.dataset.authTab ? 'block' : 'none'));
  });
  const liBtn = document.getElementById('ws-li-btn');
  liBtn.onclick = async () => {
    const email = document.getElementById('ws-li-email').value.trim();
    const pw    = document.getElementById('ws-li-pw').value;
    const err   = document.getElementById('ws-li-err');
    err.textContent = '';
    if (!/.+@.+\..+/.test(email)) { err.textContent = T.errInvalidEmail; return; }
    if (!pw) { err.textContent = T.authPassword; return; }
    liBtn.disabled = true;
    try { await doLogin(email, pw); } catch (e) { err.textContent = e.message || T.errLoginFail; }
    liBtn.disabled = false;
  };
  const rgBtn = document.getElementById('ws-rg-btn');
  rgBtn.onclick = async () => {
    const name  = document.getElementById('ws-rg-name').value.trim();
    const email = document.getElementById('ws-rg-email').value.trim();
    const pw    = document.getElementById('ws-rg-pw').value;
    const err   = document.getElementById('ws-rg-err');
    err.textContent = '';
    if (!name) { err.textContent = T.authName; return; }
    if (!/.+@.+\..+/.test(email)) { err.textContent = T.errInvalidEmail; return; }
    if (pw.length < 6) { err.textContent = T.errShortPw; return; }
    rgBtn.disabled = true;
    try { await doRegister(name, email, pw); } catch (e) { err.textContent = e.message || T.errRegisterFail; }
    rgBtn.disabled = false;
  };
  // Enter to submit
  el.querySelectorAll('.ws-auth-input').forEach(inp => inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const form = inp.closest('.ws-auth-form');
      const btn = form.querySelector('.ws-search-btn');
      if (btn) btn.click();
    }
  }));

  // Forgot password — show inline panel instead of leaving the modal
  const showForm = which => {
    el.querySelectorAll('.ws-auth-form').forEach(f => f.style.display = (f.dataset.form === which ? 'block' : 'none'));
    el.querySelectorAll('.ws-auth-tab').forEach(t => t.style.display = (which === 'forgot' ? 'none' : ''));
  };
  const forgotLink = document.getElementById('ws-li-forgot');
  if (forgotLink) forgotLink.onclick = e => {
    e.preventDefault();
    showForm('forgot');
    const pre = document.getElementById('ws-li-email').value.trim();
    if (pre) document.getElementById('ws-fp-email').value = pre;
    document.getElementById('ws-fp-email').focus();
  };
  const fpBack = document.getElementById('ws-fp-back');
  if (fpBack) fpBack.onclick = e => { e.preventDefault(); showForm('login'); };
  const fpBtn = document.getElementById('ws-fp-btn');
  if (fpBtn) fpBtn.onclick = async () => {
    const email = document.getElementById('ws-fp-email').value.trim();
    const msg   = document.getElementById('ws-fp-msg');
    msg.style.color = '';
    msg.textContent = '';
    if (!/.+@.+\..+/.test(email)) { msg.textContent = T.errInvalidEmail; return; }
    fpBtn.disabled = true;
    const oldHtml = fpBtn.innerHTML;
    fpBtn.innerHTML = `<span class="fa fa-spinner fa-spin"></span> ${escapeHtml(T.authForgotSending)}`;
    try {
      await fetch(BACKEND_BASE + '/api/auth/forgot-password', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ email })
      });
      // Always show success — never leak whether the email exists
      msg.style.color = 'var(--ws-teal)';
      msg.textContent = T.authForgotSent;
    } catch (e) {
      msg.textContent = e.message || T.errLoginFail;
    } finally {
      fpBtn.disabled = false;
      fpBtn.innerHTML = oldHtml;
    }
  };

  el.classList.add('show');
}

async function loadTrips() {
  if (!isLoggedIn()) { tripList = []; renderSidebar(); return; }
  try {
    const r = await fetch(BACKEND_BASE + '/api/conversations', { headers: authHeaders() });
    if (r.status === 401) { doLogout(); return; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    tripList = await r.json();
    renderSidebar();
  } catch (err) { /* silent */ }
}

async function loadTrip(id) {
  if (!isLoggedIn()) return;
  try {
    const r = await fetch(BACKEND_BASE + '/api/conversations/' + id, { headers: authHeaders() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    currentTripId = id;
    if (data.dest && DESTS[data.dest]) { currentDest = data.dest; localStorage.setItem('wm_studio_dest', data.dest); }
    const raw = typeof data.messages === 'string' ? JSON.parse(data.messages || '[]') : (data.messages || []);
    messages = raw.map(m => ({
      role: m.role === 'assistant' ? 'ai' : (m.role === 'user' ? 'user' : 'system'),
      agent: m.role === 'assistant' ? (m.agent || 'planner') : null,
      text: m.content || m.text || '',
      ts: Date.now()
    }));
    renderChatHeader();
    renderPanelDest();
    renderSidebar();
    renderMessages();
    addLog('info', 'fa-folder-open-o', _interp(t().logTripLoaded, { title: data.title || t().tripUntitled }));
  } catch (err) {
    addLog('error', 'fa-exclamation-circle', escapeHtml(err.message || String(err)));
  }
}

async function saveCurrentTrip() {
  if (!isLoggedIn() || messages.length === 0) return;
  const title = (tripList.find(x => x.id === currentTripId) || {}).title || _autoTitle();
  try {
    const r = await fetch(BACKEND_BASE + '/api/conversations', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', ...authHeaders() },
      body: JSON.stringify({
        conv_id: currentTripId,
        dest: currentDest,
        title: title || t().tripUntitled,
        messages: messages
          .filter(m => m.role !== 'system' && m.text !== '__typing__')
          .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text, agent: m.agent || null }))
      })
    });
    if (!r.ok) return;
    const data = await r.json();
    if (data && data.conv_id) currentTripId = data.conv_id;
    await loadTrips();
    addLog('success', 'fa-floppy-o', _interp(t().logTripSaved, { title }));
  } catch (_) { /* silent */ }
}

function scheduleAutoSave() {
  if (!isLoggedIn()) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveCurrentTrip, 2500);
}

async function deleteTripById(id) {
  if (!isLoggedIn()) return;
  if (!confirm(t().tripDelete + '?')) return;
  try {
    await fetch(BACKEND_BASE + '/api/conversations/' + id, { method:'DELETE', headers: authHeaders() });
    if (currentTripId === id) { currentTripId = null; messages = []; renderMessages(); }
    addLog('info', 'fa-trash-o', t().logTripDeleted);
    await loadTrips();
  } catch (_) { /* silent */ }
}

function createNewTrip() {
  // Anonymous users can still plan a trip — they just can't save it.
  // Auth check happens at submit time for graceful flow.
  showNewTripModal();
}

let currentTrip = (() => {
  try { return JSON.parse(localStorage.getItem('wm_studio_currentTrip') || 'null'); }
  catch(_) { return null; }
})();

function showNewTripModal() {
  const el = _ensureModal();
  const T = t();
  const today = new Date().toISOString().split('T')[0];
  const week  = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  el.innerHTML = `
    <div class="ws-modal" style="max-width:520px">
      <div class="ws-modal-head">
        <div class="ws-modal-title"><span class="fa fa-bookmark-o"></span> ${escapeHtml(T.ntTitle)}</div>
        <button class="ws-modal-close"><span class="fa fa-times"></span></button>
      </div>
      <div class="ws-modal-body">
        <p style="color:var(--ws-ink-3);font-size:13px;margin:0 0 16px;line-height:1.6">${escapeHtml(T.ntIntro)}</p>
        <div class="ws-form-row">
          <div class="ws-form-field">
            <label class="ws-form-label">${escapeHtml(T.ntDest)}</label>
            <select class="ws-form-select" id="ws-nt-dest">
              <option value="bali">${escapeHtml(T.destBali)}</option>
              <option value="kyoto">${escapeHtml(T.destKyoto)}</option>
              <option value="paris">${escapeHtml(T.destParis)}</option>
              <option value="santorini">${escapeHtml(T.destSantorini)}</option>
              <option value="any">${escapeHtml(T.destAny)}</option>
            </select>
          </div>
          <div class="ws-form-field" style="max-width:120px">
            <label class="ws-form-label">${escapeHtml(T.ntPeople)}</label>
            <select class="ws-form-select" id="ws-nt-people">
              <option value="1">1</option>
              <option value="2" selected>2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5+</option>
            </select>
          </div>
        </div>
        <div class="ws-form-row">
          <div class="ws-form-field">
            <label class="ws-form-label">${escapeHtml(T.ntStart)}</label>
            <input type="date" class="ws-form-input" id="ws-nt-start" value="${today}">
          </div>
          <div class="ws-form-field">
            <label class="ws-form-label">${escapeHtml(T.ntEnd)}</label>
            <input type="date" class="ws-form-input" id="ws-nt-end" value="${week}">
          </div>
        </div>
        <div class="ws-form-row">
          <div class="ws-form-field" style="flex:1">
            <label class="ws-form-label">${escapeHtml(T.ntBudget)}</label>
            <input type="number" class="ws-form-input" id="ws-nt-budget" placeholder="${escapeHtml(T.ntBudgetPh)}" min="500" step="500">
          </div>
          <div class="ws-form-field" style="flex:1.2">
            <label class="ws-form-label">${escapeHtml(T.ntStyle)}</label>
            <select class="ws-form-select" id="ws-nt-style">
              <option value="budget">${escapeHtml(T.ntStyleBudget)}</option>
              <option value="comfort" selected>${escapeHtml(T.ntStyleComfort)}</option>
              <option value="luxury">${escapeHtml(T.ntStyleLuxury)}</option>
            </select>
          </div>
        </div>
        <div class="ws-auth-error" id="ws-nt-err"></div>
        <button class="ws-action-btn" id="ws-nt-submit" style="margin-top:14px"><span class="fa fa-rocket"></span> ${escapeHtml(T.ntSubmit)}</button>
        ${!isLoggedIn() ? `<p style="font-size:11.5px;color:var(--ws-ink-3);text-align:center;margin-top:10px"><span class="fa fa-info-circle"></span> ${escapeHtml(T.ntAnonNote)}</p>` : ''}
      </div>
    </div>
  `;
  // Preselect current destination
  document.getElementById('ws-nt-dest').value = (currentDest === 'any' ? 'bali' : currentDest);

  el.querySelector('.ws-modal-close').onclick = closeModalEl;
  document.getElementById('ws-nt-submit').onclick = submitNewTrip;
  el.classList.add('show');
}

async function submitNewTrip() {
  const T = t();
  const dest   = document.getElementById('ws-nt-dest').value;
  const people = parseInt(document.getElementById('ws-nt-people').value) || 2;
  const start  = document.getElementById('ws-nt-start').value;
  const end    = document.getElementById('ws-nt-end').value;
  const budget = parseFloat(document.getElementById('ws-nt-budget').value);
  const style  = document.getElementById('ws-nt-style').value;
  const err    = document.getElementById('ws-nt-err');
  err.textContent = '';

  if (!start || !end) { err.textContent = T.errDatesRequired; return; }
  if (new Date(end) <= new Date(start)) { err.textContent = T.errEndAfterStart; return; }
  if (!budget || budget <= 0) { err.textContent = T.errBudgetRequired; return; }

  const days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000));
  const destLabels = {
    bali:      { zh:'巴厘岛', en:'Bali',      ja:'バリ',         ko:'발리',         id:'Bali' },
    kyoto:     { zh:'京都',   en:'Kyoto',     ja:'京都',         ko:'교토',         id:'Kyoto' },
    paris:     { zh:'巴黎',   en:'Paris',     ja:'パリ',         ko:'파리',         id:'Paris' },
    santorini: { zh:'圣托里尼', en:'Santorini', ja:'サントリーニ', ko:'산토리니',     id:'Santorini' },
    any:       { zh:'自定义',  en:'Custom',    ja:'カスタム',     ko:'사용자 정의',  id:'Kustom' }
  };
  const destName = destLabels[dest][currentLang] || destLabels[dest].en;
  const styleLabel = {
    zh: { budget:'节俭穷游', comfort:'舒适平衡', luxury:'奢享高端' }[style],
    en: { budget:'budget',   comfort:'comfort',  luxury:'luxury'    }[style],
    ja: { budget:'予算重視', comfort:'快適',     luxury:'豪華'      }[style],
    ko: { budget:'알뜰',     comfort:'편안',     luxury:'럭셔리'    }[style],
    id: { budget:'hemat',    comfort:'nyaman',   luxury:'mewah'     }[style]
  }[currentLang] || style;

  const ccy = (currentLang === 'en' || currentLang === 'id') ? '$' : '¥';
  const title = `${destName} · ${start} · ${days}d · ${people}p · ${ccy}${budget.toLocaleString()}`;

  if (dest !== currentDest) {
    currentDest = dest;
    localStorage.setItem('wm_studio_dest', dest);
    renderChatHeader();
    renderPanelDest();
    renderPanelCompare();
    renderPanelItinerary();
    renderPanelBudget();
    if (typeof fetchDestInfo === 'function') fetchDestInfo(dest);
  }

  currentTrip = { dest, start, end, days, people, budget, style, title };
  localStorage.setItem('wm_studio_currentTrip', JSON.stringify(currentTrip));
  currentTripId = null;
  messages = [];
  renderMessages();
  updateTripHeaderChips();

  closeModalEl();
  showToast(_interp(T.ntCreatedToast, { dest: destName, days }), 'fa-bookmark');
  addLog('success', 'fa-bookmark', _interp(T.logTripCreated2, { dest: destName, days }));

  // Kickoff message — first turn that tells the AI all trip params and asks
  // it to start planning. Auto-saved 2.5s after AI replies (Phase 3a hook).
  const kickoffs = {
    zh: `我打算从 ${start} 出发，${days} 天，${people} 个人去${destName}，总预算 ${ccy}${budget.toLocaleString()}，旅行风格${styleLabel}。请你以旅程规划师的身份开始规划。`,
    en: `Plan a ${days}-day trip to ${destName} starting ${start} for ${people} people. Total budget ${ccy}${budget.toLocaleString()}. Style: ${styleLabel}. Begin as the Trip Planner.`,
    ja: `${start}から${days}日間、${people}人で${destName}へ。予算${ccy}${budget.toLocaleString()}、${styleLabel}スタイル。旅程プランナーとしてプランニングを開始してください。`,
    ko: `${start}부터 ${days}일, ${people}명, ${destName}, 예산 ${ccy}${budget.toLocaleString()}, ${styleLabel} 스타일. 여행 플래너로서 계획을 시작해 주세요.`,
    id: `Rencanakan ${days} hari ke ${destName} mulai ${start} untuk ${people} orang. Anggaran ${ccy}${budget.toLocaleString()}. Gaya: ${styleLabel}. Mulai sebagai Trip Planner.`
  };
  sendMessage(kickoffs[currentLang] || kickoffs.en);
}

function updateTripHeaderChips() {
  if (!currentTrip || !currentTrip.start) return;
  const T = t();
  const ccy = (currentLang === 'en' || currentLang === 'id') ? '$' : '¥';
  const startM = new Date(currentTrip.start);
  const dateStr = (currentLang === 'zh' || currentLang === 'ja') ?
    `${startM.getMonth()+1}/${startM.getDate()}` : currentTrip.start.slice(5);
  const chips = [
    `${dateStr} ${T.ntChipDepart}`,
    _interp(T.ntChipDays, { n: currentTrip.days }),
    _interp(T.ntChipPeople, { n: currentTrip.people }),
    `${ccy}${Number(currentTrip.budget).toLocaleString()}`
  ];
  const chipsEl = document.getElementById('ws-dest-chips');
  if (chipsEl) chipsEl.innerHTML = chips.map(c => `<span class="ws-dest-chip">${escapeHtml(c)}</span>`).join('');
}

// Restore trip chips on page boot
if (currentTrip && currentTrip.start) {
  setTimeout(() => updateTripHeaderChips(), 250);
}

function updateAuthUI() {
  const slot = document.getElementById('ws-nav-auth-slot');
  if (!slot) return;
  if (isLoggedIn()) {
    slot.innerHTML = `
      <div class="lang-picker" id="ws-user-menu" style="cursor:pointer;font-weight:600;gap:8px">
        <span class="fa fa-user" style="color:#fcbf1e"></span>
        <span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(authUser.name || authUser.email)}</span>
      </div>
    `;
    document.getElementById('ws-user-menu').onclick = () => {
      if (confirm(t().authLogout + '?')) doLogout();
    };
  } else {
    slot.innerHTML = `
      <div class="lang-picker" id="ws-login-trigger" style="cursor:pointer;font-weight:600;gap:8px">
        <span class="fa fa-sign-in" style="color:#fcbf1e"></span>
        <span>${escapeHtml(t().authLogin)}</span>
      </div>
    `;
    document.getElementById('ws-login-trigger').onclick = () => showAuthModal('login');
  }
}

// Auto-save after each successful AI reply
const _origSendMessage2 = sendMessage;
sendMessage = async function(text) {
  const r = await _origSendMessage2(text);
  setTimeout(scheduleAutoSave, 1500);
  return r;
};

// Re-render auth UI on language change
const _origOnLangChange = onLangChange;
onLangChange = function(newLang) {
  _origOnLangChange(newLang);
  updateAuthUI();
};

// Boot: hydrate auth state, fetch live dest data, render auth UI
(function bootPhase3() {
  // Delay until DOM is ready and panel slots exist
  function go() {
    updateAuthUI();
    if (isLoggedIn()) loadTrips();
    if (typeof currentDest === 'string') fetchDestInfo(currentDest);
    if (isLoggedIn()) loadPrefs();
    injectPrefsButton();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else setTimeout(go, 50);
})();

/* ═══════════════════════════════════════════════════════════════════════
   PHASE 3b — TRAVEL PREFERENCES / MULTIVERSE / BUDGET CALCULATOR
   ═══════════════════════════════════════════════════════════════════════ */

/* —— Phase 3b i18n additions —— */
Object.assign(TOOL_I18N.en, {
  // Preferences
  prefsTitle:'Travel preferences', prefsIntro:'Tell us how you travel — we factor this into every plan.',
  prefsStyle:'Interests', prefsPace:'Pace', prefsDiet:'Diet & restrictions', prefsSensitivity:'Price sensitivity', prefsFree:'Anything else AI should know',
  prefsFreePh:'e.g. mild seasickness, traveling with a 5-year-old, prefer historic neighbourhoods…',
  prefsPaceFast:'Packed · max sights', prefsPaceMid:'Balanced · breathing room', prefsPaceSlow:'Slow · linger longer',
  prefsSensLow:'Splurge ok', prefsSensMid:'Value matters', prefsSensHigh:'Optimise every dollar',
  prefsStyleOpts:['Food','Culture','Nature','Adventure','Photography','Slow travel','Nightlife','Family-friendly','Wellness','Shopping'],
  prefsDietOpts:['No restriction','Vegetarian','Vegan','Halal','Kosher','Gluten-free','Seafood allergy','Spicy ok','Mild only'],
  prefsSave:'Save preferences', prefsSaved:'Preferences saved', prefsLoginFirst:'Sign in to save preferences across devices.',
  prefsBtn:'My preferences', prefsLog:'Preferences saved',
  // Multiverse
  mvTitle:'Parallel-universe planning', mvIntro:'Three AI specialists draft three plan tiers in parallel. Pick the universe that fits.',
  mvThinking:'Three specialists planning in parallel…',
  mvTierBudget:'Budget · backpack', mvTierComfort:'Comfort · balanced', mvTierLuxury:'Luxury · premium',
  mvPopular:'Most picked', mvCatLodging:'Lodging', mvCatTransport:'Transport', mvCatFood:'Food',
  mvHighlight:'Highlight', mvSuitable:'Best for', mvPick:'Plan in detail',
  mvFallbackBadge:'Showing sample plan',
  // Budget calculator
  calcTitle:'Budget calculator', calcIntro:'Adjust the inputs to see real-time cost breakdown.',
  calcDays:'Days', calcPeople:'People', calcDest:'Destination', calcStyle:'Style',
  calcTotal:'Estimated total', calcPerDay:'Per day · per person',
  calcBreakdown:'Breakdown', calcTips:'Smart-save tips',
  calcApply:'Apply to my trip',
  calcTip1:'Book hotels 6+ weeks ahead — save 15-25%',
  calcTip2:'Eat where the locals eat — half the price, twice the flavour',
  calcTip3:'Bundle activities through your stay — often discounted',
  calcTip4:'Travel mid-week — flights drop noticeably',
  // Quick action log lines
  logMvOpen:'Opened parallel-universe planner', logMvDone:'3 plan tiers ready',
  logCalcOpen:'Opened budget calculator', logCalcApply:'Applied calculator output to trip header'
});
Object.assign(TOOL_I18N.zh, {
  prefsTitle:'旅行偏好', prefsIntro:'告诉我们你怎么旅行 —— AI 会把它带进每一次规划',
  prefsStyle:'兴趣方向', prefsPace:'旅行节奏', prefsDiet:'饮食与禁忌', prefsSensitivity:'价格敏感度', prefsFree:'你想让 AI 知道的其它信息',
  prefsFreePh:'例：轻度晕船 / 带 5 岁孩子同行 / 偏爱历史街区…',
  prefsPaceFast:'紧凑 · 景点最大化', prefsPaceMid:'平衡 · 留有余地', prefsPaceSlow:'慢节奏 · 深度停留',
  prefsSensLow:'可以挥霍', prefsSensMid:'追求性价比', prefsSensHigh:'每一分都精打细算',
  prefsStyleOpts:['美食','文化','自然','冒险','摄影','慢游','夜生活','亲子','疗愈','购物'],
  prefsDietOpts:['无忌口','素食','纯素','清真','犹太洁食','无麸质','海鲜过敏','可吃辣','不吃辣'],
  prefsSave:'保存偏好', prefsSaved:'偏好已保存', prefsLoginFirst:'登录后可跨设备同步偏好',
  prefsBtn:'我的偏好', prefsLog:'偏好已保存',
  mvTitle:'平行宇宙规划', mvIntro:'3 位 AI 专家并行起草 3 档方案 —— 挑一个你的宇宙',
  mvThinking:'3 位专家并行规划中…',
  mvTierBudget:'节俭穷游', mvTierComfort:'舒适平衡', mvTierLuxury:'奢享高端',
  mvPopular:'最受欢迎', mvCatLodging:'住宿', mvCatTransport:'交通', mvCatFood:'餐饮',
  mvHighlight:'亮点', mvSuitable:'适合', mvPick:'深入规划这个方案',
  mvFallbackBadge:'展示示例方案',
  calcTitle:'预算计算器', calcIntro:'调整参数 —— 实时查看费用拆分',
  calcDays:'天数', calcPeople:'人数', calcDest:'目的地', calcStyle:'风格',
  calcTotal:'估算总额', calcPerDay:'人均日花费',
  calcBreakdown:'费用拆分', calcTips:'省钱小贴士',
  calcApply:'套用到当前行程',
  calcTip1:'酒店提前 6 周以上预订 —— 通常省 15-25%',
  calcTip2:'吃本地人吃的店 —— 一半的价 · 两倍的好吃',
  calcTip3:'通过住宿打包活动 —— 常有折扣',
  calcTip4:'周二三出发返程 —— 机票明显降',
  logMvOpen:'打开平行宇宙规划', logMvDone:'3 套方案就绪',
  logCalcOpen:'打开预算计算器', logCalcApply:'应用计算结果到行程'
});
Object.assign(TOOL_I18N.ja, {
  prefsTitle:'旅の好み', prefsIntro:'あなたの旅のスタイルを教えて —— 毎回の計画に反映します',
  prefsStyle:'興味', prefsPace:'ペース', prefsDiet:'食事制限', prefsSensitivity:'価格感度', prefsFree:'AIに伝えたいその他',
  prefsFreePh:'例：軽い船酔い／5歳児同伴／古い街並みが好み…',
  prefsPaceFast:'タイト · 観光最大化', prefsPaceMid:'バランス · 余裕あり', prefsPaceSlow:'ゆったり · 滞在重視',
  prefsSensLow:'惜しまない', prefsSensMid:'コスパ重視', prefsSensHigh:'徹底節約',
  prefsStyleOpts:['グルメ','文化','自然','冒険','撮影','ゆっくり旅','ナイト','ファミリー','癒し','買い物'],
  prefsDietOpts:['制限なし','ベジタリアン','ヴィーガン','ハラル','コーシャ','グルテンフリー','魚介アレルギー','辛い物OK','辛い物NG'],
  prefsSave:'好みを保存', prefsSaved:'好みを保存しました', prefsLoginFirst:'ログインで端末間同期',
  prefsBtn:'マイ好み', prefsLog:'好みを保存',
  mvTitle:'パラレル企画', mvIntro:'3人のAI専門家が3階層を並行起草 —— あなたの宇宙を選ぼう',
  mvThinking:'3人の専門家が並行プランニング中…',
  mvTierBudget:'予算重視', mvTierComfort:'快適バランス', mvTierLuxury:'豪華プレミアム',
  mvPopular:'人気No.1', mvCatLodging:'宿泊', mvCatTransport:'交通', mvCatFood:'食事',
  mvHighlight:'ハイライト', mvSuitable:'最適', mvPick:'このプランを深掘り',
  mvFallbackBadge:'サンプル表示',
  calcTitle:'予算計算機', calcIntro:'値を調整して費用内訳をリアルタイム表示',
  calcDays:'日数', calcPeople:'人数', calcDest:'目的地', calcStyle:'スタイル',
  calcTotal:'合計見積', calcPerDay:'1人1日あたり',
  calcBreakdown:'内訳', calcTips:'節約のコツ',
  calcApply:'現在の旅行に適用',
  calcTip1:'ホテルは6週間以上前に予約 —— 15-25%節約',
  calcTip2:'地元の人気店を選ぼう —— 半額で2倍美味しい',
  calcTip3:'宿経由でアクティビティをまとめる —— 割引あり',
  calcTip4:'週中出発で航空券が下がる',
  logMvOpen:'パラレル企画を開く', logMvDone:'3階層のプラン完成',
  logCalcOpen:'予算計算機を開く', logCalcApply:'計算結果を旅行に適用'
});
Object.assign(TOOL_I18N.ko, {
  prefsTitle:'여행 선호도', prefsIntro:'어떻게 여행하는지 알려 주세요 —— AI가 매번 계획에 반영합니다',
  prefsStyle:'관심사', prefsPace:'페이스', prefsDiet:'식단·제한', prefsSensitivity:'가격 민감도', prefsFree:'AI에게 알릴 기타 정보',
  prefsFreePh:'예: 가벼운 멀미 / 5살 동반 / 역사 구역 선호…',
  prefsPaceFast:'타이트 · 명소 최대', prefsPaceMid:'밸런스 · 여유', prefsPaceSlow:'느리게 · 깊게',
  prefsSensLow:'아끼지 않음', prefsSensMid:'가성비 중시', prefsSensHigh:'최대 절약',
  prefsStyleOpts:['미식','문화','자연','모험','사진','느린 여행','나이트라이프','가족','웰니스','쇼핑'],
  prefsDietOpts:['제한 없음','채식','비건','할랄','코셔','글루텐 프리','해산물 알러지','매운맛 가능','매운맛 불가'],
  prefsSave:'선호도 저장', prefsSaved:'선호도 저장됨', prefsLoginFirst:'로그인하여 기기 간 동기화',
  prefsBtn:'내 선호도', prefsLog:'선호도 저장',
  mvTitle:'평행 우주 기획', mvIntro:'3명의 AI 전문가가 3단계를 병렬로 초안 작성 —— 당신의 우주를 선택',
  mvThinking:'3명의 전문가가 병렬 기획 중…',
  mvTierBudget:'알뜰', mvTierComfort:'편안 균형', mvTierLuxury:'럭셔리 프리미엄',
  mvPopular:'최다 선택', mvCatLodging:'숙박', mvCatTransport:'교통', mvCatFood:'식사',
  mvHighlight:'하이라이트', mvSuitable:'적합', mvPick:'이 플랜 자세히',
  mvFallbackBadge:'샘플 표시',
  calcTitle:'예산 계산기', calcIntro:'값을 조정해 실시간 비용 분석을 보세요',
  calcDays:'일수', calcPeople:'인원', calcDest:'목적지', calcStyle:'스타일',
  calcTotal:'예상 총액', calcPerDay:'1인 1일',
  calcBreakdown:'분석', calcTips:'절약 팁',
  calcApply:'현재 여행에 적용',
  calcTip1:'호텔은 6주 전 예약 — 15-25% 절약',
  calcTip2:'현지인 맛집 — 절반 가격, 두 배 맛',
  calcTip3:'숙소 통해 액티비티 묶음 — 할인 빈번',
  calcTip4:'주중 출발 — 항공권 인하 효과',
  logMvOpen:'평행 우주 기획 열기', logMvDone:'3단계 플랜 준비',
  logCalcOpen:'예산 계산기 열기', logCalcApply:'계산 결과를 여행에 적용'
});
Object.assign(TOOL_I18N.id, {
  prefsTitle:'Preferensi perjalanan', prefsIntro:'Beri tahu cara kamu bepergian — AI akan menerapkannya di setiap rencana',
  prefsStyle:'Minat', prefsPace:'Ritme', prefsDiet:'Diet & batasan', prefsSensitivity:'Sensitivitas harga', prefsFree:'Hal lain yang AI perlu tahu',
  prefsFreePh:'mis: agak mabuk laut / bawa anak 5 tahun / suka kawasan bersejarah…',
  prefsPaceFast:'Padat · maksimal wisata', prefsPaceMid:'Seimbang · ada jeda', prefsPaceSlow:'Lambat · tinggal lama',
  prefsSensLow:'Bebas keluar uang', prefsSensMid:'Nilai penting', prefsSensHigh:'Hemat maksimal',
  prefsStyleOpts:['Kuliner','Budaya','Alam','Petualangan','Fotografi','Slow travel','Nightlife','Keluarga','Wellness','Belanja'],
  prefsDietOpts:['Tanpa pantangan','Vegetarian','Vegan','Halal','Kosher','Bebas gluten','Alergi seafood','Pedas ok','Tidak pedas'],
  prefsSave:'Simpan preferensi', prefsSaved:'Preferensi tersimpan', prefsLoginFirst:'Masuk untuk sinkron lintas perangkat',
  prefsBtn:'Preferensi saya', prefsLog:'Preferensi tersimpan',
  mvTitle:'Perencanaan alam paralel', mvIntro:'3 ahli AI menyusun 3 tier secara paralel — pilih alam yang cocok',
  mvThinking:'3 ahli merencanakan paralel…',
  mvTierBudget:'Hemat · backpack', mvTierComfort:'Nyaman · seimbang', mvTierLuxury:'Mewah · premium',
  mvPopular:'Paling dipilih', mvCatLodging:'Akomodasi', mvCatTransport:'Transportasi', mvCatFood:'Makanan',
  mvHighlight:'Sorotan', mvSuitable:'Cocok untuk', mvPick:'Rencanakan tier ini',
  mvFallbackBadge:'Menampilkan sampel',
  calcTitle:'Kalkulator anggaran', calcIntro:'Atur input untuk melihat rincian biaya real-time',
  calcDays:'Hari', calcPeople:'Orang', calcDest:'Tujuan', calcStyle:'Gaya',
  calcTotal:'Total estimasi', calcPerDay:'Per hari · per orang',
  calcBreakdown:'Rincian', calcTips:'Tips hemat',
  calcApply:'Terapkan ke perjalanan',
  calcTip1:'Pesan hotel 6+ minggu lebih awal — hemat 15-25%',
  calcTip2:'Makan di tempat lokal — separuh harga, dua kali enak',
  calcTip3:'Bundel aktivitas lewat akomodasi — sering diskon',
  calcTip4:'Berangkat tengah pekan — tiket pesawat lebih murah',
  logMvOpen:'Buka perencana alam paralel', logMvDone:'3 tier rencana siap',
  logCalcOpen:'Buka kalkulator anggaran', logCalcApply:'Terapkan hasil kalkulator ke perjalanan'
});

/* ═════════════════ PREFERENCES MODAL ═════════════════ */
let _prefs = (() => {
  try { return JSON.parse(localStorage.getItem('wm_studio_prefs') || '{}'); }
  catch(_) { return {}; }
})();

async function loadPrefs() {
  if (!isLoggedIn()) return;
  try {
    const r = await fetch(BACKEND_BASE + '/api/user/preferences', { headers: authHeaders() });
    if (r.ok) {
      _prefs = await r.json() || {};
      localStorage.setItem('wm_studio_prefs', JSON.stringify(_prefs));
    }
  } catch (_) {}
}

function injectPrefsButton() {
  // Add a "My Preferences" link below the New-Trip button in the sidebar
  const newTripBtn = document.getElementById('ws-newtrip-btn');
  if (!newTripBtn || document.getElementById('ws-prefs-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'ws-prefs-btn';
  btn.className = 'ws-newtrip-btn';
  btn.style.cssText = 'background:transparent;color:var(--ws-ink-2);border:1px solid var(--ws-line);margin-top:8px';
  btn.innerHTML = `<span class="fa fa-sliders"></span> <span id="ws-prefs-btn-label">${escapeHtml(t().prefsBtn)}</span>`;
  btn.onclick = openPrefsModal;
  newTripBtn.parentElement.appendChild(btn);
}

function openPrefsModal() {
  const el = _ensureModal();
  const T = t();
  const styleOpts = T.prefsStyleOpts || [];
  const dietOpts = T.prefsDietOpts || [];
  const selStyle = new Set(_prefs.style || []);
  const selDiet = new Set(_prefs.diet || []);
  const pace = _prefs.pace || 'mid';
  const sens = _prefs.sensitivity || 'mid';

  el.innerHTML = `
    <div class="ws-modal" style="max-width:560px">
      <div class="ws-modal-head">
        <div class="ws-modal-title"><span class="fa fa-sliders"></span> ${escapeHtml(T.prefsTitle)}</div>
        <button class="ws-modal-close"><span class="fa fa-times"></span></button>
      </div>
      <div class="ws-modal-body">
        <p style="color:var(--ws-ink-3);font-size:13px;margin:0 0 18px;line-height:1.6">${escapeHtml(T.prefsIntro)}</p>

        <div class="ws-prefs-section">
          <div class="ws-form-label" style="margin-bottom:8px">${escapeHtml(T.prefsStyle)}</div>
          <div class="ws-chip-row" id="ws-prefs-style">
            ${styleOpts.map(s => `<button class="ws-chip-pick ${selStyle.has(s)?'active':''}" data-v="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
          </div>
        </div>

        <div class="ws-prefs-section">
          <div class="ws-form-label" style="margin-bottom:8px">${escapeHtml(T.prefsPace)}</div>
          <div class="ws-chip-row" id="ws-prefs-pace">
            <button class="ws-chip-pick ${pace==='fast'?'active':''}" data-v="fast">${escapeHtml(T.prefsPaceFast)}</button>
            <button class="ws-chip-pick ${pace==='mid'?'active':''}"  data-v="mid">${escapeHtml(T.prefsPaceMid)}</button>
            <button class="ws-chip-pick ${pace==='slow'?'active':''}" data-v="slow">${escapeHtml(T.prefsPaceSlow)}</button>
          </div>
        </div>

        <div class="ws-prefs-section">
          <div class="ws-form-label" style="margin-bottom:8px">${escapeHtml(T.prefsDiet)}</div>
          <div class="ws-chip-row" id="ws-prefs-diet">
            ${dietOpts.map(s => `<button class="ws-chip-pick ${selDiet.has(s)?'active':''}" data-v="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
          </div>
        </div>

        <div class="ws-prefs-section">
          <div class="ws-form-label" style="margin-bottom:8px">${escapeHtml(T.prefsSensitivity)}</div>
          <div class="ws-chip-row" id="ws-prefs-sens">
            <button class="ws-chip-pick ${sens==='low'?'active':''}"  data-v="low">${escapeHtml(T.prefsSensLow)}</button>
            <button class="ws-chip-pick ${sens==='mid'?'active':''}"  data-v="mid">${escapeHtml(T.prefsSensMid)}</button>
            <button class="ws-chip-pick ${sens==='high'?'active':''}" data-v="high">${escapeHtml(T.prefsSensHigh)}</button>
          </div>
        </div>

        <div class="ws-prefs-section">
          <div class="ws-form-label" style="margin-bottom:8px">${escapeHtml(T.prefsFree)}</div>
          <textarea class="ws-form-input" id="ws-prefs-free" rows="3" placeholder="${escapeHtml(T.prefsFreePh)}" style="resize:vertical;min-height:70px">${escapeHtml(_prefs.free || '')}</textarea>
        </div>

        ${!isLoggedIn() ? `<p style="font-size:11.5px;color:var(--ws-ink-3);text-align:center;margin:12px 0 0"><span class="fa fa-info-circle"></span> ${escapeHtml(T.prefsLoginFirst)}</p>` : ''}
        <button class="ws-action-btn" id="ws-prefs-save" style="margin-top:14px"><span class="fa fa-check"></span> ${escapeHtml(T.prefsSave)}</button>
      </div>
    </div>
  `;

  el.querySelector('.ws-modal-close').onclick = closeModalEl;

  // Multi-select chips for style + diet
  ['ws-prefs-style','ws-prefs-diet'].forEach(id => {
    document.getElementById(id).querySelectorAll('.ws-chip-pick').forEach(c => {
      c.onclick = () => c.classList.toggle('active');
    });
  });
  // Single-select for pace + sensitivity
  ['ws-prefs-pace','ws-prefs-sens'].forEach(id => {
    const wrap = document.getElementById(id);
    wrap.querySelectorAll('.ws-chip-pick').forEach(c => {
      c.onclick = () => {
        wrap.querySelectorAll('.ws-chip-pick').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
      };
    });
  });

  document.getElementById('ws-prefs-save').onclick = savePrefs;
  el.classList.add('show');
}

async function savePrefs() {
  const styleSel = Array.from(document.querySelectorAll('#ws-prefs-style .ws-chip-pick.active')).map(c => c.dataset.v);
  const dietSel = Array.from(document.querySelectorAll('#ws-prefs-diet .ws-chip-pick.active')).map(c => c.dataset.v);
  const pace = document.querySelector('#ws-prefs-pace .ws-chip-pick.active')?.dataset.v || 'mid';
  const sens = document.querySelector('#ws-prefs-sens .ws-chip-pick.active')?.dataset.v || 'mid';
  const free = document.getElementById('ws-prefs-free').value.trim();

  _prefs = { style: styleSel, diet: dietSel, pace, sensitivity: sens, free };
  localStorage.setItem('wm_studio_prefs', JSON.stringify(_prefs));

  if (isLoggedIn()) {
    try {
      await fetch(BACKEND_BASE + '/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ preferences: _prefs })
      });
    } catch (_) {}
  }

  closeModalEl();
  showToast(t().prefsSaved, 'fa-check-circle');
  addLog('success', 'fa-sliders', t().prefsLog);
}

function getPrefsSystemPrompt() {
  if (!_prefs || Object.keys(_prefs).length === 0) return '';
  const parts = [];
  if (_prefs.style?.length)        parts.push(`Interests: ${_prefs.style.join(', ')}`);
  if (_prefs.pace)                 parts.push(`Pace: ${_prefs.pace}`);
  if (_prefs.diet?.length)         parts.push(`Diet: ${_prefs.diet.join(', ')}`);
  if (_prefs.sensitivity)          parts.push(`Price sensitivity: ${_prefs.sensitivity}`);
  if (_prefs.free)                 parts.push(`Notes: ${_prefs.free}`);
  return parts.length ? `\n\n[User Preferences]\n${parts.join('\n')}` : '';
}

/* Patch sendMessage system prompt to inject prefs */
const _origSendMessage_v2 = sendMessage;
sendMessage = async function(text) {
  // Tucked in via systemPrompt patching done inside sendMessage —
  // we replicate that here by piggy-backing on the input value before forwarding.
  return _origSendMessage_v2(text);
};
// Also patch the actual system prompt builder by overriding fetch
const _origFetch_prefs = window.fetch.bind(window);
window.fetch = function(url, opts) {
  if (typeof url === 'string' && opts && opts.body && (url.endsWith('/api/chat/once') || url.endsWith('/api/chat/team'))) {
    try {
      const body = JSON.parse(opts.body);
      if (body.system && typeof body.system === 'string' && !body.system.includes('[User Preferences]')) {
        body.system += getPrefsSystemPrompt();
        opts = { ...opts, body: JSON.stringify(body) };
      }
    } catch (_) {}
  }
  return _origFetch_prefs(url, opts);
};

/* ═════════════════ MULTIVERSE MODAL ═════════════════ */
function _mvFallback() {
  const T = t();
  const ccy = (currentLang === 'en' || currentLang === 'id') ? '$' : '¥';
  const factor = (currentLang === 'en' || currentLang === 'id') ? 0.14 : 1; // rough RMB->USD
  return {
    budget:  { tier:T.mvTierBudget,  price:`${ccy}${Math.round(3500*factor).toLocaleString()}`,  priceNote:'2p · 7d', hotel:{name:T.prefsStyleOpts? (currentLang==='zh'?'背包客栈':'Hostel / homestay'):'',note:`${ccy}${Math.round(120*factor)}/${currentLang==='zh'?'晚':'nt'}`}, transport:{name:currentLang==='zh'?'公共交通+租摩托':'Public transit + scooter',note:`${ccy}${Math.round(30*factor)}/${currentLang==='zh'?'日':'day'}`}, food:{name:currentLang==='zh'?'街边小吃+本地餐馆':'Street food + local diners',note:`${ccy}${Math.round(30*factor)}/${currentLang==='zh'?'餐':'meal'}`}, highlight:currentLang==='zh'?'最真实的本地生活体验':'Most authentic local life', suitable:currentLang==='zh'?'背包客、独行侠':'Backpackers, solo travel' },
    comfort: { tier:T.mvTierComfort, price:`${ccy}${Math.round(12000*factor).toLocaleString()}`, priceNote:'2p · 7d', hotel:{name:currentLang==='zh'?'精品民宿/3星酒店':'Boutique inn / 3-star hotel',note:`${ccy}${Math.round(400*factor)}/${currentLang==='zh'?'晚':'nt'}`}, transport:{name:currentLang==='zh'?'包车+部分公交':'Private car + public mix',note:`${ccy}${Math.round(150*factor)}/${currentLang==='zh'?'日':'day'}`}, food:{name:currentLang==='zh'?'特色餐厅+路边摊':'Signature restaurants + street',note:`${ccy}${Math.round(90*factor)}/${currentLang==='zh'?'餐':'meal'}`}, highlight:currentLang==='zh'?'品质与性价比完美平衡':'Quality-to-cost sweet spot', suitable:currentLang==='zh'?'情侣、好友结伴':'Couples, small groups' },
    luxury:  { tier:T.mvTierLuxury,  price:`${ccy}${Math.round(38000*factor).toLocaleString()}`, priceNote:'2p · 7d', hotel:{name:currentLang==='zh'?'五星度假村/顶级别墅':'5-star resort / private villa',note:`${ccy}${Math.round(2000*factor)}/${currentLang==='zh'?'晚':'nt'}`}, transport:{name:currentLang==='zh'?'专属司导+专车':'Private driver-guide',note:currentLang==='zh'?'全程包车':'Full-time chauffeured'}, food:{name:currentLang==='zh'?'米其林+私厨定制':'Michelin + private chef',note:`${ccy}${Math.round(300*factor)}+/${currentLang==='zh'?'餐':'meal'}`}, highlight:currentLang==='zh'?'极致奢华的专属体验':'Curated luxury experiences', suitable:currentLang==='zh'?'蜜月、周年纪念':'Honeymoons, anniversaries' }
  };
}

async function openMultiverseModal() {
  const el = _ensureModal();
  const T = t();
  const destLabel = (DESTS[currentDest]?.titles[currentLang] || DESTS[currentDest]?.titles?.en || '').replace(/<[^>]+>/g,'').trim();
  el.innerHTML = `
    <div class="ws-modal" style="max-width:980px">
      <div class="ws-modal-head">
        <div class="ws-modal-title"><span class="fa fa-clone"></span> ${escapeHtml(T.mvTitle)}</div>
        <button class="ws-modal-close"><span class="fa fa-times"></span></button>
      </div>
      <div class="ws-modal-body" id="ws-mv-body">
        <p style="color:var(--ws-ink-3);font-size:13px;margin:0 0 20px;line-height:1.6">${escapeHtml(T.mvIntro)}</p>
        <div class="ws-loading"><span class="fa fa-circle-o-notch"></span><div>${escapeHtml(T.mvThinking)}</div></div>
      </div>
    </div>
  `;
  el.querySelector('.ws-modal-close').onclick = closeModalEl;
  el.classList.add('show');
  addLog('info', 'fa-clone', t().logMvOpen);

  let plans = null;
  let isFallback = false;
  try {
    const promptText = currentLang === 'zh'
      ? `请为"${destLabel}"生成 3 个预算档（节俭/舒适/奢享）的方案对比，**只返回纯 JSON**，结构：{"budget":{"tier":"节俭穷游","price":"¥3,500","priceNote":"2人·7天","hotel":{"name":"","note":""},"transport":{"name":"","note":""},"food":{"name":"","note":""},"highlight":"","suitable":""},"comfort":{...},"luxury":{...}}。所有文字使用中文，价格根据目的地实际情况合理估算。`
      : `Generate 3 budget-tier comparison plans for "${destLabel}" (budget/comfort/luxury). Return ONLY pure JSON in this shape: {"budget":{"tier":"Budget","price":"$500","priceNote":"2p · 7d","hotel":{"name":"","note":""},"transport":{"name":"","note":""},"food":{"name":"","note":""},"highlight":"","suitable":""},"comfort":{...},"luxury":{...}}. All strings in ${currentLang.toUpperCase()}. Use realistic local prices.`;
    const r = await fetch(BACKEND_BASE + '/api/generate', {
      method:'POST',
      headers: { 'Content-Type':'application/json', ...authHeaders() },
      body: JSON.stringify({ prompt: promptText, max_tokens: 1400 })
    });
    if (r.ok) {
      const data = await r.json();
      const raw = (data.content || data.text || '').replace(/```json|```/g, '').trim();
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) plans = JSON.parse(m[0]);
    }
    if (!plans) throw new Error('no plans');
  } catch (_) {
    plans = _mvFallback();
    isFallback = true;
  }

  const tiers = [
    { key:'budget',  color:'#0e7c6b', bg:'rgba(14,124,107,.08)',  icon:'fa-backpack', badge:null },
    { key:'comfort', color:'#fcbf1e', bg:'rgba(252,191,30,.08)',  icon:'fa-coffee',   badge: T.mvPopular },
    { key:'luxury',  color:'#7c3aed', bg:'rgba(124,58,237,.08)',  icon:'fa-diamond',  badge:null }
  ];

  const cards = tiers.map(t2 => {
    const p = plans[t2.key] || {};
    const badge = t2.badge ? `<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:${t2.color};color:#fff;padding:3px 12px;border-radius:12px;font-size:10px;font-weight:700;letter-spacing:.05em">${escapeHtml(t2.badge)}</div>` : '';
    return `
      <div class="ws-mv-card" style="border-top-color:${t2.color};background:${t2.bg}">
        ${badge}
        <div class="ws-mv-head" style="color:${t2.color}">
          <span class="fa fa-check-circle"></span> ${escapeHtml(p.tier || '')}
        </div>
        <div class="ws-mv-price" style="color:${t2.color}">${escapeHtml(p.price || '—')}</div>
        <div class="ws-mv-price-sub">${escapeHtml(p.priceNote || '')}</div>
        <div class="ws-mv-divider"></div>
        <div class="ws-mv-item"><span class="fa fa-bed"></span><div><div class="ws-mv-lbl">${escapeHtml(T.mvCatLodging)}</div><div class="ws-mv-val">${escapeHtml(p.hotel?.name||'—')}</div><div class="ws-mv-note">${escapeHtml(p.hotel?.note||'')}</div></div></div>
        <div class="ws-mv-item"><span class="fa fa-car"></span><div><div class="ws-mv-lbl">${escapeHtml(T.mvCatTransport)}</div><div class="ws-mv-val">${escapeHtml(p.transport?.name||'—')}</div><div class="ws-mv-note">${escapeHtml(p.transport?.note||'')}</div></div></div>
        <div class="ws-mv-item"><span class="fa fa-coffee"></span><div><div class="ws-mv-lbl">${escapeHtml(T.mvCatFood)}</div><div class="ws-mv-val">${escapeHtml(p.food?.name||'—')}</div><div class="ws-mv-note">${escapeHtml(p.food?.note||'')}</div></div></div>
        <div class="ws-mv-tag" style="background:${t2.bg};color:${t2.color}"><strong>${escapeHtml(T.mvHighlight)}</strong> · ${escapeHtml(p.highlight||'')}</div>
        <div class="ws-mv-tag" style="background:${t2.bg};color:${t2.color};margin-top:6px"><strong>${escapeHtml(T.mvSuitable)}</strong> · ${escapeHtml(p.suitable||'')}</div>
        <button class="ws-action-btn" data-tier="${t2.key}" data-tier-name="${escapeHtml(p.tier||'')}" style="background:${t2.color};color:#fff;margin-top:14px"><span class="fa fa-arrow-right"></span> ${escapeHtml(T.mvPick)}</button>
      </div>
    `;
  }).join('');

  document.getElementById('ws-mv-body').innerHTML = `
    <p style="color:var(--ws-ink-3);font-size:13px;margin:0 0 18px;line-height:1.6">${escapeHtml(T.mvIntro)}${isFallback ? ` <span style="color:var(--ws-amber-dk);font-weight:600">· ${escapeHtml(T.mvFallbackBadge)}</span>` : ''}</p>
    <div class="ws-mv-grid">${cards}</div>
  `;
  document.querySelectorAll('.ws-mv-grid [data-tier]').forEach(b => {
    b.onclick = () => {
      const name = b.dataset.tierName;
      closeModalEl();
      const queries = {
        zh: `就按"${name}"这个方案深入帮我规划${destLabel}的完整行程`,
        en: `Plan the full ${destLabel} itinerary in detail using the "${name}" tier`,
        ja: `${destLabel}を「${name}」プランで詳細企画してください`,
        ko: `${destLabel}을(를) "${name}" 등급으로 상세 기획해 주세요`,
        id: `Rencanakan jadwal lengkap ${destLabel} dengan tier "${name}"`
      };
      sendMessage(queries[currentLang] || queries.en);
    };
  });
  addLog('success', 'fa-clone', t().logMvDone);
}

/* ═════════════════ BUDGET CALCULATOR MODAL ═════════════════ */
const CALC_BASE = {
  // Base per-person-per-day RMB for comfort tier
  bali:      350,
  kyoto:     500,
  paris:     650,
  santorini: 600,
  any:       400
};
const CALC_STYLE_MULT = { budget: 0.55, comfort: 1.0, luxury: 2.4 };
const CALC_BREAKDOWN = { lodging: 0.40, food: 0.22, transport: 0.15, activities: 0.16, misc: 0.07 };

function openBudgetCalcModal() {
  const el = _ensureModal();
  const T = t();
  const dest = currentTrip?.dest || currentDest || 'bali';
  const days = currentTrip?.days || 7;
  const people = currentTrip?.people || 2;
  const style = currentTrip?.style || 'comfort';

  el.innerHTML = `
    <div class="ws-modal" style="max-width:560px">
      <div class="ws-modal-head">
        <div class="ws-modal-title"><span class="fa fa-calculator"></span> ${escapeHtml(T.calcTitle)}</div>
        <button class="ws-modal-close"><span class="fa fa-times"></span></button>
      </div>
      <div class="ws-modal-body">
        <p style="color:var(--ws-ink-3);font-size:13px;margin:0 0 18px;line-height:1.6">${escapeHtml(T.calcIntro)}</p>

        <div class="ws-form-row">
          <div class="ws-form-field">
            <label class="ws-form-label">${escapeHtml(T.calcDest)}</label>
            <select class="ws-form-select" id="ws-calc-dest">
              <option value="bali">${escapeHtml(T.destBali)}</option>
              <option value="kyoto">${escapeHtml(T.destKyoto)}</option>
              <option value="paris">${escapeHtml(T.destParis)}</option>
              <option value="santorini">${escapeHtml(T.destSantorini)}</option>
              <option value="any">${escapeHtml(T.destAny)}</option>
            </select>
          </div>
          <div class="ws-form-field" style="max-width:130px">
            <label class="ws-form-label">${escapeHtml(T.calcStyle)}</label>
            <select class="ws-form-select" id="ws-calc-style">
              <option value="budget">${escapeHtml(T.mvTierBudget)}</option>
              <option value="comfort" selected>${escapeHtml(T.mvTierComfort)}</option>
              <option value="luxury">${escapeHtml(T.mvTierLuxury)}</option>
            </select>
          </div>
        </div>

        <div class="ws-form-row">
          <div class="ws-form-field">
            <label class="ws-form-label">${escapeHtml(T.calcDays)} <span id="ws-calc-days-val" style="color:var(--ws-teal);font-weight:700">${days}</span></label>
            <input type="range" min="1" max="21" value="${days}" id="ws-calc-days" class="ws-range">
          </div>
          <div class="ws-form-field">
            <label class="ws-form-label">${escapeHtml(T.calcPeople)} <span id="ws-calc-people-val" style="color:var(--ws-teal);font-weight:700">${people}</span></label>
            <input type="range" min="1" max="8" value="${people}" id="ws-calc-people" class="ws-range">
          </div>
        </div>

        <div class="ws-calc-result" id="ws-calc-result"></div>
        <button class="ws-action-btn" id="ws-calc-apply" style="margin-top:14px"><span class="fa fa-check"></span> ${escapeHtml(T.calcApply)}</button>
      </div>
    </div>
  `;
  document.getElementById('ws-calc-dest').value = dest;
  document.getElementById('ws-calc-style').value = style;

  el.querySelector('.ws-modal-close').onclick = closeModalEl;
  ['ws-calc-dest','ws-calc-style','ws-calc-days','ws-calc-people'].forEach(id => {
    document.getElementById(id).addEventListener('input', recomputeBudgetCalc);
    document.getElementById(id).addEventListener('change', recomputeBudgetCalc);
  });
  document.getElementById('ws-calc-apply').onclick = applyBudgetCalc;
  recomputeBudgetCalc();
  el.classList.add('show');
  addLog('info', 'fa-calculator', t().logCalcOpen);
}

function recomputeBudgetCalc() {
  const T = t();
  const dest = document.getElementById('ws-calc-dest').value;
  const style = document.getElementById('ws-calc-style').value;
  const days = parseInt(document.getElementById('ws-calc-days').value) || 7;
  const people = parseInt(document.getElementById('ws-calc-people').value) || 2;
  document.getElementById('ws-calc-days-val').textContent = days;
  document.getElementById('ws-calc-people-val').textContent = people;

  const base = CALC_BASE[dest] || 400;
  const mult = CALC_STYLE_MULT[style] || 1.0;
  const ccy = (currentLang === 'en' || currentLang === 'id') ? '$' : '¥';
  const factor = (currentLang === 'en' || currentLang === 'id') ? 0.14 : 1;
  const totalRMB = base * mult * days * people;
  const total = Math.round(totalRMB * factor);
  const perDayPerPerson = Math.round(base * mult * factor);

  const cats = [
    { key:'lodging',    pct: CALC_BREAKDOWN.lodging,    color:'#2563eb', icon:'fa-bed',         label: T.budgetCatLodging },
    { key:'food',       pct: CALC_BREAKDOWN.food,       color:'#ea580c', icon:'fa-coffee',      label: T.budgetCatFood },
    { key:'transport',  pct: CALC_BREAKDOWN.transport,  color:'#0e7c6b', icon:'fa-car',         label: T.budgetCatTransport },
    { key:'activities', pct: CALC_BREAKDOWN.activities, color:'#7c3aed', icon:'fa-compass',     label: T.budgetCatActivities },
    { key:'misc',       pct: CALC_BREAKDOWN.misc,       color:'#6b7280', icon:'fa-ellipsis-h',  label: T.budgetCatMisc }
  ];
  const tips = [T.calcTip1, T.calcTip2, T.calcTip3, T.calcTip4];

  document.getElementById('ws-calc-result').innerHTML = `
    <div class="ws-budget-total">
      <div class="ws-budget-amount">${ccy}${total.toLocaleString()}</div>
      <div class="ws-budget-sub">${escapeHtml(T.calcPerDay)}: ${ccy}${perDayPerPerson.toLocaleString()}</div>
    </div>
    <div class="ws-form-label" style="margin:14px 0 8px">${escapeHtml(T.calcBreakdown)}</div>
    <div class="ws-budget-rows">
      ${cats.map(c => {
        const amount = Math.round(total * c.pct);
        return `
        <div class="ws-budget-row">
          <div class="ws-budget-icon" style="background:${c.color}"><span class="fa ${c.icon}"></span></div>
          <div class="ws-budget-info">
            <div class="ws-budget-cat">${escapeHtml(c.label)}</div>
            <div class="ws-budget-note">${Math.round(c.pct*100)}%</div>
          </div>
          <div class="ws-budget-val">${ccy}${amount.toLocaleString()}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="ws-form-label" style="margin:14px 0 8px">${escapeHtml(T.calcTips)}</div>
    <ul class="ws-calc-tips">
      ${tips.map(tip => `<li><span class="fa fa-lightbulb-o"></span> ${escapeHtml(tip)}</li>`).join('')}
    </ul>
  `;
}

function applyBudgetCalc() {
  const dest = document.getElementById('ws-calc-dest').value;
  const style = document.getElementById('ws-calc-style').value;
  const days = parseInt(document.getElementById('ws-calc-days').value) || 7;
  const people = parseInt(document.getElementById('ws-calc-people').value) || 2;
  const base = CALC_BASE[dest] || 400;
  const mult = CALC_STYLE_MULT[style] || 1.0;
  const factor = (currentLang === 'en' || currentLang === 'id') ? 0.14 : 1;
  const total = Math.round(base * mult * days * people * factor);

  if (!currentTrip) currentTrip = {};
  currentTrip.dest = dest;
  currentTrip.style = style;
  currentTrip.days = days;
  currentTrip.people = people;
  currentTrip.budget = total;
  if (!currentTrip.start) {
    currentTrip.start = new Date().toISOString().split('T')[0];
    currentTrip.end = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
  }
  localStorage.setItem('wm_studio_currentTrip', JSON.stringify(currentTrip));
  if (dest !== currentDest) {
    currentDest = dest;
    localStorage.setItem('wm_studio_dest', dest);
    renderChatHeader();
    renderPanelDest();
    renderPanelCompare();
    renderPanelItinerary();
    renderPanelBudget();
    if (typeof fetchDestInfo === 'function') fetchDestInfo(dest);
  }
  updateTripHeaderChips();
  closeModalEl();
  showToast(t().calcApply + ' ✓', 'fa-check-circle');
  addLog('success', 'fa-calculator', t().logCalcApply);
}
