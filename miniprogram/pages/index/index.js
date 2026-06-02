// pages/index/index.js
const api = require('../../utils/api.js');
const { DESTINATIONS } = require('../../utils/const.js');

const app = getApp();

Page({
  data: {
    loggedIn: false,
    user: null,
    // 认证表单
    authMode: 'login',     // 'login' | 'register'
    email: '',
    password: '',
    regName: '',
    authBusy: false,
    authError: '',
    // 目的地
    destinations: DESTINATIONS,
    currentDest: 'bali',
  },

  onLoad() {
    this._refreshAuthState();
  },

  onShow() {
    this._refreshAuthState();
  },

  _refreshAuthState() {
    const token = app.globalData.token;
    const user  = app.globalData.user;
    this.setData({
      loggedIn: !!token,
      user: user || null,
      currentDest: app.globalData.currentDest,
    });
  },

  // —— 表单输入 ——
  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value, authError: '' });
  },

  switchAuth(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ authMode: mode, authError: '' });
  },

  // —— 登录 / 注册 ——
  async doAuth() {
    const { authMode, email, password, regName } = this.data;
    if (!email || !password) {
      this.setData({ authError: '请填写邮箱和密码' });
      return;
    }
    if (password.length < 6) {
      this.setData({ authError: '密码至少 6 位' });
      return;
    }
    if (authMode === 'register' && !regName) {
      this.setData({ authError: '请填写昵称' });
      return;
    }
    this.setData({ authBusy: true, authError: '' });
    try {
      const fn = authMode === 'login' ? api.login(email, password) : api.register(email, password, regName);
      const res = await fn;
      app.setToken(res.token, res.user);
      wx.showToast({ title: authMode === 'login' ? '欢迎回来' : '注册成功', icon: 'success' });
      this.setData({ loggedIn: true, user: res.user, password: '' });
    } catch (err) {
      this.setData({ authError: err.message || '操作失败' });
    } finally {
      this.setData({ authBusy: false });
    }
  },

  // —— 退出 ——
  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearAuth();
          this.setData({ loggedIn: false, user: null, password: '', email: '' });
        }
      }
    });
  },

  // —— 选择目的地 ——
  selectDest(e) {
    const id = e.currentTarget.dataset.id;
    app.setDest(id);
    this.setData({ currentDest: id });
    wx.showToast({ title: `已切换到 ${DESTINATIONS.find(d => d.id === id)?.name}`, icon: 'none' });
  },

  customDest() {
    wx.showModal({
      title: '输入目的地',
      placeholderText: '如：东京、纽约、首尔…',
      editable: true,
      success: (res) => {
        if (res.confirm && res.content) {
          const city = res.content.trim();
          if (city) {
            // 把"custom" 注册为当前目的地，名字保存在 globalData
            app.globalData.customDestName = city;
            app.setDest('custom');
            this.setData({ currentDest: 'custom' });
            wx.showToast({ title: `已设为 ${city}`, icon: 'none' });
          }
        }
      }
    });
  },

  // —— 跳转到其他 Tab ——
  goChat()      { wx.switchTab({ url: '/pages/chat/chat' }); },
  goCompare()   { wx.switchTab({ url: '/pages/compare/compare' }); },
  goItinerary() { wx.switchTab({ url: '/pages/itinerary/itinerary' }); },
  goMe()        { wx.switchTab({ url: '/pages/me/me' }); },
});
