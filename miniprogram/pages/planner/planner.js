const api = require('../../utils/api.js');
const app = getApp();

function isoDate(offset) {
  const date = new Date(Date.now() + offset * 86400000);
  return date.toISOString().slice(0, 10);
}

Page({
  data: {
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

  onLoad(query) {
    this.setData({ routeId: query.routeId || '', departureDate: isoDate(30), returnDate: isoDate(37) });
  },
  setChoice(e) { this.setData({ [e.currentTarget.dataset.field]: e.currentTarget.dataset.value, error: '' }); },
  changePeople(e) { this.setData({ travellers: Math.max(1, Math.min(8, this.data.travellers + Number(e.currentTarget.dataset.delta))) }); },
  onDeparture(e) { this.setData({ departureDate: e.detail.value }); this.updateDays(); },
  onReturn(e) { this.setData({ returnDate: e.detail.value }); this.updateDays(); },
  onBudget(e) { this.setData({ budgetIndex: Number(e.detail.value) }); },
  updateDays() {
    const start = new Date(this.data.departureDate + 'T00:00:00');
    const end = new Date(this.data.returnDate + 'T00:00:00');
    const days = Math.round((end - start) / 86400000);
    if (days > 0) this.setData({ days });
  },
  toggleGoal(e) {
    const id = e.currentTarget.dataset.id;
    const goals = this.data.goals.slice();
    const index = goals.indexOf(id);
    if (index >= 0) goals.splice(index, 1);
    else if (goals.length < 3) goals.push(id);
    else { wx.showToast({ title: '最多选择 3 项', icon: 'none' }); return; }
    this.setData({
      goals,
      goalOptions: this.data.goalOptions.map(item => ({ ...item, selected: goals.includes(item.id) })),
    });
  },

  async submit() {
    if (this.data.busy) return;
    if (!this.data.departureDate || !this.data.returnDate || this.data.days < 1) {
      this.setData({ error: '请选择正确的出发与返程日期' }); return;
    }
    if (!this.data.goals.length) { this.setData({ error: '请至少选择一个关注点' }); return; }
    const profile = {
      audience: this.data.audience, travellers: this.data.travellers,
      departure_date: this.data.departureDate, return_date: this.data.returnDate,
      days: this.data.days, budget_range: this.data.budgetOptions[this.data.budgetIndex],
      travel_style: this.data.travelStyle, pace: this.data.pace, goals: this.data.goals,
    };
    this.setData({ busy: true, error: '' });
    try {
      const payload = await api.createProfessionalRoute(profile, this.data.routeId, app.globalData.currentLang || 'zh');
      app.setProfessionalRoute(payload);
      wx.showToast({ title: '路线已匹配', icon: 'success' });
      setTimeout(() => wx.navigateBack({ delta: 1 }), 500);
    } catch (err) { this.setData({ error: err.message || '匹配失败，请重试' }); }
    finally { this.setData({ busy: false }); }
  },
});
