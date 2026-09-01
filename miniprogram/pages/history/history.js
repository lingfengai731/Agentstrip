const api = require('../../utils/api.js');

Page({
  data: { loading: true, conversations: [], error: '' },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const conversations = await api.listConversations();
      this.setData({ conversations: conversations || [], loading: false });
    } catch (err) { this.setData({ loading: false, error: err.message || '历史加载失败' }); }
  },
  async open(e) {
    const id = e.currentTarget.dataset.id;
    wx.setStorageSync('wm_open_conversation', id);
    wx.switchTab({ url: '/pages/chat/chat' });
  },
  remove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除对话', content: '删除后无法恢复，确定继续吗？',
      success: async result => {
        if (!result.confirm) return;
        try { await api.deleteConversation(id); this.load(); }
        catch (err) { wx.showToast({ title: err.message || '删除失败', icon: 'none' }); }
      },
    });
  },
});
