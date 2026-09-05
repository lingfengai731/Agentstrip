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
    wechatBusy: false,
    wechatLinked: false,
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
    const mode = e.currentTarget.dataset.mode;
    this.setData({ authMode: mode, authError: '' });
  },

  async _validateSession() {
    if (!app.globalData.token || app.globalData.sessionChecked || this._checkingSession) return;
    this._checkingSession = true;
    try {
      const user = await api.me();
      app.setToken(app.globalData.token, user);
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
      if (authMode === 'register') {
        await api.checkUserContent(regName.trim(), 1);
      }
      const res = authMode === 'login'
        ? await api.login(email.trim(), password)
        : await api.register(
          email.trim(), password, regName.trim(), verificationCode.trim(), app.globalData.currentLang
        );
      await this._finishAuth(res, authMode === 'login' ? '欢迎回来' : '注册成功');
    } catch (err) {
      this.setData({ authError: err.message || '操作失败' });
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
          if (!loginResult || !loginResult.code) throw new Error('微信登录暂不可用，请稍后重试');
          const res = await api.wechatLogin(loginResult.code, app.globalData.currentLang);
          await this._finishAuth(res, '微信登录成功');
        } catch (err) {
          this.setData({ authError: err.message || '微信登录暂不可用，请稍后重试' });
        } finally {
          this.setData({ wechatBusy: false });
        }
      },
      fail: () => {
        this.setData({ wechatBusy: false, authError: '微信登录暂不可用，请稍后重试' });
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
          if (!loginResult || !loginResult.code) throw new Error('微信绑定暂不可用，请稍后重试');
          await api.linkWechat(loginResult.code);
          const user = { ...(this.data.user || {}), wechat_linked: true };
          app.globalData.user = user;
          wx.setStorageSync('wm_user', user);
          this.setData({ user, wechatLinked: true });
          wx.showToast({ title: '微信账号已绑定', icon: 'success' });
        } catch (err) {
          this.setData({ authError: err.message || '微信绑定暂不可用，请稍后重试' });
        } finally {
          this.setData({ wechatBusy: false });
        }
      },
      fail: () => {
        this.setData({ wechatBusy: false, authError: '微信绑定暂不可用，请稍后重试' });
      },
    });
  },

  // —— 退出 ——
  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
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
  openGallery() { wx.navigateTo({ url: '/pages/gallery/gallery' }); },
});
