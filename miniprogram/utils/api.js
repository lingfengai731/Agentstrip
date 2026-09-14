// utils/api.js — 后端 API 封装
// 所有请求统一走 Render 部署的 WanderMind 后端

const app = getApp();
const ERROR_COPY = require('./error-copy.js');
const errors = () => ERROR_COPY[app.globalData.currentLang] || ERROR_COPY.zh;

function _request({ url, method = 'GET', data, auth = true, timeout = 30000 }) {
  const token = app.globalData.token;
  const copy = errors();
  return new Promise((resolve, reject) => {
    let finished = false, task, timer;
    const settle = (error, value) => {
      if (finished) return;
      finished = true;
      if (timer != null) clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    // Settle even if a platform callback is lost; never automatically retry POST.
    if (typeof setTimeout === 'function') timer = setTimeout(() => {
      settle(new Error(copy.timeout));
      if (task && task.abort) task.abort();
    }, timeout);
    const header = { 'Content-Type': 'application/json' };
    if (auth && app.globalData.token) {
      header['Authorization'] = 'Bearer ' + app.globalData.token;
    }
    task = wx.request({
      url: app.globalData.apiBase + url,
      method,
      data,
      header,
      timeout,
      success: (res) => {
        if (finished) return;
        if (auth && app.globalData.token !== token) { settle(new Error(copy.changed)); return; }
        if (res.statusCode === 401 && auth && token) {
          app.rememberCurrentRoute();
          app.clearAuth();
          wx.showToast({ title: copy.expired, icon: 'none' });
          wx.reLaunch({ url: '/pages/index/index' });
          settle(new Error(copy.expired));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          settle(null, res.data);
        } else {
          const detail = res.data && res.data.detail;
          const msg = typeof detail === 'string'
            ? detail
            : (detail && (detail.message || detail.error)) || `${copy.failed} (${res.statusCode})`;
          settle(new Error(msg));
        }
      },
      fail: (err) => settle(new Error(/timeout/i.test(err && err.errMsg || '') ? copy.timeout : copy.network)),
    });
  });
}

function _utf8ByteLength(value) {
  return encodeURIComponent(value).replace(/%[0-9a-f]{2}/gi, 'x').length;
}

function _chunkUtf8(value, maxBytes = 2500) {
  const chunks = [];
  let chunk = '';
  let bytes = 0;
  for (const char of Array.from(String(value || ''))) {
    const charBytes = _utf8ByteLength(char);
    if (bytes && bytes + charBytes > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      bytes = 0;
    }
    chunk += char;
    bytes += charBytes;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

// The backend performs the authoritative check. wx.login is intentionally
// called immediately before every chunk so each short-lived code maps to this
// user. No tail of a long input is silently omitted.
const checkUserContent = (content, scene = 2) => new Promise((resolve, reject) => {
  const text = String(content || '').trim();
  if (!text) {
    resolve({ ok: true, allowed: true, skipped: true });
    return;
  }
  const chunks = _chunkUtf8(text);
  const checkChunk = (index) => {
    if (index >= chunks.length) {
      resolve({ ok: true, allowed: true });
      return;
    }
    wx.login({
      success: (loginResult) => {
        if (!loginResult || !loginResult.code) {
          reject(new Error(errors().safety));
          return;
        }
        _request({
          url: '/api/wechat/content-check',
          method: 'POST',
          auth: false,
          timeout: 20000,
          data: { code: loginResult.code, content: chunks[index], scene },
        }).then((result) => {
          if (result && result.allowed === true) {
            checkChunk(index + 1);
            return;
          }
          reject(new Error((result && result.reason) || errors().revise));
        }, () => reject(new Error(errors().safety)));
      },
      fail: () => reject(new Error(errors().safety)),
    });
  };
  checkChunk(0);
});

// ─── 认证 ───────────────────────────────────
const sendVerificationCode = (email, lang = 'zh') =>
  _request({ url: '/api/auth/send-verification-code', method: 'POST', auth: false,
    data: { email, lang } });

const register = (email, password, name, code, lang = 'zh') =>
  _request({ url: '/api/auth/register', method: 'POST', auth: false,
    data: { email, password, name, code, lang } });

const login = (email, password) =>
  _request({ url: '/api/auth/login', method: 'POST', auth: false,
    data: { email, password } });

const wechatLogin = (code, lang = 'zh', referralCode = '') =>
  _request({ url: '/api/auth/wechat/login', method: 'POST', auth: false,
    data: { code, lang, referral_code: referralCode } });

const linkWechat = (code) =>
  _request({ url: '/api/auth/wechat/link', method: 'POST',
    data: { code } });

const me = () => _request({ url: '/api/auth/me' });

// ─── 对话（非流式，小程序专用） ────────────────
// 后端 /api/chat/once 一次性返回完整 JSON（不需要 SSE 解析）
const chatOnce = (messages, system, destination, mode = 'fast') =>
  _request({ url: '/api/chat/once', method: 'POST',
    timeout: 130000,
    data: { messages, system, agent: 'planner', destination, mode, search: true } });

// Public static catalogs only: coalesce simultaneous requests and reuse for five
// minutes across pages. Never cache account, entitlement or order responses.
const catalogCache = new Map();
function publicCatalog(url) {
  const cached = catalogCache.get(url);
  if (cached && (cached.pending || Date.now() < cached.expires)) return cached.promise;
  const entry = { pending: true, expires: 0 };
  entry.promise = _request({ url, auth: false }).then(data => {
    entry.pending = false; entry.expires = Date.now() + 300000;
    return data;
  }, error => {
    if (catalogCache.get(url) === entry) catalogCache.delete(url);
    throw error;
  });
  catalogCache.set(url, entry);
  return entry.promise;
}

// ─── Bali 公共路线与专业路线（与网站共用同一事实源） ───
const baliRouteData = () =>
  publicCatalog('/assets/data/bali-travel-data.json?v=20260911p2');
const baliExtensions = () => publicCatalog('/assets/data/bali-extensions.json?v=20260913p1');
const baliFood = () => publicCatalog('/assets/data/bali-food.json?v=20260913p1');
const baliMediaCatalog = () =>
  _request({ url: '/assets/data/poi-media-catalog.json?v=20260901p1', auth: false });
const imagePublishManifest = () =>
    _request({ url: '/assets/data/image-publish-manifest.json?v=20260913p2', auth: false });
const publicPortfolio = (destination = 'bali') =>
  _request({ url: `/api/portfolio?destination=${encodeURIComponent(destination)}`, auth: false });
const createProfessionalRoute = (tripProfile, routeId = '', lang = 'zh', tripId = '') =>
  _request({ url: '/api/bali/professional-route', method: 'POST', timeout: 15000,
    data: { trip_profile: tripProfile, route_id: routeId, lang, trip_id: tripId } });
const recentUnlockedProfessionalRoute = (lang = 'zh') =>
  _request({ url: `/api/bali/professional-route/recent-unlocked?lang=${encodeURIComponent(lang)}` });

const sendDriverRequest = (data) =>
  _request({ url: '/api/driver-request', method: 'POST', data, timeout: 45000 });
const listDriverRequests = () =>
  _request({ url: '/api/driver-requests/mine' });

// ─── 目的地动态信息 ────────────────────────────
const destInfo = (destination, lang = 'zh') =>
  _request({ url: '/api/dest_info', method: 'POST',
    data: { destination, lang } });

// ─── 酒店比价 ────────────────────────────────
const searchHotels = (destination, checkIn, checkOut, adults = 2, lang = 'zh') =>
  _request({ url: '/api/search/hotels', method: 'POST',
    data: { destination, check_in: checkIn, check_out: checkOut, adults, lang } });

// ─── 机票比价 ────────────────────────────────
const searchFlights = (origin, destination, departDate, returnDate = '', adults = 1, lang = 'zh') =>
  _request({ url: '/api/search/flights', method: 'POST',
    data: { origin, destination, depart_date: departDate, return_date: returnDate, adults, lang } });

// ─── 旅行偏好 ────────────────────────────────
const getPrefs = () => _request({ url: '/api/user/preferences' });
const savePrefs = (preferences) =>
  _request({ url: '/api/user/preferences', method: 'POST', data: { preferences } });

// ─── 对话历史 ────────────────────────────────
const listConversations = () => _request({ url: '/api/conversations' });
const saveConversation = (data) =>
  _request({ url: '/api/conversations', method: 'POST', data });
const getConversation = (convId) =>
  _request({ url: `/api/conversations/${convId}` });
const deleteConversation = (convId) =>
  _request({ url: `/api/conversations/${convId}`, method: 'DELETE' });

module.exports = {
  sendVerificationCode, register, login, wechatLogin, linkWechat, me,
  checkUserContent,
  chatOnce,
  baliRouteData, baliExtensions, baliFood, baliMediaCatalog, imagePublishManifest, publicPortfolio,
  createProfessionalRoute, recentUnlockedProfessionalRoute,
  sendDriverRequest, listDriverRequests,
  destInfo,
  searchHotels, searchFlights,
  getPrefs, savePrefs,
  listConversations, saveConversation, getConversation, deleteConversation,
};
