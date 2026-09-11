// app.js — WanderMind 智旅 小程序全局入口
const MEMORY_COPY = {
  zh: { heading: '用户旅行偏好', budget: '预算', party: '同行方式', styles: '兴趣', notes: '需要注意', instruction: '请按这些偏好给出具体、可执行的建议。', budgetMap: { budget: '预算优先', midrange: '舒适平衡', luxury: '高端私享' }, partyMap: { solo: '独自旅行', couple: '两人同行', family: '家庭亲子', group: '朋友或团体' }, styleMap: { culture: '文化历史', food: '当地美食', adventure: '户外体验', relax: '放松度假', nature: '自然风景', wellness: '疗愈养生' } },
  en: { heading: 'Traveller preferences', budget: 'Budget', party: 'Travelling with', styles: 'Interests', notes: 'Important notes', instruction: 'Use these preferences to give specific, practical advice.', budgetMap: { budget: 'budget-conscious', midrange: 'comfort and value', luxury: 'premium and private' }, partyMap: { solo: 'solo', couple: 'two travellers', family: 'family with children', group: 'friends or group' }, styleMap: { culture: 'culture and history', food: 'local food', adventure: 'outdoor activities', relax: 'rest and resorts', nature: 'nature', wellness: 'wellness' } },
  ja: { heading: '旅行者の希望', budget: '予算', party: '同行者', styles: '興味', notes: '注意事項', instruction: 'これらの希望に沿って、具体的で実行しやすい提案をしてください。', budgetMap: { budget: '予算重視', midrange: '快適さと価格のバランス', luxury: '上質・プライベート' }, partyMap: { solo: '一人旅', couple: '二人旅', family: '家族・子ども連れ', group: '友人・グループ' }, styleMap: { culture: '文化・歴史', food: '地元の食', adventure: 'アウトドア', relax: '休息・リゾート', nature: '自然', wellness: 'ウェルネス' } },
  ko: { heading: '여행자 선호', budget: '예산', party: '동행', styles: '관심사', notes: '중요 메모', instruction: '이 선호에 맞춰 구체적이고 실행 가능한 조언을 주세요.', budgetMap: { budget: '예산 우선', midrange: '편안함과 가격 균형', luxury: '프리미엄·프라이빗' }, partyMap: { solo: '혼자', couple: '두 명', family: '가족·아이 동반', group: '친구·단체' }, styleMap: { culture: '문화·역사', food: '현지 음식', adventure: '야외 활동', relax: '휴식·리조트', nature: '자연', wellness: '웰니스' } },
  id: { heading: 'Preferensi wisatawan', budget: 'Anggaran', party: 'Teman perjalanan', styles: 'Minat', notes: 'Catatan penting', instruction: 'Gunakan preferensi ini untuk memberi saran yang spesifik dan praktis.', budgetMap: { budget: 'hemat', midrange: 'nyaman dan sepadan', luxury: 'premium dan privat' }, partyMap: { solo: 'sendiri', couple: 'dua orang', family: 'keluarga dengan anak', group: 'teman atau grup' }, styleMap: { culture: 'budaya dan sejarah', food: 'kuliner lokal', adventure: 'aktivitas luar ruang', relax: 'santai dan resor', nature: 'alam', wellness: 'kebugaran' } },
};
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
    const prefs = wx.getStorageSync('wm_prefs_' + (user && user.id != null ? user.id : 'guest'));
    if (token) this.globalData.token = token;
    if (user)  this.globalData.user = user;
    if (dest)  this.globalData.currentDest = dest;
    const supported = ['zh', 'en', 'ja', 'ko', 'id'];
    if (supported.includes(lang)) {
      this.globalData.currentLang = lang;
    } else {
      let locale = '';
      try { locale = wx.getAppBaseInfo().language; } catch (e) {
        try { locale = wx.getSystemInfoSync().language; } catch (legacyError) { /* use default */ }
      }
      const base = String(locale || '').toLowerCase().replace(/_/g, '-').split('-')[0];
      const normalized = base === 'in' ? 'id' : base;
      this.globalData.currentLang = supported.includes(normalized) ? normalized : 'zh';
      // Automatic detection is not a manual preference: do not persist wm_lang.
    }
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
    const changed = !this.globalData.user || !user || this.globalData.user.id !== user.id;
    if (changed) {
      this.setProfessionalRoute(null);
    }
    this.globalData.token = token;
    this.globalData.user = user;
    if (changed) this.globalData.preferences = wx.getStorageSync(this.privateStorageKey('wm_prefs')) || {};
    wx.setStorageSync('wm_token', token);
    wx.setStorageSync('wm_user', user);
    this.globalData.sessionChecked = true;
  },

  // 清除登录态
  clearAuth() {
    this.setProfessionalRoute(null);
    this.globalData.token = '';
    this.globalData.user = null;
    this.globalData.preferences = {};
    wx.removeStorageSync('wm_token');
    wx.removeStorageSync('wm_user');
    this.globalData.sessionChecked = false;
  },

  privateStorageKey(name) {
    const user = this.globalData.user;
    return name + '_' + (user && user.id != null ? user.id : 'guest');
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
    if (!['zh', 'en', 'ja', 'ko', 'id'].includes(lang)) return;
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
    wx.setStorageSync(this.privateStorageKey('wm_prefs'), this.globalData.preferences);
  },

  // 构建 system prompt 的偏好片段（chat 时调用，注入到 AI 上下文）
  buildMemoryPrompt() {
    const p = this.globalData.preferences || {};
    const copy = MEMORY_COPY[this.globalData.currentLang] || MEMORY_COPY.zh;

    const lines = [];
    if (p.budgetLevel && copy.budgetMap[p.budgetLevel]) lines.push(`- ${copy.budget}: ${copy.budgetMap[p.budgetLevel]}`);
    if (Array.isArray(p.styleList) && p.styleList.length > 0) {
      const styles = p.styleList.map(s => copy.styleMap[s] || s).join(', ');
      lines.push(`- ${copy.styles}: ${styles}`);
    }
    if (p.party && copy.partyMap[p.party]) lines.push(`- ${copy.party}: ${copy.partyMap[p.party]}`);
    if (p.notes && p.notes.trim()) lines.push(`- ${copy.notes}: ${p.notes.trim()}`);

    if (lines.length === 0) return '';
    return `\n\n${copy.heading}\n${lines.join('\n')}\n${copy.instruction}`;
  },
});
