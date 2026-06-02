// utils/api.js — 后端 API 封装
// 所有请求统一走 Render 部署的 WanderMind 后端

const app = getApp();

function _request({ url, method = 'GET', data, auth = true }) {
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
      timeout: 60000,
      success: (res) => {
        if (res.statusCode === 401) {
          // 登录态失效
          app.clearAuth();
          wx.showToast({ title: '登录已过期', icon: 'none' });
          wx.reLaunch({ url: '/pages/index/index' });
          reject(new Error('Unauthorized'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const msg = (res.data && res.data.detail) || `请求失败 ${res.statusCode}`;
          reject(new Error(msg));
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
  });
}

// ─── 认证 ───────────────────────────────────
const register = (email, password, name) =>
  _request({ url: '/api/auth/register', method: 'POST', auth: false,
    data: { email, password, name } });

const login = (email, password) =>
  _request({ url: '/api/auth/login', method: 'POST', auth: false,
    data: { email, password } });

const me = () => _request({ url: '/api/auth/me' });

// ─── 对话（非流式，小程序专用） ────────────────
// 后端 /api/chat/once 一次性返回完整 JSON（不需要 SSE 解析）
const chatOnce = (messages, system, destination, mode = 'fast') =>
  _request({ url: '/api/chat/once', method: 'POST',
    data: { messages, system, agent: 'planner', destination, mode, search: true } });

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

module.exports = {
  register, login, me,
  chatOnce,
  destInfo,
  searchHotels, searchFlights,
  getPrefs, savePrefs,
  listConversations, saveConversation, getConversation,
};
