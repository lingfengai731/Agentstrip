// pages/itinerary/itinerary.js — Bali 路线中心
const api = require('../../utils/api.js');
const app = getApp();

function localized(value, lang, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.zh || fallback;
}

Page({
  data: { loading: true, error: '', routes: [], selected: null, professional: null, loggedIn: false },

  onShow() {
    this.setData({ loggedIn: !!app.globalData.token });
    this.loadRoutes();
    this.loadProfessionalRoute();
  },

  async loadRoutes() {
    if (this.data.routes.length) return;
    this.setData({ loading: true, error: '' });
    try {
      const data = await api.baliRouteData();
      const lang = app.globalData.currentLang || 'zh';
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
      this.setData({ routes, selected: routes[0] || null, loading: false });
    } catch (err) {
      this.setData({ loading: false, error: err.message || '路线加载失败' });
    }
  },

  async loadProfessionalRoute() {
    const cached = app.globalData.professionalRoute;
    if (cached) this.setData({ professional: cached });
    if (!app.globalData.token) return;
    try {
      const payload = await api.recentUnlockedProfessionalRoute(app.globalData.currentLang || 'zh');
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
        title: '请先登录', content: '登录后可保存预览，并在网页与小程序间恢复路线。',
        showCancel: false, success: () => wx.switchTab({ url: '/pages/index/index' }),
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
      success: () => wx.showToast({ title: '解锁链接已复制', icon: 'success' }),
    });
  },
  goChat() { wx.switchTab({ url: '/pages/chat/chat' }); },
  retry() { this.setData({ routes: [], error: '' }); this.loadRoutes(); },
});
