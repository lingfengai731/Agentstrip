const api = require('../../utils/api.js');
const driverEstimate = require('../../utils/driver-estimate.js');
const COPY = require('./copy.js');
const app = getApp();

function currentCopy() {
  return COPY[app.globalData.currentLang] || COPY.zh;
}

function fill(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (
    values[key] == null ? '' : String(values[key])
  ));
}

function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : ((value & 3) | 8)).toString(16);
  });
}

function routeSummary(payload, copy = COPY.zh) {
  const route = payload && payload.route;
  if (!route) return { routeId: '', attractions: '', startDate: '', endDate: '', people: 2, days: 0, budget: '' };
  const profile = payload.profile || route.trip_profile || payload.trip_profile || {};
  const attractions = (route.days_plan || []).map(day => {
    const names = (day.places || []).concat(day.restaurants || []).map(place => place.name).filter(Boolean).join(copy.routeSeparator);
    return fill(copy.routeDay, { day: day.day }) + (names || day.theme || day.region_name || '');
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
  { value: 'full_day', copyKey: 'fullDayService' },
  { value: 'half_day', copyKey: 'halfDayService' },
  { value: 'airport_transfer', copyKey: 'airportTransferService' },
  { value: 'penida', copyKey: 'penidaService' },
];

const serviceOptions = (values, copy = COPY.zh) =>
  SERVICES.map(item => ({
    value: item.value,
    label: copy[item.copyKey],
    checked: (values || []).includes(item.value),
  }));

function dateLabel(timestamp) {
  const value = Number(timestamp || 0);
  if (!value) return '';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function statusLabel(status, copy = COPY.zh) {
  const key = ({
    pending: 'statusPending',
    sent: 'statusSent',
    replied: 'statusReplied',
    failed: 'statusFailed',
  })[status] || 'statusPending';
  return copy[key] || COPY.zh[key];
}



function viewRequest(item, copy = COPY.zh) {
  return {
    ...item,
    statusLabel: statusLabel(item.status, copy),
    dateLabel: dateLabel(item.created_at),
    replyDateLabel: item.reply ? dateLabel(item.reply.created_at) : '',
    tripLabel: item.start_date && item.end_date
      ? `${item.start_date} → ${item.end_date}`
      : (item.num_days ? fill(copy.tripDays, { days: item.num_days }) : copy.missingTripDate),
  };
}

Page({
  data: {
    copy: COPY.zh,
    driverId: 'dicky',
    firstName: '', lastName: '', email: '',
    startDate: '', endDate: '', people: 2, days: 0,
    peopleOptions: [1, 2, 3, 4, 5, 6],
    dayOptions: Array.from({ length: 15 }, (_, index) => index),
    fullDays: 0, halfDays: 0,
    estimate: driverEstimate.calculate(),
    pickup: '', budget: '', intro: '', attractions: '',
    services: ['full_day'], privacyConsent: false,
    serviceOptions: serviceOptions(['full_day'], COPY.zh),
    routeId: '', busy: false, error: '', sent: false,
    requests: [], loadingRequests: false, requestsError: '',
  },

  onLoad() {
    this._sessionToken=app.globalData.token;
    const copy = currentCopy();
    const route = routeSummary(app.globalData.professionalRoute, copy);
    const saved = wx.getStorageSync(app.privateStorageKey('wm_driver_draft')) || {};
    const user = app.globalData.user || {};
    const services = saved.services || ['full_day'];
    const fullDays = saved.fullDays == null
      ? (services.includes('full_day') ? Math.max(1, route.days || 1) : 0)
      : Number(saved.fullDays);
    const halfDays = saved.halfDays == null ? 0 : Number(saved.halfDays);
    const next = {
      ...route,
      ...saved,
      copy,
      services,
      serviceOptions: serviceOptions(services, copy),
      firstName: saved.firstName || user.name || '',
      email: saved.email || user.email || '',
      fullDays,
      halfDays,
    };
    next.estimate = driverEstimate.calculate(next, copy);
    next.fullDays = next.estimate.fullDays;
    next.halfDays = next.estimate.halfDays;
    this.setData(next);
  },

  onShow() {
    if(this._sessionToken!==app.globalData.token) {
      this.setData({firstName:'',lastName:'',email:'',startDate:'',endDate:'',pickup:'',budget:'',intro:'',attractions:'',routeId:'',requests:[],sent:false,busy:false,error:'',privacyConsent:false});
      this.onLoad();
    }
    const copy = currentCopy();
    this.setData({
      copy,
      serviceOptions: serviceOptions(this.data.services, copy),
      estimate: driverEstimate.calculate(this.data, copy),
      requests: this.data.requests.map(item => viewRequest(item, copy)),
    });
    wx.setNavigationBarTitle({ title: copy.title });
    this.loadRequests();
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value, error: '' }, () => this.saveDraft());
  },
  selectDriver(e) { this.setData({ driverId: e.currentTarget.dataset.id, error: '' }, () => this.saveDraft()); },
  setStart(e) { this.setData({ startDate: e.detail.value, error: '' }, () => this.saveDraft()); },
  setEnd(e) { this.setData({ endDate: e.detail.value, error: '' }, () => this.saveDraft()); },
  setPeople(e) { this.setData({ people: Number(e.detail.value) + 1 }, () => this.refreshEstimate()); },
  setFullDays(e) { this.setData({ fullDays: Number(e.detail.value) }, () => this.refreshEstimate()); },
  setHalfDays(e) { this.setData({ halfDays: Number(e.detail.value) }, () => this.refreshEstimate()); },
  setServices(e) {
    const services = e.detail.value;
    this.setData({ services, serviceOptions: serviceOptions(services, this.data.copy) }, () => this.refreshEstimate());
  },
  setConsent(e) { this.setData({ privacyConsent: e.detail.value.includes('yes'), error: '' }, () => this.saveDraft()); },

  saveDraft() {
    const draft = {
      driverId: this.data.driverId,
      firstName: this.data.firstName,
      lastName: this.data.lastName,
      email: this.data.email,
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      people: this.data.people,
      days: this.data.days,
      fullDays: this.data.fullDays,
      halfDays: this.data.halfDays,
      pickup: this.data.pickup,
      budget: this.data.budget,
      intro: this.data.intro,
      attractions: this.data.attractions,
      services: this.data.services,
      privacyConsent: this.data.privacyConsent,
      routeId: this.data.routeId,
    };
    wx.setStorageSync(app.privateStorageKey('wm_driver_draft'), draft);
  },

  refreshEstimate() {
    this.setData({ estimate: driverEstimate.calculate(this.data, this.data.copy) }, () => this.saveDraft());
  },

  back() { wx.navigateBack({ delta: 1 }); },

  async loadRequests() {
    const token=app.globalData.token;
    if (!app.globalData.token) {
      this.setData({ requests: [], loadingRequests: false, requestsError: '' });
      return;
    }
    this.setData({ loadingRequests: true, requestsError: '' });
    try {
      const result = await api.listDriverRequests();
      if(app.globalData.token!==token) return;
      const requests = (result && Array.isArray(result.requests) ? result.requests : [])
        .map(item => viewRequest(item, this.data.copy || COPY.zh));
      this.setData({ requests, loadingRequests: false });
    } catch (err) {
      if(app.globalData.token!==token) return;
      this.setData({ loadingRequests: false, requestsError: err.message || this.data.copy.loadRequestsFailed });
    }
  },

  async submit() {
    const token=app.globalData.token;
    if (this.data.busy) return;
    const copy = this.data.copy || COPY.zh;
    const name = `${this.data.firstName} ${this.data.lastName}`.trim();
    if (!name) { this.setData({ error: copy.nameRequired }); return; }
    const email = this.data.email.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { this.setData({ error: copy.emailInvalid }); return; }
    if (!email && !app.globalData.token) {
      this.setData({ error: copy.guestEmailRequired });
      return;
    }
    if (!this.data.startDate || !this.data.endDate || this.data.endDate < this.data.startDate) {
      this.setData({ error: copy.dateInvalid }); return;
    }
    if (!this.data.pickup.trim()) { this.setData({ error: copy.pickupRequired }); return; }
    if (!this.data.privacyConsent) { this.setData({ error: copy.consentRequired }); return; }

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
      if(app.globalData.token!==token) return;
    } catch (err) {
      if(app.globalData.token!==token) return;
      this.saveDraft();
      this.setData({ busy: false, error: err.message || copy.safetyUnavailable });
      return;
    }

    let stableId = wx.getStorageSync(app.privateStorageKey('wm_driver_request_id'));
    if (!stableId) {
      stableId = requestId();
      wx.setStorageSync(app.privateStorageKey('wm_driver_request_id'), stableId);
    }
    try {
      const requestedServices = this.data.services.slice();
      if (this.data.fullDays) requestedServices.push(`Full-day driver × ${this.data.fullDays}`);
      if (this.data.halfDays) requestedServices.push(`Half-day driver × ${this.data.halfDays}`);
      if (this.data.estimate.total) requestedServices.push(`Starting driver estimate: IDR ${this.data.estimate.total.toLocaleString('en-US')}`);
      await api.sendDriverRequest({
        request_id: stableId,
        driver_id: this.data.driverId,
        route_id: this.data.routeId,
        first_name: this.data.firstName.trim(),
        last_name: this.data.lastName.trim(),
        intro: this.data.intro.trim(),
        contact_email: email,
        num_people: this.data.people,
        num_days: this.data.days || null,
        attractions: this.data.attractions.trim(),
        start_date: this.data.startDate,
        end_date: this.data.endDate,
        pickup_location: this.data.pickup.trim(),
        budget_range: this.data.budget.trim(),
        requested_services: requestedServices,
        lang: app.globalData.currentLang || 'zh',
        privacy_consent: true,
        website: '',
      });
      if(app.globalData.token!==token) return;
      wx.removeStorageSync(app.privateStorageKey('wm_driver_draft'));
      wx.removeStorageSync(app.privateStorageKey('wm_driver_request_id'));
      this.setData({ sent: true });
      this.loadRequests();
    } catch (err) {
      if(app.globalData.token!==token) return;
      this.saveDraft();
      this.setData({ error: err.message || copy.sendFailed });
    } finally {
      if(app.globalData.token===token) this.setData({ busy: false });
    }
  },
});
