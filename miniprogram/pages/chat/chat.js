// pages/chat/chat.js
const api = require('../../utils/api.js');
const { DESTINATIONS } = require('../../utils/const.js');
const { formatAssistantMessage } = require('../../utils/message-format.js');

const app = getApp();
const COPY=require('./copy.js');
const DEST_COPY=require('../index/copy.js');

const BASE_SYSTEM = `你是 WanderMind 智旅的旅行规划助手。
- 提供具体地点、价格参考（当地货币/人民币双标注）
- 用自然、具体的旅行语言表达，不用 emoji 堆砌气氛
- 分段清晰，避免大段密集文字
- 像去过目的地 20 次的朋友在分享真实经验
- 使用完整、自然的句子；不要把数字、币种、专有名词或单词拆到不同的行
- 不使用 Markdown 的 # 标题、表格或代码块；需要列举时使用简短小标题和“•”项目符号
- 除地点原名等专有名词外，只使用用户选择的语言，不混入其他语言
- 价格仅作为参考，统一写成“IDR 100,000（约 CNY 45）”这样的完整格式；无法核实时明确提示实时确认`;

const LANG_PROMPT = {
  zh: '请使用简体中文回复，专业名词可括号标注英文。',
  en: 'Reply in clear, concise English.',
  ja: '自然で簡潔な日本語で回答してください。',
  ko: '자연스럽고 간결한 한국어로 답변해 주세요.',
  id: 'Jawab dalam bahasa Indonesia yang alami dan ringkas.',
};
const DESTINATION_PROMPT = { zh: '当前目的地', en: 'Current destination', ja: '現在の目的地', ko: '현재 목적지', id: 'Destinasi saat ini' };


let _msgIdCounter = 0;
const _nextId = () => 'm' + (++_msgIdCounter);

Page({
  data: {
    copy: COPY.zh,
    destFlag: '🌺',
    destName: '巴厘岛',
    mode: 'fast',
    modeLabel: COPY.zh.fastLabel,
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
    this._sessionToken=app.globalData.token;
    this._syncDestFromGlobal();
    const mode = wx.getStorageSync('wm_chat_mode') || 'fast';
    const saved = wx.getStorageSync(app.privateStorageKey('wm_chat_state')) || {};
    const currentDest = this._destKey();
    this._activeDest=currentDest;
    const sameDest = saved.destKey === currentDest;
    const pendingText = sameDest ? (saved.pendingText || '') : '';
    this.setData({
      mode,
      modeLabel: mode === 'fast' ? this.data.copy.fastLabel : this.data.copy.deepLabel,
      messages: sameDest ? this._normalizeMessages(saved.messages || []) : [],
      inputText: pendingText || (sameDest ? (saved.inputText || '') : ''),
      canSend: !!(pendingText || (sameDest && saved.inputText)),
      retryText: pendingText,
      convId: sameDest ? (saved.convId || '') : '',
    });
  },

  async onShow() {
    if(this._sessionToken!==app.globalData.token || this._activeDest!==this._destKey()) { this.setData({messages:[],inputText:'',convId:'',busy:false,retryText:'',saveError:''}); this.onLoad(); }
    // 切换目的地后回来要同步
    this._syncDestFromGlobal();
    const openId = wx.getStorageSync(app.privateStorageKey('wm_open_conversation'));
    if (openId && !this._loadingConversation) {
      wx.removeStorageSync(app.privateStorageKey('wm_open_conversation'));
      await this._openConversation(openId);
    }
  },

  _destKey() {
    return app.globalData.currentDest === 'custom'
      ? `custom:${app.globalData.customDestName || ''}`
      : app.globalData.currentDest;
  },

  _normalizeMessages(messages) {
    return (messages || []).filter(item => item && item.role && item.content).map(item => {
      const normalized = { ...item, id: item.id || _nextId() };
      if (item.role === 'assistant') normalized.renderBlocks = formatAssistantMessage(item.content);
      return normalized;
    });
  },

  _persistState(overrides = {}) {
    wx.setStorageSync(app.privateStorageKey('wm_chat_state'), {
      destKey: this._destKey(),
      messages: this.data.messages,
      inputText: this.data.inputText,
      pendingText: '',
      convId: this.data.convId,
      ...overrides,
    });
  },

  async _openConversation(id) {
    const token=app.globalData.token;
    this._loadingConversation = true;
    this.setData({ busy: true, saveError: '', retryText: '' });
    try {
      const conversation = await api.getConversation(id);
      if(app.globalData.token!==token) return;
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
      if(app.globalData.token===token) this.setData({ busy: false, saveError: err.message || this.data.copy.restoreFailed });
    } finally {
      this._loadingConversation = false;
    }
  },

  _syncDestFromGlobal() {
    const lang=app.globalData.currentLang || 'zh', copy=COPY[lang] || COPY.zh;
    this.setData({copy,modeLabel:this.data.mode==='fast'?copy.fastLabel:copy.deepLabel});
    wx.setNavigationBarTitle({title:copy.advisor});
    if(app.updateTabBarLanguage) app.updateTabBarLanguage();
    const destId = app.globalData.currentDest;
    let flag = '🌍', name = this.data.copy.custom;
    if (destId === 'custom') {
      name = app.globalData.customDestName || this.data.copy.custom;
    } else {
      const d = DESTINATIONS.find(x => x.id === destId);
      if (d) { flag = d.flag; name = (DEST_COPY[lang] || DEST_COPY.zh)[d.id] || d.name; }
    }
    this.setData({
      destFlag: flag,
      destName: name,
      suggestions: [copy.stay,copy.route,copy.food,copy.budget],
    });
  },

  setMode(e) {
    if(this.data.busy) return;
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      mode,
      modeLabel: mode === 'fast' ? this.data.copy.fastLabel : this.data.copy.deepLabel,
    });
    wx.setStorageSync('wm_chat_mode', mode);
    wx.showToast({
      title: mode === 'fast' ? this.data.copy.fastToast : this.data.copy.deepToast,
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
    const token=app.globalData.token;
    const text = this.data.inputText.trim();
    if (!text || this.data.busy) return;

    if (!app.globalData.token) {
      wx.showModal({
        title: this.data.copy.login,
        content: this.data.copy.loginHint,
        showCancel: false, confirmText:this.data.copy.confirm,
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
      if(app.globalData.token!==token) return;
    } catch (err) {
      if(app.globalData.token!==token) return;
      this.setData({
        busy: false,
        inputText: text,
        canSend: true,
        retryText: text,
        saveError: err.message || this.data.copy.safety,
      });
      wx.showModal({
        title: this.data.copy.sendFailed,
        content: err.message || this.data.copy.safety,
        showCancel: false, confirmText:this.data.copy.confirm,
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
      const system = BASE_SYSTEM + `\n${LANG_PROMPT[lang] || LANG_PROMPT.zh}` + memoryPrompt + `\n\n${DESTINATION_PROMPT[lang] || DESTINATION_PROMPT.zh}: ${dest}`;
      // 把所有历史发给后端（角色+内容）
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await api.chatOnce(history, system, dest, this.data.mode);
      if(app.globalData.token!==token) return;

      const assistantMsg = {
        id: _nextId(),
        role: 'assistant',
        content: res.text || this.data.copy.noReply,
        renderBlocks: formatAssistantMessage(res.text || this.data.copy.noReply),
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
        const title = text.replace(/\s+/g, ' ').slice(0, 32) || dest;
        const saved = await api.saveConversation({
          conv_id: this.data.convId || null,
          dest,
          title,
          messages: completedMessages.map(item => ({ role: item.role, content: item.content })),
        });
        if(app.globalData.token!==token) return;
        this.setData({ convId: saved.id || this.data.convId });
        this._persistState({ convId: saved.id || this.data.convId, messages: completedMessages });
      } catch (saveErr) {
        if(app.globalData.token!==token) return;
        this.setData({ saveError: this.data.copy.syncFailed });
      }
    } catch (err) {
      if(app.globalData.token!==token) return;
      this.setData({
        messages: previousMessages,
        inputText: text,
        canSend: true,
        retryText: text,
        busy: false,
      });
      this._persistState({ messages: previousMessages, inputText: text, pendingText: '' });
      wx.showModal({
        title: this.data.copy.error,
        content: `${err.message || this.data.copy.tryAgain}\n\n${this.data.copy.kept}`,
        showCancel: false, confirmText:this.data.copy.confirm,
      });
    }
  },

  retryLast() {
    if (!this.data.retryText || this.data.busy) return;
    this.setData({ inputText: this.data.retryText, canSend: true }, () => this.sendMsg());
  },
});
