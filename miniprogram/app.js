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
    // 当前语言（默认中文）
    currentLang: 'zh',
    // 系统信息
    systemInfo: null,
  },

  onLaunch() {
    // 启动时从本地缓存恢复登录态
    const token = wx.getStorageSync('wm_token');
    const user  = wx.getStorageSync('wm_user');
    const dest  = wx.getStorageSync('wm_dest');
    const lang  = wx.getStorageSync('wm_lang');
    if (token) this.globalData.token = token;
    if (user)  this.globalData.user = user;
    if (dest)  this.globalData.currentDest = dest;
    if (lang)  this.globalData.currentLang = lang;

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
});
