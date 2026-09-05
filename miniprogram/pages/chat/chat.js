// pages/chat/chat.js
const api = require('../../utils/api.js');
const { DESTINATIONS } = require('../../utils/const.js');
const { formatAssistantMessage } = require('../../utils/message-format.js');

const app = getApp();

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

const SUGG_BY_DEST = {
  bali:      ['推荐适合住三晚的乌布民宿', '第一次冲浪应该选哪个海滩', '整理一份巴厘岛在地餐厅清单', '规划两个人七天的大致预算'],
  kyoto:     ['安排一条京都五日深度路线', '樱花季怎么避开人潮', '推荐值得提前预约的餐厅', '安排一条顺路的岚山一日路线'],
  paris:     ['安排一条巴黎四日经典路线', '推荐本地人常去的面包店和咖啡馆', '第一次去卢浮宫怎么安排', '推荐适合纪念日晚餐的街区'],
  santorini: ['伊亚日落应该提前多久到', '推荐可以参观的当地酒庄', '怎么安排一天跳岛行程', '蜜月住在哪个区域更安静'],
};

let _msgIdCounter = 0;
const _nextId = () => 'm' + (++_msgIdCounter);

Page({
  data: {
    destFlag: '🌺',
    destName: '巴厘岛',
    mode: 'fast',
    modeLabel: '快速回答',
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
      modeLabel: mode === 'fast' ? '快速回答' : '深入规划',
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
    return (messages || []).filter(item => item && item.role && item.content).map(item => {
      const normalized = { ...item, id: item.id || _nextId() };
      if (item.role === 'assistant') normalized.renderBlocks = formatAssistantMessage(item.content);
      return normalized;
    });
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
      modeLabel: mode === 'fast' ? '快速回答' : '深入规划',
    });
    wx.setStorageSync('wm_chat_mode', mode);
    wx.showToast({
      title: mode === 'fast' ? '已切换到快速回答' : '已切换到深入规划',
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
        renderBlocks: formatAssistantMessage(res.text || '（AI 没有返回内容，请重试）'),
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
