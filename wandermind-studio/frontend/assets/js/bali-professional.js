(function () {
  'use strict';

  var app = document.getElementById('bali-professional-app');
  if (!app) return;

  var API_BASE = window.WM_BACKEND || '';
  var query = new URLSearchParams(window.location.search);
  var state = {
    tripId: localStorage.getItem('wm_studio_professional_trip_id') || '',
    routeId: (query.get('route') || localStorage.getItem('wm_studio_professional_route_hint') || '').toUpperCase(),
    profile: null,
    response: null,
    editing: false,
    paymentOpen: false,
    paypal: null,
    loading: false,
    pendingRouteId: '',
    queuedRouteId: '',
    userMatchPending: false
  };

  var PAYPAL_COPY = {
    en: { option:'Pay online with PayPal or card', sandbox:'Sandbox test · no real charge', local:'Or use a local QR payment', processing:'Verifying the payment securely…', done:'Payment verified. Your full route is now open.', cancelled:'Checkout closed. No route access was granted; you can try again.', failed:'PayPal could not verify this payment. No route access was granted.' },
    zh: { option:'使用 PayPal 或银行卡在线支付', sandbox:'沙盒测试 · 不会真实扣款', local:'或使用本地二维码付款', processing:'正在由服务器安全核验付款…', done:'付款已核验，完整路线已经开放。', cancelled:'已关闭付款，没有授予路线权益；你可以重新尝试。', failed:'PayPal 未能核验这笔付款，路线尚未解锁。' },
    ja: { option:'PayPal またはカードでオンライン決済', sandbox:'Sandbox テスト・実際の請求なし', local:'またはローカルQR決済', processing:'サーバーで決済を確認しています…', done:'決済を確認し、完全版ルートを開放しました。', cancelled:'決済を閉じました。ルートは開放されていません。もう一度お試しいただけます。', failed:'PayPalで決済を確認できなかったため、ルートは開放されていません。' },
    ko: { option:'PayPal 또는 카드로 온라인 결제', sandbox:'Sandbox 테스트 · 실제 청구 없음', local:'또는 현지 QR 결제', processing:'서버에서 결제를 안전하게 확인 중입니다…', done:'결제가 확인되어 전체 경로가 열렸습니다.', cancelled:'결제를 닫았습니다. 경로 권한은 부여되지 않았으며 다시 시도할 수 있습니다.', failed:'PayPal 결제를 확인하지 못해 경로가 잠금 해제되지 않았습니다.' },
    id: { option:'Bayar online dengan PayPal atau kartu', sandbox:'Uji Sandbox · tidak ada tagihan nyata', local:'Atau gunakan pembayaran QR lokal', processing:'Memverifikasi pembayaran dengan aman…', done:'Pembayaran terverifikasi. Rute lengkap sudah terbuka.', cancelled:'Checkout ditutup. Akses rute belum diberikan; Anda dapat mencoba lagi.', failed:'PayPal tidak dapat memverifikasi pembayaran ini. Rute belum dibuka.' }
  };

  var COPY = {
    en: {
      noProfile: 'Complete a few travel details and we will match a more suitable professional route. You can skip this and keep browsing the public route families.',
      formTitle: 'Your Bali trip', submit: 'Match my route', submitAdjust: 'Apply this adjustment', edit: 'Edit trip information', cancel: 'Close editor', basics:'1 · Trip basics', approach:'2 · Travel approach', goalsGroup:'3 · What matters most', optional:'Optional · choose up to 3', profileTitle:'Your trip profile', profileHint:'Updates as you choose', daysCount:'{n} days', peopleCount:'{n} travellers', invalidDates:'Choose a return date after your departure date.', invalidBudget:'Enter your approximate total budget.', increase:'Add one traveller', decrease:'Remove one traveller',
      audience: 'Trip stage', first: 'First Bali trip', returning: 'Returning visitor', people: 'Travellers', start: 'Departure date', end: 'Return date', budget: 'Budget', style: 'Travel style', comfort: 'Comfort', budgetStyle: 'Value', luxury: 'Premium', pace: 'Pace', balanced: 'Balanced', slow: 'Slower', goals: 'Priorities', local: 'Local culture', photo: 'Scenery & photography', easy: 'Less planning', value: 'Budget control',
      route: 'Matched professional route', preview: 'Free preview', unlocked: 'Full route unlocked', reason: 'Why this route', openDays: '{n} days open', lockedDays: '{n} days locked', day: 'Day {n}', locked: 'Locked detail', lockedNote: 'Unlock to see the place order, experience modules and execution notes.', tripUnavailable:'This saved route belongs to a different account. Sign in with the purchasing account or open your latest unlocked route.',
      unlock: 'Unlock full route · ¥9.9', points: 'Use 30 referral points', adjust: 'Adjust this trip', remaining: '{n} adjustments left', adjustExhausted: 'No adjustments left', adjustScope: 'Includes 3 parameter adjustments for this same trip: dates or days, pace, budget, interests, travel style and group size. It does not include human deep customization or new trip orders.', routeSwitchPending: '{route} is selected above. Your unlocked route will not be replaced by browsing; submit “Adjust this trip” to switch, using one adjustment.', driver: 'Send this route to a driver', dicky: 'Send to Dicky', gede: 'Send to Gede Nico', login: 'Sign in to unlock', public: 'Browse public R1–R6 routes', payTitle: 'Unlock this route', payText: 'Pay ¥9.9 to unlock this full route and 3 parameter adjustments for the same trip. AI self-planning credits stay separate. Human deep customization and new trip orders are not included.', paid: 'I paid · submit for confirmation', orderSent: 'Payment confirmation request submitted. The route will open after confirmation.', pointsDone: 'Route unlocked with points.', loading: 'Matching your route…', error: 'We could not load the professional route. Please try again.', noData: 'Enter your dates, travellers and budget to start.', routeBasis: 'Structured from Bali geography, route families and POI modules. Access and availability still need confirmation.'
    },
    zh: {
      noProfile: '完成几项旅行信息后，我们可以从 Bali 的区域和路线体系中匹配更适合你的专业路线。你也可以跳过，继续浏览公共路线。',
      formTitle: '你的巴厘岛行程', submit: '匹配我的路线', submitAdjust: '提交本次调整', edit: '修改旅行信息', cancel: '收起编辑', basics:'1 · 基本行程', approach:'2 · 旅行方式', goalsGroup:'3 · 最关注什么', optional:'可选 · 最多选择 3 项', profileTitle:'你的旅行画像', profileHint:'选择后实时更新', daysCount:'{n} 天', peopleCount:'{n} 人', invalidDates:'请选择晚于出发日期的返回日期。', invalidBudget:'请填写大致总预算。', increase:'增加一位旅客', decrease:'减少一位旅客',
      audience: '旅行阶段', first: '第一次去巴厘岛', returning: '去过巴厘岛', people: '出行人数', start: '出发日期', end: '返回日期', budget: '预算', style: '旅行风格', comfort: '舒适平衡', budgetStyle: '预算优先', luxury: '高端私享', pace: '节奏', balanced: '平衡', slow: '慢一点', goals: '优先事项', local: '风土人情', photo: '自然与摄影', easy: '少做攻略', value: '预算控制',
      route: '匹配到的专业路线', preview: '免费预览', unlocked: '完整路线已解锁', reason: '为什么是这条路线', openDays: '已开放 {n} 天', lockedDays: '锁定 {n} 天', day: '第 {n} 天', locked: '细节已锁定', lockedNote: '解锁后查看地点顺序、体验模块和执行备注。', tripUnavailable:'这条本机记录属于另一个账号。请登录付款时使用的账号，或打开该账号最近解锁的路线。',
      unlock: '解锁完整路线 · ¥9.9', points: '用 30 推荐积分兑换', adjust: '调整本次行程', remaining: '还可调整 {n} 次', adjustExhausted: '本行程调整次数已用完', adjustScope: '同一行程可调整 3 次，可改日期或天数、节奏、预算、兴趣模块、旅行风格和人数；不含人工深度定制，也不能用于新建其他旅行订单。', routeSwitchPending: '上方已选择 {route}。浏览不会覆盖已解锁路线；提交“调整本次行程”后才会切换，并使用 1 次调整。', driver: '把完整路线发给司机', dicky: '发送给 Dicky', gede: '发送给 Gede Nico', login: '登录后解锁', public: '继续浏览公共 R1–R6 路线', payTitle: '解锁这条路线', payText: '¥9.9 解锁当前完整专业路线，附带同一行程 3 次调整。AI 自助规划额度单独计算；不含人工深度定制，也不能用于新建其他旅行订单。', paid: '我已付款 · 提交确认', orderSent: '到账确认申请已提交，管理员确认后路线会开放。', pointsDone: '已用积分解锁路线。', loading: '正在匹配你的路线…', error: '专业路线暂时无法加载，请稍后重试。', noData: '填写日期、人数和预算后开始匹配。', routeBasis: '基于 Bali 地理区域、路线家族和 POI 模块生成。开放时间和可用性仍需确认。'
    },
    ja: { noProfile:'旅行情報を入力すると、Bali の地域とルートから合うプロルートを提案します。公開ルートはそのまま見られます。', formTitle:'バリ旅行の情報', submit:'ルートを提案', submitAdjust:'この調整を適用', edit:'旅行情報を編集', cancel:'編集を閉じる', basics:'1 · 基本情報', approach:'2 · 旅のスタイル', goalsGroup:'3 · 重視すること', optional:'任意 · 3項目まで', profileTitle:'旅のプロフィール', profileHint:'選択に合わせて更新', daysCount:'{n}日', peopleCount:'{n}名', invalidDates:'帰着日は出発日より後にしてください。', invalidBudget:'おおよその総予算を入力してください。', increase:'旅行者を1名追加', decrease:'旅行者を1名減らす', audience:'旅行段階', first:'初めて', returning:'リピーター', people:'人数', start:'出発日', end:'帰着日', budget:'予算', style:'旅行スタイル', comfort:'快適', budgetStyle:'予算重視', luxury:'プレミアム', pace:'ペース', balanced:'バランス', slow:'ゆっくり', goals:'優先事項', local:'文化', photo:'風景・写真', easy:'計画を減らす', value:'予算管理', route:'提案されたプロルート', preview:'無料プレビュー', unlocked:'完全版を解放済み', reason:'おすすめの理由', openDays:'{n}日を表示', lockedDays:'{n}日をロック', day:'{n}日目', locked:'詳細はロック中', lockedNote:'解放すると場所の順序、体験モジュール、実行メモを確認できます。', tripUnavailable:'保存されたルートは別のアカウントに属します。購入時のアカウントでログインしてください。', unlock:'完全版を解放 · ¥9.9', points:'紹介ポイント30で交換', adjust:'この旅程を調整', remaining:'残り{n}回', adjustExhausted:'この旅程の調整回数を使い切りました', adjustScope:'同じ旅程について、日数・ペース・予算・興味など3回の項目調整を含みます。人による詳細設計や新しい旅程3件の作成は含みません。', routeSwitchPending:'上で{route}を選択しました。閲覧だけでは解放済みルートは変わりません。「この旅程を調整」を送信すると1回分を使って切り替わります。', driver:'完全なルートをドライバーへ', dicky:'Dickyへ送る', gede:'Gede Nicoへ送る', login:'ログインして解放', public:'公開R1–R6を見る', payTitle:'このルートを解放', payText:'¥9.9で現在の完全版ルートと、同じ旅程の項目調整3回を解放します。AI自分計画の枠とは別で、人による詳細設計や新しい旅程の作成は含みません。', paid:'支払済み・確認を申請', orderSent:'確認申請を受け付けました。確認後に開放されます。', pointsDone:'ポイントで解放しました。', loading:'ルートを提案中…', error:'プロルートを読み込めませんでした。', noData:'日付、人数、予算を入力してください。', routeBasis:'Baliの地理、ルート、POIモジュールから構成しています。時間と空き状況は要確認です。' },
    ko: { noProfile:'여행 정보를 입력하면 Bali 지역과 경로에서 맞춤 전문 경로를 추천합니다. 공개 경로는 계속 볼 수 있습니다.', formTitle:'발리 여행 정보', submit:'경로 매칭', submitAdjust:'이번 조정 적용', edit:'여행 정보 편집', cancel:'편집 닫기', basics:'1 · 기본 일정', approach:'2 · 여행 방식', goalsGroup:'3 · 가장 중요한 것', optional:'선택 · 최대 3개', profileTitle:'나의 여행 프로필', profileHint:'선택에 따라 업데이트', daysCount:'{n}일', peopleCount:'{n}명', invalidDates:'귀국일은 출발일보다 늦어야 합니다.', invalidBudget:'대략적인 총예산을 입력하세요.', increase:'여행자 1명 추가', decrease:'여행자 1명 줄이기', audience:'여행 단계', first:'첫 방문', returning:'재방문', people:'인원', start:'출발일', end:'귀국일', budget:'예산', style:'여행 스타일', comfort:'편안함', budgetStyle:'예산 우선', luxury:'프리미엄', pace:'속도', balanced:'균형', slow:'느긋하게', goals:'우선순위', local:'현지 문화', photo:'풍경·사진', easy:'계획 줄이기', value:'예산 관리', route:'매칭된 전문 경로', preview:'무료 미리보기', unlocked:'전체 루트 잠금 해제', reason:'추천 이유', openDays:'{n}일 공개', lockedDays:'{n}일 잠금', day:'{n}일차', locked:'상세 잠금', lockedNote:'잠금 해제 후 장소 순서, 체험 모듈과 실행 메모를 확인할 수 있습니다.', tripUnavailable:'저장된 경로는 다른 계정에 속합니다. 구매한 계정으로 로그인하세요.', unlock:'전체 루트 잠금 해제 · ¥9.9', points:'추천 포인트 30점 사용', adjust:'이 여행 조정', remaining:'{n}회 남음', adjustExhausted:'이 여행의 조정 횟수를 모두 사용했습니다', adjustScope:'같은 여행에 대해 일정 일수, 속도, 예산, 관심사 등의 항목을 3회 조정할 수 있습니다. 사람의 심층 맞춤 설계나 새 여행 주문 3건은 포함하지 않습니다.', routeSwitchPending:'위에서 {route}을(를) 선택했습니다. 둘러보기만으로 잠금 해제된 경로는 바뀌지 않습니다. “이 여행 조정”을 제출하면 조정 1회를 사용해 전환됩니다.', driver:'전체 루트를 기사에게 보내기', dicky:'Dicky에게 보내기', gede:'Gede Nico에게 보내기', login:'로그인 후 잠금 해제', public:'공개 R1–R6 보기', payTitle:'이 루트 잠금 해제', payText:'¥9.9로 현재 전체 전문 경로와 같은 여행의 항목 조정 3회를 잠금 해제합니다. AI 직접 계획 한도와 별도이며, 사람의 심층 맞춤 설계나 새 여행 주문은 포함하지 않습니다.', paid:'결제 완료 · 확인 요청', orderSent:'확인 요청을 보냈습니다. 확인 후 루트가 열립니다.', pointsDone:'포인트로 잠금 해제했습니다.', loading:'루트를 매칭하는 중…', error:'전문 경로를 불러오지 못했습니다.', noData:'날짜, 인원과 예산을 입력하세요.', routeBasis:'Bali 지리, 경로 가족과 POI 모듈을 바탕으로 구성합니다. 운영 시간과 이용 가능 여부는 확인이 필요합니다.' },
    id: { noProfile:'Isi detail perjalanan untuk mencocokkan rute profesional dari wilayah dan rute Bali. Anda tetap dapat melihat rute publik.', formTitle:'Perjalanan Bali Anda', submit:'Cocokkan rute saya', submitAdjust:'Terapkan penyesuaian', edit:'Ubah detail perjalanan', cancel:'Tutup editor', basics:'1 · Dasar perjalanan', approach:'2 · Cara bepergian', goalsGroup:'3 · Yang paling penting', optional:'Opsional · pilih hingga 3', profileTitle:'Profil perjalanan Anda', profileHint:'Diperbarui saat memilih', daysCount:'{n} hari', peopleCount:'{n} orang', invalidDates:'Tanggal pulang harus setelah tanggal berangkat.', invalidBudget:'Masukkan perkiraan total anggaran.', increase:'Tambah satu wisatawan', decrease:'Kurangi satu wisatawan', audience:'Tahap perjalanan', first:'Pertama kali', returning:'Pernah datang', people:'Jumlah orang', start:'Tanggal berangkat', end:'Tanggal pulang', budget:'Anggaran', style:'Gaya perjalanan', comfort:'Nyaman', budgetStyle:'Hemat', luxury:'Premium', pace:'Tempo', balanced:'Seimbang', slow:'Santai', goals:'Prioritas', local:'Budaya lokal', photo:'Pemandangan & foto', easy:'Lebih sedikit rencana', value:'Kendali anggaran', route:'Rute profesional yang cocok', preview:'Pratinjau gratis', unlocked:'Rute lengkap terbuka', reason:'Alasan rekomendasi', openDays:'{n} hari terbuka', lockedDays:'{n} hari terkunci', day:'Hari {n}', locked:'Detail terkunci', lockedNote:'Buka kunci untuk melihat urutan tempat, modul pengalaman dan catatan pelaksanaan.', tripUnavailable:'Rute tersimpan ini milik akun lain. Masuk dengan akun yang digunakan saat membeli.', unlock:'Buka rute lengkap · ¥9.9', points:'Gunakan 30 poin referral', adjust:'Sesuaikan perjalanan ini', remaining:'tersisa {n} penyesuaian', adjustExhausted:'Penyesuaian untuk perjalanan ini sudah habis', adjustScope:'Termasuk 3 penyesuaian parameter untuk perjalanan yang sama, seperti jumlah hari, tempo, anggaran atau minat. Tidak termasuk kustomisasi mendalam oleh manusia atau tiga pesanan perjalanan baru.', routeSwitchPending:'{route} dipilih di atas. Menjelajah tidak mengganti rute yang sudah terbuka; kirim “Sesuaikan perjalanan ini” untuk beralih dengan memakai 1 penyesuaian.', driver:'Kirim rute lengkap ke driver', dicky:'Kirim ke Dicky', gede:'Kirim ke Gede Nico', login:'Masuk untuk membuka', public:'Lihat rute publik R1–R6', payTitle:'Buka rute ini', payText:'Bayar ¥9.9 untuk membuka rute profesional lengkap saat ini dan 3 penyesuaian parameter untuk perjalanan yang sama. Kredit AI tetap terpisah; kustomisasi mendalam oleh manusia dan pesanan perjalanan baru tidak termasuk.', paid:'Saya sudah bayar · kirim konfirmasi', orderSent:'Permintaan konfirmasi dikirim. Rute terbuka setelah dikonfirmasi.', pointsDone:'Rute dibuka dengan poin.', loading:'Mencocokkan rute…', error:'Rute profesional tidak dapat dimuat.', noData:'Isi tanggal, jumlah orang dan anggaran.', routeBasis:'Disusun dari geografi Bali, keluarga rute dan modul POI. Jam buka dan ketersediaan tetap perlu dikonfirmasi.' }
  };

  Object.assign(COPY.en, { intro:'Matched from your days, group, goals, budget and pace across Bali G1–G7 and route families R1–R6. Required items are marked *; about 1 minute.', required:'Required', progress:'{n}/7 complete', tripDates:'Travel dates', budget:'Budget tier', budgetValue:'Essential', budgetComfort:'Comfort', budgetPremium:'Premium', budgetHint:'Shown in your language currency', styleComfort:'Comfortably balanced', styleDeep:'Explore deeper', styleRelaxed:'Resort & unwind', slow:'Light', balanced:'Balanced', active:'Full', hidden:'Hidden routes', goalRequired:'Choose 1–3 priorities', routeType:'Expected route type', routePending:'Complete the required choices to see it', routeFamily:'G1–G7 regions × R1–R6 route families', routeR1:'R1 · First Bali foundation', routeR2R3:'R2 / R3 · Slow or coastal Bali', routeR4:'R4 · Culture & local depth', routeR5:'R5 · Outdoor & active Bali', routeR6:'R6 · Visual island life', reassurance:'✓ Your matched route includes 3 adjustments for the same trip.', submit:'Generate my Bali route', public:'Not now — browse public routes', edit:'Return to edit trip', rematch:'Rematch route', stepFill:'Fill trip', stepMatch:'Match route', stepPay:'Confirm payment', missingChoice:'Complete this required choice.', invalidGoals:'Choose at least one priority (up to 3).', budgetTierValue:'Value', budgetTierComfort:'Comfort', budgetTierPremium:'Premium', hotelArea:'Hotel area (optional)', hotelHint:'Helps reduce backtracking', hotelUnknown:'Not decided', hotelSouth:'South Bali', hotelSanur:'Sanur', hotelUbud:'Ubud', hotelNorth:'Lovina / North Bali', hotelEast:'East Bali', liveCheck:'Check live details', transferEstimate:'Planning drive estimate', adjustScope:'Includes 3 parameter adjustments for this same trip: dates or days, pace, budget, interests, travel style, group size and hotel area. It does not include human deep customization or new trip orders.' });
  Object.assign(COPY.zh, { intro:'根据你的天数、同行者、旅行目标、预算和节奏，从 Bali 的 G1–G7 区域事实与 R1–R6 路线家族中匹配专属路线。带 * 为必填，全程大约 1 分钟。', required:'必填', progress:'已完成 {n}/7', tripDates:'出行日期', budget:'预算档位', budgetValue:'实用省心', budgetComfort:'舒适平衡', budgetPremium:'品质升级', budgetHint:'金额会按当前语言显示对应货币', styleComfort:'舒适平衡', styleDeep:'深度探索', styleRelaxed:'度假放松', slow:'轻松', balanced:'平衡', active:'充实', hidden:'小众路线', goalRequired:'请选择 1–3 项 · 最多 3 项', routeType:'预计路线类型', routePending:'待填写完整后给出', routeFamily:'G1–G7 区域 × R1–R6 路线家族', routeR1:'R1 · 初见巴厘岛基础路线', routeR2R3:'R2 / R3 · 慢生活或南部海岸', routeR4:'R4 · 文化与在地深入', routeR5:'R5 · 户外与火山挑战', routeR6:'R6 · 视觉与岛屿生活', reassurance:'✓ 匹配结果支持 3 次同行程调整，放心试', submit:'生成我的 Bali 路线', public:'暂时跳过，浏览公共路线', edit:'返回修改行程', rematch:'重新匹配', stepFill:'填写行程', stepMatch:'匹配路线', stepPay:'确认支付', missingChoice:'请完成这个必填选项。', invalidGoals:'请至少选择 1 个关注点，最多 3 个。', budgetTierValue:'实用', budgetTierComfort:'舒适', budgetTierPremium:'品质', hotelArea:'酒店所在区域（可选）', hotelHint:'用于减少折返，不确定可先跳过', hotelUnknown:'暂未决定', hotelSouth:'南部海岸', hotelSanur:'萨努尔', hotelUbud:'乌布', hotelNorth:'罗威纳 / 北部', hotelEast:'东部海岸', liveCheck:'查看实时信息', transferEstimate:'规划车程参考', adjustScope:'同一行程可调整 3 次，可改日期或天数、节奏、预算、兴趣模块、旅行风格、人数和酒店所在区域；不含人工深度定制，也不能用于新建其他旅行订单。' });
  Object.assign(COPY.ja, { intro:'日数、同行者、目的、予算、ペースをもとに、Bali の G1–G7 地域と R1–R6 ルートから提案します。* は必須、約1分です。', required:'必須', progress:'{n}/7 完了', tripDates:'旅行日程', budget:'予算レベル', budgetValue:'実用', budgetComfort:'快適', budgetPremium:'上質', budgetHint:'表示言語に合う通貨で目安を表示', styleComfort:'快適なバランス', styleDeep:'深く探索', styleRelaxed:'リゾートで休む', slow:'ゆったり', balanced:'バランス', active:'充実', hidden:'穴場ルート', goalRequired:'1〜3項目を選択', routeType:'予想ルートタイプ', routePending:'必須項目の入力後に表示', routeFamily:'G1–G7 地域 × R1–R6 ルート', routeR1:'R1 · 初めてのBali基礎ルート', routeR2R3:'R2 / R3 · スロー旅または南部海岸', routeR4:'R4 · 文化とローカル体験', routeR5:'R5 · アウトドアと火山', routeR6:'R6 · 写真と島の暮らし', reassurance:'✓ 同じ旅程を3回調整できます。', submit:'私の Bali ルートを作成', public:'今は公開ルートを見る', edit:'旅程を戻って編集', rematch:'再マッチ', stepFill:'旅程入力', stepMatch:'ルート提案', stepPay:'支払い確認', missingChoice:'この必須項目を選択してください。', invalidGoals:'優先事項を1〜3個選択してください。', budgetTierValue:'実用', budgetTierComfort:'快適', budgetTierPremium:'上質', hotelArea:'ホテルエリア（任意）', hotelHint:'往復移動を減らすために使用', hotelUnknown:'未定', hotelSouth:'南部バリ', hotelSanur:'サヌール', hotelUbud:'ウブド', hotelNorth:'ロビナ / 北部', hotelEast:'東部バリ', liveCheck:'最新情報を確認', transferEstimate:'移動時間の目安', adjustScope:'同じ旅程で、日程、ペース、予算、興味、旅行スタイル、人数、ホテルエリアを3回調整できます。人による詳細設計や新規注文は含みません。' });
  Object.assign(COPY.ko, { intro:'여행 일수, 동행, 목표, 예산과 속도를 바탕으로 Bali G1–G7 지역과 R1–R6 경로에서 맞춤 추천합니다. *는 필수이며 약 1분 걸립니다.', required:'필수', progress:'7개 중 {n}개 완료', tripDates:'여행 날짜', budget:'예산 등급', budgetValue:'실속', budgetComfort:'편안함', budgetPremium:'프리미엄', budgetHint:'현재 언어에 맞는 통화로 표시', styleComfort:'편안한 균형', styleDeep:'깊이 탐험', styleRelaxed:'휴양과 쉼', slow:'여유', balanced:'균형', active:'알차게', hidden:'숨은 경로', goalRequired:'1–3개 선택 · 최대 3개', routeType:'예상 경로 유형', routePending:'필수 선택을 완료하면 표시', routeFamily:'G1–G7 지역 × R1–R6 경로', routeR1:'R1 · 첫 Bali 기본 경로', routeR2R3:'R2 / R3 · 느린 여행 또는 남부 해안', routeR4:'R4 · 문화와 현지 깊이', routeR5:'R5 · 야외 활동과 화산', routeR6:'R6 · 사진과 섬 라이프스타일', reassurance:'✓ 같은 여행을 3회 조정할 수 있습니다.', submit:'나의 Bali 경로 만들기', public:'나중에 — 공개 경로 보기', edit:'여행 정보로 돌아가기', rematch:'다시 매칭', stepFill:'여행 입력', stepMatch:'경로 매칭', stepPay:'결제 확인', missingChoice:'필수 선택을 완료해 주세요.', invalidGoals:'우선순위를 1–3개 선택해 주세요.', budgetTierValue:'실속', budgetTierComfort:'편안함', budgetTierPremium:'프리미엄', hotelArea:'호텔 지역 (선택)', hotelHint:'되돌아가는 이동을 줄이는 데 사용', hotelUnknown:'미정', hotelSouth:'발리 남부', hotelSanur:'사누르', hotelUbud:'우붓', hotelNorth:'로비나 / 북부', hotelEast:'발리 동부', liveCheck:'실시간 정보 확인', transferEstimate:'예상 이동 시간', adjustScope:'같은 여행에서 날짜, 속도, 예산, 관심사, 여행 스타일, 인원과 호텔 지역을 3회 조정할 수 있습니다. 사람의 심층 맞춤이나 새 주문은 포함하지 않습니다.' });
  Object.assign(COPY.id, { intro:'Kami mencocokkan hari, teman perjalanan, tujuan, anggaran, dan tempo Anda dengan wilayah Bali G1–G7 serta rute R1–R6. Tanda * wajib; sekitar 1 menit.', required:'Wajib', progress:'{n}/7 selesai', tripDates:'Tanggal perjalanan', budget:'Tingkat anggaran', budgetValue:'Praktis', budgetComfort:'Nyaman', budgetPremium:'Premium', budgetHint:'Kisaran memakai mata uang sesuai bahasa', styleComfort:'Nyaman seimbang', styleDeep:'Jelajah mendalam', styleRelaxed:'Liburan santai', slow:'Santai', balanced:'Seimbang', active:'Padat', hidden:'Rute tersembunyi', goalRequired:'Pilih 1–3 prioritas', routeType:'Perkiraan tipe rute', routePending:'Lengkapi pilihan wajib untuk melihat', routeFamily:'Wilayah G1–G7 × rute R1–R6', routeR1:'R1 · Fondasi Bali pertama', routeR2R3:'R2 / R3 · Bali santai atau pesisir selatan', routeR4:'R4 · Budaya dan pengalaman lokal', routeR5:'R5 · Alam terbuka dan gunung berapi', routeR6:'R6 · Visual dan gaya hidup pulau', reassurance:'✓ Hasil mencakup 3 penyesuaian untuk perjalanan yang sama.', submit:'Buat rute Bali saya', public:'Nanti — lihat rute publik', edit:'Kembali ubah perjalanan', rematch:'Cocokkan ulang', stepFill:'Isi perjalanan', stepMatch:'Cocokkan rute', stepPay:'Konfirmasi bayar', missingChoice:'Lengkapi pilihan wajib ini.', invalidGoals:'Pilih setidaknya 1 prioritas, maksimal 3.', budgetTierValue:'Praktis', budgetTierComfort:'Nyaman', budgetTierPremium:'Premium', hotelArea:'Area hotel (opsional)', hotelHint:'Membantu mengurangi perjalanan bolak-balik', hotelUnknown:'Belum ditentukan', hotelSouth:'Bali selatan', hotelSanur:'Sanur', hotelUbud:'Ubud', hotelNorth:'Lovina / Bali utara', hotelEast:'Bali timur', liveCheck:'Periksa detail terkini', transferEstimate:'Perkiraan waktu perjalanan', adjustScope:'Termasuk 3 penyesuaian untuk perjalanan yang sama: tanggal, tempo, anggaran, minat, gaya, jumlah orang dan area hotel. Tidak termasuk kustomisasi mendalam atau pesanan baru.' });

  function currentLang() {
    return ((document.getElementById('langPicker') || {}).value || localStorage.getItem('wm_studio_lang') || 'en').toLowerCase();
  }
  function T() { return COPY[currentLang()] || COPY.en; }
  function paypalT() { return PAYPAL_COPY[currentLang()] || PAYPAL_COPY.en; }
  function text(value) { return String(value == null ? '' : value); }
  function esc(value) { return text(value).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); }
  function fill(value, vars) { return text(value).replace(/\{(\w+)\}/g, function (_, key) { return esc(vars[key] == null ? '' : vars[key]); }); }
  function requiredLabel(value) { return esc(value) + ' <span class="bali-professional-required" aria-hidden="true">*</span>'; }
  function budgetConfig() {
    var configs = {
      zh:{ currency:'CNY', tiers:[['value',9000,'¥6,000–12,000'],['comfort',18000,'¥12,000–25,000'],['premium',30000,'¥25,000+']] },
      en:{ currency:'USD', tiers:[['value',1300,'$900–1,800'],['comfort',2600,'$1,800–3,500'],['premium',4000,'$3,500+']] },
      ja:{ currency:'JPY', tiers:[['value',210000,'¥140,000–280,000'],['comfort',410000,'¥280,000–550,000'],['premium',600000,'¥550,000+']] },
      ko:{ currency:'KRW', tiers:[['value',1800000,'₩1,200,000–2,400,000'],['comfort',3600000,'₩2,400,000–4,800,000'],['premium',5500000,'₩4,800,000+']] },
      id:{ currency:'IDR', tiers:[['value',21000000,'IDR 14–28 juta'],['comfort',41000000,'IDR 28–55 juta'],['premium',60000000,'IDR 55 juta+']] }
    };
    return configs[currentLang()] || configs.en;
  }
  function stepMarkup(stage) {
    var l = T();
    var steps = [[1,l.stepFill],[2,l.stepMatch],[3,l.stepPay]];
    return '<nav class="bali-professional-steps" aria-label="' + esc(l.formTitle) + '">' + steps.map(function (item) {
      var status = item[0] < stage ? ' is-done' : item[0] === stage ? ' is-current' : '';
      return '<button type="button" class="bali-professional-step' + status + '" data-professional-step="' + item[0] + '"' + (item[0] === stage ? ' aria-current="step"' : '') + (item[0] > stage ? ' disabled' : '') + '><span>' + item[0] + '</span>' + esc(item[1]) + '</button>';
    }).join('') + '</nav>';
  }
  function authHeaders() {
    var token = localStorage.getItem('wm_studio_token');
    return token ? { Authorization: 'Bearer ' + token } : {};
  }
  function sessionId() {
    var id = localStorage.getItem('wm_studio_session');
    if (!id) { id = 'anon_' + Math.random().toString(36).slice(2, 11); localStorage.setItem('wm_studio_session', id); }
    return id;
  }
  function isLoggedIn() { return !!localStorage.getItem('wm_studio_token') && !!localStorage.getItem('wm_studio_user'); }
  function trackMatch(eventName, content) {
    if (typeof window.wmTrack === 'function') window.wmTrack(eventName, { content:content || '' });
  }
  function redirectToLogin() {
    var profile = state.profile;
    if (profile) localStorage.setItem('wm_studio_trip_profile', JSON.stringify(profile));
    var returnPath = window.location.pathname + window.location.search + '#professional-planner';
    window.location.assign('ai-tool.html?auth=login&return=' + encodeURIComponent(returnPath));
  }
  function readProfile() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem('wm_studio_trip_profile') || 'null'); } catch (_) {}
    if (raw && raw.days) return raw;
    try {
      var brief = JSON.parse(localStorage.getItem('wm_studio_trip_brief') || 'null');
      if (brief) {
        var start = brief.start || '';
        var end = brief.end || '';
        var days = Number(brief.days || 0);
        if (!days && start && end) days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000));
        return {
          audience: brief.audience || 'first', goals: brief.goals || [], travel_style: brief.style || 'comfort',
          travellers: Number(brief.people || 2), departure_date: start, return_date: end, days: days || 5,
          currency: brief.currency || budgetConfig().currency, budget_range: brief.budget || '', budget_tier: brief.budget_tier || 'comfort', pace: brief.pace || 'balanced', hotel_area: brief.hotel_area || '', origin_region: ''
        };
      }
    } catch (_) {}
    return null;
  }
  function saveProfile(profile) {
    state.profile = profile;
    localStorage.setItem('wm_studio_trip_profile', JSON.stringify(profile));
    var brief = { dest:'bali', audience:profile.audience, goals:profile.goals, people:profile.travellers, start:profile.departure_date, end:profile.return_date, days:profile.days, currency:profile.currency, budget:profile.budget_range, budget_tier:profile.budget_tier, style:profile.travel_style, pace:profile.pace, hotel_area:profile.hotel_area || '', trip_profile:profile };
    localStorage.setItem('wm_studio_trip_brief', JSON.stringify(brief));
  }
  function makeProfile(form) {
    var start = form.querySelector('[name="start"]').value;
    var end = form.querySelector('[name="end"]').value;
    var tier = form.querySelector('[name="budget_tier"]:checked');
    var config = budgetConfig();
    var tierData = config.tiers.find(function (item) { return item[0] === (tier && tier.value); }) || config.tiers[1];
    return {
      audience: form.querySelector('[name="audience"]:checked').value,
      goals: Array.from(form.querySelectorAll('[name="goal"]:checked')).map(function (item) { return item.value; }),
      travel_style: form.querySelector('[name="style"]:checked').value,
      travellers: Number(form.querySelector('[name="people"]').value || 2),
      departure_date: start, return_date: end,
      days: Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000)),
      currency: config.currency, budget_range: tierData[1], budget_tier: tierData[0],
      pace: form.querySelector('[name="pace"]:checked').value,
      hotel_area: form.querySelector('[name="hotel_area"]').value || '', origin_region: ''
    };
  }
  function choiceMarkup(name, value, label, selected, extraClass) {
    return '<label class="bali-professional-choice ' + esc(extraClass || '') + '"><input type="' + (name === 'goal' ? 'checkbox' : 'radio') + '" name="' + esc(name) + '" value="' + esc(value) + '" ' + (selected ? 'checked' : '') + (name === 'goal' ? '' : ' required') + '><span><span class="fa fa-check" aria-hidden="true"></span>' + esc(label) + '</span></label>';
  }
  function budgetChoiceMarkup(tier, selected, label) {
    return '<label class="bali-professional-choice is-budget"><input type="radio" name="budget_tier" value="' + esc(tier[0]) + '"' + (selected ? ' checked' : '') + ' required><span><span class="fa fa-check" aria-hidden="true"></span><b>' + esc(label) + '</b><small>' + esc(tier[2]) + '</small></span></label>';
  }
  function goalLabel(l, value) {
    return ({ local:l.local, photo:l.photo, hidden:l.hidden, easy:l.easy, value:l.value })[value] || value;
  }
  function hotelAreaLabel(l, value) {
    return ({ '':l.hotelUnknown, south:l.hotelSouth, sanur:l.hotelSanur, ubud:l.hotelUbud, north:l.hotelNorth, east:l.hotelEast })[value] || l.hotelUnknown;
  }
  function hotelOptionsMarkup(l, selected) {
    return [['',l.hotelUnknown],['south',l.hotelSouth],['sanur',l.hotelSanur],['ubud',l.hotelUbud],['north',l.hotelNorth],['east',l.hotelEast]].map(function (item) {
      return '<option value="' + esc(item[0]) + '"' + (item[0] === selected ? ' selected' : '') + '>' + esc(item[1]) + '</option>';
    }).join('');
  }
  function predictedRoute(profile, l) {
    if (!profile || !profile.budget_tier || !(profile.goals || []).length) return '';
    if (profile.pace === 'active') return l.routeR5;
    if (profile.travel_style === 'relaxed' || profile.goals.indexOf('easy') >= 0) return l.routeR2R3;
    if (profile.travel_style === 'deep' && profile.goals.indexOf('local') >= 0) return l.routeR4;
    if (profile.goals.indexOf('photo') >= 0) return l.routeR6;
    return l.routeR1;
  }
  function bindStepActions() {
    document.querySelectorAll('[data-professional-step]').forEach(function (button) {
      button.addEventListener('click', function () {
        var step = Number(button.dataset.professionalStep || 0);
        if (step === 1) {
          if (state.response && !state.editing) { state.editing = true; state.paymentOpen = false; renderResult(); }
          window.requestAnimationFrame(function () {
            var form = document.getElementById('bali-professional-form');
            if (form) form.scrollIntoView({ behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start' });
          });
        } else if (step === 2 && state.response) {
          var result = document.querySelector('.bali-professional-layout');
          if (result) result.scrollIntoView({ behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start' });
        } else if (step === 3 && state.response && !state.response.professional_route_entitlement) {
          var unlock = document.getElementById('bali-professional-unlock');
          if (unlock) unlock.click();
        }
      });
    });
  }
  function formMarkup(profile) {
    var l = T(); var p = profile || {};
    var start = p.departure_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    var end = p.return_date || new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
    var goals = p.goals || [];
    var style = ['deep','relaxed'].indexOf(p.travel_style) >= 0 ? p.travel_style : 'comfort';
    var pace = ['slow','active'].indexOf(p.pace) >= 0 ? p.pace : 'balanced';
    var budget = budgetConfig();
    var budgetTier = p.budget_tier || '';
    var hotelArea = p.hotel_area || '';
    var people = Number(p.travellers || 2);
    var days = start && end ? Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000)) : 0;
    var isAdjustment = !!(state.response && state.response.professional_route_entitlement);
    var draftProfile = { audience:p.audience || 'first', goals:goals, travel_style:style, travellers:people, departure_date:start, return_date:end, days:days, currency:budget.currency, budget_range:'', budget_tier:budgetTier, pace:pace, hotel_area:hotelArea };
    var complete = [p.audience || 'first', people, days > 0, budgetTier, style, pace, goals.length].filter(Boolean).length;
    return '<form class="bali-professional-form" id="bali-professional-form" novalidate>' + stepMarkup(1) +
      '<div class="bali-professional-form-heading"><p>' + esc(l.intro) + '</p><strong data-form-progress>' + fill(l.progress, { n:complete }) + '</strong></div>' +
      '<div class="bali-professional-form-shell"><div class="bali-professional-form-fields">' +
      '<fieldset class="bali-professional-form-section"><legend>' + esc(l.basics) + '</legend>' +
      '<div class="bali-professional-field" data-required-group="audience"><span class="bali-professional-field-label">' + requiredLabel(l.audience) + '</span><div class="bali-professional-choice-grid is-two">' + choiceMarkup('audience', 'first', l.first, p.audience !== 'returning') + choiceMarkup('audience', 'returning', l.returning, p.audience === 'returning') + '</div></div>' +
      '<div class="bali-professional-basics-grid"><div class="bali-professional-field"><span class="bali-professional-field-label">' + requiredLabel(l.people) + '</span><div class="bali-professional-stepper"><button type="button" data-people-step="-1" aria-label="' + esc(l.decrease) + '"><span aria-hidden="true">−</span></button><input name="people" type="number" min="1" max="40" required value="' + esc(people) + '" aria-label="' + esc(l.people) + '"><button type="button" data-people-step="1" aria-label="' + esc(l.increase) + '"><span aria-hidden="true">+</span></button></div></div></div>' +
      '<div class="bali-professional-field"><span class="bali-professional-field-label">' + requiredLabel(l.tripDates) + '</span><div class="bali-professional-date-range"><label><span class="bali-professional-date-caption">' + esc(l.start) + '</span><input name="start" type="date" required value="' + esc(start) + '"></label><span aria-hidden="true">→</span><label><span class="bali-professional-date-caption">' + esc(l.end) + '</span><input name="end" type="date" required value="' + esc(end) + '"></label></div></div>' +
      '<div class="bali-professional-field"><span class="bali-professional-field-label">' + esc(l.hotelArea) + '</span><span class="bali-professional-field-help">' + esc(l.hotelHint) + '</span><select class="bali-professional-select" name="hotel_area">' + hotelOptionsMarkup(l, hotelArea) + '</select></div>' +
      '<div class="bali-professional-field" data-required-group="budget_tier"><span class="bali-professional-field-label">' + requiredLabel(l.budget) + '</span><span class="bali-professional-field-help">' + esc(l.budgetHint) + '</span><div class="bali-professional-choice-grid is-three">' + budgetChoiceMarkup(budget.tiers[0], budgetTier === 'value', l.budgetTierValue) + budgetChoiceMarkup(budget.tiers[1], budgetTier === 'comfort', l.budgetTierComfort) + budgetChoiceMarkup(budget.tiers[2], budgetTier === 'premium', l.budgetTierPremium) + '</div></div></fieldset>' +
      '<fieldset class="bali-professional-form-section"><legend>' + esc(l.approach) + '</legend><div class="bali-professional-field" data-required-group="style"><span class="bali-professional-field-label">' + requiredLabel(l.style) + '</span><div class="bali-professional-choice-grid is-three">' + choiceMarkup('style', 'comfort', l.styleComfort, style === 'comfort') + choiceMarkup('style', 'deep', l.styleDeep, style === 'deep') + choiceMarkup('style', 'relaxed', l.styleRelaxed, style === 'relaxed') + '</div></div><div class="bali-professional-field" data-required-group="pace"><span class="bali-professional-field-label">' + requiredLabel(l.pace) + '</span><div class="bali-professional-choice-grid is-three is-pace">' + choiceMarkup('pace', 'slow', l.slow, pace === 'slow') + choiceMarkup('pace', 'balanced', l.balanced, pace === 'balanced') + choiceMarkup('pace', 'active', l.active, pace === 'active') + '</div></div></fieldset>' +
      '<fieldset class="bali-professional-form-section" data-required-group="goal"><legend>' + esc(l.goalsGroup) + '</legend><span class="bali-professional-field-help">' + requiredLabel(l.goalRequired) + '</span><div class="bali-professional-choice-grid is-goals">' + choiceMarkup('goal', 'local', l.local, goals.indexOf('local') >= 0, 'is-chip') + choiceMarkup('goal', 'photo', l.photo, goals.indexOf('photo') >= 0, 'is-chip') + choiceMarkup('goal', 'hidden', l.hidden, goals.indexOf('hidden') >= 0, 'is-chip') + choiceMarkup('goal', 'easy', l.easy, goals.indexOf('easy') >= 0, 'is-chip') + choiceMarkup('goal', 'value', l.value, goals.indexOf('value') >= 0, 'is-chip') + '</div></fieldset>' +
      '<div id="bali-professional-form-status" class="bali-professional-status" role="status" aria-live="polite"></div>' +
      '<div class="bali-professional-form-actions"><button class="bali-btn bali-btn-primary" type="submit" data-form-submit><span class="fa fa-magic"></span> ' + esc(isAdjustment ? l.submitAdjust : l.submit) + '</button><a class="bali-btn bali-route-secondary" href="#route-families">' + esc(l.public) + '</a></div>' +
      '<div class="bali-professional-form-note">' + esc(l.reassurance) + '</div></div>' +
      '<aside class="bali-professional-profile" aria-live="polite"><div><strong>' + esc(l.profileTitle) + '</strong><span>' + esc(l.profileHint) + '</span></div><dl><div><dt>' + esc(l.audience) + '</dt><dd data-summary="audience">' + esc(p.audience === 'returning' ? l.returning : l.first) + '</dd></div><div><dt>' + esc(l.people) + '</dt><dd data-summary="people">' + esc(fill(l.peopleCount, { n:people })) + '</dd></div><div><dt>' + esc(l.tripDates) + '</dt><dd data-summary="dates">' + esc(fill(l.daysCount, { n:days })) + '</dd></div><div><dt>' + esc(l.hotelArea) + '</dt><dd data-summary="hotel">' + esc(hotelAreaLabel(l, hotelArea)) + '</dd></div><div><dt>' + esc(l.budget) + '</dt><dd data-summary="budget">' + esc(budgetTier ? (budget.tiers.find(function (item) { return item[0] === budgetTier; }) || ['',0,l.routePending])[2] : l.routePending) + '</dd></div><div><dt>' + esc(l.style) + '</dt><dd data-summary="style">' + esc((style === 'deep' ? l.styleDeep : style === 'relaxed' ? l.styleRelaxed : l.styleComfort) + ' · ' + (pace === 'slow' ? l.slow : pace === 'active' ? l.active : l.balanced)) + '</dd></div><div><dt>' + esc(l.goals) + '</dt><dd data-summary="goals">' + esc(goals.length ? goals.map(function (goal) { return goalLabel(l, goal); }).join(' · ') : l.goalRequired) + '</dd></div><div class="is-route-type"><dt>' + esc(l.routeType) + '</dt><dd data-summary="route">' + esc(predictedRoute(draftProfile, l) || l.routePending) + '</dd></div></dl><p>' + esc(l.routeFamily) + '</p></aside></div></form>';
  }
  function bindForm(form) {
    if (!form) return;
    var l = T();
    var peopleInput = form.querySelector('[name="people"]');
    var goalInputs = Array.from(form.querySelectorAll('[name="goal"]'));
    function optionLabel(name, value) {
      var labels = { audience:{ first:l.first, returning:l.returning }, style:{ comfort:l.styleComfort, deep:l.styleDeep, relaxed:l.styleRelaxed }, pace:{ balanced:l.balanced, slow:l.slow, active:l.active }, goal:{ local:l.local, photo:l.photo, hidden:l.hidden, easy:l.easy, value:l.value }, budget_tier:{ value:l.budgetTierValue, comfort:l.budgetTierComfort, premium:l.budgetTierPremium } };
      return (labels[name] && labels[name][value]) || value;
    }
    function syncGoalLimit() {
      var selected = goalInputs.filter(function (input) { return input.checked; }).length;
      goalInputs.forEach(function (input) { input.disabled = selected >= 3 && !input.checked; });
    }
    function updateSummary() {
      var audience = form.querySelector('[name="audience"]:checked');
      var style = form.querySelector('[name="style"]:checked');
      var pace = form.querySelector('[name="pace"]:checked');
      var budgetTier = form.querySelector('[name="budget_tier"]:checked');
      var start = form.querySelector('[name="start"]').value;
      var end = form.querySelector('[name="end"]').value;
      var days = start && end && end > start ? Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000)) : 0;
      var selectedGoals = goalInputs.filter(function (input) { return input.checked; }).map(function (input) { return optionLabel('goal', input.value); });
      var profile = { audience:audience && audience.value, travellers:Number(peopleInput.value || 1), departure_date:start, return_date:end, days:days, budget_tier:budgetTier && budgetTier.value, travel_style:style && style.value, pace:pace && pace.value, hotel_area:form.querySelector('[name="hotel_area"]').value || '', goals:goalInputs.filter(function (input) { return input.checked; }).map(function (input) { return input.value; }) };
      var complete = [profile.audience, profile.travellers > 0, profile.days > 0, profile.budget_tier, profile.travel_style, profile.pace, profile.goals.length].filter(Boolean).length;
      var budget = budgetConfig();
      var budgetData = budget.tiers.find(function (item) { return item[0] === profile.budget_tier; });
      var values = {
        audience: audience ? optionLabel('audience', audience.value) : '',
        people: fill(l.peopleCount, { n:Number(peopleInput.value || 1) }),
        dates: days ? fill(l.daysCount, { n:days }) : l.invalidDates,
        hotel: hotelAreaLabel(l, profile.hotel_area),
        style: (style ? optionLabel('style', style.value) : '') + (pace ? ' · ' + optionLabel('pace', pace.value) : ''),
        budget: budgetData ? budgetData[2] : l.routePending,
        goals: selectedGoals.length ? selectedGoals.join(' · ') : l.goalRequired,
        route: predictedRoute(profile, l) || l.routePending
      };
      Object.keys(values).forEach(function (key) { var target = form.querySelector('[data-summary="' + key + '"]'); if (target) target.textContent = values[key]; });
      var progress = form.querySelector('[data-form-progress]');
      if (progress) progress.textContent = fill(l.progress, { n:complete });
    }
    form.querySelectorAll('[data-people-step]').forEach(function (button) {
      button.addEventListener('click', function () {
        peopleInput.value = Math.max(1, Math.min(40, Number(peopleInput.value || 1) + Number(button.dataset.peopleStep || 0)));
        peopleInput.dispatchEvent(new Event('input', { bubbles:true }));
      });
    });
    form.addEventListener('input', updateSummary);
    form.addEventListener('change', function (event) { if (event.target.name === 'goal') syncGoalLimit(); updateSummary(); });
    syncGoalLimit(); updateSummary();
    bindStepActions();
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var start = form.querySelector('[name="start"]').value;
      var end = form.querySelector('[name="end"]').value;
      form.querySelectorAll('[aria-invalid="true"]').forEach(function (field) { field.removeAttribute('aria-invalid'); });
      if (!start || !end || end <= start) { var dateField = form.querySelector('[name="end"]'); dateField.setAttribute('aria-invalid', 'true'); setStatus(l.invalidDates, true, 'bali-professional-form-status'); dateField.focus(); return; }
      var requiredGroups = ['audience','budget_tier','style','pace'];
      for (var i = 0; i < requiredGroups.length; i += 1) {
        var groupName = requiredGroups[i];
        if (!form.querySelector('[name="' + groupName + '"]:checked')) {
          var group = form.querySelector('[data-required-group="' + groupName + '"]');
          if (group) group.setAttribute('aria-invalid', 'true');
          setStatus(l.missingChoice, true, 'bali-professional-form-status');
          var first = group && group.querySelector('input');
          if (first) first.focus();
          return;
        }
      }
      if (!goalInputs.some(function (input) { return input.checked; })) {
        var goalGroup = form.querySelector('[data-required-group="goal"]');
        if (goalGroup) goalGroup.setAttribute('aria-invalid', 'true');
        setStatus(l.invalidGoals, true, 'bali-professional-form-status');
        if (goalInputs[0]) goalInputs[0].focus();
        return;
      }
      var profile = makeProfile(form);
      var adjusting = !!(state.response && state.response.professional_route_entitlement);
      var submit = form.querySelector('[data-form-submit]');
      var submitHtml = submit.innerHTML;
      submit.disabled = true; submit.innerHTML = '<span class="fa fa-circle-o-notch fa-spin"></span> ' + esc(l.loading); setStatus(l.loading, false, 'bali-professional-form-status');
      try {
        if (adjusting) await adjustRoute(profile);
        else {
          state.userMatchPending = true;
          trackMatch('bali_professional_route_match_submit', state.routeId || 'auto');
          state.editing = false;
          await loadRoute(profile, state.routeId);
        }
      } finally {
        if (submit.isConnected) { submit.disabled = false; submit.innerHTML = submitHtml; }
      }
    });
  }
  function setStatus(message, isError, targetId) {
    var status = document.getElementById(targetId || 'bali-professional-status');
    if (status) { status.textContent = message || ''; status.className = 'bali-professional-status' + (isError ? ' error' : ''); }
  }
  function clearStoredTrip() {
    state.tripId = '';
    localStorage.removeItem('wm_studio_professional_trip_id');
  }
  function apiError(body, fallback) {
    var detail = body && body.detail;
    if (typeof detail === 'string') return detail;
    return (detail && detail.error) || fallback;
  }
  function renderEmpty() {
    var l = T();
    app.innerHTML = '<div class="bali-professional-empty"><div class="bali-professional-empty-intro"><h3>' + esc(l.formTitle) + '</h3><p>' + esc(l.noProfile) + '</p></div><div id="bali-professional-empty-form"></div></div>';
    document.getElementById('bali-professional-empty-form').innerHTML = formMarkup(state.profile);
    bindForm(document.getElementById('bali-professional-form'));
  }
  function routeText(route) {
    return (route.days_plan || []).map(function (day) {
      var places = (day.places || []).map(function (place) { return place.name; }).join('、');
      return 'Day ' + day.day + ' · ' + day.region_name + ' · ' + day.theme + (places ? ' · ' + places : '');
    }).join('\n');
  }
  function saveDriverHandoff(driverId) {
    var data = state.response; var route = data && data.route;
    if (!route || !route.unlocked) return;
    var p = state.profile;
    var currentTrip = { dest:'bali', start:p.departure_date, end:p.return_date, days:p.days, people:p.travellers, budget:p.budget_range, currency:p.currency, style:p.travel_style, route_id:route.route_id, professional_route_entitlement:true, product_trip_id:state.tripId, trip_profile:p };
    localStorage.setItem('wm_studio_currentTrip', JSON.stringify(currentTrip));
    localStorage.setItem('wm_studio_lastPlan', JSON.stringify({ source:'bali-professional-route', route_id:route.route_id, text:routeText(route), ts:Date.now() }));
    var params = new URLSearchParams({ driver_id:driverId, route:route.route_id, start:p.departure_date || '', end:p.return_date || '', people:String(p.travellers || ''), budget:String(p.budget_range || ''), currency:String(p.currency || '') });
    window.location.assign('find-driver.html?' + params.toString());
  }
  async function loadPayPalConfig() {
    try {
      var response = await fetch(API_BASE + '/api/paypal/config');
      var body = await response.json().catch(function () { return {}; });
      state.paypal = response.ok && body.enabled ? body : { enabled:false };
    } catch (_) {
      state.paypal = { enabled:false };
    }
    return state.paypal;
  }
  function loadPayPalSdk(config) {
    if (window.paypal && window.paypal.Buttons) return Promise.resolve(window.paypal);
    return new Promise(function (resolve, reject) {
      var existing = document.getElementById('wandermind-paypal-sdk');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.paypal); }, { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      var script = document.createElement('script');
      script.id = 'wandermind-paypal-sdk';
      script.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(config.client_id) + '&currency=' + encodeURIComponent(config.currency) + '&intent=capture&components=buttons';
      script.async = true;
      script.onload = function () { resolve(window.paypal); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  async function renderPayPalButtons() {
    var container = document.getElementById('bali-professional-paypal-buttons');
    var config = state.paypal;
    if (!container || !config || !config.enabled || container.dataset.rendered) return;
    container.dataset.rendered = 'true';
    var pc = paypalT();
    try {
      var paypalApi = await loadPayPalSdk(config);
      if (!paypalApi || !paypalApi.Buttons) throw new Error('PayPal SDK unavailable');
      await paypalApi.Buttons({
        style: { layout:'vertical', color:'gold', shape:'rect', label:'paypal', height:44 },
        createOrder: async function () {
          var response = await fetch(API_BASE + '/api/paypal/orders', {
            method:'POST',
            headers:Object.assign({ 'Content-Type':'application/json', 'X-Anon-Id':sessionId() }, authHeaders()),
            body:JSON.stringify({ trip_id:state.tripId })
          });
          var body = await response.json().catch(function () { return {}; });
          if (!response.ok || !body.provider_order_id) throw new Error(apiError(body, pc.failed));
          return body.provider_order_id;
        },
        onApprove: async function (data) {
          setStatus(pc.processing, false, 'bali-professional-payment-status');
          var response = await fetch(API_BASE + '/api/paypal/orders/' + encodeURIComponent(data.orderID) + '/capture', {
            method:'POST', headers:Object.assign({ 'Content-Type':'application/json' }, authHeaders())
          });
          var body = await response.json().catch(function () { return {}; });
          if (!response.ok || !body.professional_route_unlocked) throw new Error(apiError(body, pc.failed));
          setStatus(pc.done, false, 'bali-professional-payment-status');
          await loadRoute(state.profile, state.routeId);
        },
        onCancel: async function (data) {
          if (data && data.orderID) {
            await fetch(API_BASE + '/api/paypal/orders/' + encodeURIComponent(data.orderID) + '/abandon', {
              method:'POST', headers:Object.assign({ 'Content-Type':'application/json' }, authHeaders())
            }).catch(function () { return null; });
          }
          setStatus(pc.cancelled, false, 'bali-professional-payment-status');
        },
        onError: function () { setStatus(pc.failed, true, 'bali-professional-payment-status'); }
      }).render('#bali-professional-paypal-buttons');
    } catch (_) {
      setStatus(pc.failed, true, 'bali-professional-payment-status');
    }
  }
  function paymentPanel() {
    var l = T(); var pc = paypalT(); var config = state.paypal || {};
    var paypalOption = config.enabled ? '<section class="bali-professional-paypal"><div class="bali-professional-payment-label"><strong>' + esc(pc.option) + '</strong><span>' + esc(config.environment === 'sandbox' ? pc.sandbox : (config.currency + ' ' + config.amount)) + '</span></div><div id="bali-professional-paypal-buttons"></div></section><div class="bali-professional-payment-divider"><span>' + esc(pc.local) + '</span></div>' : '';
    return '<div class="bali-professional-card" id="bali-professional-payment"><h3>' + esc(l.payTitle) + '</h3><p>' + esc(l.payText) + '</p>' + paypalOption + '<div class="bali-professional-qr-grid"><figure><img src="assets/images/pay-wechat.jpg" alt="WeChat Pay"><figcaption>WeChat Pay · CNY 9.90</figcaption></figure><figure><img src="assets/images/pay-alipay.jpg" alt="Alipay"><figcaption>Alipay · CNY 9.90</figcaption></figure></div><div class="bali-professional-actions"><button class="bali-btn bali-btn-primary" id="bali-professional-paid" type="button">' + esc(l.paid) + '</button><button class="bali-btn bali-route-secondary" id="bali-professional-payment-close" type="button">' + esc(l.cancel) + '</button></div><div id="bali-professional-payment-status" class="bali-professional-status" role="status" aria-live="polite"></div></div>';
  }
  function renderResult() {
    var l = T(); var data = state.response || {}; var route = data.route || {};
    var p = state.profile || data.profile || {};
    var days = route.days_plan || [];
    var unlocked = !!data.professional_route_entitlement;
    var adjustmentRemaining = Number(data.professional_adjustments_remaining || 0);
    if (unlocked && adjustmentRemaining <= 0) state.editing = false;
    var summary = [p.departure_date && (p.departure_date + ' → ' + (p.return_date || '')), fill(l.daysCount, { n:p.days || route.days || '' }), fill(l.peopleCount, { n:p.travellers || 2 }), p.budget_range ? ((p.currency || 'CNY') + ' ' + p.budget_range) : ''].filter(Boolean);
    var goals = (p.goals || []).map(function (goal) { return goalLabel(l, goal); }).join(' · ');
    var dayHtml = days.map(function (day) {
      var locked = !!day.locked;
      var places = (day.places || []).map(function (place) { return '<a class="bali-professional-place" href="' + esc(place.maps_url || place.official_url || '#') + '" target="_blank" rel="noopener noreferrer" title="' + esc(l.liveCheck) + '">' + esc(place.name) + ' <span class="fa fa-external-link" aria-hidden="true"></span></a>'; }).join('');
      var transfer = day.transfer_estimate ? '<p class="bali-professional-transfer"><span class="fa fa-road" aria-hidden="true"></span><strong>' + esc(l.transferEstimate) + '</strong> · ' + esc(day.transfer_estimate) + '</p>' : '';
      return '<article class="bali-professional-day' + (locked ? ' is-locked' : '') + '"><span class="bali-professional-day-number">' + esc(day.day) + '</span><div class="bali-professional-day-head"><strong>' + esc(fill(l.day, { n:day.day })) + ' · ' + esc(day.region_name) + '</strong>' + (locked ? '<span>' + esc(l.locked) + '</span>' : (unlocked ? '' : '<span>' + esc(l.preview) + '</span>')) + '</div><p>' + esc(day.theme) + '</p>' + (locked ? '<div class="bali-professional-lock-note"><span class="fa fa-lock"></span> ' + esc(l.lockedNote) + '</div>' : transfer + '<div class="bali-professional-places">' + (places || '<span class="bali-professional-place">' + esc(l.routeBasis) + '</span>') + '</div><p class="bali-professional-live-note">' + esc(day.route_note || l.routeBasis) + '</p>') + '</article>';
    }).join('');
    var actionHtml = unlocked ? (adjustmentRemaining > 0 ? '<button class="bali-btn bali-btn-primary" type="button" id="bali-professional-edit" aria-expanded="' + String(state.editing) + '"><span class="fa fa-sliders"></span> ' + esc(state.editing ? l.cancel : l.adjust) + '</button><span class="bali-professional-badge bali-professional-adjustments-badge">' + esc(fill(l.remaining, { n:adjustmentRemaining })) + '</span>' : '<button class="bali-btn bali-btn-primary" type="button" disabled><span class="fa fa-sliders"></span> ' + esc(l.adjustExhausted) + '</button><span class="bali-professional-badge bali-professional-adjustments-badge">' + esc(fill(l.remaining, { n:0 })) + '</span>') : '<button class="bali-btn bali-route-secondary" type="button" id="bali-professional-edit" aria-expanded="' + String(state.editing) + '"><span class="fa fa-pencil"></span> ' + esc(state.editing ? l.cancel : l.edit) + '</button><button class="bali-btn bali-route-secondary" type="button" id="bali-professional-rematch"><span class="fa fa-refresh"></span> ' + esc(l.rematch) + '</button><button class="bali-btn bali-btn-primary" type="button" id="bali-professional-unlock"><span class="fa fa-lock"></span> ' + esc(l.unlock) + '</button><button class="bali-btn bali-route-secondary" type="button" id="bali-professional-points"><span class="fa fa-gift"></span> ' + esc(l.points) + '</button>';
    var adjustmentNote = unlocked ? '<div class="bali-professional-form-note">' + esc(l.adjustScope) + '</div>' : '';
    var driverHtml = unlocked ? '<div class="bali-professional-actions"><strong style="width:100%;font-size:12px;color:#64748b">' + esc(l.driver) + '</strong><button class="bali-btn bali-route-secondary" type="button" data-driver="dicky">' + esc(l.dicky) + '</button><button class="bali-btn bali-route-secondary" type="button" data-driver="gede">' + esc(l.gede) + '</button></div>' : '';
    var editor = state.editing ? '<div class="bali-professional-card bali-professional-editor" id="bali-professional-editor"><h3>' + esc(l.formTitle) + '</h3>' + formMarkup(p) + '</div>' : '';
    var daysHeader = unlocked ? '<div class="bali-professional-route-label"><strong>' + esc(l.unlocked) + '</strong></div>' : '<div class="bali-professional-route-label"><strong>' + esc(fill(l.openDays, { n:route.preview_days || 0 })) + '</strong><span class="bali-professional-badge">' + esc(fill(l.lockedDays, { n:route.locked_days || 0 })) + '</span></div>';
    app.innerHTML = stepMarkup(unlocked ? 3 : 2) + editor + '<div class="bali-professional-layout"><div class="bali-professional-card"><div class="bali-professional-route-label"><strong>' + esc(l.route) + '</strong><span class="bali-professional-badge">' + esc(unlocked ? l.unlocked : l.preview) + '</span></div><h3>' + esc(route.route_id || '') + ' · ' + esc(route.route_name || '') + '</h3><p>' + esc(route.route_promise || '') + '</p><div class="bali-profile-summary">' + summary.map(function (item) { return '<span class="bali-profile-chip">' + esc(item) + '</span>'; }).join('') + (goals ? '<span class="bali-profile-chip">' + esc(goals) + '</span>' : '') + '</div><div class="bali-professional-reason"><strong>' + esc(l.reason) + '</strong><br>' + esc(route.recommendation_reason || '') + '</div><div id="bali-professional-status" class="bali-professional-status" role="status" aria-live="polite"></div><div class="bali-professional-actions">' + actionHtml + '</div>' + adjustmentNote + driverHtml + '</div><div class="bali-professional-card">' + daysHeader + '<div class="bali-professional-days">' + dayHtml + '</div></div></div>' + (state.paymentOpen ? paymentPanel() : '');
    bindResultActions();
    if (state.paymentOpen) renderPayPalButtons();
    if (state.pendingRouteId) setStatus(fill(l.routeSwitchPending, { route:state.pendingRouteId }), false);
  }
  function bindResultActions() {
    var l = T(); var unlock = document.getElementById('bali-professional-unlock');
    if (unlock) unlock.onclick = async function () { if (!isLoggedIn()) { redirectToLogin(); return; } if (!state.paypal) await loadPayPalConfig(); state.paymentOpen = true; renderResult(); };
    var points = document.getElementById('bali-professional-points');
    if (points) points.onclick = async function () {
      if (!isLoggedIn()) { redirectToLogin(); return; }
      points.disabled = true; setStatus(l.loading, false);
      try {
        var response = await fetch(API_BASE + '/api/referrals/redeem-professional-route', { method:'POST', headers:Object.assign({ 'Content-Type':'application/json', 'X-Anon-Id':sessionId() }, authHeaders()), body:JSON.stringify({ trip_id:state.tripId }) });
        var body = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error((body.detail && (body.detail.balance != null ? 'Points: ' + body.detail.balance : body.detail.error)) || 'Redeem failed');
        state.paymentOpen = false; setStatus(l.pointsDone, false); await loadRoute(state.profile, state.routeId);
      } catch (error) { setStatus(error.message || l.error, true); points.disabled = false; }
    };
    var edit = document.getElementById('bali-professional-edit');
    if (edit) edit.onclick = function () {
      state.editing = !state.editing;
      state.paymentOpen = false;
      renderResult();
      if (state.editing) window.requestAnimationFrame(function () {
        var editor = document.getElementById('bali-professional-editor');
        if (!editor) return;
        editor.scrollIntoView({ behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start' });
        var firstField = editor.querySelector('input, select, button');
        if (firstField) firstField.focus({ preventScroll:true });
      });
    };
    var rematch = document.getElementById('bali-professional-rematch');
    if (rematch) rematch.onclick = function () {
      state.editing = true;
      state.paymentOpen = false;
      renderResult();
      window.requestAnimationFrame(function () {
        var submit = document.querySelector('#bali-professional-editor [data-form-submit]');
        if (submit) { submit.scrollIntoView({ behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'center' }); submit.focus({ preventScroll:true }); }
      });
    };
    document.querySelectorAll('[data-driver]').forEach(function (button) { button.onclick = function () { saveDriverHandoff(button.dataset.driver); }; });
    var paid = document.getElementById('bali-professional-paid');
    if (paid) paid.onclick = async function () {
      if (!isLoggedIn()) { redirectToLogin(); return; }
      paid.disabled = true;
      try {
        var response = await fetch(API_BASE + '/api/professional-route/orders', { method:'POST', headers:Object.assign({ 'Content-Type':'application/json' }, authHeaders()), body:JSON.stringify({ trip_id:state.tripId }) });
        var body = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(body.detail || 'Order failed');
        setStatus(body.already_unlocked ? l.unlocked : l.orderSent, false, 'bali-professional-payment-status');
      } catch (error) { setStatus(error.message || l.error, true); paid.disabled = false; }
    };
    var paymentClose = document.getElementById('bali-professional-payment-close');
    if (paymentClose) paymentClose.onclick = function () { state.paymentOpen = false; renderResult(); };
    bindForm(document.getElementById('bali-professional-form'));
    bindStepActions();
  }
  async function adjustRoute(profile) {
    var l = T();
    if (!state.tripId) { setStatus(l.error, true); return; }
    state.loading = true; setStatus(l.loading, false);
    try {
      var response = await fetch(API_BASE + '/api/bali/professional-route/' + encodeURIComponent(state.tripId) + '/adjust', { method:'POST', headers:Object.assign({ 'Content-Type':'application/json', 'X-Anon-Id':sessionId() }, authHeaders()), body:JSON.stringify({ trip_profile:profile, route_id:state.pendingRouteId || '', lang:currentLang() }) });
      var body = await response.json().catch(function () { return {}; });
      if (response.status === 401) { redirectToLogin(); return; }
      if (response.status === 402 && body.detail && body.detail.error === 'professional_route_adjustments_exhausted') throw new Error(l.adjustExhausted);
      if (!response.ok) throw new Error(apiError(body, l.error));
      state.profile = profile;
      state.routeId = (body.route && body.route.route_id) || state.routeId;
      state.pendingRouteId = '';
      state.response = body;
      state.loading = false;
      state.editing = false;
      localStorage.setItem('wm_studio_professional_route_hint', state.routeId);
      saveProfile(profile);
      renderResult();
    } catch (error) {
      state.loading = false;
      setStatus(error.message || l.error, true);
    }
  }
  async function restoreUnlockedRoute(requestedRouteId) {
    if (!isLoggedIn()) return false;
    var response = await fetch(API_BASE + '/api/bali/professional-route/recent-unlocked?lang=' + encodeURIComponent(currentLang()), { headers:authHeaders() });
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 404) return false;
    if (response.status === 401) { redirectToLogin(); return true; }
    if (!response.ok) throw new Error(apiError(body, T().error));
    state.tripId = body.trip_id || '';
    state.profile = body.profile || state.profile;
    state.routeId = (body.route && body.route.route_id) || state.routeId;
    state.pendingRouteId = requestedRouteId && requestedRouteId !== state.routeId ? requestedRouteId : '';
    state.response = body;
    state.loading = false;
    state.paymentOpen = false;
    if (state.tripId) localStorage.setItem('wm_studio_professional_trip_id', state.tripId);
    if (state.routeId) localStorage.setItem('wm_studio_professional_route_hint', state.routeId);
    if (state.profile) saveProfile(state.profile);
    if (state.userMatchPending) {
      trackMatch('bali_professional_route_match_success', state.routeId || 'restored');
      state.userMatchPending = false;
    }
    renderResult();
    return true;
  }
  async function loadRoute(profile, routeId) {
    if (!profile) { renderEmpty(); return; }
    state.profile = profile; state.loading = true; app.innerHTML = '<div class="bali-professional-loading">' + esc(T().loading) + '</div>';
    try {
      var hadTripId = !!state.tripId;
      if (!state.tripId && await restoreUnlockedRoute(routeId || '')) return;
      var requestBody = { trip_id:state.tripId, trip_profile:profile, route_id:routeId || '', lang:currentLang() };
      var response = await fetch(API_BASE + '/api/bali/professional-route', { method:'POST', headers:Object.assign({ 'Content-Type':'application/json', 'X-Anon-Id':sessionId() }, authHeaders()), body:JSON.stringify(requestBody) });
      var body = await response.json().catch(function () { return {}; });
      if ((response.status === 403 || response.status === 404 || response.status === 409) && hadTripId) {
        if (await restoreUnlockedRoute(routeId || '')) return;
        if (response.status === 403 || response.status === 404) {
          clearStoredTrip();
          await loadRoute(profile, routeId);
          return;
        }
      }
      if (response.status === 401) { redirectToLogin(); return; }
      if (!response.ok) throw new Error(apiError(body, T().error));
      state.tripId = body.trip_id || state.tripId;
      if (state.tripId) localStorage.setItem('wm_studio_professional_trip_id', state.tripId);
      state.routeId = (body.route && body.route.route_id) || routeId || '';
      localStorage.setItem('wm_studio_professional_route_hint', state.routeId);
      state.response = body; state.loading = false; state.paymentOpen = false;
      saveProfile(profile);
      var queuedRouteId = state.queuedRouteId;
      state.queuedRouteId = '';
      if (queuedRouteId && queuedRouteId !== state.routeId && !body.professional_route_entitlement) {
        await loadRoute(profile, queuedRouteId);
        return;
      }
      if (state.userMatchPending) {
        trackMatch('bali_professional_route_match_success', state.routeId || 'auto');
        state.userMatchPending = false;
      }
      renderResult();
    } catch (error) {
      if (state.userMatchPending) {
        trackMatch('bali_professional_route_match_error', 'route_load');
        state.userMatchPending = false;
      }
      state.loading = false;
      if (state.response) { state.editing = true; renderResult(); }
      else renderEmpty();
      setStatus(error.message || T().error, true, 'bali-professional-form-status');
    }
  }
  function start() {
    loadPayPalConfig();
    state.profile = readProfile();
    if (state.profile) loadRoute(state.profile, state.routeId); else renderEmpty();
    window.addEventListener('wm:bali-route-selected', function (event) {
      var routeId = String(event.detail && event.detail.routeId || '').toUpperCase();
      if (!/^R[1-6]$/.test(routeId)) return;
      localStorage.setItem('wm_studio_professional_route_hint', routeId);
      if (!state.profile) { state.routeId = routeId; return; }
      var currentRouteId = String(state.response && state.response.route && state.response.route.route_id || state.routeId || '').toUpperCase();
      var unlocked = !!(state.response && state.response.professional_route_entitlement);
      if (unlocked) {
        state.pendingRouteId = routeId === currentRouteId ? '' : routeId;
        if (state.pendingRouteId) setStatus(fill(T().routeSwitchPending, { route:state.pendingRouteId }), false);
        else setStatus('', false);
        return;
      }
      state.routeId = routeId;
      state.pendingRouteId = '';
      if (routeId !== currentRouteId) {
        if (state.loading) state.queuedRouteId = routeId;
        else loadRoute(state.profile, routeId);
      }
    });
    var picker = document.getElementById('langPicker');
    if (picker) picker.addEventListener('change', function () { if (state.profile && state.response) loadRoute(state.profile, state.routeId); else renderEmpty(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
