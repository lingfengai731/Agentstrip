(function () {
  'use strict';

  var root = document.getElementById('bali-package-app');
  if (!root) return;

  var packages = [];
  var selectedId = '';
  var filters = { days:'all' };

  function language() {
    var picker = document.getElementById('langPicker');
    return (picker && picker.value) || localStorage.getItem('wm_studio_lang') || 'en';
  }
  function text(value) { return value && typeof value === 'object' ? (value[language()] || value.en || value.zh || '') : String(value || ''); }
  function esc(value) { return String(value || '').replace(/[&<>"']/g, function (char) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]; }); }
  function copy() {
    return ({
      zh:{nav:'套餐',eyebrow:'按区域组合',title:'先选一段喜欢的体验，再拼成顺路的巴厘岛行程',subtitle:'按天数和区域挑选，司机再确认交通、天气与当天安排。标有固定报价的套餐按卡片范围执行，其余套餐出发前确认。',days:'天数',area:'同区域动线',all:'全部',one:'1 日',two:'2 日',select:'选择这个套餐',selected:'已选择',checks:'出发前确认',send:'把套餐发给司机确认',note:'选好后把套餐发给司机，确认日期、接送和当天安排。',empty:'没有符合筛选的套餐。',price:'固定报价',priceScope:'2 名成人 · 总价',priceIncludes:'含酒店往返接送、快艇往返、岛上包车与司机向导、午餐、门票、停车和矿泉水',priceLimit:'适用于示例范围：水明漾接送、萨努尔往返、佩妮达西线一日。'},
      en:{nav:'Packs',eyebrow:'Combine by area',title:'Choose one experience, then build a Bali trip that flows',subtitle:'Browse by days and area. A driver then confirms transport, weather and the day plan. Published prices follow the scope shown on the card; other packages are confirmed before travel.',days:'Days',area:'Same-area route',all:'All',one:'1 day',two:'2 days',select:'Choose this package',selected:'Selected',checks:'Confirm before travel',send:'Send package to a driver',note:'Send your chosen package to a driver to confirm the date, pickup and day plan.',empty:'No package matches these filters.',price:'Published price',priceScope:'2 adults · total',priceIncludes:'Includes return hotel transfer, return fast boat, private island car with driver-guide, lunch, entry tickets, parking and mineral water',priceLimit:'Scope: Seminyak pickup, return through Sanur and a one-day West Nusa Penida route.'},
      ja:{nav:'パック',eyebrow:'地域ごとに組み合わせ',title:'好きな体験を選び、無駄なくつながるバリ旅へ',subtitle:'日数と地域から選び、交通・天候・当日の流れをドライバーが確認します。固定価格はカード記載の範囲、それ以外は出発前に確認します。',days:'日数',area:'同じ地域の動線',all:'すべて',one:'1日',two:'2日',select:'このパッケージを選ぶ',selected:'選択済み',checks:'出発前に確認',send:'ドライバーに確認を送る',note:'選んだパッケージを送り、日程・送迎・当日の流れを確認します。',empty:'条件に合うパッケージがありません。',price:'固定価格',priceScope:'大人2名 · 合計',priceIncludes:'ホテル往復送迎、往復高速船、島内専用車とドライバーガイド、昼食、入場料、駐車、ミネラルウォーターを含む',priceLimit:'範囲：スミニャック送迎、サヌール往復、ヌサ・ペニダ西部1日。'},
      ko:{nav:'패키지',eyebrow:'지역별 조합',title:'마음에 드는 체험을 골라 동선이 자연스러운 발리 여행으로',subtitle:'일수와 지역으로 고른 뒤 기사와 교통·날씨·당일 일정을 확인합니다. 고정 가격은 카드에 적힌 범위에 적용되며 나머지는 출발 전에 확인합니다.',days:'일수',area:'같은 지역 동선',all:'전체',one:'1일',two:'2일',select:'이 패키지 선택',selected:'선택됨',checks:'출발 전 확인',send:'기사에게 패키지 확인 요청',note:'선택한 패키지를 보내 날짜·픽업·당일 일정을 확인하세요.',empty:'필터와 일치하는 패키지가 없습니다.',price:'고정 가격',priceScope:'성인 2명 · 총액',priceIncludes:'호텔 왕복 픽업, 왕복 쾌속선, 섬 전용 차량과 기사 가이드, 점심, 입장료, 주차 및 생수 포함',priceLimit:'범위: 스미냑 픽업, 사누르 왕복, 누사 페니다 서부 1일.'},
      id:{nav:'Paket',eyebrow:'Rangkai per area',title:'Pilih satu pengalaman, lalu susun perjalanan Bali yang searah',subtitle:'Pilih berdasarkan hari dan area. Pengemudi lalu memastikan transportasi, cuaca dan rencana hari itu. Harga tetap berlaku sesuai cakupan di kartu; paket lain dikonfirmasi sebelum berangkat.',days:'Hari',area:'Rute satu area',all:'Semua',one:'1 hari',two:'2 hari',select:'Pilih paket ini',selected:'Dipilih',checks:'Konfirmasi sebelum berangkat',send:'Kirim paket ke pengemudi',note:'Kirim paket pilihanmu untuk memastikan tanggal, penjemputan dan rencana hari itu.',empty:'Tidak ada paket yang sesuai.',price:'Harga tetap',priceScope:'2 dewasa · total',priceIncludes:'Termasuk antar-jemput hotel, tiket fast boat pulang-pergi, mobil privat di pulau dengan driver-guide, makan siang, tiket masuk, parkir dan air mineral',priceLimit:'Cakupan: penjemputan Seminyak, pulang-pergi melalui Sanur, dan rute sehari Nusa Penida Barat.'}
    })[language()] || null;
  }
  function visible(item) { return filters.days === 'all' || String(item.duration_days) === filters.days; }
  function durationLabel(value, c) { return String(value) === '1' ? c.one : c.two; }
  function formatIdr(value) { return 'IDR ' + Number(value || 0).toLocaleString('en-US'); }
  function renderPrice(item, c) {
    if (!item.published_price || !item.published_price.amount_idr) return '';
    return '<div class="bali-package-price"><span>'+esc(c.price)+'</span><strong>'+esc(formatIdr(item.published_price.amount_idr))+'</strong><small>'+esc(c.priceScope)+'</small><p>'+esc(c.priceIncludes)+'</p><em>'+esc(c.priceLimit)+'</em></div>';
  }
  function renderFilters() {
    var c = copy();
    return '<div class="bali-package-filters">' +
      '<div><span>'+esc(c.days)+'</span>'+['all','1','2'].map(function(v){return '<button type="button" data-package-days="'+v+'" aria-pressed="'+String(filters.days===v)+'">'+esc(v==='all'?c.all:v==='1'?c.one:c.two)+'</button>';}).join('')+'</div></div>';
  }
  function render() {
    var c = copy();
    var eyebrow=document.getElementById('bali-package-eyebrow');var title=document.getElementById('bali-package-title');var subtitle=document.getElementById('bali-package-subtitle');var nav=document.getElementById('bali-package-mobile-label');
    if(eyebrow)eyebrow.textContent=c.eyebrow;if(title)title.textContent=c.title;if(subtitle)subtitle.textContent=c.subtitle;if(nav)nav.textContent=c.nav;
    var list = packages.filter(visible);
    root.innerHTML = renderFilters() + (list.length ? '<div class="bali-package-grid">'+list.map(function(item){
      var selected = item.id === selectedId;
      return '<article class="bali-package-card'+(selected?' active':'')+'"><div class="bali-package-card-top"><span>'+esc((item.route_id || 'Bali')+' · '+durationLabel(item.duration_days, c))+'</span><span class="bali-package-status">'+esc(c.checks)+'</span></div><div class="bali-package-area"><span class="fa fa-map-marker" aria-hidden="true"></span><span><strong>'+esc(c.area)+'</strong> · '+esc(text(item.area))+'</span></div><h3>'+esc(text(item.title))+'</h3><p>'+esc(text(item.summary))+'</p>'+renderPrice(item,c)+(item.transport_note?'<p class="bali-package-transport"><span class="fa fa-road" aria-hidden="true"></span> '+esc(text(item.transport_note))+'</p>':'')+'<button type="button" data-package-select="'+esc(item.id)+'" aria-pressed="'+String(selected)+'">'+esc(selected?c.selected:c.select)+'</button></article>';
    }).join('')+'</div>' : '<p class="bali-package-empty">'+esc(c.empty)+'</p>') + '<div class="bali-package-summary" '+(selectedId?'':'hidden')+'><p>'+esc(c.note)+'</p><a class="bali-btn bali-btn-primary" href="find-driver.html?package='+encodeURIComponent(selectedId)+'">'+esc(c.send)+'</a></div>';
    root.querySelectorAll('[data-package-days]').forEach(function(button){button.addEventListener('click',function(){filters.days=button.dataset.packageDays;render();});});
    root.querySelectorAll('[data-package-select]').forEach(function(button){button.addEventListener('click',function(){selectedId=button.dataset.packageSelect;render();var summary=root.querySelector('.bali-package-summary');if(summary)summary.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});});});
  }
  fetch('assets/data/bali-experience-packages.json?v=20260831p4').then(function(response){if(!response.ok)throw new Error('HTTP '+response.status);return response.json();}).then(function(data){packages=data.packages||[];var requested=new URLSearchParams(window.location.search).get('package');if(packages.some(function(item){return item.id===requested;}))selectedId=requested;render();}).catch(function(){root.innerHTML='<p class="bali-package-empty">Package library is temporarily unavailable.</p>';});
  document.addEventListener('wm:language-change',function(){if(packages.length)render();});
})();
