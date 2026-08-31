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
      zh:{nav:'套餐',eyebrow:'巴厘岛模块 · 可编辑套餐',title:'从一日体验开始，组合成能落地的巴厘岛套餐',subtitle:'按天数和区域查看套餐骨架，再由司机核对交通、供应商、安全、天气与最终价格。每个模块都可以替换，它不是即时预订。',days:'天数',area:'同区域动线',all:'全部',one:'1 日',two:'2 日',select:'选择这个套餐',selected:'已选择',checks:'出发前确认',send:'把套餐发给司机确认',note:'套餐是可编辑的路线起点，不是即时预订。供应商、天气、保险与最终价格会在司机回复后确认。',empty:'没有符合筛选的套餐。'},
      en:{nav:'Packs',eyebrow:'Bali modules · editable packages',title:'Start with a one-day experience, then build a workable Bali package',subtitle:'Browse by days and area, then let a driver check transport, suppliers, safety, weather and final price. Every module can be swapped; this is not instant booking.',days:'Days',area:'Same-area route',all:'All',one:'1 day',two:'2 days',select:'Choose this package',selected:'Selected',checks:'Confirm before travel',send:'Send package to a driver',note:'Packages are editable route starts, not instant bookings. Suppliers, weather, insurance and final price are confirmed after the driver replies.',empty:'No package matches these filters.'},
      ja:{nav:'パック',eyebrow:'バリのモジュール · 編集可能',title:'1日体験から、実行できるバリ旅へ',subtitle:'日数と地域で選び、交通・事業者・安全・天候・最終価格をドライバーが確認します。各モジュールは入れ替え可能で、即時予約ではありません。',days:'日数',area:'同じ地域の動線',all:'すべて',one:'1日',two:'2日',select:'このパッケージを選ぶ',selected:'選択済み',checks:'出発前に確認',send:'ドライバーに確認を送る',note:'編集できる旅程の出発点であり、即時予約ではありません。最終条件はドライバー返信後に確認します。',empty:'条件に合うパッケージがありません。'},
      ko:{nav:'패키지',eyebrow:'발리 모듈 · 편집 가능',title:'하루 체험에서 실행 가능한 발리 패키지로',subtitle:'일수와 지역으로 살펴본 뒤 교통·업체·안전·날씨·최종 가격을 기사가 확인합니다. 각 모듈은 교체할 수 있으며 즉시 예약이 아닙니다.',days:'일수',area:'같은 지역 동선',all:'전체',one:'1일',two:'2일',select:'이 패키지 선택',selected:'선택됨',checks:'출발 전 확인',send:'기사에게 패키지 확인 요청',note:'편집 가능한 일정 시작점이며 즉시 예약이 아닙니다. 최종 조건은 기사 답장 후 확인합니다.',empty:'필터와 일치하는 패키지가 없습니다.'},
      id:{nav:'Paket',eyebrow:'Modul Bali · dapat diedit',title:'Mulai dari pengalaman sehari, lalu susun paket Bali yang dapat dijalankan',subtitle:'Lihat berdasarkan hari dan area, lalu pengemudi memeriksa transportasi, pemasok, keselamatan, cuaca dan harga akhir. Setiap modul dapat diganti; ini bukan pemesanan instan.',days:'Hari',area:'Rute satu area',all:'Semua',one:'1 hari',two:'2 hari',select:'Pilih paket ini',selected:'Dipilih',checks:'Konfirmasi sebelum berangkat',send:'Kirim paket ke pengemudi',note:'Paket adalah titik awal rute yang dapat diedit, bukan pemesanan instan. Detail akhir dikonfirmasi setelah pengemudi membalas.',empty:'Tidak ada paket yang sesuai.'}
    })[language()] || null;
  }
  function visible(item) { return filters.days === 'all' || String(item.duration_days) === filters.days; }
  function durationLabel(value, c) { return String(value) === '1' ? c.one : c.two; }
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
      return '<article class="bali-package-card'+(selected?' active':'')+'"><div class="bali-package-card-top"><span>'+esc((item.route_id || 'Bali')+' · '+durationLabel(item.duration_days, c))+'</span><span class="bali-package-status">'+esc(c.checks)+'</span></div><div class="bali-package-area"><span class="fa fa-map-marker" aria-hidden="true"></span><span><strong>'+esc(c.area)+'</strong> · '+esc(text(item.area))+'</span></div><h3>'+esc(text(item.title))+'</h3><p>'+esc(text(item.summary))+'</p><button type="button" data-package-select="'+esc(item.id)+'" aria-pressed="'+String(selected)+'">'+esc(selected?c.selected:c.select)+'</button></article>';
    }).join('')+'</div>' : '<p class="bali-package-empty">'+esc(c.empty)+'</p>') + '<div class="bali-package-summary" '+(selectedId?'':'hidden')+'><p>'+esc(c.note)+'</p><a class="bali-btn bali-btn-primary" href="find-driver.html?package='+encodeURIComponent(selectedId)+'">'+esc(c.send)+'</a></div>';
    root.querySelectorAll('[data-package-days]').forEach(function(button){button.addEventListener('click',function(){filters.days=button.dataset.packageDays;render();});});
    root.querySelectorAll('[data-package-select]').forEach(function(button){button.addEventListener('click',function(){selectedId=button.dataset.packageSelect;render();var summary=root.querySelector('.bali-package-summary');if(summary)summary.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});});});
  }
  fetch('assets/data/bali-experience-packages.json?v=20260828p2').then(function(response){if(!response.ok)throw new Error('HTTP '+response.status);return response.json();}).then(function(data){packages=data.packages||[];var requested=new URLSearchParams(window.location.search).get('package');if(packages.some(function(item){return item.id===requested;}))selectedId=requested;render();}).catch(function(){root.innerHTML='<p class="bali-package-empty">Package library is temporarily unavailable.</p>';});
  document.addEventListener('wm:language-change',function(){if(packages.length)render();});
})();
