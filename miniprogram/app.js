// app.js — WanderMind 游心 小程序全局入口
App({
  globalData: {
    // 后端 API base URL（指向 Render 部署的 H5 服务）
    apiBase: 'https://agentstrip.onrender.com',
    // 用户登录态
    token: '',
    user: null,
    // 当前选中的目的地（默认巴厘岛）
    currentDest: 'bali',
    customDestName: '',
    // 当前语言（默认中文）
    currentLang: 'zh',
    // 系统信息
    systemInfo: null,
    // 旅行偏好（影响 AI 对话个性化）
    // { budgetLevel: 'midrange', styleList: ['culture','food'], party: 'couple', notes: '...' }
    preferences: {},
  },

  onLaunch() {
    // 启动时从本地缓存恢复登录态
    const token = wx.getStorageSync('wm_token');
    const user  = wx.getStorageSync('wm_user');
    const dest  = wx.getStorageSync('wm_dest');
    const lang  = wx.getStorageSync('wm_lang');
    const prefs = wx.getStorageSync('wm_prefs');
    if (token) this.globalData.token = token;
    if (user)  this.globalData.user = user;
    if (dest)  this.globalData.currentDest = dest;
    if (lang)  this.globalData.currentLang = lang;
    if (prefs) this.globalData.preferences = prefs;

    // 缓存系统信息（替代废弃的 wx.getSystemInfoSync）
    try {
      this.globalData.systemInfo = wx.getDeviceInfo
        ? { ...wx.getDeviceInfo(), ...wx.getWindowInfo() }
        : wx.getSystemInfoSync();
    } catch (e) {
      this.globalData.systemInfo = {};
    }
  },

  // 设置 token 并持久化
  setToken(token, user) {
    this.globalData.token = token;
    this.globalData.user = user;
    wx.setStorageSync('wm_token', token);
    wx.setStorageSync('wm_user', user);
  },

  // 清除登录态
  clearAuth() {
    this.globalData.token = '';
    this.globalData.user = null;
    wx.removeStorageSync('wm_token');
    wx.removeStorageSync('wm_user');
  },

  // 切换目的地
  setDest(dest) {
    this.globalData.currentDest = dest;
    wx.setStorageSync('wm_dest', dest);
  },

  // 切换语言
  setLang(lang) {
    this.globalData.currentLang = lang;
    wx.setStorageSync('wm_lang', lang);
  },

  // 保存偏好（本地 + 上报后端在调用方做）
  setPrefs(prefs) {
    this.globalData.preferences = prefs || {};
    wx.setStorageSync('wm_prefs', this.globalData.preferences);
  },

  // 构建 system prompt 的偏好片段（chat 时调用，注入到 AI 上下文）
  buildMemoryPrompt() {
    const p = this.globalData.preferences || {};
    const budgetMap = { budget: '经济实惠', midrange: '标准舒适', luxury: '豪华享受' };
    const partyMap  = { solo: '独自旅行', couple: '情侣出行', family: '家庭亲子', group: '朋友/团体' };
    const styleMap  = {
      culture: '文化历史', food: '美食探索', adventure: '冒险户外',
      relax: '悠闲放松', nature: '自然风光', wellness: '养生健康',
    };

    const lines = [];
    if (p.budgetLevel && budgetMap[p.budgetLevel]) lines.push(`- 预算档次：${budgetMap[p.budgetLevel]}`);
    if (Array.isArray(p.styleList) && p.styleList.length > 0) {
      const styles = p.styleList.map(s => styleMap[s] || s).join('、');
      lines.push(`- 旅行风格：${styles}`);
    }
    if (p.party && partyMap[p.party]) lines.push(`- 同行方式：${partyMap[p.party]}`);
    if (p.notes && p.notes.trim()) lines.push(`- 特殊偏好/备注：${p.notes.trim()}`);

    if (lines.length === 0) return '';
    return `\n\n【用户旅行偏好档案】\n${lines.join('\n')}\n请在推荐时充分考虑用户偏好，提供个性化建议。`;
  },
});
