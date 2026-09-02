// pages/chat/chat.js
const api = require('../../utils/api.js');
const { DESTINATIONS } = require('../../utils/const.js');

const app = getApp();

const BASE_SYSTEM = `你是 WanderMind 游心的旅行规划助手。
- 提供具体地点、价格参考（当地货币/人民币双标注）
- 适当使用 emoji 让回复生动
- 分段清晰，避免大段密集文字
- 像去过目的地 20 次的朋友在分享真实经验`;

const LANG_PROMPT = {
  zh: '请使用简体中文回复，专业名词可括号标注英文。',
  en: 'Reply in clear, concise English.',
  ja: '自然で簡潔な日本語で回答してください。',
  ko: '자연스럽고 간결한 한국어로 답변해 주세요.',
  id: 'Jawab dalam bahasa Indonesia yang alami dan ringkas.',
};

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
    canSend: false,
    busy: false,
    retryText: '',
    saveError: '',
    convId: '',
    scrollAnchor: '',
    suggestions: [],
  },

  onLoad() {
    this._syncDestFromGlobal();
    const mode = wx.getStorageSync('wm_chat_mode') || 'fast';
    const saved = wx.getStorageSync('wm_chat_state') || {};
    const currentDest = this._destKey();
    const sameDest = saved.destKey === currentDest;
    const pendingText = sameDest ? (saved.pendingText || '') : '';
    this.setData({
      mode,
      modeLabel: mode === 'fast' ? '⚡ 极速模式' : '🎯 精细模式',
      messages: sameDest ? this._normalizeMessages(saved.messages || []) : [],
      inputText: pendingText || (sameDest ? (saved.inputText || '') : ''),
      canSend: !!(pendingText || (sameDest && saved.inputText)),
      retryText: pendingText,
      convId: sameDest ? (saved.convId || '') : '',
    });
  },

  async onShow() {
    // 切换目的地后回来要同步
    this._syncDestFromGlobal();
    const openId = wx.getStorageSync('wm_open_conversation');
    if (openId && !this._loadingConversation) {
      wx.removeStorageSync('wm_open_conversation');
      await this._openConversation(openId);
    }
  },

  _destKey() {
    return app.globalData.currentDest === 'custom'
      ? `custom:${app.globalData.customDestName || ''}`
      : app.globalData.currentDest;
  },

  _normalizeMessages(messages) {
    return (messages || []).filter(item => item && item.role && item.content).map(item => ({
      ...item,
      id: item.id || _nextId(),
    }));
  },

  _persistState(overrides = {}) {
    wx.setStorageSync('wm_chat_state', {
      destKey: this._destKey(),
      messages: this.data.messages,
      inputText: this.data.inputText,
      pendingText: '',
      convId: this.data.convId,
      ...overrides,
    });
  },

  async _openConversation(id) {
    this._loadingConversation = true;
    this.setData({ busy: true, saveError: '', retryText: '' });
    try {
      const conversation = await api.getConversation(id);
      const messages = this._normalizeMessages(conversation.messages || []);
      this.setData({
        convId: conversation.id || id,
        messages,
        inputText: '',
        canSend: false,
        busy: false,
        destName: conversation.dest || this.data.destName,
        scrollAnchor: messages.length ? `msg-${messages[messages.length - 1].id}` : '',
      });
      this._persistState();
    } catch (err) {
      this.setData({ busy: false, saveError: err.message || '对话恢复失败' });
    } finally {
      this._loadingConversation = false;
    }
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
    const inputText = e.detail.value;
    this.setData({ inputText, canSend: !!inputText.trim(), retryText: '', saveError: '' }, () => this._persistState());
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

    const dest = app.globalData.currentDest === 'custom'
      ? (app.globalData.customDestName || 'custom')
      : this.data.destName;
    const customDestination = app.globalData.currentDest === 'custom'
      ? (app.globalData.customDestName || '').trim()
      : '';
    const contentForSafetyCheck = customDestination
      ? `${customDestination}\n${text}`
      : text;
    this.setData({ busy: true, saveError: '', retryText: '' });
    try {
      await api.checkUserContent(contentForSafetyCheck, 2);
    } catch (err) {
      this.setData({
        busy: false,
        inputText: text,
        canSend: true,
        retryText: text,
        saveError: err.message || '内容安全校验暂不可用，请稍后重试',
      });
      wx.showModal({
        title: '暂时无法发送',
        content: err.message || '内容安全校验暂不可用，请稍后重试',
        showCancel: false,
      });
      return;
    }

    const previousMessages = this.data.messages.slice();
    const userMsg = { id: _nextId(), role: 'user', content: text };
    const messages = previousMessages.concat(userMsg);

    this.setData({
      messages,
      inputText: '',
      canSend: false,
      busy: true,
      retryText: '',
      saveError: '',
      scrollAnchor: 'msg-typing',
    });
    this._persistState({ messages: previousMessages, inputText: '', pendingText: text });

    try {
      // 注入旅行偏好（如果用户在"我的-旅行偏好"里设置过）
      const memoryPrompt = app.buildMemoryPrompt();
      const lang = app.globalData.currentLang || 'zh';
      const system = BASE_SYSTEM + `\n${LANG_PROMPT[lang] || LANG_PROMPT.zh}` + memoryPrompt + `\n\n当前目的地: ${dest}`;
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
      const completedMessages = messages.concat(assistantMsg);
      this.setData({
        messages: completedMessages,
        busy: false,
        scrollAnchor: 'msg-' + assistantMsg.id,
      });
      this._persistState({ messages: completedMessages, pendingText: '' });
      try {
        const title = text.replace(/\s+/g, ' ').slice(0, 32) || `${dest} 行程`;
        const saved = await api.saveConversation({
          conv_id: this.data.convId || null,
          dest,
          title,
          messages: completedMessages.map(item => ({ role: item.role, content: item.content })),
        });
        this.setData({ convId: saved.id || this.data.convId });
        this._persistState({ convId: saved.id || this.data.convId, messages: completedMessages });
      } catch (saveErr) {
        this.setData({ saveError: '回复已保存在本机；云端同步失败，可继续使用。' });
      }
    } catch (err) {
      this.setData({
        messages: previousMessages,
        inputText: text,
        canSend: true,
        retryText: text,
        busy: false,
      });
      this._persistState({ messages: previousMessages, inputText: text, pendingText: '' });
      wx.showModal({
        title: '出了点问题 🌊',
        content: `${err.message || '请稍后重试'}\n\n输入内容已保留。`,
        showCancel: false,
      });
    }
  },

  retryLast() {
    if (!this.data.retryText || this.data.busy) return;
    this.setData({ inputText: this.data.retryText, canSend: true }, () => this.sendMsg());
  },
});
