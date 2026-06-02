// pages/me/me.js
const { LANGS } = require('../../utils/const.js');
const app = getApp();

function _hasAny(p) {
  if (!p) return false;
  return !!(p.budgetLevel || p.party || (p.notes && p.notes.trim())
    || (Array.isArray(p.styleList) && p.styleList.length > 0));
}

Page({
  data: {
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
    this.setData({
      loggedIn,
      user,
      userInitial: user?.name ? user.name.charAt(0) : '游',
      currentLangLabel: lang.flag + ' ' + lang.label,
      hasPrefs: _hasAny(app.globalData.preferences),
    });
  },

  openPrefs() {
    if (!app.globalData.token) {
      wx.showModal({
        title: '请先登录',
        content: '需要登录后才能设置旅行偏好',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return;
    }
    wx.navigateTo({ url: '/pages/prefs/prefs' });
  },

  goLogin() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearAuth();
          this.setData({ loggedIn: false, user: null });
          wx.showToast({ title: '已退出', icon: 'none' });
        }
      }
    });
  },

  openH5() {
    wx.setClipboardData({
      data: 'https://agentstrip.onrender.com',
      success: () => wx.showToast({ title: '网址已复制', icon: 'success' }),
    });
  },

  about() {
    wx.showModal({
      title: 'WanderMind · 游心',
      content: 'AI 多智能体旅行规划助手\n网页版：agentstrip.onrender.com\n版本：v0.1.0',
      showCancel: false,
    });
  },

  todo() {
    wx.showToast({ title: '功能开发中…', icon: 'none' });
  },
});
