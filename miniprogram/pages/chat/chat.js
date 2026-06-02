// pages/chat/chat.js
const api = require('../../utils/api.js');
const { DESTINATIONS } = require('../../utils/const.js');

const app = getApp();

const BASE_SYSTEM = `你是 WanderMind 游心 — 一个专业的多智能体旅行规划助手。
- 用中文回复，专业名词括号标注英文
- 提供具体地点、价格参考（当地货币/人民币双标注）
- 适当使用 emoji 让回复生动
- 分段清晰，避免大段密集文字
- 像去过目的地 20 次的朋友在分享真实经验`;

const SUGG_BY_DEST = {
  bali:      ['🏨 推荐乌布精品民宿', '🌊 巴厘岛冲浪入门攻略', '🍜 必吃地道美食清单', '💰 两人 7 天预算规划'],
  kyoto:     ['🏯 京都 5 日深度路线', '🌸 樱花季最佳赏花点', '🍣 米其林餐厅推荐', '🎋 岚山一日游攻略'],
  paris:     ['🗼 巴黎 4 日经典路线', '🥐 必去面包店和咖啡馆', '🎨 卢浮宫攻略', '🌃 浪漫晚餐推荐'],
  santorini: ['🌅 伊亚日落最佳位置', '🍷 当地酒庄推荐', '🛳️ 跳岛游攻略', '💍 蜜月酒店推荐'],
};

let _msgIdCounter = 0;
const _nextId = () => 'm' + (++_msgIdCounter);

Page({
  data: {
    destFlag: '🌺',
    destName: '巴厘岛',
    mode: 'fast',
    modeLabel: '⚡ 极速模式',
    messages: [],
    inputText: '',
    busy: false,
    scrollAnchor: '',
    suggestions: [],
  },

  onLoad() {
    this._syncDestFromGlobal();
    const mode = wx.getStorageSync('wm_chat_mode') || 'fast';
    this.setData({
      mode,
      modeLabel: mode === 'fast' ? '⚡ 极速模式' : '🎯 精细模式',
    });
  },

  onShow() {
    // 切换目的地后回来要同步
    this._syncDestFromGlobal();
  },

  _syncDestFromGlobal() {
    const destId = app.globalData.currentDest;
    let flag = '🌍', name = '自定义';
    if (destId === 'custom') {
      name = app.globalData.customDestName || '自定义';
    } else {
      const d = DESTINATIONS.find(x => x.id === destId);
      if (d) { flag = d.flag; name = d.name; }
    }
    this.setData({
      destFlag: flag,
      destName: name,
      suggestions: SUGG_BY_DEST[destId] || SUGG_BY_DEST.bali,
    });
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      mode,
      modeLabel: mode === 'fast' ? '⚡ 极速模式' : '🎯 精细模式',
    });
    wx.setStorageSync('wm_chat_mode', mode);
    wx.showToast({
      title: mode === 'fast' ? '已切换 ⚡ 极速' : '已切换 🎯 精细',
      icon: 'none',
    });
  },

  onInputChange(e) {
    this.setData({ inputText: e.detail.value });
  },

  quickSend(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputText: text }, () => this.sendMsg());
  },

  async sendMsg() {
    const text = this.data.inputText.trim();
    if (!text || this.data.busy) return;

    if (!app.globalData.token) {
      wx.showModal({
        title: '请先登录',
        content: '需要先登录后才能开始对话',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return;
    }

    const userMsg = { id: _nextId(), role: 'user', content: text };
    const messages = this.data.messages.concat(userMsg);

    this.setData({
      messages,
      inputText: '',
      busy: true,
      scrollAnchor: 'msg-typing',
    });

    try {
      const dest = app.globalData.currentDest === 'custom'
        ? (app.globalData.customDestName || 'custom')
        : this.data.destName;
      // 注入旅行偏好（如果用户在"我的-旅行偏好"里设置过）
      const memoryPrompt = app.buildMemoryPrompt();
      const system = BASE_SYSTEM + memoryPrompt + `\n\n当前目的地: ${dest}`;
      // 把所有历史发给后端（角色+内容）
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await api.chatOnce(history, system, dest, this.data.mode);

      const assistantMsg = {
        id: _nextId(),
        role: 'assistant',
        content: res.text || '（AI 没有返回内容，请重试）',
        mode: res.mode || this.data.mode,
        searched: !!res.searched,
      };
      this.setData({
        messages: this.data.messages.concat(assistantMsg),
        busy: false,
        scrollAnchor: 'msg-' + assistantMsg.id,
      });
    } catch (err) {
      this.setData({ busy: false });
      wx.showModal({
        title: '出了点问题 🌊',
        content: err.message || '请稍后重试',
        showCancel: false,
      });
    }
  },
});
