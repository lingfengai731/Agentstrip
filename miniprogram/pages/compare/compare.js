// pages/compare/compare.js — 酒店 + 机票比价
const api = require('../../utils/api.js');
const { DESTINATIONS } = require('../../utils/const.js');
const { HOTEL_AREAS, DEPARTURE_CITIES } = require('../../utils/areas.js');

const app = getApp();
const COPY = require('./copy.js');
const DEST_COPY = require('../index/copy.js');

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
    copy: COPY.zh,
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
    const lang=app.globalData.currentLang || 'zh', copy=COPY[lang] || COPY.zh;
    const changed=this._lastDest !== app.globalData.currentDest || this._lastLang !== lang;
    const destId = app.globalData.currentDest;
    const destCopy=DEST_COPY[lang] || DEST_COPY.zh;
    this.setData({copy});
    wx.setNavigationBarTitle({title:copy.title});
    if(app.updateTabBarLanguage) app.updateTabBarLanguage();
    let name = this.data.copy.custom;
    if (destId === 'custom') {
      name = app.globalData.customDestName || this.data.copy.custom;
    } else {
      const d = DESTINATIONS.find(x => x.id === destId);
      if (d) name = destCopy[d.id] || d.name;
    }
    this.setData({
      destName: name,
      areas: (HOTEL_AREAS[destId] || HOTEL_AREAS.custom).map(a=>({...a,name:a.key==='all'?copy.all:lang==='zh'?a.name:a.q})),
      cities: DEPARTURE_CITIES.map(c=>({...c,name:lang==='zh'?c.name:({PVG:'Shanghai',PEK:'Beijing',CAN:'Guangzhou',SZX:'Shenzhen',CTU:'Chengdu',HKG:'Hong Kong',HGH:'Hangzhou',XIY:'Xi’an'})[c.iata]})),
      adultsRange:[1,2,3,4].map(n=>n+' '+copy.person),
      ...(changed?{currentArea:'all',hotelResults:[],flightResults:[],flightBookingUrl:'',hotelSearched:false,flightSearched:false}:{}),
    });
    this._lastDest=destId; this._lastLang=lang;
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
      title: this.data.copy.customTitle,
      placeholderText: this.data.copy.customHint,
      editable: true, confirmText:this.data.copy.confirm, cancelText:this.data.copy.cancel,
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
    if(this.data.hotelBusy) return;
    if (!app.globalData.token) return this._needLogin();

    const { hotelCheckIn, hotelCheckOut, hotelAdultsIdx, currentArea, areas, destName } = this.data;
    if (!hotelCheckIn || !hotelCheckOut) {
      return wx.showToast({ title: this.data.copy.datesRequired, icon: 'none' });
    }
    if (hotelCheckOut <= hotelCheckIn) {
      return wx.showToast({ title: this.data.copy.checkoutInvalid, icon: 'none' });
    }

    // 拼接区域关键词
    const area = areas.find(a => a.key === currentArea);
    const dest = area && area.q ? `${area.q}, ${destName}` : destName;

    this.setData({ hotelBusy: true });
    try {
      const data = await api.searchHotels(dest, hotelCheckIn, hotelCheckOut, hotelAdultsIdx + 1, app.globalData.currentLang || 'zh');
      this.setData({
        hotelResults: data.hotels || [],
        hotelSearched: true,
      });
    } catch (err) {
      wx.showModal({ title: this.data.copy.failed, content: err.message, showCancel: false });
    } finally {
      this.setData({ hotelBusy: false });
    }
  },

  openHotelLink(e) {
    const link = e.currentTarget.dataset.link;
    if (!link) return wx.showToast({title:this.data.copy.missingLink,icon:'none'});
    wx.setClipboardData({
      data: link,
      fail:()=>wx.showToast({title:this.data.copy.copyFailed,icon:'none'}),
      success: () => wx.showToast({ title: this.data.copy.copied, icon: 'none', duration: 2500 }),
    });
  },

  // —— 搜索机票 ——
  async searchFlightsHandler() {
    if(this.data.flightBusy) return;
    if (!app.globalData.token) return this._needLogin();

    const { flightTripType, flightDepart, flightReturn, flightAdultsIdx, flightOrigin, customOriginName, destName } = this.data;
    const origin = flightOrigin === '__custom__' ? customOriginName : flightOrigin;
    if (!origin) return wx.showToast({ title: this.data.copy.originRequired, icon: 'none' });
    if (!flightDepart) return wx.showToast({ title: this.data.copy.departRequired, icon: 'none' });
    const ret = flightTripType === 'round' ? flightReturn : '';
    if (flightTripType === 'round' && (!ret || ret <= flightDepart)) {
      return wx.showToast({ title: this.data.copy.returnInvalid, icon: 'none' });
    }

    this.setData({ flightBusy: true });
    try {
      const data = await api.searchFlights(origin, destName, flightDepart, ret, flightAdultsIdx + 1, app.globalData.currentLang || 'zh');
      // 格式化返回字段
      const enriched = (data.flights || []).map(f => ({
        ...f,
        depart_time_short: _fmtTime(f.depart_time),
        arrive_time_short: _fmtTime(f.arrive_time),
        duration_label:    _fmtDuration(f.duration_min),
        stops_label: f.stops === 0 ? this.data.copy.direct : `${f.stops} ${this.data.copy.stops}`,
      }));
      this.setData({
        flightResults: enriched,
        flightSearched: true,
        flightBookingUrl: data.booking_url || '',
      });
    } catch (err) {
      wx.showModal({ title: this.data.copy.failed, content: err.message, showCancel: false });
    } finally {
      this.setData({ flightBusy: false });
    }
  },

  openFlightLink() {
    const url = this.data.flightBookingUrl;
    if (!url) return wx.showToast({title:this.data.copy.missingLink,icon:'none'});
    wx.setClipboardData({
      data: url,
      fail:()=>wx.showToast({title:this.data.copy.copyFailed,icon:'none'}),
      success: () => wx.showToast({ title: this.data.copy.copied, icon: 'none', duration: 2500 }),
    });
  },

  _needLogin() {
    wx.showModal({
      title: this.data.copy.login,
      content: this.data.copy.loginHint,
      showCancel: false, confirmText:this.data.copy.confirm,
      success: () => wx.switchTab({ url: '/pages/index/index' }),
    });
  },
});
