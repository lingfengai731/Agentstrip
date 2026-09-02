// utils/api.js — 后端 API 封装
// 所有请求统一走 Render 部署的 WanderMind 后端

const app = getApp();

function _request({ url, method = 'GET', data, auth = true, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' };
    if (auth && app.globalData.token) {
      header['Authorization'] = 'Bearer ' + app.globalData.token;
    }
    wx.request({
      url: app.globalData.apiBase + url,
      method,
      data,
      header,
      timeout,
      success: (res) => {
        if (res.statusCode === 401) {
          app.rememberCurrentRoute();
          app.clearAuth();
          wx.showToast({ title: '登录已过期', icon: 'none' });
          wx.reLaunch({ url: '/pages/index/index' });
          reject(new Error('Unauthorized'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const detail = res.data && res.data.detail;
          const msg = typeof detail === 'string'
            ? detail
            : (detail && (detail.message || detail.error)) || `请求失败 ${res.statusCode}`;
          reject(new Error(msg));
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
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
          reject(new Error('内容安全校验暂不可用，请稍后重试'));
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
          reject(new Error((result && result.reason) || '这段内容暂时无法提交，请修改后重试'));
        }, () => reject(new Error('内容安全校验暂不可用，请稍后重试')));
      },
      fail: () => reject(new Error('内容安全校验暂不可用，请稍后重试')),
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

const me = () => _request({ url: '/api/auth/me' });

// ─── 对话（非流式，小程序专用） ────────────────
// 后端 /api/chat/once 一次性返回完整 JSON（不需要 SSE 解析）
const chatOnce = (messages, system, destination, mode = 'fast') =>
  _request({ url: '/api/chat/once', method: 'POST',
    timeout: 130000,
    data: { messages, system, agent: 'planner', destination, mode, search: true } });

// ─── Bali 公共路线与专业路线（与网站共用同一事实源） ───
const baliRouteData = () =>
  _request({ url: '/assets/data/bali-travel-data.json?v=20260831', auth: false });
const createProfessionalRoute = (tripProfile, routeId = '', lang = 'zh', tripId = '') =>
  _request({ url: '/api/bali/professional-route', method: 'POST',
    data: { trip_profile: tripProfile, route_id: routeId, lang, trip_id: tripId } });
const recentUnlockedProfessionalRoute = (lang = 'zh') =>
  _request({ url: `/api/bali/professional-route/recent-unlocked?lang=${encodeURIComponent(lang)}` });

const sendDriverRequest = (data) =>
  _request({ url: '/api/driver-request', method: 'POST', data, timeout: 45000 });

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
  sendVerificationCode, register, login, me,
  checkUserContent,
  chatOnce,
  baliRouteData, createProfessionalRoute, recentUnlockedProfessionalRoute,
  sendDriverRequest,
  destInfo,
  searchHotels, searchFlights,
  getPrefs, savePrefs,
  listConversations, saveConversation, getConversation, deleteConversation,
};
