const api = require('../../utils/api.js');
const engine = require('../../utils/bali-itinerary.js');
const COPY = require('../../utils/bali-food-copy.js');
const app = getApp();
const localized = (value, lang) => typeof value === 'string' ? value : (value || {})[lang] || (value || {}).en || '';
Page({
  data: {copy:COPY.zh,loading:true,error:'',items:[],regions:[],categories:[],budgets:[],meals:[],days:[],regionIndex:0,categoryIndex:0,budgetIndex:0,mealIndex:2,dayIndex:0,hasPlan:false},
  onLoad(query) { this.routeId = query.routeId || ''; this.initialDay = Number(query.day || 0); },
  onShow() { this.load(); },
  async load() {
    const lang = app.globalData.currentLang || 'zh', owner = app.privateStorageKey('wm_public_route_plans');
    const copy = COPY[lang] || COPY.zh;
    this.setData({copy,loading:true,error:''}); wx.setNavigationBarTitle({title:copy.title});
    try {
      const [travel,catalog,food] = await Promise.all([api.baliRouteData(),api.baliExtensions(),api.baliFood()]);
      if (owner !== app.privateStorageKey('wm_public_route_plans') || lang !== (app.globalData.currentLang || 'zh')) return;
      this.travel = travel; this.catalog = catalog; this.food = food.restaurants; this.owner = owner;
      this.plans = wx.getStorageSync(owner) || {};
      const route = travel.routes.find(item => item.id === this.routeId);
      this.routeFamily = route;
      this.plan = route ? this.plans[route.id] || {route_id:route.id,days:route.free_outline.map(day=>({region_id:day.region_id,theme:day.theme,place_ids:(day.suggested_poi_ids || []).slice()}))} : null;
      const regions = [{id:'',label:copy.all}].concat(travel.regions.map(item=>({id:item.id,label:localized(item.name,lang)})));
      const labels = ids => [{id:'',label:copy.all}].concat(ids.map(id=>({id,label:copy[id]})));
      const days = this.plan ? this.plan.days.map((day,index)=>({id:index,label:copy.day+' '+(index+1)+' · '+localized(day.theme,lang)})) : [];
      this.setData({regions,categories:labels(['local','seafood','asian','cafe','atmosphere']),budgets:labels(['low','mid','high']),meals:labels(['breakfast','lunch','dinner','brunch','dessert']),days,dayIndex:Math.max(0,Math.min(Number.isInteger(this.initialDay)?this.initialDay:0,days.length-1)),hasPlan:!!this.plan,loading:false});
      this.filter();
    } catch (err) {
      if (owner !== app.privateStorageKey('wm_public_route_plans') || lang !== (app.globalData.currentLang || 'zh')) return;
      this.setData({loading:false,error:copy.failed});
    }
  },
  change(e) { const key = e.currentTarget.dataset.key; if (!['regionIndex','categoryIndex','budgetIndex','mealIndex','dayIndex'].includes(key)) return; this.setData({[key]:Number(e.detail.value)}); this.filter(); },
  filter() {
    const d = this.data, lang = app.globalData.currentLang || 'zh';
    const filters = {category:d.categories[d.categoryIndex].id,price:d.budgets[d.budgetIndex].id,meal:d.meals[d.mealIndex].id};
    let items = this.plan ? engine.foodCandidates(this.plan.days[d.dayIndex],this.food,filters) : this.food.filter(item=>item.published && (!filters.category || item.category===filters.category) && (!filters.price || item.priceLevel===filters.price) && (!filters.meal || item.suitableDayparts.includes(filters.meal)));
    const region = d.regions[d.regionIndex].id;
    if (region) items = items.filter(item=>item.region===region);
    this.setData({items:items.map(item=>({...item,categoryLabel:d.copy[item.category],budgetLabel:d.copy[item.priceLevel],mealLabel:item.suitableDayparts.map(meal=>d.copy[meal]).join(' · '),spend:item.referenceSpend?'IDR '+Number(item.referenceSpend).toLocaleString():'',dateLabel:(item.lastVerified?d.copy.checked:d.copy.research)+': '+(item.lastVerified || item.researchDate)}))});
  },
  add(e) {
    if (this.owner !== app.privateStorageKey('wm_public_route_plans')) { this.load(); return; }
    const item = this.food.find(food=>food.id===e.currentTarget.dataset.id);
    if (!item) return;
    if (!this.plan) { this.chooseRoute((item.routeIds || []).find(id=>this.travel.routes.some(route=>route.id===id))); return; }
    try {
      const plan = engine.addFood(this.plan,this.data.dayIndex,item,this.data.meals[this.data.mealIndex].id || (item.suitableDayparts.includes('lunch') ? 'lunch' : item.suitableDayparts[0]));
      const plans = {...this.plans,[this.routeFamily.id]:plan};
      wx.setStorageSync(this.owner,plans); this.plan=plan; this.plans=plans;
      wx.showToast({title:this.data.copy.saved,icon:'none'});
    } catch (_) { wx.showToast({title:this.data.copy.failed,icon:'none'}); }
  },
  source(e) {
    const item = this.food.find(food=>food.id===e.currentTarget.dataset.id);
    if (!item) return;
    const url = e.currentTarget.dataset.kind==='map' ? 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(item.name+', '+item.area+', Bali') : item.source[0].url;
    wx.setClipboardData({data:url});
  },
  chooseRoute(routeId) {
    try {
      if (routeId) wx.setStorageSync(app.privateStorageKey('wm_bali_route_selection'),routeId);
      wx.switchTab({url:'/pages/itinerary/itinerary'});
    } catch (_) { wx.showToast({title:this.data.copy.failed,icon:'none'}); }
  },
  browse() { this.chooseRoute(this.routeId); },
  retry() { this.load(); },
});
