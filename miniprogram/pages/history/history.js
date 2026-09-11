const api = require('../../utils/api.js');

const COPY = require('../../utils/browse-copy.js');
const app = getApp();

Page({
  data: { copy: COPY.zh, loading: true, conversations: [], error: '' },
  onShow() { this.setData({copy: COPY[app.globalData.currentLang] || COPY.zh}); wx.setNavigationBarTitle({title:this.data.copy.historyTitle}); this.load(); },
  async load() {
    const token=app.globalData.token;
    this.setData({ loading: !!token, error: '', conversations: [] });
    if (!token) return;
    try {
      const conversations = await api.listConversations();
      if(app.globalData.token !== token) return;
      this.setData({ conversations: conversations || [], loading: false });
    } catch (err) { if(app.globalData.token===token) this.setData({ loading: false, error: err.message || this.data.copy.historyFailed }); }
  },
  async open(e) {
    const id = e.currentTarget.dataset.id;
    wx.setStorageSync(app.privateStorageKey('wm_open_conversation'), id);
    wx.switchTab({ url: '/pages/chat/chat' });
  },
  remove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: this.data.copy.deleteTitle, content: this.data.copy.deleteAsk,
      confirmText:this.data.copy.ok, cancelText:this.data.copy.cancel,
      success: async result => {
        if (!result.confirm) return;
        try { await api.deleteConversation(id); this.load(); }
        catch (err) { wx.showToast({ title: err.message || this.data.copy.deleteFailed, icon: 'none' }); }
      },
    });
  },
});
