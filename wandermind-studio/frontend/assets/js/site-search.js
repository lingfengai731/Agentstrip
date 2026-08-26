(function () {
  'use strict';

  var LANGUAGES = ['zh', 'en', 'ja', 'ko', 'id'];
  var DATA_URL = 'assets/data/bali-travel-data.json?v=20260825p3';
  var PAGE_ENTRIES = [
    { href: 'index.html', titleKey: 'navHome', summaryKey: 'hero1Sub', aliases: ['home', 'index'] },
    { href: 'about.html', titleKey: 'navAbout', summaryKey: 'aboutStoryP1', aliases: ['about', 'story'] },
    { href: 'services.html', titleKey: 'navExplore', summaryKey: 'srvHeaderSub', aliases: ['explore', 'services'] },
    { href: 'bali.html', titleKey: 'navBali', summaryKey: 'baliHeroSub', aliases: ['bali', 'routes', 'island'] },
    { href: 'ai-tool.html', titleKey: 'navAITool', summaryKey: 'hero3Sub', aliases: ['ai', 'planner', 'tool'] },
    { href: 'contact.html', titleKey: 'navContact', summaryKey: 'contactSub', aliases: ['contact', 'email'] },
    { href: 'find-driver.html', titleKey: 'contactDriverTitle', summaryKey: 'contactDriverValue', aliases: ['driver', 'guide', 'car'] }
  ];
  var state = { data: null, dataState: 'loading' };
  var form = document.getElementById('site-search-form');
  var input = document.getElementById('site-search-input');
  var status = document.getElementById('site-search-status');
  var resultList = document.getElementById('site-search-results');

  if (!form || !input || !status || !resultList) return;

  function dictionaries() {
    return typeof LANGS === 'undefined' ? {} : LANGS;
  }

  function currentLanguage() {
    var lang = document.documentElement.lang || '';
    try { lang = localStorage.getItem('wm_studio_lang') || lang; } catch (_) {}
    return LANGUAGES.indexOf(lang) >= 0 ? lang : 'en';
  }

  function dictionary(lang) {
    var all = dictionaries();
    return all[lang] || all.en || {};
  }

  function copy(key, replacements) {
    var value = dictionary(currentLanguage())[key] || dictionary('en')[key] || key;
    Object.keys(replacements || {}).forEach(function (name) {
      value = String(value).split('{' + name + '}').join(String(replacements[name]));
    });
    return value;
  }

  function valueForLanguage(value, lang) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return String(value[lang] || value.en || value.zh || value.ja || value.ko || value.id || '');
  }

  function localizedValues(value) {
    return LANGUAGES.map(function (lang) { return valueForLanguage(value, lang); });
  }

  function dictionaryValues(key) {
    return LANGUAGES.map(function (lang) { return dictionary(lang)[key] || ''; });
  }

  function flatten(value) {
    if (Array.isArray(value)) return value.map(flatten).join(' ');
    if (value && typeof value === 'object') return Object.keys(value).map(function (key) { return flatten(value[key]); }).join(' ');
    return value === null || value === undefined ? '' : String(value);
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function queryFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return String(params.get('q') || params.get('search') || '').trim().slice(0, 120);
  }

  function routeId(value) {
    return /^R[1-6]$/.test(String(value || '')) ? String(value) : '';
  }

  function routeHref(id) {
    return 'bali.html?route=' + encodeURIComponent(id) + '#route-families';
  }

  function statusKey(value) {
    if (value === 'pending_review') return 'searchStatusPending';
    if (value === 'needs_supplier_confirmation') return 'searchStatusSupplier';
    if (value === 'retired') return 'searchStatusUnavailable';
    return '';
  }

  function pageCatalog() {
    return PAGE_ENTRIES.map(function (entry) {
      return {
        kind: 'page',
        typeKey: 'searchResultPage',
        title: copy(entry.titleKey),
        description: copy(entry.summaryKey),
        href: entry.href,
        searchText: [entry.href, entry.titleKey].concat(entry.aliases, dictionaryValues(entry.titleKey), dictionaryValues(entry.summaryKey)).join(' ')
      };
    });
  }

  function routeItem(route) {
    var id = routeId(route && route.id);
    if (!id || (route || {}).verification_status === 'retired') return null;
    var lang = currentLanguage();
    var title = valueForLanguage(route.name, lang) || route.slug || id;
    var description = valueForLanguage(route.promise, lang) || valueForLanguage(route.best_for, lang) || '';
    return {
      kind: 'route',
      typeKey: 'searchResultRoute',
      title: id + ' · ' + title,
      description: description,
      href: routeHref(id),
      status: route.verification_status || '',
      statusKey: statusKey(route.verification_status),
      searchText: [id, route.slug, flatten(route.name), flatten(route.promise), flatten(route.best_for), flatten(route.secondary_tags), flatten(route.free_outline)].join(' ')
    };
  }

  function poiItem(poi, regions) {
    if (!poi || poi.verification_status === 'retired') return null;
    var lang = currentLanguage();
    var region = regions[poi.region_id] || {};
    var name = valueForLanguage(poi.name, lang) || poi.id;
    var regionName = valueForLanguage(region.name, lang) || poi.region_id || '';
    var routeIds = (Array.isArray(poi.route_ids) ? poi.route_ids : []).map(routeId).filter(Boolean);
    var description = [regionName, poi.type || ''].filter(Boolean).join(' · ');
    return {
      kind: 'poi',
      typeKey: 'searchResultPoi',
      title: name,
      description: description,
      href: routeIds.length ? routeHref(routeIds[0]) : 'bali.html#route-families',
      status: poi.verification_status || '',
      statusKey: statusKey(poi.verification_status),
      searchText: [poi.id, poi.name, poi.region_id, flatten(region.name), poi.type, (poi.tags || []).join(' '), routeIds.join(' ')].join(' ')
    };
  }

  function baliCatalog(data) {
    var regions = {};
    (data.regions || []).forEach(function (region) { regions[region.id] = region; });
    var items = [];
    (data.routes || []).forEach(function (route) {
      var item = routeItem(route);
      if (item) items.push(item);
    });
    (data.pois || []).forEach(function (poi) {
      var item = poiItem(poi, regions);
      if (item) items.push(item);
    });
    return items;
  }

  function catalog() {
    return pageCatalog().concat(state.data ? baliCatalog(state.data) : []);
  }

  function matches(item, query) {
    var terms = normalize(query).split(' ').filter(Boolean);
    var haystack = normalize(item.searchText);
    return terms.every(function (term) { return haystack.indexOf(term) >= 0; });
  }

  function score(item, query) {
    var needle = normalize(query);
    var title = normalize(item.title);
    if (title === needle) return 0;
    if (title.indexOf(needle) === 0) return 1;
    return item.kind === 'page' ? 2 : item.kind === 'route' ? 3 : 4;
  }

  function renderItem(item) {
    var li = document.createElement('li');
    var article = document.createElement('article');
    var link = document.createElement('a');
    var type = document.createElement('span');
    var title = document.createElement('span');
    var description = document.createElement('span');

    article.className = 'wm-search-result';
    link.className = 'wm-search-result-link';
    link.href = item.href;
    type.className = 'wm-search-result-type';
    type.textContent = copy(item.typeKey);
    title.className = 'wm-search-result-title';
    title.textContent = item.title;
    description.className = 'wm-search-result-description';
    description.textContent = item.description;
    link.appendChild(type);
    link.appendChild(title);
    if (item.description) link.appendChild(description);
    if (item.statusKey) {
      var statusBadge = document.createElement('span');
      statusBadge.className = 'wm-search-result-status';
      statusBadge.dataset.status = item.status;
      statusBadge.textContent = copy(item.statusKey);
      link.appendChild(statusBadge);
    }
    article.appendChild(link);
    li.appendChild(article);
    return li;
  }

  function render() {
    var query = queryFromUrl();
    var items = catalog();
    var found = query ? items.filter(function (item) { return matches(item, query); }) : [];
    found.sort(function (a, b) { return score(a, query) - score(b, query) || a.title.localeCompare(b.title); });
    input.value = query;
    resultList.textContent = '';

    if (!query) {
      status.textContent = copy('searchPrompt');
      return;
    }

    if (state.dataState === 'loading') {
      status.textContent = copy('searchLoading');
    } else if (state.dataState === 'failed') {
      status.textContent = copy('searchDataUnavailable') + ' ' + copy('searchResultCount', { n: found.length });
    } else if (found.length) {
      status.textContent = copy('searchResultCount', { n: found.length });
    } else {
      status.textContent = copy('searchNoResults');
    }

    found.forEach(function (item) { resultList.appendChild(renderItem(item)); });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var next = new URL(window.location.href);
    var query = String(input.value || '').trim().slice(0, 120);
    if (query) next.searchParams.set('q', query);
    else next.searchParams.delete('q');
    next.searchParams.delete('search');
    window.history.pushState({}, document.title, next.pathname + next.search + next.hash);
    render();
    input.focus();
  });

  window.addEventListener('popstate', render);
  document.addEventListener('wm:language-change', render);

  fetch(DATA_URL, { credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (data) {
      state.data = data;
      state.dataState = 'ready';
      render();
    })
    .catch(function () {
      state.dataState = 'failed';
      render();
    });

  render();
})();
