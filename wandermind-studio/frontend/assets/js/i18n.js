/* ──────────────────────────────────────────────────────
   i18n.js — WanderMind Studio 5-language switcher
   Languages: en / zh / ja / ko / id
   Hard rule: no mixed languages — every visible string
   on the page must come from this dictionary.
   ────────────────────────────────────────────────────── */

const LANGS = {
  en: {
    pageTitle: 'WanderMind Studio | AI-Powered Travel Planning',
    /* —— Navigation —— */
    navHome: 'Home', navAbout: 'About', navExplore: 'Explore', navAITool: 'AI Tool', navContact: 'Contact',
    searchBtn: 'Search',

    /* —— Hero —— */
    hero1Title: 'Travel Reimagined<br>by AI',
    hero1Sub:   'Six AI agents collaborate to craft your perfect journey — real-time data, personalized recommendations, every detail intelligently planned.',
    hero1Btn:   'Start Planning',
    hero2Title: 'Bali · Kyoto · Paris<br>Santorini',
    hero2Sub:   'Explore curated experiences in the world\'s most stunning destinations — or let our AI craft a complete guide for any city you name.',
    hero2Btn:   'Explore Destinations',
    hero3Title: 'Six Expert Agents<br>at Your Service',
    hero3Sub:   'Trip Planner · Hotel Advisor · Food Explorer · Activity Curator · Budget Manager · Live Search — all working together for you.',
    hero3Btn:   'Meet the Team',

    /* —— Form —— */
    formTitle: 'Let AI experts craft your perfect getaway',
    formSub:   'Answer a few questions and our six AI agents will instantly generate a custom itinerary tailored to your style, budget, and travel companions.',
    formName: 'Your Name', formDest: 'Destination', formDestAny: 'Any', formDestCustom: 'Custom (any city)',
    formStyle: 'Travel Style', formStyleAny: 'Any', formStyleCity: 'City Tours',
    formStyleCultural: 'Cultural & Thematic', formStyleFamily: 'Family Friendly',
    formStyleLuxury: 'Indulgence & Luxury', formStyleOutdoor: 'Outdoor Activities',
    formStyleRelax: 'Relaxation', formStyleAdv: 'Wild & Adventure',
    formDuration: 'Duration', formDurAny: 'Any', formDur1: '1 Day', formDur2: '2-4 Days', formDur5: '5-7 Days', formDur7: '7+ Days',
    formDate: 'Departure', formSubmitLbl: 'Submit', formSubmitBtn: 'Get My AI Plan',

    /* —— Section 4 (1 + 4 grid) —— */
    sec4BaliTitle:  'Bali · The Island of Gods',
    sec4BaliDesc:   'Sun-soaked beaches, lush rice terraces, ancient cliffside temples and a deep spiritual culture. From Ubud\'s jungle retreats to Uluwatu\'s surf breaks.',
    sec4KyotoTitle: 'Kyoto · Ancient Capital',
    sec4KyotoDesc:  'Thousand-year shrines, geisha culture, bamboo groves and seasonal kaiseki.',
    sec4ParisTitle: 'Paris · City of Lights',
    sec4ParisDesc:  'Romance, world-class art, timeless boulevards and patisseries.',
    sec4SantTitle:  'Santorini · Aegean Pearl',
    sec4SantDesc:   'Whitewashed villages, caldera sunsets and crystal-blue waters.',
    sec4AnyTitle:   'Anywhere · AI Powered',
    sec4AnyDesc:    'Type any city — Tokyo, Marrakech, Reykjavik — AI builds your guide instantly.',

    /* —— Section 5 (3 cards) —— */
    sec5Title: 'Top Travelling Destinations',
    sec5Sub:   'Hand-picked destinations where our AI agents have deep local intelligence — from hidden food spots to optimal photo timing.',
    sec5From: 'from', sec5From2: 'from', sec5From3: 'from',
    sec5BaliName: 'Bali · Indonesia',  sec5BaliDays: '7 Days',  sec5BaliPeople: '2-4 People',
    sec5BaliDesc: 'Sun-soaked beaches, lush rice terraces, ancient temples and a deep spiritual culture.',
    sec5KyotoName: 'Kyoto · Japan',    sec5KyotoDays: '5 Days', sec5KyotoPeople: '2-4 People',
    sec5KyotoDesc: 'Ancient shrines, geisha culture, cherry blossoms and seasonal kaiseki cuisine.',
    sec5ParisName: 'Paris · France',   sec5ParisDays: '7 Days', sec5ParisPeople: '2-4 People',
    sec5ParisDesc: 'Romance, world-class art, timeless boulevards and unforgettable patisseries.',

    /* —— Section 6 (About) —— */
    sec6Eyebrow: 'About WanderMind Studio',
    sec6Title:   'Personalized travel powered by AI multi-agent collaboration.',
    sec6Desc:    'WanderMind Studio combines six specialized AI agents to plan your perfect trip — from itinerary design to real-time hotel pricing, from local food discovery to budget optimization. Available in 5 languages, with intelligent data for any city worldwide.',
    sec6Btn:     'Learn more',

    /* —— Section 7 (CTA) —— */
    sec7Title: 'AI experts on duty<br>from planning to landing',
    sec7Desc:  'From the first idea to the last photograph, our six AI agents support every step of your journey. Real-time data, personalized recommendations, available in five languages.',
    sec7Btn:   'Start Your Journey',

    /* —— Footer —— */
    footContactTitle: 'Contact Us', footWeChat: '(WeChat)', footWaTag: '(Bali Concierge)',
    footFeaturesTitle: 'Features',
    footFeat1: 'AI Planning', footFeat2: 'Hotels Compare', footFeat3: 'Flights Compare',
    footFeat4: 'Itinerary Builder', footFeat5: 'Travel Preferences',
    footGalleryTitle: 'Gallery', footDestTitle: 'Top Destinations',
    footDest1: 'Bali', footDest2: 'Kyoto', footDest3: 'Paris', footDest4: 'Santorini', footDest5: 'Any City',
    footCopy: 'All rights reserved.',
  },

  zh: {
    pageTitle: 'WanderMind Studio 游心臻选 | AI 驱动的旅行规划',
    navHome: '首页', navAbout: '关于', navExplore: '探索', navAITool: 'AI 工具', navContact: '联系我们',
    searchBtn: '搜索',

    hero1Title: '让 AI 重新定义<br>你的旅程',
    hero1Sub:   '六位 AI 智能体协同打造你的专属行程 —— 实时数据、个性化推荐，每个细节都精心规划。',
    hero1Btn:   '开始规划',
    hero2Title: '巴厘岛 · 京都 · 巴黎<br>圣托里尼',
    hero2Sub:   '探索全球最迷人的目的地精选体验 —— 或让 AI 为你输入的任何城市即时生成完整攻略。',
    hero2Btn:   '发现目的地',
    hero3Title: '六位专家智能体<br>随时为你服务',
    hero3Sub:   '旅程规划师 · 住宿顾问 · 美食探索家 · 活动策划师 · 预算管家 · 实时搜索 —— 协同为你服务。',
    hero3Btn:   '认识团队',

    formTitle: '让 AI 专家为你定制完美假期',
    formSub:   '回答几个问题，六位 AI 智能体立刻为你生成符合风格、预算和同行人的个性化行程。',
    formName: '你的称呼', formDest: '目的地', formDestAny: '任意', formDestCustom: '自定义（任意城市）',
    formStyle: '旅行风格', formStyleAny: '任意', formStyleCity: '城市游',
    formStyleCultural: '文化主题', formStyleFamily: '亲子家庭',
    formStyleLuxury: '奢华享受', formStyleOutdoor: '户外活动',
    formStyleRelax: '休闲放松', formStyleAdv: '冒险探索',
    formDuration: '行程天数', formDurAny: '任意', formDur1: '1 天', formDur2: '2-4 天', formDur5: '5-7 天', formDur7: '7 天以上',
    formDate: '出发日期', formSubmitLbl: '提交', formSubmitBtn: '生成我的 AI 方案',

    sec4BaliTitle:  '巴厘岛 · 神之岛',
    sec4BaliDesc:   '阳光海滩、翠绿梯田、悬崖古寺与深厚的精神文化。从乌布雨林到乌鲁瓦图浪点，深度玩转印尼。',
    sec4KyotoTitle: '京都 · 千年古都',
    sec4KyotoDesc:  '千年神社、艺伎文化、竹林小径与季节怀石料理。',
    sec4ParisTitle: '巴黎 · 灯光之城',
    sec4ParisDesc:  '浪漫、世界级艺术、永恒的林荫大道与糕点店。',
    sec4SantTitle:  '圣托里尼 · 爱琴海明珠',
    sec4SantDesc:   '白色村庄、火山口日落、清澈蔚蓝的爱琴海。',
    sec4AnyTitle:   '任意目的地 · AI 即时生成',
    sec4AnyDesc:    '输入任意城市 —— 东京、马拉喀什、雷克雅未克 —— AI 即刻为你生成攻略。',

    sec5Title: '热门旅行目的地',
    sec5Sub:   '精选目的地 —— AI 智能体掌握深度本地信息，从隐藏美食到最佳拍照时机。',
    sec5From: '起价', sec5From2: '起价', sec5From3: '起价',
    sec5BaliName: '巴厘岛 · 印度尼西亚', sec5BaliDays: '7 天', sec5BaliPeople: '2-4 人',
    sec5BaliDesc: '阳光海滩、翠绿梯田、古老寺庙与深厚的精神文化。',
    sec5KyotoName: '京都 · 日本',       sec5KyotoDays: '5 天', sec5KyotoPeople: '2-4 人',
    sec5KyotoDesc: '古老神社、艺伎文化、樱花季节与怀石料理。',
    sec5ParisName: '巴黎 · 法国',       sec5ParisDays: '7 天', sec5ParisPeople: '2-4 人',
    sec5ParisDesc: '浪漫、世界级艺术、永恒的林荫大道与难忘的糕点店。',

    sec6Eyebrow: '关于 WanderMind Studio',
    sec6Title:   '六位 AI 智能体协同，为每次旅行赋予灵魂。',
    sec6Desc:    'WanderMind Studio 集结六位专业 AI 智能体为你打造完美旅程 —— 从行程设计到实时酒店比价，从本地美食发现到预算优化。支持 5 种语言，覆盖全球任何城市的智能数据。',
    sec6Btn:     '了解更多',

    sec7Title: 'AI 专家在线<br>从规划到落地全程陪伴',
    sec7Desc:  '从最初的想法到最后一张照片，六位 AI 智能体陪伴你旅程的每一步。实时数据、个性化推荐、5 种语言可选。',
    sec7Btn:   '开启你的旅程',

    footContactTitle: '联系我们', footWeChat: '（微信）', footWaTag: '（巴厘岛专属）',
    footFeaturesTitle: '功能',
    footFeat1: 'AI 行程规划', footFeat2: '酒店比价', footFeat3: '机票比价',
    footFeat4: '行程时间轴', footFeat5: '旅行偏好',
    footGalleryTitle: '图片画廊', footDestTitle: '热门目的地',
    footDest1: '巴厘岛', footDest2: '京都', footDest3: '巴黎', footDest4: '圣托里尼', footDest5: '任意城市',
    footCopy: '保留所有权利。',
  },

  ja: {
    pageTitle: 'WanderMind Studio | AI 旅行プランナー',
    navHome: 'ホーム', navAbout: '私たちについて', navExplore: '探索', navAITool: 'AI ツール', navContact: 'お問い合わせ',
    searchBtn: '検索',

    hero1Title: 'AI が再定義する<br>新しい旅',
    hero1Sub:   '6 つの AI エージェントが連携し、リアルタイムデータと個性的な推薦で完璧な旅をプランニング。',
    hero1Btn:   '計画を始める',
    hero2Title: 'バリ · 京都 · パリ<br>サントリーニ',
    hero2Sub:   '世界の名所での厳選体験 —— または、お好きな都市名を入力すれば AI が完全ガイドを瞬時に作成。',
    hero2Btn:   '目的地を探す',
    hero3Title: '6 人の専門 AI<br>あなたの旅をサポート',
    hero3Sub:   '旅行プランナー · 宿泊アドバイザー · グルメ探検家 · アクティビティ企画 · 予算マネージャー · リアル検索 —— 連携で最適化。',
    hero3Btn:   'チームに会う',

    formTitle: 'AI 専門家があなたの完璧な旅をプランニング',
    formSub:   '簡単な質問にお答えいただくと、6 つの AI エージェントがスタイル・予算・同行者に合わせた専用旅程を即座に作成します。',
    formName: 'お名前', formDest: '目的地', formDestAny: '任意', formDestCustom: 'カスタム（任意の都市）',
    formStyle: '旅行スタイル', formStyleAny: '任意', formStyleCity: '都市観光',
    formStyleCultural: '文化テーマ', formStyleFamily: 'ファミリー',
    formStyleLuxury: '高級志向', formStyleOutdoor: 'アウトドア',
    formStyleRelax: 'リラックス', formStyleAdv: 'アドベンチャー',
    formDuration: '期間', formDurAny: '任意', formDur1: '1 日', formDur2: '2-4 日', formDur5: '5-7 日', formDur7: '7 日以上',
    formDate: '出発日', formSubmitLbl: '送信', formSubmitBtn: 'AI プランを取得',

    sec4BaliTitle:  'バリ島 · 神々の島',
    sec4BaliDesc:   '陽光のビーチ、棚田、断崖の古寺と深い精神文化。ウブドのジャングルリトリートからウルワトゥのサーフブレイクまで。',
    sec4KyotoTitle: '京都 · 千年の古都',
    sec4KyotoDesc:  '千年の神社、芸者文化、竹林の道、季節の懐石料理。',
    sec4ParisTitle: 'パリ · 光の街',
    sec4ParisDesc:  'ロマン、世界クラスの芸術、永遠の並木道とパティスリー。',
    sec4SantTitle:  'サントリーニ · エーゲ海の真珠',
    sec4SantDesc:   '白い村、カルデラの夕日、透き通る青い海。',
    sec4AnyTitle:   '任意の目的地 · AI 即時生成',
    sec4AnyDesc:    '都市名を入力 —— 東京、マラケシュ、レイキャビク —— AI が瞬時にガイドを作成。',

    sec5Title: '人気の旅行先',
    sec5Sub:   'AI エージェントが深いローカル情報を持つ厳選目的地 —— 隠れた絶品グルメから最適な撮影タイミングまで。',
    sec5From: '〜から', sec5From2: '〜から', sec5From3: '〜から',
    sec5BaliName: 'バリ島 · インドネシア', sec5BaliDays: '7 日間', sec5BaliPeople: '2-4 名',
    sec5BaliDesc: '陽光のビーチ、棚田、古い寺院と深い精神文化。',
    sec5KyotoName: '京都 · 日本',         sec5KyotoDays: '5 日間', sec5KyotoPeople: '2-4 名',
    sec5KyotoDesc: '古い神社、芸者文化、桜の季節、懐石料理。',
    sec5ParisName: 'パリ · フランス',     sec5ParisDays: '7 日間', sec5ParisPeople: '2-4 名',
    sec5ParisDesc: 'ロマン、世界クラスの芸術、永遠の並木道と忘れられないパティスリー。',

    sec6Eyebrow: 'WanderMind Studio について',
    sec6Title:   '6 つの AI エージェントが連携し、すべての旅に魂を吹き込む。',
    sec6Desc:    'WanderMind Studio は 6 つの専門 AI エージェントを統合し、完璧な旅を計画します —— 旅程設計からリアルタイムホテル価格、ローカルグルメ発見から予算最適化まで。5 言語対応、世界中の都市の知能データ。',
    sec6Btn:     '詳細を見る',

    sec7Title: 'AI 専門家が常駐<br>計画から到着まで',
    sec7Desc:  '最初のアイデアから最後の写真まで、6 つの AI エージェントが旅のあらゆるステップをサポート。リアルタイムデータ、個性的推薦、5 言語対応。',
    sec7Btn:   '旅を始める',

    footContactTitle: 'お問い合わせ', footWeChat: '（WeChat）', footWaTag: '（バリ専属）',
    footFeaturesTitle: '機能',
    footFeat1: 'AI 旅程計画', footFeat2: 'ホテル比較', footFeat3: '航空券比較',
    footFeat4: '旅程タイムライン', footFeat5: '旅行プリファレンス',
    footGalleryTitle: 'ギャラリー', footDestTitle: '人気の目的地',
    footDest1: 'バリ島', footDest2: '京都', footDest3: 'パリ', footDest4: 'サントリーニ', footDest5: '任意の都市',
    footCopy: 'All Rights Reserved.',
  },

  ko: {
    pageTitle: 'WanderMind Studio | AI 여행 플래너',
    navHome: '홈', navAbout: '소개', navExplore: '탐색', navAITool: 'AI 도구', navContact: '문의',
    searchBtn: '검색',

    hero1Title: 'AI 가 재정의하는<br>여행의 새로운 경험',
    hero1Sub:   '6 명의 AI 에이전트가 협력하여 실시간 데이터와 개인 맞춤 추천으로 완벽한 여행을 설계합니다.',
    hero1Btn:   '계획 시작',
    hero2Title: '발리 · 교토 · 파리<br>산토리니',
    hero2Sub:   '세계 최고의 명소에서 큐레이션된 경험 —— 또는 도시 이름만 알려주시면 AI 가 즉시 완전 가이드를 만듭니다.',
    hero2Btn:   '목적지 탐색',
    hero3Title: '6 명의 전문 AI 에이전트<br>당신을 위해 대기 중',
    hero3Sub:   '여행 플래너 · 숙박 어드바이저 · 미식 탐험가 · 액티비티 큐레이터 · 예산 매니저 · 실시간 검색 —— 협력하여 작동.',
    hero3Btn:   '팀 만나기',

    formTitle: 'AI 전문가가 당신의 완벽한 여행을 설계합니다',
    formSub:   '몇 가지 질문에 답하시면 6 명의 AI 에이전트가 스타일·예산·동행자에 맞춘 맞춤 여행을 즉시 생성합니다.',
    formName: '성함', formDest: '목적지', formDestAny: '아무거나', formDestCustom: '커스텀 (모든 도시)',
    formStyle: '여행 스타일', formStyleAny: '아무거나', formStyleCity: '도시 투어',
    formStyleCultural: '문화 테마', formStyleFamily: '가족 친화',
    formStyleLuxury: '럭셔리 호화', formStyleOutdoor: '아웃도어',
    formStyleRelax: '휴양', formStyleAdv: '모험 탐험',
    formDuration: '기간', formDurAny: '아무거나', formDur1: '1 일', formDur2: '2-4 일', formDur5: '5-7 일', formDur7: '7 일 이상',
    formDate: '출발일', formSubmitLbl: '제출', formSubmitBtn: 'AI 계획 받기',

    sec4BaliTitle:  '발리 · 신들의 섬',
    sec4BaliDesc:   '햇살 가득한 해변, 푸른 계단식 논, 절벽 위 고대 사원과 깊은 영적 문화. 우붓 정글 리트리트부터 울루와뚜 서핑까지.',
    sec4KyotoTitle: '교토 · 천년의 고도',
    sec4KyotoDesc:  '천년의 신사, 게이샤 문화, 대나무 숲길과 계절 가이세키 요리.',
    sec4ParisTitle: '파리 · 빛의 도시',
    sec4ParisDesc:  '낭만, 세계적 수준의 예술, 시간을 초월한 가로수길과 파티세리.',
    sec4SantTitle:  '산토리니 · 에게해의 진주',
    sec4SantDesc:   '하얀 마을, 칼데라 일몰, 수정처럼 맑은 푸른 바다.',
    sec4AnyTitle:   '어디든 · AI 가 만들어주는',
    sec4AnyDesc:    '도시 이름을 입력하세요 —— 도쿄, 마라케시, 레이캬비크 —— AI 가 즉시 가이드를 만듭니다.',

    sec5Title: '인기 여행지',
    sec5Sub:   'AI 에이전트가 깊은 로컬 정보를 가진 엄선된 목적지 —— 숨겨진 맛집부터 최적의 사진 촬영 시간까지.',
    sec5From: '〜부터', sec5From2: '〜부터', sec5From3: '〜부터',
    sec5BaliName: '발리 · 인도네시아', sec5BaliDays: '7 일',  sec5BaliPeople: '2-4 명',
    sec5BaliDesc: '햇살 가득한 해변, 푸른 계단식 논, 고대 사원과 깊은 영적 문화.',
    sec5KyotoName: '교토 · 일본',      sec5KyotoDays: '5 일', sec5KyotoPeople: '2-4 명',
    sec5KyotoDesc: '고대 신사, 게이샤 문화, 벚꽃 시즌, 가이세키 요리.',
    sec5ParisName: '파리 · 프랑스',    sec5ParisDays: '7 일', sec5ParisPeople: '2-4 명',
    sec5ParisDesc: '낭만, 세계적 수준의 예술, 시간을 초월한 가로수길과 잊지 못할 파티세리.',

    sec6Eyebrow: 'WanderMind Studio 소개',
    sec6Title:   '6 명의 AI 에이전트가 협력하여 모든 여행에 영혼을 불어넣습니다.',
    sec6Desc:    'WanderMind Studio 는 6 명의 전문 AI 에이전트를 결합하여 완벽한 여행을 계획합니다 —— 여행 일정 설계부터 실시간 호텔 가격, 현지 미식 발견부터 예산 최적화까지. 5 개 언어 지원, 전 세계 모든 도시의 지능형 데이터.',
    sec6Btn:     '더 알아보기',

    sec7Title: 'AI 전문가가 항시 대기<br>계획부터 도착까지',
    sec7Desc:  '첫 아이디어부터 마지막 사진까지, 6 명의 AI 에이전트가 여행의 모든 단계를 지원합니다. 실시간 데이터, 개인 맞춤 추천, 5 개 언어 지원.',
    sec7Btn:   '여행 시작',

    footContactTitle: '문의', footWeChat: '(WeChat)', footWaTag: '(발리 전담)',
    footFeaturesTitle: '기능',
    footFeat1: 'AI 여행 계획', footFeat2: '호텔 가격 비교', footFeat3: '항공권 가격 비교',
    footFeat4: '여행 타임라인', footFeat5: '여행 선호도',
    footGalleryTitle: '갤러리', footDestTitle: '인기 목적지',
    footDest1: '발리', footDest2: '교토', footDest3: '파리', footDest4: '산토리니', footDest5: '모든 도시',
    footCopy: 'All Rights Reserved.',
  },

  id: {
    pageTitle: 'WanderMind Studio | Perencana Perjalanan AI',
    navHome: 'Beranda', navAbout: 'Tentang', navExplore: 'Jelajahi', navAITool: 'Alat AI', navContact: 'Kontak',
    searchBtn: 'Cari',

    hero1Title: 'Perjalanan<br>Didefinisikan Ulang oleh AI',
    hero1Sub:   'Enam agen AI berkolaborasi untuk merancang perjalanan sempurna Anda — data real-time, rekomendasi personal, setiap detail direncanakan dengan cerdas.',
    hero1Btn:   'Mulai Merencanakan',
    hero2Title: 'Bali · Kyoto · Paris<br>Santorini',
    hero2Sub:   'Jelajahi pengalaman pilihan di tujuan paling memukau di dunia — atau biarkan AI kami merancang panduan lengkap untuk kota mana pun yang Anda sebutkan.',
    hero2Btn:   'Jelajahi Tujuan',
    hero3Title: 'Enam Agen Ahli AI<br>Siap Melayani Anda',
    hero3Sub:   'Perencana Perjalanan · Penasihat Akomodasi · Penjelajah Kuliner · Kurator Aktivitas · Manajer Anggaran · Pencarian Langsung — semua bekerja sama untuk Anda.',
    hero3Btn:   'Kenali Tim',

    formTitle: 'Biarkan ahli AI merancang liburan sempurna Anda',
    formSub:   'Jawab beberapa pertanyaan dan enam agen AI kami akan langsung membuat itinerary kustom yang disesuaikan dengan gaya, anggaran, dan teman perjalanan Anda.',
    formName: 'Nama Anda', formDest: 'Tujuan', formDestAny: 'Apa saja', formDestCustom: 'Kustom (kota mana pun)',
    formStyle: 'Gaya Perjalanan', formStyleAny: 'Apa saja', formStyleCity: 'Tur Kota',
    formStyleCultural: 'Budaya & Tema', formStyleFamily: 'Ramah Keluarga',
    formStyleLuxury: 'Kemewahan', formStyleOutdoor: 'Aktivitas Outdoor',
    formStyleRelax: 'Relaksasi', formStyleAdv: 'Petualangan',
    formDuration: 'Durasi', formDurAny: 'Apa saja', formDur1: '1 Hari', formDur2: '2-4 Hari', formDur5: '5-7 Hari', formDur7: '7+ Hari',
    formDate: 'Berangkat', formSubmitLbl: 'Kirim', formSubmitBtn: 'Dapatkan Rencana AI',

    sec4BaliTitle:  'Bali · Pulau Dewata',
    sec4BaliDesc:   'Pantai bermandikan matahari, sawah hijau, pura kuno di tebing, dan budaya spiritual yang dalam. Dari retret hutan Ubud hingga ombak surfing Uluwatu.',
    sec4KyotoTitle: 'Kyoto · Ibukota Kuno',
    sec4KyotoDesc:  'Kuil seribu tahun, budaya geisha, jalan setapak bambu, dan kaiseki musiman.',
    sec4ParisTitle: 'Paris · Kota Cahaya',
    sec4ParisDesc:  'Romansa, seni kelas dunia, jalan boulevard abadi, dan toko kue terbaik.',
    sec4SantTitle:  'Santorini · Mutiara Aegean',
    sec4SantDesc:   'Desa-desa putih, matahari terbenam di kaldera, dan perairan biru kristal.',
    sec4AnyTitle:   'Di Mana Saja · Didukung AI',
    sec4AnyDesc:    'Ketik kota mana pun — Tokyo, Marrakech, Reykjavik — AI langsung membangun panduan Anda.',

    sec5Title: 'Destinasi Perjalanan Teratas',
    sec5Sub:   'Tujuan pilihan di mana agen AI kami memiliki intelijen lokal yang mendalam — dari tempat makan tersembunyi hingga waktu foto optimal.',
    sec5From: 'mulai dari', sec5From2: 'mulai dari', sec5From3: 'mulai dari',
    sec5BaliName: 'Bali · Indonesia',  sec5BaliDays: '7 Hari',  sec5BaliPeople: '2-4 Orang',
    sec5BaliDesc: 'Pantai bermandikan matahari, sawah hijau, pura kuno, dan budaya spiritual yang dalam.',
    sec5KyotoName: 'Kyoto · Jepang',   sec5KyotoDays: '5 Hari', sec5KyotoPeople: '2-4 Orang',
    sec5KyotoDesc: 'Kuil kuno, budaya geisha, musim bunga sakura, dan masakan kaiseki.',
    sec5ParisName: 'Paris · Prancis',  sec5ParisDays: '7 Hari', sec5ParisPeople: '2-4 Orang',
    sec5ParisDesc: 'Romansa, seni kelas dunia, jalan boulevard abadi, dan toko kue tak terlupakan.',

    sec6Eyebrow: 'Tentang WanderMind Studio',
    sec6Title:   'Perjalanan personal didukung kolaborasi multi-agen AI.',
    sec6Desc:    'WanderMind Studio menggabungkan enam agen AI khusus untuk merencanakan perjalanan sempurna Anda — dari desain itinerary hingga harga hotel real-time, dari penemuan kuliner lokal hingga optimasi anggaran. Tersedia dalam 5 bahasa, dengan data cerdas untuk kota mana pun di dunia.',
    sec6Btn:     'Pelajari lebih lanjut',

    sec7Title: 'Ahli AI siaga<br>dari perencanaan hingga pendaratan',
    sec7Desc:  'Dari ide pertama hingga foto terakhir, enam agen AI kami mendukung setiap langkah perjalanan Anda. Data real-time, rekomendasi personal, tersedia dalam lima bahasa.',
    sec7Btn:   'Mulai Perjalanan Anda',

    footContactTitle: 'Hubungi Kami', footWeChat: '(WeChat)', footWaTag: '(Concierge Bali)',
    footFeaturesTitle: 'Fitur',
    footFeat1: 'Perencanaan AI', footFeat2: 'Perbandingan Hotel', footFeat3: 'Perbandingan Penerbangan',
    footFeat4: 'Pembangun Itinerary', footFeat5: 'Preferensi Perjalanan',
    footGalleryTitle: 'Galeri', footDestTitle: 'Tujuan Teratas',
    footDest1: 'Bali', footDest2: 'Kyoto', footDest3: 'Paris', footDest4: 'Santorini', footDest5: 'Kota Mana Saja',
    footCopy: 'Semua hak dilindungi.',
  },
};

/* ──────────────────────────────────────────────────────
   apply / persist / wire up the picker
   ────────────────────────────────────────────────────── */

function applyLang(lang) {
  const dict = LANGS[lang] || LANGS.en;
  // page title
  if (dict.pageTitle) document.title = dict.pageTitle;
  // every element with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) {
      // use innerHTML so <br> inside titles renders correctly
      el.innerHTML = dict[key];
    }
  });
  // set <html lang="..."> for accessibility + search engines
  document.documentElement.setAttribute('lang', lang);
  // persist selection
  try { localStorage.setItem('wm_studio_lang', lang); } catch (e) {}
}

(function init() {
  const saved = (function () {
    try { return localStorage.getItem('wm_studio_lang'); } catch (e) { return null; }
  })() || (navigator.language || 'en').slice(0, 2).toLowerCase();

  // fall back to en if saved language is not in our dictionary
  const initial = LANGS[saved] ? saved : 'en';
  // wait for DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    const picker = document.getElementById('langPicker');
    if (picker) {
      picker.value = initial;
      picker.addEventListener('change', function () { applyLang(this.value); });
    }
    applyLang(initial);
  });
})();
