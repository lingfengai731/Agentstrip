// pages/me/me.js
const { LANGS } = require('../../utils/const.js');
const app = getApp();
const COPY = require('./copy.js');

function _hasAny(p) {
  if (!p) return false;
  return !!(p.budgetLevel || p.party || (p.notes && p.notes.trim())
    || (Array.isArray(p.styleList) && p.styleList.length > 0));
}

Page({
  data: {
    copy: COPY.zh,
    loggedIn: false,
    user: null,
    userInitial: '',
    currentLangLabel: '中文',
    hasPrefs: false,
  },

  onShow() {
    const loggedIn = !!app.globalData.token;
    const user = app.globalData.user;
    const lang = LANGS.find(l => l.id === app.globalData.currentLang) || LANGS[0];
    const copy = COPY[lang.id] || COPY.zh;
    wx.setNavigationBarTitle({ title: copy.title });
    app.updateTabBarLanguage();
    this.setData({
      copy,
      loggedIn,
      user,
      userInitial: user?.name ? user.name.charAt(0) : 'WM',
      currentLangLabel: lang.flag + ' ' + lang.label,
      hasPrefs: _hasAny(app.globalData.preferences),
    });
  },

  openPrefs() {
    if (!app.globalData.token) {
      wx.showModal({
        title: this.data.copy.loginFirst,
        content: this.data.copy.prefsLogin,
        confirmText: this.data.copy.confirm,
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return;
    }
    wx.navigateTo({ url: '/pages/prefs/prefs' });
  },

  openHistory() {
    if (!app.globalData.token) { this.goLogin(); return; }
    wx.navigateTo({ url: '/pages/history/history' });
  },

  openLanguage() { wx.navigateTo({ url: '/pages/language/language' }); },

  goLogin() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  doLogout() {
    wx.showModal({
      title: this.data.copy.logout,
      content: this.data.copy.logoutAsk,
      confirmText: this.data.copy.confirm,
      cancelText: this.data.copy.cancel,
      success: (res) => {
        if (res.confirm) {
          app.clearAuth();
          this.setData({ loggedIn: false, user: null });
          wx.showToast({ title: this.data.copy.loggedOut, icon: 'none' });
        }
      }
    });
  },

  openH5() {
    wx.setClipboardData({
      data: 'https://wandermind.cc',
      success: () => wx.showToast({ title: this.data.copy.copied, icon: 'success' }),
      fail: () => wx.showToast({ title: this.data.copy.copyFailed, icon: 'none' }),
    });
  },

  about() {
    wx.showModal({
      title: this.data.copy.about,
      content: this.data.copy.aboutCopy,
      confirmText: this.data.copy.confirm,
      showCancel: false,
    });
  },

});
