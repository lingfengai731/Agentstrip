const api = require('../../utils/api.js');
const COPY = require('./copy.js');
const app = getApp();
const itinerary = require('../../utils/bali-itinerary.js');
const FOOD_COPY = require('../../utils/bali-food-copy.js');

function isoDate(offset) {
  const date = new Date(Date.now() + offset * 86400000);
  return date.toISOString().slice(0, 10);
}

Page({
  data: {
    copy: COPY.zh,
    routeId: '', audience: 'first', travellers: 2,
    departureDate: '', returnDate: '', days: 7,
    budgetOptions: ['6000-10000', '10000-20000', '20000-35000', '35000+'],
    budgetIndex: 1, travelStyle: 'comfort', pace: 'balanced',
    goalOptions: [
      { id: 'local', label: '在地文化', selected: true }, { id: 'photo', label: '自然摄影', selected: true },
      { id: 'hidden', label: '小众路线', selected: false }, { id: 'easy', label: '少做攻略', selected: false },
      { id: 'value', label: '控制预算', selected: false },
    ],
    goals: ['local', 'photo'], busy: false, error: '',
  },

  onShow() {
    const copy = COPY[app.globalData.currentLang] || COPY.zh;
    this.setData({ copy, error: '', goalOptions: this.data.goalOptions.map(item => ({ ...item, label: copy[item.id] })) });
    wx.setNavigationBarTitle({ title: copy.submit });
  },

  onLoad(query) {
    const user = app.globalData.user;
    this.draftKey = user && user.id != null ? `wm_planner_draft_${user.id}` : '';
    const draft = this.draftKey ? wx.getStorageSync(this.draftKey) : null;
    const restored = {};
    if (draft && typeof draft === 'object') {
      ['audience', 'travellers', 'departureDate', 'returnDate', 'budgetIndex', 'travelStyle', 'pace', 'goals'].forEach(key => {
        if (draft[key] !== undefined) restored[key] = draft[key];
      });
    }
    this.setData({ departureDate: isoDate(30), returnDate: isoDate(37), ...restored,
      routeId: query.routeId || (draft && draft.routeId) || '' });
    this.setData({ goalOptions: this.data.goalOptions.map(item => ({ ...item, selected: this.data.goals.includes(item.id) })) });
    this.updateDays();
  },
  saveDraft() {
    if (!this.draftKey) return;
    const draft = {};
    ['routeId', 'audience', 'travellers', 'departureDate', 'returnDate', 'budgetIndex', 'travelStyle', 'pace', 'goals'].forEach(key => {
      draft[key] = this.data[key];
    });
    wx.setStorageSync(this.draftKey, draft);
  },
  setChoice(e) { this.setData({ [e.currentTarget.dataset.field]: e.currentTarget.dataset.value, error: '' }); this.saveDraft(); },
  changePeople(e) { this.setData({ travellers: Math.max(1, Math.min(8, this.data.travellers + Number(e.currentTarget.dataset.delta))) }); this.saveDraft(); },
  onDeparture(e) { this.setData({ departureDate: e.detail.value }); this.updateDays(); },
  onReturn(e) { this.setData({ returnDate: e.detail.value }); this.updateDays(); },
  onBudget(e) { this.setData({ budgetIndex: Number(e.detail.value) }); this.saveDraft(); },
  updateDays() {
    const start = new Date(this.data.departureDate + 'T00:00:00');
    const end = new Date(this.data.returnDate + 'T00:00:00');
    const days = Math.round((end - start) / 86400000);
    this.setData({ days: Number.isFinite(days) && days > 0 ? days : 0 });
    this.saveDraft();
  },
  toggleGoal(e) {
    const id = e.currentTarget.dataset.id;
    const goals = this.data.goals.slice();
    const index = goals.indexOf(id);
    if (index >= 0) goals.splice(index, 1);
    else if (goals.length < 3) goals.push(id);
    else { wx.showToast({ title: this.data.copy.limit, icon: 'none' }); return; }
    this.setData({
      goals,
      goalOptions: this.data.goalOptions.map(item => ({ ...item, selected: goals.includes(item.id) })),
    });
    this.saveDraft();
  },

  async submit() {
    if (this.data.busy) return;
    const owner = app.privateStorageKey('wm_public_route_plans');
    const isCurrent = () => owner === app.privateStorageKey('wm_public_route_plans');
    this.updateDays();
    if (!this.data.departureDate || !this.data.returnDate || this.data.days < 1) {
      this.setData({ error: this.data.copy.invalidDates }); return;
    }
    if (!this.data.goals.length) { this.setData({ error: this.data.copy.noGoals }); return; }
    const profile = {
      audience: this.data.audience, travellers: this.data.travellers,
      departure_date: this.data.departureDate, return_date: this.data.returnDate,
      days: this.data.days, budget_range: this.data.budgetOptions[this.data.budgetIndex],
      travel_style: this.data.travelStyle, pace: this.data.pace, goals: this.data.goals,
    };
    const plans = wx.getStorageSync(app.privateStorageKey('wm_public_route_plans')) || {};
    const routePlan = plans[this.data.routeId];
    if (routePlan) {
      profile.extension_ids = routePlan.extension_ids || [];
      profile.dining_stops = itinerary.diningStops(routePlan);
    }
    this.setData({ busy: true, error: '' });
    try {
      if (routePlan && profile.dining_stops.length) {
        const [travel,catalog,food]=await Promise.all([api.baliRouteData(),api.baliExtensions(),api.baliFood()]);
        if (!isCurrent()) return;
        const route=travel.routes.find(item=>item.id===this.data.routeId);
        const fitted=itinerary.fitDining(routePlan,route,catalog,profile.days);
        const copy=FOOD_COPY[app.globalData.currentLang] || FOOD_COPY.zh;
        if (fitted.unplaced.length) { this.setData({error:copy.unplacedDining}); return; }
        if (fitted.moved.length) {
          const approved=await new Promise(resolve=>wx.showModal({title:this.data.copy.title,content:copy.reviewDining+'\n'+fitted.moved.map(item=>{
            const restaurant=food.restaurants.find(entry=>entry.id===item.restaurant_id);
            return (restaurant ? restaurant.name : copy.title)+': '+item.from+' → '+item.to;
          }).join('\n'),success:result=>resolve(result.confirm),fail:()=>resolve(false)}));
          if (!approved || !isCurrent()) return;
        }
        profile.dining_stops=fitted.stops;
      }
      const payload = await api.createProfessionalRoute(profile, this.data.routeId, app.globalData.currentLang || 'zh');
      if (!isCurrent()) return;
      app.setProfessionalRoute(payload);
      wx.showToast({ title: this.data.copy.success, icon: 'success' });
      setTimeout(() => { if (isCurrent()) wx.navigateBack({ delta: 1 }); }, 500);
    } catch (err) { if (isCurrent()) this.setData({ error: err.message || this.data.copy.failed }); }
    finally { if (isCurrent()) this.setData({ busy: false }); }
  },
});
