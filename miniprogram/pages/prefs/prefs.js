const api = require('../../utils/api.js');
const COPY = require('./copy.js');
const app = getApp();
const options = (values, copy, selected = []) => values.map(value => ({ value, label: copy[value], selected: selected.includes(value) }));
Page({
  data: { copy: COPY.zh, budgetOptions: [], styleOptions: [], partyOptions: [], budgetLevel: '', styleList: [], party: '', notes: '', busy: false, hasAny: false },
  onLoad() {
    this._edited = false;
    this._apply(app.globalData.preferences || {});
    this._loadFromServer();
  },
  onShow() {
    const copy = COPY[app.globalData.currentLang] || COPY.zh;
    this.setData({ copy, budgetOptions: options(['budget','midrange','luxury'],copy), partyOptions: options(['solo','couple','family','group'],copy), styleOptions: options(['culture','food','adventure','relax','nature','wellness'],copy,this.data.styleList) });
    wx.setNavigationBarTitle({ title: copy.title });
  },
  _apply(p) {
    const styleList = Array.isArray(p.styleList) ? p.styleList : [];
    this.setData({ budgetLevel:p.budgetLevel || '', styleList, party:p.party || '', notes:p.notes || '', hasAny:this._hasAny(p), styleOptions:options(['culture','food','adventure','relax','nature','wellness'],this.data.copy,styleList) });
  },
  async _loadFromServer() {
    const token = app.globalData.token;
    if (!token) return;
    try {
      const p = await api.getPrefs() || {};
      if (app.globalData.token !== token || this._edited) return;
      app.setPrefs(p);
      this._apply(p);
    } catch (_) { /* Keep the local version on read failure. */ }
  },
  _hasAny(p) { return !!(p.budgetLevel || p.party || (p.notes || '').trim() || (p.styleList || []).length); },
  selectBudget(e) { if (this.data.busy) return; this._edited=true; const v=e.currentTarget.dataset.value; this.setData({budgetLevel:this.data.budgetLevel===v?'':v,hasAny:false}); },
  selectParty(e) { if (this.data.busy) return; this._edited=true; const v=e.currentTarget.dataset.value; this.setData({party:this.data.party===v?'':v,hasAny:false}); },
  toggleStyle(e) {
    if (this.data.busy) return;
    this._edited=true;
    const v=e.currentTarget.dataset.value, list=this.data.styleList.slice(), i=list.indexOf(v);
    if(i>=0) list.splice(i,1); else list.push(v);
    this.setData({styleList:list,styleOptions:options(['culture','food','adventure','relax','nature','wellness'],this.data.copy,list),hasAny:false});
  },
  onNotesChange(e) { if(this.data.busy) return; this._edited=true; this.setData({notes:e.detail.value,hasAny:false}); },
  async savePrefs() {
    if(this.data.busy) return;
    const token=app.globalData.token, copy=this.data.copy;
    if(!token) { wx.showModal({title:copy.login,content:copy.loginHint,confirmText:copy.confirm,showCancel:false,success:()=>wx.switchTab({url:'/pages/index/index'})}); return; }
    const prefs={budgetLevel:this.data.budgetLevel,styleList:this.data.styleList,party:this.data.party,notes:(this.data.notes||'').trim()};
    this.setData({busy:true});
    try {
      await api.checkUserContent(prefs.notes, 2);
      if(app.globalData.token!==token) return;
      await api.savePrefs(prefs);
      if(app.globalData.token!==token) return;
      app.setPrefs(prefs); this._edited=false; this._apply(prefs);
      wx.showToast({title:copy.saved,icon:'success'});
    } catch(err) { if(app.globalData.token===token) wx.showModal({title:copy.failed,content:err.message||copy.failed,confirmText:copy.confirm,showCancel:false}); }
    finally { if(app.globalData.token===token) this.setData({busy:false}); }
  },
  clearPrefs() {
    if(this.data.busy) return;
    const copy=this.data.copy, token=app.globalData.token;
    wx.showModal({title:copy.clearTitle,content:copy.clearAsk,confirmText:copy.confirm,cancelText:copy.cancel,success:async res=>{
      if(!res.confirm || this.data.busy || app.globalData.token!==token) return;
      const empty={budgetLevel:'',styleList:[],party:'',notes:''};
      this.setData({busy:true});
      try {
        if(token) await api.savePrefs(empty);
        if(app.globalData.token!==token) return;
        app.setPrefs(empty); this._edited=false; this._apply(empty);
        wx.showToast({title:copy.cleared,icon:'none'});
      } catch(err) { if(app.globalData.token===token) wx.showModal({title:copy.failed,content:err.message||copy.failed,confirmText:copy.confirm,showCancel:false}); }
      finally { if(app.globalData.token===token) this.setData({busy:false}); }
    }});
  }
});
