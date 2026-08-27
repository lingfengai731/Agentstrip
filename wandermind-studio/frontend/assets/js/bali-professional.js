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
    queuedRouteId: ''
  };

  var PAYPAL_COPY = {
    en: { option:'Pay online with PayPal or card', sandbox:'Sandbox test · no real charge', local:'Or use a local QR payment', processing:'Verifying the payment securely…', done:'Payment verified. Your full route is now open.', failed:'PayPal could not verify this payment. No route access was granted.' },
    zh: { option:'使用 PayPal 或银行卡在线支付', sandbox:'沙盒测试 · 不会真实扣款', local:'或使用本地二维码付款', processing:'正在由服务器安全核验付款…', done:'付款已核验，完整路线已经开放。', failed:'PayPal 未能核验这笔付款，路线尚未解锁。' },
    ja: { option:'PayPal またはカードでオンライン決済', sandbox:'Sandbox テスト・実際の請求なし', local:'またはローカルQR決済', processing:'サーバーで決済を確認しています…', done:'決済を確認し、完全版ルートを開放しました。', failed:'PayPalで決済を確認できなかったため、ルートは開放されていません。' },
    ko: { option:'PayPal 또는 카드로 온라인 결제', sandbox:'Sandbox 테스트 · 실제 청구 없음', local:'또는 현지 QR 결제', processing:'서버에서 결제를 안전하게 확인 중입니다…', done:'결제가 확인되어 전체 경로가 열렸습니다.', failed:'PayPal 결제를 확인하지 못해 경로가 잠금 해제되지 않았습니다.' },
    id: { option:'Bayar online dengan PayPal atau kartu', sandbox:'Uji Sandbox · tidak ada tagihan nyata', local:'Atau gunakan pembayaran QR lokal', processing:'Memverifikasi pembayaran dengan aman…', done:'Pembayaran terverifikasi. Rute lengkap sudah terbuka.', failed:'PayPal tidak dapat memverifikasi pembayaran ini. Rute belum dibuka.' }
  };

  var COPY = {
    en: {
      noProfile: 'Complete a few travel details and we will match a more suitable professional route. You can skip this and keep browsing the public route families.',
      formTitle: 'Your Bali trip', submit: 'Match my route', submitAdjust: 'Apply this adjustment', edit: 'Adjust trip information', cancel: 'Close editor',
      audience: 'Trip stage', first: 'First Bali trip', returning: 'Returning visitor', people: 'Travellers', start: 'Departure date', end: 'Return date', budget: 'Budget', style: 'Travel style', comfort: 'Comfort', budgetStyle: 'Value', luxury: 'Premium', pace: 'Pace', balanced: 'Balanced', slow: 'Slower', goals: 'Priorities', local: 'Local culture', photo: 'Scenery & photography', easy: 'Less planning', value: 'Budget control',
      route: 'Matched professional route', preview: 'Free preview', unlocked: 'Full route unlocked', reason: 'Why this route', openDays: '{n} days open', lockedDays: '{n} days locked', day: 'Day {n}', locked: 'Locked detail', lockedNote: 'Unlock to see the place order, experience modules and execution notes.',
      unlock: 'Unlock full route · ¥9.9', points: 'Use 30 referral points', adjust: 'Adjust this trip', remaining: '{n} adjustments left', adjustExhausted: 'No adjustments left', adjustScope: 'Includes 3 parameter adjustments for this same trip: dates or days, pace, budget, interests, travel style and group size. It does not include human deep customization or new trip orders.', routeSwitchPending: '{route} is selected above. Your unlocked route will not be replaced by browsing; submit “Adjust this trip” to switch, using one adjustment.', driver: 'Send this route to a driver', dicky: 'Send to Dicky', gede: 'Send to Gede Nico', login: 'Sign in to unlock', public: 'Browse public R1–R6 routes', payTitle: 'Unlock this route', payText: 'Pay ¥9.9 to unlock this full route and 3 parameter adjustments for the same trip. AI self-planning credits stay separate. Human deep customization and new trip orders are not included.', paid: 'I paid · submit for confirmation', orderSent: 'Payment confirmation request submitted. The route will open after confirmation.', pointsDone: 'Route unlocked with points.', loading: 'Matching your route…', error: 'We could not load the professional route. Please try again.', noData: 'Enter your dates, travellers and budget to start.', routeBasis: 'Structured from Bali geography, route families and POI modules. Access and availability still need confirmation.'
    },
    zh: {
      noProfile: '完成几项旅行信息后，我们可以从 Bali 的区域和路线体系中匹配更适合你的专业路线。你也可以跳过，继续浏览公共路线。',
      formTitle: '你的巴厘岛行程', submit: '匹配我的路线', submitAdjust: '提交本次调整', edit: '调整旅行信息', cancel: '收起编辑',
      audience: '旅行阶段', first: '第一次去巴厘岛', returning: '去过巴厘岛', people: '出行人数', start: '出发日期', end: '返回日期', budget: '预算', style: '旅行风格', comfort: '舒适平衡', budgetStyle: '预算优先', luxury: '高端私享', pace: '节奏', balanced: '平衡', slow: '慢一点', goals: '优先事项', local: '风土人情', photo: '自然与摄影', easy: '少做攻略', value: '预算控制',
      route: '匹配到的专业路线', preview: '免费预览', unlocked: '完整路线已解锁', reason: '为什么是这条路线', openDays: '已开放 {n} 天', lockedDays: '锁定 {n} 天', day: '第 {n} 天', locked: '细节已锁定', lockedNote: '解锁后查看地点顺序、体验模块和执行备注。',
      unlock: '解锁完整路线 · ¥9.9', points: '用 30 推荐积分兑换', adjust: '调整本次行程', remaining: '还可调整 {n} 次', adjustExhausted: '本行程调整次数已用完', adjustScope: '同一行程可调整 3 次，可改日期或天数、节奏、预算、兴趣模块、旅行风格和人数；不含人工深度定制，也不能用于新建其他旅行订单。', routeSwitchPending: '上方已选择 {route}。浏览不会覆盖已解锁路线；提交“调整本次行程”后才会切换，并使用 1 次调整。', driver: '把完整路线发给司机', dicky: '发送给 Dicky', gede: '发送给 Gede Nico', login: '登录后解锁', public: '继续浏览公共 R1–R6 路线', payTitle: '解锁这条路线', payText: '¥9.9 解锁当前完整专业路线，附带同一行程 3 次调整。AI 自助规划额度单独计算；不含人工深度定制，也不能用于新建其他旅行订单。', paid: '我已付款 · 提交确认', orderSent: '到账确认申请已提交，管理员确认后路线会开放。', pointsDone: '已用积分解锁路线。', loading: '正在匹配你的路线…', error: '专业路线暂时无法加载，请稍后重试。', noData: '填写日期、人数和预算后开始匹配。', routeBasis: '基于 Bali 地理区域、路线家族和 POI 模块生成。开放时间和可用性仍需确认。'
    },
    ja: { noProfile:'旅行情報を入力すると、Bali の地域とルートから合うプロルートを提案します。公開ルートはそのまま見られます。', formTitle:'バリ旅行の情報', submit:'ルートを提案', submitAdjust:'この調整を適用', edit:'旅行情報を調整', cancel:'編集を閉じる', audience:'旅行段階', first:'初めて', returning:'リピーター', people:'人数', start:'出発日', end:'帰着日', budget:'予算', style:'旅行スタイル', comfort:'快適', budgetStyle:'予算重視', luxury:'プレミアム', pace:'ペース', balanced:'バランス', slow:'ゆっくり', goals:'優先事項', local:'文化', photo:'風景・写真', easy:'計画を減らす', value:'予算管理', route:'提案されたプロルート', preview:'無料プレビュー', unlocked:'完全版を解放済み', reason:'おすすめの理由', openDays:'{n}日を表示', lockedDays:'{n}日をロック', day:'{n}日目', locked:'詳細はロック中', lockedNote:'解放すると場所の順序、体験モジュール、実行メモを確認できます。', unlock:'完全版を解放 · ¥9.9', points:'紹介ポイント30で交換', adjust:'この旅程を調整', remaining:'残り{n}回', adjustExhausted:'この旅程の調整回数を使い切りました', adjustScope:'同じ旅程について、日数・ペース・予算・興味など3回の項目調整を含みます。人による詳細設計や新しい旅程3件の作成は含みません。', routeSwitchPending:'上で{route}を選択しました。閲覧だけでは解放済みルートは変わりません。「この旅程を調整」を送信すると1回分を使って切り替わります。', driver:'完全なルートをドライバーへ', dicky:'Dickyへ送る', gede:'Gede Nicoへ送る', login:'ログインして解放', public:'公開R1–R6を見る', payTitle:'このルートを解放', payText:'¥9.9で現在の完全版ルートと、同じ旅程の項目調整3回を解放します。AI自分計画の枠とは別で、人による詳細設計や新しい旅程の作成は含みません。', paid:'支払済み・確認を申請', orderSent:'確認申請を受け付けました。確認後に開放されます。', pointsDone:'ポイントで解放しました。', loading:'ルートを提案中…', error:'プロルートを読み込めませんでした。', noData:'日付、人数、予算を入力してください。', routeBasis:'Baliの地理、ルート、POIモジュールから構成しています。時間と空き状況は要確認です。' },
    ko: { noProfile:'여행 정보를 입력하면 Bali 지역과 경로에서 맞춤 전문 루트를 추천합니다. 공개 경로는 계속 볼 수 있습니다.', formTitle:'발리 여행 정보', submit:'경로 매칭', submitAdjust:'이번 조정 적용', edit:'여행 정보 조정', cancel:'편집 닫기', audience:'여행 단계', first:'첫 방문', returning:'재방문', people:'인원', start:'출발일', end:'귀국일', budget:'예산', style:'여행 스타일', comfort:'편안함', budgetStyle:'예산 우선', luxury:'프리미엄', pace:'속도', balanced:'균형', slow:'느긋하게', goals:'우선순위', local:'현지 문화', photo:'풍경·사진', easy:'계획 줄이기', value:'예산 관리', route:'매칭된 전문 루트', preview:'무료 미리보기', unlocked:'전체 루트 잠금 해제', reason:'추천 이유', openDays:'{n}일 공개', lockedDays:'{n}일 잠금', day:'{n}일차', locked:'상세 잠금', lockedNote:'잠금 해제 후 장소 순서, 체험 모듈과 실행 메모를 확인할 수 있습니다.', unlock:'전체 루트 잠금 해제 · ¥9.9', points:'추천 포인트 30점 사용', adjust:'이 여행 조정', remaining:'{n}회 남음', adjustExhausted:'이 여행의 조정 횟수를 모두 사용했습니다', adjustScope:'같은 여행에 대해 일정 일수, 속도, 예산, 관심사 등의 항목을 3회 조정할 수 있습니다. 사람의 심층 맞춤 설계나 새 여행 주문 3건은 포함하지 않습니다.', routeSwitchPending:'위에서 {route}을(를) 선택했습니다. 둘러보기만으로 잠금 해제된 경로는 바뀌지 않습니다. “이 여행 조정”을 제출하면 조정 1회를 사용해 전환됩니다.', driver:'전체 루트를 기사에게 보내기', dicky:'Dicky에게 보내기', gede:'Gede Nico에게 보내기', login:'로그인 후 잠금 해제', public:'공개 R1–R6 보기', payTitle:'이 루트 잠금 해제', payText:'¥9.9로 현재 전체 전문 루트와 같은 여행의 항목 조정 3회를 잠금 해제합니다. AI 직접 계획 한도와 별도이며, 사람의 심층 맞춤 설계나 새 여행 주문은 포함하지 않습니다.', paid:'결제 완료 · 확인 요청', orderSent:'확인 요청을 보냈습니다. 확인 후 루트가 열립니다.', pointsDone:'포인트로 잠금 해제했습니다.', loading:'루트를 매칭하는 중…', error:'전문 루트를 불러오지 못했습니다.', noData:'날짜, 인원과 예산을 입력하세요.', routeBasis:'Bali 지리, 경로 가족과 POI 모듈을 바탕으로 구성합니다. 운영 시간과 이용 가능 여부는 확인이 필요합니다.' },
    id: { noProfile:'Isi detail perjalanan untuk mencocokkan rute profesional dari wilayah dan rute Bali. Anda tetap dapat melihat rute publik.', formTitle:'Perjalanan Bali Anda', submit:'Cocokkan rute saya', submitAdjust:'Terapkan penyesuaian', edit:'Ubah detail perjalanan', cancel:'Tutup editor', audience:'Tahap perjalanan', first:'Pertama kali', returning:'Pernah datang', people:'Jumlah orang', start:'Tanggal berangkat', end:'Tanggal pulang', budget:'Anggaran', style:'Gaya perjalanan', comfort:'Nyaman', budgetStyle:'Hemat', luxury:'Premium', pace:'Tempo', balanced:'Seimbang', slow:'Santai', goals:'Prioritas', local:'Budaya lokal', photo:'Pemandangan & foto', easy:'Lebih sedikit rencana', value:'Kendali anggaran', route:'Rute profesional yang cocok', preview:'Pratinjau gratis', unlocked:'Rute lengkap terbuka', reason:'Alasan rekomendasi', openDays:'{n} hari terbuka', lockedDays:'{n} hari terkunci', day:'Hari {n}', locked:'Detail terkunci', lockedNote:'Buka kunci untuk melihat urutan tempat, modul pengalaman dan catatan pelaksanaan.', unlock:'Buka rute lengkap · ¥9.9', points:'Gunakan 30 poin referral', adjust:'Sesuaikan perjalanan ini', remaining:'tersisa {n} penyesuaian', adjustExhausted:'Penyesuaian untuk perjalanan ini sudah habis', adjustScope:'Termasuk 3 penyesuaian parameter untuk perjalanan yang sama, seperti jumlah hari, tempo, anggaran atau minat. Tidak termasuk kustomisasi mendalam oleh manusia atau tiga pesanan perjalanan baru.', routeSwitchPending:'{route} dipilih di atas. Menjelajah tidak mengganti rute yang sudah terbuka; kirim “Sesuaikan perjalanan ini” untuk beralih dengan memakai 1 penyesuaian.', driver:'Kirim rute lengkap ke driver', dicky:'Kirim ke Dicky', gede:'Kirim ke Gede Nico', login:'Masuk untuk membuka', public:'Lihat rute publik R1–R6', payTitle:'Buka rute ini', payText:'Bayar ¥9.9 untuk membuka rute profesional lengkap saat ini dan 3 penyesuaian parameter untuk perjalanan yang sama. Kredit AI tetap terpisah; kustomisasi mendalam oleh manusia dan pesanan perjalanan baru tidak termasuk.', paid:'Saya sudah bayar · kirim konfirmasi', orderSent:'Permintaan konfirmasi dikirim. Rute terbuka setelah dikonfirmasi.', pointsDone:'Rute dibuka dengan poin.', loading:'Mencocokkan rute…', error:'Rute profesional tidak dapat dimuat.', noData:'Isi tanggal, jumlah orang dan anggaran.', routeBasis:'Disusun dari geografi Bali, keluarga rute dan modul POI. Jam buka dan ketersediaan tetap perlu dikonfirmasi.' }
  };

  function currentLang() {
    return ((document.getElementById('langPicker') || {}).value || localStorage.getItem('wm_studio_lang') || 'en').toLowerCase();
  }
  function T() { return COPY[currentLang()] || COPY.en; }
  function paypalT() { return PAYPAL_COPY[currentLang()] || PAYPAL_COPY.en; }
  function text(value) { return String(value == null ? '' : value); }
  function esc(value) { return text(value).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); }
  function fill(value, vars) { return text(value).replace(/\{(\w+)\}/g, function (_, key) { return esc(vars[key] == null ? '' : vars[key]); }); }
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
  function redirectToLogin() {
    var profile = state.profile;
    if (profile) localStorage.setItem('wm_studio_trip_profile', JSON.stringify(profile));
    var returnPath = '/bali.html#professional-planner';
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
          currency: brief.currency || 'CNY', budget_range: brief.budget || '', pace: brief.pace || 'balanced', origin_region: ''
        };
      }
    } catch (_) {}
    return null;
  }
  function saveProfile(profile) {
    state.profile = profile;
    localStorage.setItem('wm_studio_trip_profile', JSON.stringify(profile));
    var brief = { dest:'bali', audience:profile.audience, goals:profile.goals, people:profile.travellers, start:profile.departure_date, end:profile.return_date, days:profile.days, currency:profile.currency, budget:profile.budget_range, style:profile.travel_style, trip_profile:profile };
    localStorage.setItem('wm_studio_trip_brief', JSON.stringify(brief));
  }
  function makeProfile(form) {
    var start = form.querySelector('[name="start"]').value;
    var end = form.querySelector('[name="end"]').value;
    return {
      audience: form.querySelector('[name="audience"]:checked').value,
      goals: Array.from(form.querySelectorAll('[name="goal"]:checked')).map(function (item) { return item.value; }),
      travel_style: form.querySelector('[name="style"]').value,
      travellers: Number(form.querySelector('[name="people"]').value || 2),
      departure_date: start, return_date: end,
      days: Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000)),
      currency: state.profile.currency || 'CNY', budget_range: Number(form.querySelector('[name="budget"]').value || 0),
      pace: form.querySelector('[name="pace"]').value, origin_region: ''
    };
  }
  function formMarkup(profile) {
    var l = T(); var p = profile || {};
    var start = p.departure_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    var end = p.return_date || new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
    var goals = p.goals || [];
    return '<form class="bali-professional-form" id="bali-professional-form">' +
      '<div class="bali-professional-form-row"><label>' + esc(l.audience) + '<span><input type="radio" name="audience" value="first" ' + (p.audience !== 'returning' ? 'checked' : '') + '> ' + esc(l.first) + '</span><span><input type="radio" name="audience" value="returning" ' + (p.audience === 'returning' ? 'checked' : '') + '> ' + esc(l.returning) + '</span></label><label>' + esc(l.people) + '<input name="people" type="number" min="1" max="40" value="' + esc(p.travellers || 2) + '"></label></div>' +
      '<div class="bali-professional-form-row"><label>' + esc(l.start) + '<input name="start" type="date" required value="' + esc(start) + '"></label><label>' + esc(l.end) + '<input name="end" type="date" required value="' + esc(end) + '"></label></div>' +
      '<div class="bali-professional-form-row"><label>' + esc(l.budget) + '<input name="budget" type="number" min="100" step="100" required value="' + esc(p.budget_range || '') + '"></label><label>' + esc(l.style) + '<select name="style"><option value="budget" ' + (p.travel_style === 'budget' ? 'selected' : '') + '>' + esc(l.budgetStyle) + '</option><option value="comfort" ' + (p.travel_style !== 'budget' && p.travel_style !== 'luxury' ? 'selected' : '') + '>' + esc(l.comfort) + '</option><option value="luxury" ' + (p.travel_style === 'luxury' ? 'selected' : '') + '>' + esc(l.luxury) + '</option></select></label></div>' +
      '<div class="bali-professional-form-row"><label>' + esc(l.pace) + '<select name="pace"><option value="balanced" ' + (p.pace !== 'slow' ? 'selected' : '') + '>' + esc(l.balanced) + '</option><option value="slow" ' + (p.pace === 'slow' ? 'selected' : '') + '>' + esc(l.slow) + '</option></select></label><label>' + esc(l.goals) + '<span><input type="checkbox" name="goal" value="local" ' + (goals.indexOf('local') >= 0 ? 'checked' : '') + '> ' + esc(l.local) + ' · <input type="checkbox" name="goal" value="photo" ' + (goals.indexOf('photo') >= 0 ? 'checked' : '') + '> ' + esc(l.photo) + ' · <input type="checkbox" name="goal" value="easy" ' + (goals.indexOf('easy') >= 0 ? 'checked' : '') + '> ' + esc(l.easy) + ' · <input type="checkbox" name="goal" value="value" ' + (goals.indexOf('value') >= 0 ? 'checked' : '') + '> ' + esc(l.value) + '</span></label></div>' +
      '<div class="bali-professional-actions"><button class="bali-btn bali-btn-primary" type="submit"><span class="fa fa-magic"></span> ' + esc(state.editing ? l.submitAdjust : l.submit) + '</button><a class="bali-btn bali-route-secondary" href="#route-families">' + esc(l.public) + '</a></div>' +
      '<div class="bali-professional-form-note">' + esc(l.routeBasis) + '</div></form>';
  }
  function bindForm(form) {
    if (!form) return;
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var start = form.querySelector('[name="start"]').value;
      var end = form.querySelector('[name="end"]').value;
      if (!start || !end || end <= start) { setStatus(T().error, true); return; }
      var profile = makeProfile(form);
      var adjusting = !!(state.response && state.response.professional_route_entitlement);
      if (adjusting) await adjustRoute(profile);
      else { state.editing = false; await loadRoute(profile, state.routeId); }
    });
  }
  function setStatus(message, isError, targetId) {
    var status = document.getElementById(targetId || 'bali-professional-status');
    if (status) { status.textContent = message || ''; status.className = 'bali-professional-status' + (isError ? ' error' : ''); }
  }
  function apiError(body, fallback) {
    var detail = body && body.detail;
    if (typeof detail === 'string') return detail;
    return (detail && detail.error) || fallback;
  }
  function renderEmpty() {
    var l = T();
    app.innerHTML = '<div class="bali-professional-empty"><p>' + esc(l.noProfile) + '</p><div id="bali-professional-empty-form"></div></div>';
    document.getElementById('bali-professional-empty-form').innerHTML = formMarkup(null);
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
        onCancel: function () { setStatus('', false, 'bali-professional-payment-status'); },
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
    var summary = [p.departure_date && (p.departure_date + ' → ' + (p.return_date || '')), (p.days || route.days || '') + ' days', (p.travellers || 2) + ' people', p.budget_range ? ((p.currency || 'CNY') + ' ' + p.budget_range) : ''].filter(Boolean);
    var goals = (p.goals || []).join(' · ');
    var dayHtml = days.map(function (day) {
      var locked = !!day.locked;
      var places = (day.places || []).map(function (place) { return '<span class="bali-professional-place">' + esc(place.name) + '</span>'; }).join('');
      return '<article class="bali-professional-day' + (locked ? ' is-locked' : '') + '"><span class="bali-professional-day-number">' + esc(day.day) + '</span><div class="bali-professional-day-head"><strong>' + esc(fill(l.day, { n:day.day })) + ' · ' + esc(day.region_name) + '</strong><span>' + (locked ? esc(l.locked) : esc(l.preview)) + '</span></div><p>' + esc(day.theme) + '</p>' + (locked ? '<div class="bali-professional-lock-note"><span class="fa fa-lock"></span> ' + esc(l.lockedNote) + '</div>' : '<div class="bali-professional-places">' + (places || '<span class="bali-professional-place">' + esc(l.routeBasis) + '</span>') + '</div>') + '</article>';
    }).join('');
    var actionHtml = unlocked ? (adjustmentRemaining > 0 ? '<button class="bali-btn bali-btn-primary" type="button" id="bali-professional-edit"><span class="fa fa-sliders"></span> ' + esc(l.adjust) + '</button><span class="bali-professional-badge bali-professional-adjustments-badge">' + esc(fill(l.remaining, { n:adjustmentRemaining })) + '</span>' : '<button class="bali-btn bali-btn-primary" type="button" disabled><span class="fa fa-sliders"></span> ' + esc(l.adjustExhausted) + '</button><span class="bali-professional-badge bali-professional-adjustments-badge">' + esc(fill(l.remaining, { n:0 })) + '</span>') : '<button class="bali-btn bali-btn-primary" type="button" id="bali-professional-unlock"><span class="fa fa-lock"></span> ' + esc(l.unlock) + '</button><button class="bali-btn bali-route-secondary" type="button" id="bali-professional-points"><span class="fa fa-gift"></span> ' + esc(l.points) + '</button>';
    var adjustmentNote = unlocked ? '<div class="bali-professional-form-note">' + esc(l.adjustScope) + '</div>' : '';
    var driverHtml = unlocked ? '<div class="bali-professional-actions"><strong style="width:100%;font-size:12px;color:#64748b">' + esc(l.driver) + '</strong><button class="bali-btn bali-route-secondary" type="button" data-driver="dicky">' + esc(l.dicky) + '</button><button class="bali-btn bali-route-secondary" type="button" data-driver="gede">' + esc(l.gede) + '</button></div>' : '';
    var editor = state.editing ? '<div class="bali-professional-card" style="margin-top:20px"><h3>' + esc(l.formTitle) + '</h3>' + formMarkup(p) + '</div>' : '';
    app.innerHTML = '<div class="bali-professional-layout"><div class="bali-professional-card"><div class="bali-professional-route-label"><strong>' + esc(l.route) + '</strong><span class="bali-professional-badge">' + esc(unlocked ? l.unlocked : l.preview) + '</span></div><h3>' + esc(route.route_id || '') + ' · ' + esc(route.route_name || '') + '</h3><p>' + esc(route.route_promise || '') + '</p><div class="bali-profile-summary">' + summary.map(function (item) { return '<span class="bali-profile-chip">' + esc(item) + '</span>'; }).join('') + (goals ? '<span class="bali-profile-chip">' + esc(goals) + '</span>' : '') + '</div><div class="bali-professional-reason"><strong>' + esc(l.reason) + '</strong><br>' + esc(route.recommendation_reason || '') + '</div><div id="bali-professional-status" class="bali-professional-status" role="status" aria-live="polite"></div><div class="bali-professional-actions">' + actionHtml + '</div>' + adjustmentNote + driverHtml + '</div><div class="bali-professional-card"><div class="bali-professional-route-label"><strong>' + esc(fill(l.openDays, { n:route.preview_days || 0 })) + '</strong><span class="bali-professional-badge">' + esc(fill(l.lockedDays, { n:route.locked_days || 0 })) + '</span></div><div class="bali-professional-days">' + dayHtml + '</div></div></div>' + editor + (state.paymentOpen ? paymentPanel() : '');
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
    if (edit) edit.onclick = function () { state.editing = !state.editing; renderResult(); };
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
  async function loadRoute(profile, routeId) {
    if (!profile) { renderEmpty(); return; }
    state.profile = profile; state.loading = true; app.innerHTML = '<div class="bali-professional-loading">' + esc(T().loading) + '</div>';
    try {
      var requestBody = { trip_id:state.tripId, trip_profile:profile, route_id:routeId || '', lang:currentLang() };
      var response = await fetch(API_BASE + '/api/bali/professional-route', { method:'POST', headers:Object.assign({ 'Content-Type':'application/json', 'X-Anon-Id':sessionId() }, authHeaders()), body:JSON.stringify(requestBody) });
      var body = await response.json().catch(function () { return {}; });
      if (response.status === 403 && state.tripId) {
        state.tripId = '';
        localStorage.removeItem('wm_studio_professional_trip_id');
        requestBody.trip_id = '';
        response = await fetch(API_BASE + '/api/bali/professional-route', { method:'POST', headers:Object.assign({ 'Content-Type':'application/json', 'X-Anon-Id':sessionId() }, authHeaders()), body:JSON.stringify(requestBody) });
        body = await response.json().catch(function () { return {}; });
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
      renderResult();
    } catch (error) { state.loading = false; app.innerHTML = '<div class="bali-professional-error">' + esc(error.message || T().error) + '</div>'; }
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
