// pages/prefs/prefs.js — 旅行偏好编辑
const api = require('../../utils/api.js');
const app = getApp();

const BUDGET_OPTIONS = [
  { value: 'budget',   label: '经济实惠' },
  { value: 'midrange', label: '标准舒适' },
  { value: 'luxury',   label: '豪华享受' },
];
const STYLE_OPTIONS = [
  { value: 'culture',   label: '文化历史' },
  { value: 'food',      label: '美食探索' },
  { value: 'adventure', label: '冒险户外' },
  { value: 'relax',     label: '悠闲放松' },
  { value: 'nature',    label: '自然风光' },
  { value: 'wellness',  label: '养生健康' },
];
const PARTY_OPTIONS = [
  { value: 'solo',   label: '独自旅行' },
  { value: 'couple', label: '情侣出行' },
  { value: 'family', label: '家庭亲子' },
  { value: 'group',  label: '朋友/团体' },
];

Page({
  data: {
    budgetOptions: BUDGET_OPTIONS,
    styleOptions:  STYLE_OPTIONS,
    partyOptions:  PARTY_OPTIONS,
    // 当前选中
    budgetLevel: '',
    styleList:   [],
    party:       '',
    notes:       '',
    busy: false,
    hasAny: false,
  },

  onLoad() {
    // 先从本地恢复（即时反馈），再从后端拉一次（保证多端同步）
    const cached = app.globalData.preferences || {};
    this.setData({
      budgetLevel: cached.budgetLevel || '',
      styleList:   Array.isArray(cached.styleList) ? cached.styleList : [],
      party:       cached.party || '',
      notes:       cached.notes || '',
      hasAny:      this._hasAny(cached),
    });
    this._loadFromServer();
  },

  async _loadFromServer() {
    if (!app.globalData.token) return;
    try {
      const p = await api.getPrefs();
      app.setPrefs(p || {});
      this.setData({
        budgetLevel: p.budgetLevel || '',
        styleList:   Array.isArray(p.styleList) ? p.styleList : [],
        party:       p.party || '',
        notes:       p.notes || '',
        hasAny:      this._hasAny(p),
      });
    } catch (e) { /* 静默失败，本地版本还在用 */ }
  },

  _hasAny(p) {
    if (!p) return false;
    return !!(p.budgetLevel || p.party || (p.notes && p.notes.trim())
      || (Array.isArray(p.styleList) && p.styleList.length > 0));
  },

  // —— 单选：预算 ——
  selectBudget(e) {
    const v = e.currentTarget.dataset.value;
    // 再点一次取消选中
    this.setData({ budgetLevel: this.data.budgetLevel === v ? '' : v });
  },

  // —— 多选：风格 ——
  toggleStyle(e) {
    const v = e.currentTarget.dataset.value;
    const list = this.data.styleList.slice();
    const idx = list.indexOf(v);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(v);
    this.setData({ styleList: list });
  },

  // —— 单选：同行 ——
  selectParty(e) {
    const v = e.currentTarget.dataset.value;
    this.setData({ party: this.data.party === v ? '' : v });
  },

  // —— 备注 ——
  onNotesChange(e) {
    this.setData({ notes: e.detail.value });
  },

  // —— 保存 ——
  async savePrefs() {
    if (!app.globalData.token) {
      wx.showModal({
        title: '请先登录',
        content: '需要登录后才能保存偏好',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return;
    }
    const prefs = {
      budgetLevel: this.data.budgetLevel,
      styleList:   this.data.styleList,
      party:       this.data.party,
      notes:       (this.data.notes || '').trim(),
    };
    this.setData({ busy: true });
    try {
      await api.savePrefs(prefs);
      app.setPrefs(prefs);
      this.setData({ hasAny: this._hasAny(prefs) });
      wx.showToast({ title: '已保存！AI 将更懂你', icon: 'success' });
      // 短暂延迟后返回上一页
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1200);
    } catch (err) {
      wx.showModal({ title: '保存失败', content: err.message, showCancel: false });
    } finally {
      this.setData({ busy: false });
    }
  },

  clearPrefs() {
    wx.showModal({
      title: '清除偏好',
      content: '确定清除所有旅行偏好吗？AI 将回到通用模式。',
      success: async (res) => {
        if (!res.confirm) return;
        const empty = { budgetLevel: '', styleList: [], party: '', notes: '' };
        this.setData(empty);
        try {
          if (app.globalData.token) await api.savePrefs(empty);
        } catch (e) { /* ignore */ }
        app.setPrefs(empty);
        this.setData({ hasAny: false });
        wx.showToast({ title: '已清除', icon: 'none' });
      }
    });
  },
});
