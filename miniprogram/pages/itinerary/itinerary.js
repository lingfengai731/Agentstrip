// pages/itinerary/itinerary.js — Bali 路线中心
const api = require('../../utils/api.js');
const app = getApp();
const COPY = require('./copy.js');

function localized(value, lang, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.zh || fallback;
}

Page({
  data: { copy: COPY.zh, loading: true, error: '', routes: [], selected: null, professional: null, loggedIn: false },

  onShow() {
    const copy = COPY[app.globalData.currentLang] || COPY.zh;
    this.setData({ copy, loggedIn: !!app.globalData.token });
    wx.setNavigationBarTitle({ title: copy.match });
    app.updateTabBarLanguage();
    this.loadRoutes();
    this.loadProfessionalRoute();
  },

  async loadRoutes() {
    const lang = app.globalData.currentLang || 'zh';
    if (this.data.routes.length && this.routesLang === lang) return;
    this.setData({ loading: true, error: '' });
    try {
      const data = await api.baliRouteData();
      const poiById = {};
      (data.pois || []).forEach(poi => { poiById[poi.id] = poi; });
      const routes = (data.routes || []).map(route => ({
        id: route.id,
        name: localized(route.name, lang, route.id),
        promise: localized(route.promise, lang),
        idealDays: route.recommended_days && route.recommended_days.ideal,
        regionPath: (route.base_regions || []).join(' → '),
        days: (route.free_outline || []).map(day => ({
          day: day.day,
          regionId: day.region_id,
          theme: localized(day.theme, lang),
          places: (day.suggested_poi_ids || []).map(id => {
            const poi = poiById[id] || {};
            return { id, name: localized(poi.name_i18n || poi.localized_name, lang, poi.name || id) };
          }),
        })),
      }));
      if ((app.globalData.currentLang || 'zh') !== lang) return;
      const selectedId = this.data.selected && this.data.selected.id;
      this.routesLang = lang;
      this.setData({ routes, selected: routes.find(route => route.id === selectedId) || routes[0] || null, loading: false });
    } catch (err) {
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
      app.setProfessionalRoute(payload);
      this.setData({ professional: payload });
    } catch (err) {
      if (!cached && !/not_found|404/i.test(err.message || '')) this.setData({ error: err.message });
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
  openPlace(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const routeId = e.currentTarget.dataset.route || (this.data.selected && this.data.selected.id) || '';
    wx.navigateTo({ url: `/pages/place/place?id=${encodeURIComponent(id)}&routeId=${encodeURIComponent(routeId)}` });
  },
  copyUnlockLink() {
    wx.setClipboardData({
      data: 'https://wandermind.cc/bali.html#professional-planner',
      success: () => wx.showToast({ title: this.data.copy.copied, icon: 'success' }),
      fail: () => wx.showToast({ title: this.data.copy.copyFailed, icon: 'none' }),
    });
  },
  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); },
  retry() { this.setData({ routes: [], error: '' }); this.loadRoutes(); },
});
