// pages/itinerary/itinerary.js — Bali 路线中心
const api = require('../../utils/api.js');
const app = getApp();
const COPY = require('./copy.js');
const engine = require('../../utils/bali-itinerary.js');
const FOOD_COPY = require('../../utils/bali-food-copy.js');

function localized(value, lang, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.zh || fallback;
}

Page({
  data: { copy: COPY.zh, loading: true, error: '', routes: [], selected: null, professional: null, loggedIn: false, isBali: true, destinationName: '' },

  onShow() {
    const copy = COPY[app.globalData.currentLang] || COPY.zh;
    const destination = app.globalData.currentDest || 'bali';
    const destinationName = destination === 'custom'
      ? (app.globalData.customDestName || copy.otherDestination)
      : (copy[destination] || destination);
    const isBali = destination === 'bali';
    this.setData({ copy, loggedIn: !!app.globalData.token, isBali, destinationName, professionalError: '' });
    wx.setNavigationBarTitle({ title: copy.match });
    app.updateTabBarLanguage();
    if (!isBali) {
      this.setData({ loading: false, error: '', routes: [], selected: null, professional: null });
      return;
    }
    this.loadRoutes();
    this.loadProfessionalRoute();
  },

  async loadRoutes() {
    const lang = app.globalData.currentLang || 'zh';
    const owner = app.privateStorageKey('wm_public_route_plans');
    this.setData({ loading: true, error: '' });
    try {
      const [data, catalog, food] = await Promise.all([api.baliRouteData(),api.baliExtensions(),api.baliFood()]);
      if (owner !== app.privateStorageKey('wm_public_route_plans') || lang !== (app.globalData.currentLang || 'zh')) return;
      this.owner = owner; this.catalog = catalog; this.plans = wx.getStorageSync(owner) || {};
      const poiById = {};
      (data.pois || []).concat(catalog.pois || []).forEach(poi => { poiById[poi.id] = poi; });
      const foodById = {}; food.restaurants.forEach(item=>{foodById[item.id]=item;});
      const routes = (data.routes || []).map(route => {
        const plan = this.plans[route.id] || {route_id:route.id,days:route.free_outline.map(day=>({region_id:day.region_id,theme:day.theme,place_ids:(day.suggested_poi_ids || []).slice()}))};
        this.plans[route.id] = plan;
        return {
        id: route.id,
        name: localized(route.name, lang, route.id),
        promise: localized(route.promise, lang),
        idealDays: route.recommended_days && route.recommended_days.ideal,
        regionPath: (route.base_regions || []).join(' → '),
        modules: engine.extensions(catalog,route.id).map(item=>({id:item.id,name:localized(item.name,lang),summary:localized(item.summary,lang),selected:(plan.extension_ids || []).includes(item.id)})),
        days: plan.days.map((day,index) => ({
          day: index + 1,
          index,
          regionId: day.region_id,
          theme: localized(day.theme, lang),
          places: (day.place_ids || []).map(id => {
            const poi = poiById[id] || {};
            return { id, name: localized(poi.name_i18n || poi.localized_name, lang, poi.name || id) };
          }),
          food: (day.food_stops || []).map(stop=>({id:stop.restaurant_id,name:(foodById[stop.restaurant_id] || {}).name || '',meal:(FOOD_COPY[lang] || FOOD_COPY.zh)[stop.meal]})),
        })),
      }; });
      if ((app.globalData.currentLang || 'zh') !== lang) return;
      const selectionKey=app.privateStorageKey('wm_bali_route_selection');
      const requestedId=wx.getStorageSync(selectionKey);
      const requestedRoute=routes.find(route=>route.id===requestedId);
      const selectedId = requestedRoute ? requestedRoute.id : this.data.selected && this.data.selected.id;
      this.routesLang = lang;
      this.setData({ routes, selected: routes.find(route => route.id === selectedId) || routes[0] || null, loading: false, foodCopy:FOOD_COPY[lang] || FOOD_COPY.zh });
      if (requestedRoute) wx.removeStorageSync(selectionKey);
    } catch (err) {
      if (owner !== app.privateStorageKey('wm_public_route_plans') || lang !== (app.globalData.currentLang || 'zh')) return;
      this.setData({ loading: false, error: err.message || this.data.copy.failed });
    }
  },

  async loadProfessionalRoute() {
    const token = app.globalData.token;
    if (!token) { this.setData({ professional: null }); return; }
    const cached = app.globalData.professionalRoute;
    this.setData({ professional: cached || null });
    try {
      const payload = await api.recentUnlockedProfessionalRoute(app.globalData.currentLang || 'zh');
      if (app.globalData.token !== token) return;
      if (app.globalData.professionalRoute !== cached) return;
      // Restore only this trip: another paid trip must not replace a new preview.
      if (cached && cached.trip_id && cached.trip_id !== payload.trip_id) return;
      app.setProfessionalRoute(payload);
      this.setData({ professional: payload });
    } catch (err) {
      if (app.globalData.token === token && !app.globalData.professionalRoute && !/not_found|404/i.test(err.message || '')) this.setData({ professionalError: err.message });
    }
  },

  selectRoute(e) {
    const route = this.data.routes.find(item => item.id === e.currentTarget.dataset.id);
    if (route) this.setData({ selected: route });
  },

  openPlanner() {
    if (!app.globalData.token) {
      app.rememberCurrentRoute();
      wx.showModal({
        title: this.data.copy.login, content: this.data.copy.loginCopy,
        confirmText: this.data.copy.ok, showCancel: false, success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return;
    }
    const routeId = this.data.selected ? this.data.selected.id : '';
    wx.navigateTo({ url: `/pages/planner/planner?routeId=${routeId}` });
  },

  openDriver() { if (this.data.professional) wx.navigateTo({ url: '/pages/driver/driver' }); },
  openGallery() { wx.navigateTo({ url: '/pages/gallery/gallery' }); },
  openFood(e) { wx.navigateTo({url:'/pages/food/food?routeId='+this.data.selected.id+'&day='+e.currentTarget.dataset.day}); },
  toggleExtension(e) {
    if (this.owner !== app.privateStorageKey('wm_public_route_plans') || !this.data.selected) return;
    const routeId = this.data.selected.id, id=e.currentTarget.dataset.id, plan=this.plans[routeId];
    try {
      const next = (plan.extension_ids || []).includes(id) ? engine.remove(plan,id) : engine.append(plan,this.catalog,id);
      const plans={...this.plans,[routeId]:next}; wx.setStorageSync(this.owner,plans); this.plans=plans; this.loadRoutes();
    } catch (_) { wx.showToast({title:this.data.foodCopy.failed,icon:'none'}); }
  },
  retryProfessional() { this.setData({professionalError:''}); this.loadProfessionalRoute(); },
  openPlace(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const routeId = e.currentTarget.dataset.route || (this.data.selected && this.data.selected.id) || '';
    wx.navigateTo({ url: `/pages/place/place?id=${encodeURIComponent(id)}&routeId=${encodeURIComponent(routeId)}` });
  },
  copyUnlockLink() {
    const routeId = (this.data.professional && this.data.professional.route && this.data.professional.route.route_id)
      || (this.data.selected && this.data.selected.id) || '';
    const query = `route=${encodeURIComponent(routeId)}&lang=${encodeURIComponent(app.globalData.currentLang || 'zh')}&source=miniprogram`;
    wx.setClipboardData({
      data: `https://wandermind.cc/bali.html?${query}#professional-planner`,
      success: () => wx.showToast({ title: this.data.copy.copied, icon: 'success' }),
      fail: () => wx.showToast({ title: this.data.copy.copyFailed, icon: 'none' }),
    });
  },
  chooseBali() {
    app.setDest('bali');
    this.onShow();
  },
  goChat() {
    if (this.data.selected && this.owner === app.privateStorageKey('wm_public_route_plans')) {
      const route=this.data.selected;
      const text=route.id+' · '+route.name+'\n'+route.days.map(day=>
        this.data.foodCopy.day+' '+day.day+' · '+day.theme+'\n'+day.places.map(place=>place.name).join(' → ')+
        (day.food.length ? '\n'+day.food.map(stop=>stop.meal+' · '+stop.name).join('\n') : '')
      ).join('\n\n');
      try { wx.setStorageSync(app.privateStorageKey('wm_itinerary_context'),{destination:'bali',text}); }
      catch (_) { wx.showToast({title:this.data.foodCopy.failed,icon:'none'}); return; }
    }
    wx.switchTab({ url: '/pages/chat/chat' });
  },
  retry() { this.setData({ routes: [], error: '' }); this.loadRoutes(); },
});
