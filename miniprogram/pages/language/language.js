const { LANGS } = require('../../utils/const.js');
const app = getApp();

Page({
  data: { languages: LANGS, current: 'zh' },
  onShow() { this.setData({ current: app.globalData.currentLang || 'zh' }); },
  choose(e) {
    const lang = e.currentTarget.dataset.id;
    app.setLang(lang);
    this.setData({ current: lang });
    wx.showToast({ title: '语言已更新', icon: 'success' });
    setTimeout(() => {
      wx.navigateBack({
        delta: 1,
        success: () => setTimeout(() => app.updateTabBarLanguage(), 0),
      });
    }, 450);
  },
});
