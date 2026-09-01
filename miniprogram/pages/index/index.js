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
    verificationCode: '',
    codeBusy: false,
    codeCooldown: 0,
    authBusy: false,
    authError: '',
    // 目的地
    destinations: DESTINATIONS,
    currentDest: 'bali',
  },

  onLoad() {
    this._refreshAuthState();
    this._validateSession();
  },

  onShow() {
    app.updateTabBarLanguage();
    this._refreshAuthState();
    this._validateSession();
  },

  onUnload() {
    this._clearCodeTimer();
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

  async _validateSession() {
    if (!app.globalData.token || app.globalData.sessionChecked || this._checkingSession) return;
    this._checkingSession = true;
    try {
      const user = await api.me();
      app.setToken(app.globalData.token, user);
      this.setData({ loggedIn: true, user });
    } catch (err) {
      // 401 由统一请求层清理并回到登录页；普通网络错误保留本地会话供稍后重试。
    } finally {
      this._checkingSession = false;
    }
  },

  _clearCodeTimer() {
    if (this._codeTimer) clearInterval(this._codeTimer);
    this._codeTimer = null;
  },

  _startCodeCooldown(seconds) {
    this._clearCodeTimer();
    this.setData({ codeCooldown: seconds });
    this._codeTimer = setInterval(() => {
      const next = this.data.codeCooldown - 1;
      this.setData({ codeCooldown: Math.max(0, next) });
      if (next <= 0) this._clearCodeTimer();
    }, 1000);
  },

  async sendCode() {
    const email = this.data.email.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      this.setData({ authError: '请先填写有效邮箱' });
      return;
    }
    if (this.data.codeBusy || this.data.codeCooldown > 0) return;
    this.setData({ codeBusy: true, authError: '' });
    try {
      const res = await api.sendVerificationCode(email, app.globalData.currentLang);
      this._startCodeCooldown(Number(res.resend_in) || 60);
      wx.showToast({ title: '验证码已发送', icon: 'success' });
    } catch (err) {
      this.setData({ authError: err.message || '验证码发送失败，请重试' });
    } finally {
      this.setData({ codeBusy: false });
    }
  },

  // —— 登录 / 注册 ——
  async doAuth() {
    const { authMode, email, password, regName, verificationCode } = this.data;
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
    if (authMode === 'register' && !/^\d{6}$/.test(verificationCode.trim())) {
      this.setData({ authError: '请输入邮件中的 6 位验证码' });
      return;
    }
    this.setData({ authBusy: true, authError: '' });
    try {
      const fn = authMode === 'login'
        ? api.login(email.trim(), password)
        : api.register(
          email.trim(), password, regName.trim(), verificationCode.trim(), app.globalData.currentLang
        );
      const res = await fn;
      app.setToken(res.token, res.user);
      wx.showToast({ title: authMode === 'login' ? '欢迎回来' : '注册成功', icon: 'success' });
      this.setData({ loggedIn: true, user: res.user, password: '', verificationCode: '' });
      // 登录成功后异步拉取后端的旅行偏好（不阻塞 UI）
      try {
        const prefs = await api.getPrefs();
        app.setPrefs(prefs || {});
      } catch (e) { /* 静默失败 */ }
      app.resumePendingRoute();
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
            app.setCustomDest(city);
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
