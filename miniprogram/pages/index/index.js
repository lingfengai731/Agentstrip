// pages/index/index.js
const api = require('../../utils/api.js');
const { DESTINATIONS } = require('../../utils/const.js');

const app = getApp();
const COPY = require('./copy.js');

Page({
  data: {
    copy: COPY.zh,
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
    wechatBusy: false,
    wechatLinked: false,
    authError: '',
    // 目的地
    destinations: DESTINATIONS,
    currentDest: 'bali',
    showFutureDestinations: false,
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
    const copy = COPY[app.globalData.currentLang] || COPY.zh;
    const regions = { bali: 'indonesia' };
    const token = app.globalData.token;
    const user  = app.globalData.user;
    this.setData({
      copy,
      destinations: DESTINATIONS.map(item => ({ ...item, name: copy[item.id], region: copy[regions[item.id]] })),
      loggedIn: !!token,
      user: user || null,
      wechatLinked: !!(user && user.wechat_linked),
      currentDest: app.globalData.currentDest,
    });
  },

  // —— 表单输入 ——
  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value, authError: '' });
  },

  switchAuth(e) {
    if (this.data.authBusy || this.data.wechatBusy) return;
    const mode = e.currentTarget.dataset.mode;
    this.setData({ authMode: mode, authError: '' });
  },

  async _validateSession() {
    if (!app.globalData.token || app.globalData.sessionChecked || this._checkingSession) return;
    this._checkingSession = true;
    const token = app.globalData.token;
    try {
      const user = await api.me();
      if (app.globalData.token !== token) return;
      app.setToken(token, user);
      this.setData({ loggedIn: true, user, wechatLinked: !!(user && user.wechat_linked) });
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

  async _finishAuth(res, title) {
    app.setToken(res.token, res.user);
    wx.showToast({ title, icon: 'success' });
    this.setData({
      loggedIn: true,
      user: res.user,
      wechatLinked: !!(res.user && res.user.wechat_linked),
      password: '',
      verificationCode: '',
      authError: '',
    });
    // 登录成功后异步拉取后端的旅行偏好（不阻塞 UI）
    try {
      const prefs = await api.getPrefs();
      app.setPrefs(prefs || {});
    } catch (e) { /* 静默失败 */ }
    app.resumePendingRoute();
  },

  async sendCode() {
    const email = this.data.email.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      this.setData({ authError: this.data.copy.validEmail });
      return;
    }
    if (this.data.codeBusy || this.data.codeCooldown > 0) return;
    this.setData({ codeBusy: true, authError: '' });
    try {
      const res = await api.sendVerificationCode(email, app.globalData.currentLang);
      this._startCodeCooldown(Number(res.resend_in) || 60);
      wx.showToast({ title: this.data.copy.codeSent, icon: 'success' });
    } catch (err) {
      this.setData({ authError: err.message || this.data.copy.codeFailed });
    } finally {
      this.setData({ codeBusy: false });
    }
  },

  // —— 登录 / 注册 ——
  async doAuth() {
    if (this.data.authBusy || this.data.wechatBusy) return;
    const { authMode, email, password, regName, verificationCode } = this.data;
    if (!email || !password) {
      this.setData({ authError: this.data.copy.required });
      return;
    }
    if (password.length < 6) {
      this.setData({ authError: this.data.copy.passwordShort });
      return;
    }
    if (authMode === 'register' && !regName) {
      this.setData({ authError: this.data.copy.nameRequired });
      return;
    }
    if (authMode === 'register' && !/^\d{6}$/.test(verificationCode.trim())) {
      this.setData({ authError: this.data.copy.codeRequired });
      return;
    }
    this.setData({ authBusy: true, authError: '' });
    try {
      if (authMode === 'register') {
        await api.checkUserContent(regName.trim(), 1);
      }
      const res = authMode === 'login'
        ? await api.login(email.trim(), password)
        : await api.register(
          email.trim(), password, regName.trim(), verificationCode.trim(), app.globalData.currentLang
        );
      await this._finishAuth(res, authMode === 'login' ? this.data.copy.welcome : this.data.copy.registered);
    } catch (err) {
      this.setData({ authError: err.message || this.data.copy.failed });
    } finally {
      this.setData({ authBusy: false });
    }
  },

  // —— 微信一键登录（仅使用 wx.login，不请求手机号） ——
  wechatLogin() {
    if (this.data.wechatBusy || this.data.authBusy) return;
    this.setData({ wechatBusy: true, authError: '' });
    wx.login({
      timeout: 10000,
      success: async (loginResult) => {
        try {
          if (!loginResult || !loginResult.code) throw new Error(this.data.copy.wechatError);
          const res = await api.wechatLogin(loginResult.code, app.globalData.currentLang);
          await this._finishAuth(res, this.data.copy.wechatSuccess);
        } catch (err) {
          this.setData({ authError: err.message || this.data.copy.wechatError });
        } finally {
          this.setData({ wechatBusy: false });
        }
      },
      fail: () => {
        this.setData({ wechatBusy: false, authError: this.data.copy.wechatError });
      },
    });
  },

  // —— 已有账号的显式微信绑定，不按昵称/手机号/邮箱自动合并 ——
  linkWechat() {
    if (this.data.wechatBusy || !this.data.loggedIn) return;
    this.setData({ wechatBusy: true, authError: '' });
    wx.login({
      timeout: 10000,
      success: async (loginResult) => {
        try {
          if (!loginResult || !loginResult.code) throw new Error(this.data.copy.linkError);
          await api.linkWechat(loginResult.code);
          const user = { ...(this.data.user || {}), wechat_linked: true };
          app.globalData.user = user;
          wx.setStorageSync('wm_user', user);
          this.setData({ user, wechatLinked: true });
          wx.showToast({ title: this.data.copy.linked, icon: 'success' });
        } catch (err) {
          this.setData({ authError: err.message || this.data.copy.linkError });
        } finally {
          this.setData({ wechatBusy: false });
        }
      },
      fail: () => {
        this.setData({ wechatBusy: false, authError: this.data.copy.linkError });
      },
    });
  },

  // —— 退出 ——
  doLogout() {
    wx.showModal({
      title: this.data.copy.logout,
      confirmText: this.data.copy.confirm, cancelText: this.data.copy.cancel,
      content: this.data.copy.logoutAsk,
      success: (res) => {
        if (res.confirm) {
          app.clearAuth();
          this.setData({ loggedIn: false, user: null, wechatLinked: false, password: '', email: '' });
        }
      }
    });
  },

  // —— 选择目的地 ——
  selectDest(e) {
    const id = e.currentTarget.dataset.id;
    app.setDest(id);
    this.setData({ currentDest: id });
    wx.showToast({ title: `${this.data.copy.selected}${this.data.destinations.find(d => d.id === id)?.name || ''}`, icon: 'none' });
  },

  customDest() {
    if (!this.data.showFutureDestinations) return;
    wx.showModal({
      title: this.data.copy.destination,
      confirmText: this.data.copy.confirm, cancelText: this.data.copy.cancel,
      placeholderText: this.data.copy.destinationHint,
      editable: true,
      success: (res) => {
        if (res.confirm && res.content) {
          const city = res.content.trim();
          if (city) {
            // 把"custom" 注册为当前目的地，名字保存在 globalData
            app.setCustomDest(city);
            this.setData({ currentDest: 'custom' });
            wx.showToast({ title: `${this.data.copy.selected}${city}`, icon: 'none' });
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
  openGallery() { wx.navigateTo({ url: '/pages/gallery/gallery' }); },
});
