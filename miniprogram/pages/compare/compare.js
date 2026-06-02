// pages/compare/compare.js — 酒店 + 机票比价
const api = require('../../utils/api.js');
const { DESTINATIONS } = require('../../utils/const.js');
const { HOTEL_AREAS, DEPARTURE_CITIES } = require('../../utils/areas.js');

const app = getApp();

// 格式化日期 YYYY-MM-DD
function _fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 格式化时长：90 -> "1h 30m"
function _fmtDuration(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return (h ? `${h}h ` : '') + (m ? `${m}m` : '');
}

function _fmtTime(t) {
  if (!t) return '';
  const m = t.match(/\d{1,2}:\d{2}/);
  return m ? m[0] : t;
}

Page({
  data: {
    destFlag: '🌺',
    destName: '巴厘岛',
    tab: 'hotels',
    today: '',
    adultsRange: ['1人', '2人', '3人', '4人'],

    // —— 酒店 ——
    areas: [],
    currentArea: 'all',
    hotelCheckIn: '',
    hotelCheckOut: '',
    hotelAdultsIdx: 1,    // index 1 = 2 人
    hotelBusy: false,
    hotelResults: [],
    hotelSearched: false,

    // —— 机票 ——
    cities: DEPARTURE_CITIES,
    flightOrigin: 'PVG',
    customOriginName: '',
    flightTripType: 'round',
    flightDepart: '',
    flightReturn: '',
    flightAdultsIdx: 0,   // index 0 = 1 人
    flightBusy: false,
    flightResults: [],
    flightSearched: false,
    flightBookingUrl: '',
  },

  onLoad() {
    this._syncDestFromGlobal();
    this._initDates();
  },

  onShow() {
    this._syncDestFromGlobal();
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
      areas: HOTEL_AREAS[destId] || HOTEL_AREAS.custom,
      currentArea: 'all',
    });
  },

  _initDates() {
    const now = new Date();
    const ci  = new Date(now); ci.setDate(now.getDate() + 1);
    const co  = new Date(now); co.setDate(now.getDate() + 4);
    const dep = new Date(now); dep.setDate(now.getDate() + 14);
    const ret = new Date(now); ret.setDate(now.getDate() + 21);
    this.setData({
      today: _fmtDate(now),
      hotelCheckIn:  _fmtDate(ci),
      hotelCheckOut: _fmtDate(co),
      flightDepart:  _fmtDate(dep),
      flightReturn:  _fmtDate(ret),
    });
  },

  // —— 子 tab ——
  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  // —— 区域选择 ——
  selectArea(e) {
    this.setData({ currentArea: e.currentTarget.dataset.key });
  },

  // —— 酒店日期 / 人数 ——
  onCheckIn(e)      { this.setData({ hotelCheckIn:  e.detail.value, hotelSearched: false }); },
  onCheckOut(e)     { this.setData({ hotelCheckOut: e.detail.value, hotelSearched: false }); },
  onHotelAdults(e)  { this.setData({ hotelAdultsIdx: parseInt(e.detail.value) }); },

  // —— 机票出发城市 ——
  selectOrigin(e) {
    const iata = e.currentTarget.dataset.iata;
    this.setData({ flightOrigin: iata, customOriginName: '' });
  },
  customOrigin() {
    wx.showModal({
      title: '其他出发城市',
      placeholderText: '输入城市名或 IATA 代码',
      editable: true,
      success: (res) => {
        if (res.confirm && res.content) {
          const v = res.content.trim();
          if (v) {
            this.setData({
              flightOrigin: '__custom__',
              customOriginName: v,
            });
          }
        }
      }
    });
  },

  // —— 机票日期 / 类型 / 人数 ——
  setTripType(e)      { this.setData({ flightTripType: e.currentTarget.dataset.type, flightSearched: false }); },
  onFlightDepart(e)   { this.setData({ flightDepart:  e.detail.value, flightSearched: false }); },
  onFlightReturn(e)   { this.setData({ flightReturn:  e.detail.value, flightSearched: false }); },
  onFlightAdults(e)   { this.setData({ flightAdultsIdx: parseInt(e.detail.value) }); },

  // —— 搜索酒店 ——
  async searchHotelsHandler() {
    if (!app.globalData.token) return this._needLogin();

    const { hotelCheckIn, hotelCheckOut, hotelAdultsIdx, currentArea, areas, destName } = this.data;
    if (!hotelCheckIn || !hotelCheckOut) {
      return wx.showToast({ title: '请选择日期', icon: 'none' });
    }
    if (hotelCheckOut <= hotelCheckIn) {
      return wx.showToast({ title: '退房日期必须晚于入住', icon: 'none' });
    }

    // 拼接区域关键词
    const area = areas.find(a => a.key === currentArea);
    const dest = area && area.q ? `${area.q}, ${destName}` : destName;

    this.setData({ hotelBusy: true });
    try {
      const data = await api.searchHotels(dest, hotelCheckIn, hotelCheckOut, hotelAdultsIdx + 1, 'zh');
      this.setData({
        hotelResults: data.hotels || [],
        hotelSearched: true,
      });
    } catch (err) {
      wx.showModal({ title: '搜索失败', content: err.message, showCancel: false });
    } finally {
      this.setData({ hotelBusy: false });
    }
  },

  openHotelLink(e) {
    const link = e.currentTarget.dataset.link;
    if (!link) return;
    wx.setClipboardData({
      data: link,
      success: () => wx.showToast({ title: '链接已复制，去浏览器打开', icon: 'none', duration: 2500 }),
    });
  },

  // —— 搜索机票 ——
  async searchFlightsHandler() {
    if (!app.globalData.token) return this._needLogin();

    const { flightTripType, flightDepart, flightReturn, flightAdultsIdx, flightOrigin, customOriginName, destName } = this.data;
    const origin = flightOrigin === '__custom__' ? customOriginName : flightOrigin;
    if (!origin) return wx.showToast({ title: '请选择出发城市', icon: 'none' });
    if (!flightDepart) return wx.showToast({ title: '请选择起飞日期', icon: 'none' });
    const ret = flightTripType === 'round' ? flightReturn : '';
    if (ret && ret <= flightDepart) {
      return wx.showToast({ title: '返回日期必须晚于起飞', icon: 'none' });
    }

    this.setData({ flightBusy: true });
    try {
      const data = await api.searchFlights(origin, destName, flightDepart, ret, flightAdultsIdx + 1, 'zh');
      // 格式化返回字段
      const enriched = (data.flights || []).map(f => ({
        ...f,
        depart_time_short: _fmtTime(f.depart_time),
        arrive_time_short: _fmtTime(f.arrive_time),
        duration_label:    _fmtDuration(f.duration_min),
        stops_label: f.stops === 0 ? '✅ 直飞'
                    : f.stops === 1 ? `1 次中转${f.layover_codes && f.layover_codes[0] ? ' · ' + f.layover_codes[0] : ''}`
                    : `${f.stops} 次中转`,
      }));
      this.setData({
        flightResults: enriched,
        flightSearched: true,
        flightBookingUrl: data.booking_url || '',
      });
    } catch (err) {
      wx.showModal({ title: '搜索失败', content: err.message, showCancel: false });
    } finally {
      this.setData({ flightBusy: false });
    }
  },

  openFlightLink() {
    const url = this.data.flightBookingUrl;
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制，去浏览器打开', icon: 'none', duration: 2500 }),
    });
  },

  _needLogin() {
    wx.showModal({
      title: '请先登录',
      content: '需要登录后才能使用比价功能',
      showCancel: false,
      success: () => wx.switchTab({ url: '/pages/index/index' }),
    });
  },
});
