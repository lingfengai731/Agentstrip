(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var lang = params.get('lang') || localStorage.getItem('wm_studio_lang') || 'en';
  if (!window.WMBaliFoodCopy[lang]) lang = 'en';
  var data, catalog, foods = [], plan, route, plans = {}, selectedDay = Number(params.get('day') || 0);
  var engine = window.WMBaliItinerary;
  var copy = function () { return window.WMBaliFoodCopy[lang]; };
  function localized(value) { return typeof value === 'string' ? value : (value || {})[lang] || (value || {}).en || ''; }
  function element(tag, text, className) { var node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; }
  function options(id, items, value) {
    $(id).replaceChildren();
    items.forEach(function (item) { var node = element('option', item[1]); node.value = item[0]; $(id).appendChild(node); });
    $(id).value = value || '';
  }
  function setCopy() {
    var c = copy(); document.documentElement.lang = lang; $('food-language').value = lang;
    [['food-eyebrow','title'],['food-heading','headline'],['food-intro','intro'],['food-trip-title','trip'],['day-label','day'],['meal-label','meal'],['region-label','region'],['category-label','category'],['budget-label','budget'],['food-browse','browse'],['food-diy','diy'],['food-retry','retry']].forEach(function (pair) { $(pair[0]).textContent = c[pair[1]]; });
    options('food-meal', [['',''+c.all]].concat(['breakfast','lunch','dinner','brunch','dessert'].map(function(id){return [id,c[id]];})), $('food-meal').value || 'lunch');
    options('food-category', [['',c.all]].concat(['local','seafood','asian','cafe','atmosphere'].map(function (id) { return [id,c[id]]; })), $('food-category').value);
    options('food-budget', [['',c.all]].concat(['low','mid','high'].map(function (id) { return [id,c[id]]; })), $('food-budget').value);
    if (data) {
      options('food-region', [['',c.all]].concat(data.regions.map(function (item) { return [item.id,localized(item.name)]; })), $('food-region').value);
      options('food-day', plan ? plan.days.map(function (day,index) { return [String(index),c.day + ' ' + (index + 1) + ' · ' + localized(day.theme)]; }) : [['',c.noPlan]], String(selectedDay));
    }
    $('food-trip-note').textContent = plan ? c.handoff : c.noPlan;
    $('food-diy').hidden = !plan;
    render();
  }
  function persist() {
    plans[route.id] = plan;
    localStorage.setItem('wm_bali_route_plans_v1',JSON.stringify(plans));
    localStorage.setItem('wm_bali_route_draft',JSON.stringify({route_id:route.id,days:plan.days,extension_ids:plan.extension_ids || [],dining_stops:engine.diningStops(plan),updated_at:new Date().toISOString()}));
    var pois = data.pois.concat(catalog.pois || []);
    var text = localized(route.name) + ' (' + route.id + ')\n' + plan.days.map(function (day,index) {
      var names = (day.place_ids || []).map(function (id) { var item = pois.find(function (poi) { return poi.id === id; }); return item && item.name; }).filter(Boolean);
      (day.food_stops || []).forEach(function (stop) { var food = foods.find(function (item) { return item.id === stop.restaurant_id; }); if (food) names.push(copy()[stop.meal] + ': ' + food.name); });
      return copy().day + ' ' + (index + 1) + ' · ' + localized(day.theme) + ' · ' + names.join(' → ');
    }).join('\n');
    localStorage.setItem('wm_studio_lastPlan',JSON.stringify({text:text,source:'bali-route-editor',route_id:route.id}));
  }
  function link(text, url) { var node = element('a',text); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node; }
  function render() {
    if (!data) return;
    var c = copy(), filters = {category:$('food-category').value,price:$('food-budget').value,meal:$('food-meal').value};
    var list = plan ? engine.foodCandidates(plan.days[selectedDay],foods,filters) : foods.filter(function (item) { return item.published && (!filters.category || item.category === filters.category) && (!filters.price || item.priceLevel === filters.price) && (!filters.meal || item.suitableDayparts.indexOf(filters.meal) >= 0); });
    if ($('food-region').value) list = list.filter(function (item) { return item.region === $('food-region').value; });
    $('food-results').replaceChildren();
    $('food-status').textContent = list.length ? c.title + ' · ' + list.length : c.empty;
    list.forEach(function (item) {
      var card = element('article','', 'food-card'); card.dataset.restaurantId = item.id;
      card.appendChild(element('p',item.area + ' · ' + (c[item.category] || c.unknown),'food-area'));
      card.appendChild(element('h2',item.name));
      card.appendChild(element('p',item.address || item.area));
      card.appendChild(element('p',c[item.priceLevel] || c.unknown));
      if (item.referenceSpend) card.appendChild(element('p',c.reference + ': IDR ' + Number(item.referenceSpend).toLocaleString(lang)));
      card.appendChild(element('p',item.suitableDayparts.map(function (meal) { return c[meal]; }).join(' · ')));
      card.appendChild(element('p',(item.lastVerified ? c.checked + ': ' + item.lastVerified : c.research + ': ' + item.researchDate)));
      var links = element('div','', 'food-card-links');
      links.appendChild(link(c.map,'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.name + ', ' + item.area + ', Bali')));
      if (item.source[0] && /^https:\/\//.test(item.source[0].url)) links.appendChild(link(c.source,item.source[0].url));
      card.appendChild(links);
      var matches = (item.routeIds || []).filter(function (id) { return data.routes.some(function (r) { return r.id === id; }); });
      matches.forEach(function (id) { var a = element('a',id); a.href = 'bali.html?route=' + id + '#route-families'; links.appendChild(a); });
      (item.nearbyPOIs || []).forEach(function(id){
        var poi=data.pois.find(function(p){return p.id===id;});
        if(poi)links.appendChild(link(c.near+' · '+localized(poi.name_i18n || poi.localized_name || poi.name),'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(poi.name+', Bali')));
      });
      var button = element('button',plan ? c.add : c.choose); button.type = 'button';
      button.addEventListener('click',function () {
        if (!plan) { location.assign('bali.html?route=' + (matches[0] || 'R1') + '#route-families'); return; }
        try {
          var next = engine.addFood(plan,selectedDay,item,$('food-meal').value || (item.suitableDayparts.indexOf('lunch') >= 0 ? 'lunch' : item.suitableDayparts[0]));
          var previous = plan; plan = next;
          try { persist(); } catch (error) { plan = previous; throw error; }
          card.classList.add('food-added'); $('food-status').textContent = c.saved + ' · ' + item.name;
        } catch (_) { $('food-status').textContent = c.failed; }
      });
      card.appendChild(button); $('food-results').appendChild(card);
    });
  }
  async function load() {
    $('food-retry').hidden = true;
    try {
      var result = await Promise.all(['bali-travel-data','bali-extensions','bali-food'].map(async function (name) { var response = await fetch('assets/data/' + name + '.json?v=20260913p1'); if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }));
      data = result[0]; catalog = result[1]; foods = result[2].restaurants;
      try { plans = JSON.parse(localStorage.getItem('wm_bali_route_plans_v1') || '{}'); } catch (_) { plans = {}; }
      route = data.routes.find(function (item) { return item.id === params.get('route'); });
      if (route) {
        plan = plans[route.id];
        if (!plan || !Array.isArray(plan.days) || !plan.days.length) plan = {route_id:route.id,days:route.free_outline.map(function (day) { return {region_id:day.region_id,theme:day.theme,place_ids:(day.suggested_poi_ids || []).slice()}; })};
        if (!Number.isInteger(selectedDay) || selectedDay < 0 || selectedDay >= plan.days.length) selectedDay = 0;
        $('food-browse').href = 'bali.html?route=' + route.id + '#route-families';
      }
      setCopy();
    } catch (_) { $('food-status').textContent = copy().failed; $('food-retry').hidden = false; }
  }
  $('food-language').addEventListener('change',function () { lang = this.value; localStorage.setItem('wm_studio_lang',lang); setCopy(); });
  ['food-region','food-category','food-budget','food-meal'].forEach(function (id) { $(id).addEventListener('change',render); });
  $('food-day').addEventListener('change',function () { selectedDay = Number(this.value); render(); });
  $('food-retry').addEventListener('click',load); setCopy(); load();
})();
