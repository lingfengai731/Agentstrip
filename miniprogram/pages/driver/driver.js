const api = require('../../utils/api.js');
const app = getApp();

function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : ((value & 3) | 8)).toString(16);
  });
}

function routeSummary(payload) {
  const route = payload && payload.route;
  if (!route) return { routeId: '', attractions: '', startDate: '', endDate: '', people: 2, days: 0, budget: '' };
  const profile = payload.profile || route.trip_profile || payload.trip_profile || {};
  const attractions = (route.days_plan || []).map(day => {
    const names = (day.places || []).map(place => place.name).filter(Boolean).join('、');
    return `第 ${day.day} 天：${names || day.theme || day.region_name || ''}`;
  }).filter(Boolean).join('\n');
  return {
    routeId: route.route_id || '',
    attractions,
    startDate: profile.departure_date || '',
    endDate: profile.return_date || '',
    people: Number(profile.travellers) || 2,
    days: Number(profile.days) || 0,
    budget: profile.budget_range == null ? '' : String(profile.budget_range),
  };
}

const SERVICES = [
  { value: 'full_day', label: '全天包车' },
  { value: 'half_day', label: '半天包车' },
  { value: 'airport_transfer', label: '机场接送' },
  { value: 'penida', label: '佩妮达行程' },
];

const serviceOptions = values =>
  SERVICES.map(item => ({ ...item, checked: (values || []).includes(item.value) }));

Page({
  data: {
    driverId: 'dicky',
    firstName: '', lastName: '', email: '',
    startDate: '', endDate: '', people: 2, days: 0,
    peopleOptions: [1, 2, 3, 4, 5, 6],
    pickup: '', budget: '', intro: '', attractions: '',
    services: ['full_day'], privacyConsent: false,
    serviceOptions: serviceOptions(['full_day']),
    routeId: '', busy: false, error: '', sent: false,
  },

  onLoad() {
    const route = routeSummary(app.globalData.professionalRoute);
    const saved = wx.getStorageSync('wm_driver_draft') || {};
    const user = app.globalData.user || {};
    const services = saved.services || ['full_day'];
    this.setData({
      ...route,
      ...saved,
      services,
      serviceOptions: serviceOptions(services),
      firstName: saved.firstName || user.name || '',
      email: saved.email || user.email || '',
    });
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value, error: '' }, () => this.saveDraft());
  },
  selectDriver(e) { this.setData({ driverId: e.currentTarget.dataset.id, error: '' }, () => this.saveDraft()); },
  setStart(e) { this.setData({ startDate: e.detail.value, error: '' }, () => this.saveDraft()); },
  setEnd(e) { this.setData({ endDate: e.detail.value, error: '' }, () => this.saveDraft()); },
  setPeople(e) { this.setData({ people: Number(e.detail.value) + 1 }, () => this.saveDraft()); },
  setServices(e) {
    const services = e.detail.value;
    this.setData({ services, serviceOptions: serviceOptions(services) }, () => this.saveDraft());
  },
  setConsent(e) { this.setData({ privacyConsent: e.detail.value.includes('yes'), error: '' }, () => this.saveDraft()); },

  saveDraft() {
    const { busy, error, sent, ...draft } = this.data;
    wx.setStorageSync('wm_driver_draft', draft);
  },

  back() { wx.navigateBack({ delta: 1 }); },

  async submit() {
    if (this.data.busy) return;
    const name = `${this.data.firstName} ${this.data.lastName}`.trim();
    if (!name) { this.setData({ error: '请填写姓名' }); return; }
    if (!/^\S+@\S+\.\S+$/.test(this.data.email.trim())) { this.setData({ error: '请填写有效邮箱' }); return; }
    if (!this.data.startDate || !this.data.endDate || this.data.endDate < this.data.startDate) {
      this.setData({ error: '请选择正确的旅行日期' }); return;
    }
    if (!this.data.pickup.trim()) { this.setData({ error: '请填写接送地点或酒店区域' }); return; }
    if (!this.data.privacyConsent) { this.setData({ error: '请确认由 WanderMind 转交申请' }); return; }

    const contentForSafetyCheck = [
      this.data.firstName,
      this.data.lastName,
      this.data.intro,
      this.data.pickup,
      this.data.budget,
      this.data.attractions,
    ].map(value => (value || '').trim()).filter(Boolean).join('\n');
    this.setData({ busy: true, error: '' });
    try {
      await api.checkUserContent(contentForSafetyCheck, 2);
    } catch (err) {
      this.saveDraft();
      this.setData({ busy: false, error: err.message || '内容安全校验暂不可用，请稍后重试' });
      return;
    }

    let stableId = wx.getStorageSync('wm_driver_request_id');
    if (!stableId) {
      stableId = requestId();
      wx.setStorageSync('wm_driver_request_id', stableId);
    }
    try {
      await api.sendDriverRequest({
        request_id: stableId,
        driver_id: this.data.driverId,
        route_id: this.data.routeId,
        first_name: this.data.firstName.trim(),
        last_name: this.data.lastName.trim(),
        intro: this.data.intro.trim(),
        contact_email: this.data.email.trim(),
        num_people: this.data.people,
        num_days: this.data.days || null,
        attractions: this.data.attractions.trim(),
        start_date: this.data.startDate,
        end_date: this.data.endDate,
        pickup_location: this.data.pickup.trim(),
        budget_range: this.data.budget.trim(),
        requested_services: this.data.services,
        lang: app.globalData.currentLang || 'zh',
        privacy_consent: true,
        website: '',
      });
      wx.removeStorageSync('wm_driver_draft');
      wx.removeStorageSync('wm_driver_request_id');
      this.setData({ sent: true });
    } catch (err) {
      this.saveDraft();
      this.setData({ error: err.message || '发送失败；内容已保留，请重试' });
    } finally {
      this.setData({ busy: false });
    }
  },
});
