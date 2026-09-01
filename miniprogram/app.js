// app.js — WanderMind 游心 小程序全局入口
App({
  globalData: {
    // 后端 API base URL（指向 Render 部署的 H5 服务）
    apiBase: 'https://wandermind.cc',
    // 用户登录态
    token: '',
    user: null,
    // 当前选中的目的地（默认巴厘岛）
    currentDest: 'bali',
    customDestName: '',
    professionalRoute: null,
    sessionChecked: false,
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
    this.globalData.customDestName = wx.getStorageSync('wm_custom_dest') || '';
    this.globalData.professionalRoute = wx.getStorageSync('wm_professional_route') || null;

    // 缓存设备与窗口信息
    try {
      this.globalData.systemInfo = { ...wx.getDeviceInfo(), ...wx.getWindowInfo() };
    } catch (e) {
      this.globalData.systemInfo = {};
    }
    setTimeout(() => this.updateTabBarLanguage(), 0);
  },

  // 设置 token 并持久化
  setToken(token, user) {
    this.globalData.token = token;
    this.globalData.user = user;
    wx.setStorageSync('wm_token', token);
    wx.setStorageSync('wm_user', user);
    this.globalData.sessionChecked = true;
  },

  // 清除登录态
  clearAuth() {
    this.globalData.token = '';
    this.globalData.user = null;
    wx.removeStorageSync('wm_token');
    wx.removeStorageSync('wm_user');
    this.globalData.sessionChecked = false;
  },

  // 切换目的地
  setDest(dest) {
    this.globalData.currentDest = dest;
    wx.setStorageSync('wm_dest', dest);
  },

  setCustomDest(name) {
    this.globalData.customDestName = name || '';
    wx.setStorageSync('wm_custom_dest', this.globalData.customDestName);
    this.setDest('custom');
  },

  // 切换语言
  setLang(lang) {
    this.globalData.currentLang = lang;
    wx.setStorageSync('wm_lang', lang);
    this.updateTabBarLanguage();
  },

  updateTabBarLanguage() {
    const labels = {
      zh: ['首页', '聊天', '比价', '行程', '我的'],
      en: ['Home', 'AI Chat', 'Compare', 'Trips', 'Me'],
      ja: ['ホーム', 'AI相談', '比較', '旅程', 'マイ'],
      ko: ['홈', 'AI 채팅', '비교', '일정', '내 정보'],
      id: ['Beranda', 'Chat AI', 'Bandingkan', 'Rute', 'Saya'],
    }[this.globalData.currentLang] || ['首页', '聊天', '比价', '行程', '我的'];
    labels.forEach((text, index) => {
      try { wx.setTabBarItem({ index, text }); } catch (e) { /* tab bar not ready */ }
    });
  },

  setProfessionalRoute(payload) {
    this.globalData.professionalRoute = payload || null;
    if (payload) wx.setStorageSync('wm_professional_route', payload);
    else wx.removeStorageSync('wm_professional_route');
  },

  rememberCurrentRoute() {
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];
    if (!current || current.route === 'pages/index/index') return;
    const route = '/' + current.route;
    wx.setStorageSync('wm_pending_route', route);
  },

  resumePendingRoute() {
    const route = wx.getStorageSync('wm_pending_route');
    if (!route) return false;
    wx.removeStorageSync('wm_pending_route');
    const tabs = [
      '/pages/index/index', '/pages/chat/chat', '/pages/compare/compare',
      '/pages/itinerary/itinerary', '/pages/me/me',
    ];
    setTimeout(() => {
      if (tabs.includes(route)) wx.switchTab({ url: route });
      else wx.navigateTo({ url: route });
    }, 120);
    return true;
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
