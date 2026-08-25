(function () {
  'use strict';

  var token = localStorage.getItem('wm_studio_token') || '';
  var langs = ['zh', 'en', 'ja', 'ko', 'id'];
  var copy = {
    en:{skip:'Skip to measurement',portfolio:'Portfolio manager',eyebrow:'Launch measurement',title:'See what visitors choose',subtitle:'Anonymous first-party counts for the launch funnel. No visitor names, contact details, cookies or ad-platform tags.',range:'Window',visits:'Page views',visitsHint:'Landing interest',route:'Route interest',routeHint:'Public or professional routes',driverStart:'Driver form starts',driverStartHint:'High-intent visitors',driverSent:'Driver requests sent',driverSentHint:'Delivered requests only',events:'Events',event:'Event',channels:'Channels',source:'Source',medium:'Medium',campaigns:'Campaigns',campaign:'Campaign',creative:'Creative',count:'Count',empty:'No measurements in this window yet.',reading:'How to read this',readingBody:'Compare visits → route interest → driver form starts → delivered requests. Use campaign and creative labels to decide what to keep, pause or rewrite.',privacy:'Privacy boundary: only approved event names, page paths and campaign labels are stored. Contact details and raw IP addresses are not stored in this measurement table.',loading:'Loading launch measurements…',loaded:'Updated for the last {days} days.',adminOnly:'This page requires an administrator account.',expired:'Your session expired. Sign in again to continue.',failed:'Measurement could not be loaded. Try again.'},
    zh:{skip:'跳到推广数据',portfolio:'Portfolio 管理器',eyebrow:'推广数据',title:'看见访客真正选择什么',subtitle:'面向上线漏斗的匿名第一方计数；不记录访客姓名、联系方式、Cookie，也未接入广告平台标签。',range:'统计周期',visits:'页面访问',visitsHint:'落地页兴趣',route:'路线兴趣',routeHint:'公共或专业路线',driverStart:'开始填写司机表单',driverStartHint:'高意向访客',driverSent:'已发送司机请求',driverSentHint:'仅统计成功送达',events:'行为事件',event:'事件',channels:'来源渠道',source:'来源',medium:'媒介',campaigns:'推广系列',campaign:'系列',creative:'内容版本',count:'次数',empty:'该周期还没有数据。',reading:'如何判断',readingBody:'比较访问 → 路线兴趣 → 开始填写 → 成功送达。再按推广系列和内容版本决定保留、暂停或改写。',privacy:'隐私边界：只保存白名单事件、页面路径和推广标签；此统计表不保存联系方式或原始 IP。',loading:'正在读取推广数据…',loaded:'已更新最近 {days} 天数据。',adminOnly:'此页面仅限管理员账户。',expired:'登录已过期，请重新登录。',failed:'暂时无法读取推广数据，请重试。'},
    ja:{skip:'計測データへ移動',portfolio:'Portfolio 管理',eyebrow:'ローンチ計測',title:'訪問者の選択を確認',subtitle:'ローンチ導線の匿名ファーストパーティ集計です。氏名、連絡先、Cookie、広告タグは記録しません。',range:'期間',visits:'ページ表示',visitsHint:'入口の関心',route:'ルートへの関心',routeHint:'公開・プロルート',driverStart:'ドライバーフォーム開始',driverStartHint:'関心の高い訪問者',driverSent:'送信済み依頼',driverSentHint:'配信成功のみ',events:'イベント',event:'イベント',channels:'チャネル',source:'流入元',medium:'媒体',campaigns:'キャンペーン',campaign:'キャンペーン',creative:'クリエイティブ',count:'件数',empty:'この期間のデータはまだありません。',reading:'見方',readingBody:'表示 → ルートへの関心 → フォーム開始 → 送信成功を比較し、キャンペーン別に継続・停止・改善を判断します。',privacy:'プライバシー境界：許可済みイベント、ページパス、キャンペーンラベルのみ保存し、連絡先と生のIPは保存しません。',loading:'データを読み込み中…',loaded:'過去 {days} 日分を更新しました。',adminOnly:'管理者アカウントが必要です。',expired:'セッションが切れました。再度ログインしてください。',failed:'データを読み込めませんでした。'},
    ko:{skip:'측정 데이터로 이동',portfolio:'Portfolio 관리자',eyebrow:'출시 측정',title:'방문자가 선택한 것을 확인하세요',subtitle:'출시 퍼널의 익명 자사 집계입니다. 이름, 연락처, 쿠키, 광고 플랫폼 태그를 기록하지 않습니다.',range:'기간',visits:'페이지 조회',visitsHint:'랜딩 관심',route:'경로 관심',routeHint:'공개 또는 전문 경로',driverStart:'기사 양식 시작',driverStartHint:'관심도 높은 방문자',driverSent:'전송된 기사 요청',driverSentHint:'전달 성공만 집계',events:'이벤트',event:'이벤트',channels:'채널',source:'출처',medium:'매체',campaigns:'캠페인',campaign:'캠페인',creative:'콘텐츠',count:'횟수',empty:'이 기간에는 아직 데이터가 없습니다.',reading:'읽는 방법',readingBody:'조회 → 경로 관심 → 양식 시작 → 전달 성공을 비교하고 캠페인별 유지, 중단, 개선을 판단하세요.',privacy:'개인정보 경계: 승인된 이벤트, 페이지 경로, 캠페인 라벨만 저장하며 연락처와 원본 IP는 저장하지 않습니다.',loading:'출시 데이터를 불러오는 중…',loaded:'최근 {days}일 데이터로 업데이트했습니다.',adminOnly:'관리자 계정이 필요합니다.',expired:'세션이 만료되었습니다. 다시 로그인하세요.',failed:'데이터를 불러오지 못했습니다.'},
    id:{skip:'Lewati ke pengukuran',portfolio:'Pengelola Portfolio',eyebrow:'Pengukuran peluncuran',title:'Lihat pilihan pengunjung',subtitle:'Hitungan pihak pertama anonim untuk alur peluncuran. Tanpa nama, kontak, cookie, atau tag platform iklan.',range:'Periode',visits:'Tampilan halaman',visitsHint:'Minat halaman awal',route:'Minat rute',routeHint:'Rute publik atau profesional',driverStart:'Mulai formulir driver',driverStartHint:'Pengunjung berniat tinggi',driverSent:'Permintaan driver terkirim',driverSentHint:'Hanya yang berhasil dikirim',events:'Peristiwa',event:'Peristiwa',channels:'Kanal',source:'Sumber',medium:'Media',campaigns:'Kampanye',campaign:'Kampanye',creative:'Konten',count:'Jumlah',empty:'Belum ada data pada periode ini.',reading:'Cara membaca',readingBody:'Bandingkan kunjungan → minat rute → mulai formulir → permintaan terkirim. Gunakan label kampanye dan konten untuk memilih yang dipertahankan, dihentikan, atau ditulis ulang.',privacy:'Batas privasi: hanya nama peristiwa yang disetujui, jalur halaman, dan label kampanye yang disimpan. Kontak dan IP mentah tidak disimpan.',loading:'Memuat pengukuran peluncuran…',loaded:'Diperbarui untuk {days} hari terakhir.',adminOnly:'Halaman ini memerlukan akun administrator.',expired:'Sesi berakhir. Silakan masuk lagi.',failed:'Data pengukuran tidak dapat dimuat.'}
  };
  var picker = document.getElementById('langPicker');
  var currentLang = langs.indexOf(localStorage.getItem('wm_studio_lang')) >= 0 ? localStorage.getItem('wm_studio_lang') : 'en';

  function t(key) { return (copy[currentLang] || copy.en)[key] || copy.en[key] || key; }
  function applyLanguage() { document.documentElement.lang = currentLang; picker.value = currentLang; document.querySelectorAll('[data-copy]').forEach(function (node) { node.textContent = t(node.dataset.copy); }); }
  function redirectToLogin() { window.location.assign('../ai-tool.html?auth=login&return=' + encodeURIComponent('/admin/marketing')); }
  function countMap(events) { var map = {}; (events || []).forEach(function (row) { map[row.event_name] = Number(row.count || 0); }); return map; }
  function setText(id, value) { document.getElementById(id).textContent = String(value); }
  function renderRows(id, emptyId, rows, fields) {
    var body = document.getElementById(id); body.textContent = '';
    (rows || []).forEach(function (row) { var tr = document.createElement('tr'); fields.forEach(function (field) { var td = document.createElement('td'); td.textContent = String(row[field] == null ? '' : row[field]); tr.appendChild(td); }); body.appendChild(tr); });
    document.getElementById(emptyId).hidden = Boolean((rows || []).length);
  }
  function showAlert(message) { var node = document.getElementById('alert'); node.textContent = message; node.hidden = false; }

  async function load() {
    if (!token) { redirectToLogin(); return; }
    var days = document.getElementById('days').value;
    document.getElementById('status').textContent = t('loading');
    document.getElementById('alert').hidden = true;
    try {
      var response = await fetch('/api/admin/marketing-summary?days=' + encodeURIComponent(days), { headers:{Authorization:'Bearer ' + token}, cache:'no-store' });
      if (response.status === 401) { showAlert(t('expired')); window.setTimeout(redirectToLogin, 700); return; }
      if (response.status === 403) { showAlert(t('adminOnly')); return; }
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error('load');
      var events = countMap(data.events);
      setText('metricViews', events.page_view || 0);
      setText('metricRoutes', (events.home_professional_route || 0) + (events.bali_public_route_select || 0) + (events.bali_professional_route_start || 0));
      setText('metricDriverStarts', events.driver_form_start || 0);
      setText('metricDriverSent', events.driver_request_submitted || 0);
      renderRows('eventsBody', 'eventsEmpty', data.events, ['event_name','count']);
      renderRows('channelsBody', 'channelsEmpty', data.channels, ['source','medium','count']);
      renderRows('campaignsBody', 'campaignsEmpty', data.campaigns, ['campaign','content','count']);
      document.getElementById('status').textContent = t('loaded').replace('{days}', data.days);
    } catch (_) { document.getElementById('status').textContent = ''; showAlert(t('failed')); }
  }

  picker.addEventListener('change', function () { currentLang = picker.value; localStorage.setItem('wm_studio_lang', currentLang); applyLanguage(); load(); });
  document.getElementById('days').addEventListener('change', load);
  applyLanguage(); load();
})();
