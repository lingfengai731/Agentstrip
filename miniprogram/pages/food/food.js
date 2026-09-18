const api = require('../../utils/api.js');
const engine = require('../../utils/bali-itinerary.js');
const COPY = require('../../utils/bali-food-copy.js');
const TAXONOMY = require('../../utils/bali-food-taxonomy.js');
const app = getApp();
const FILTER_FIELDS = {regionIndex:['regions','region'],categoryIndex:['categories','category'],cuisineIndex:['cuisines','cuisine'],sceneIndex:['scenes','scene'],budgetIndex:['budgets','budget'],mealIndex:['meals','meal']};
const CLOSE_LABEL = {zh:'关闭',en:'Close',ja:'閉じる',ko:'닫기',id:'Tutup'};
const localized = (value, lang) => typeof value === 'string' ? value : (value || {})[lang] || (value || {}).en || '';
const dayLabel = (copy, index, theme, lang) => copy.day + ' ' + (index + 1) + (copy.daySuffix || '') + ' · ' + localized(theme, lang);
Page({
  data: {copy:COPY.zh,loading:true,error:'',items:[],regions:[],categories:[],cuisines:[],scenes:[],budgets:[],meals:[],days:[],regionIndex:0,categoryIndex:0,cuisineIndex:0,sceneIndex:0,budgetIndex:0,mealIndex:2,dayIndex:0,hasPlan:false},
  onLoad(query) { this.routeId = query.routeId || ''; this.initialDay = Number(query.day || 0); },
  onShow() { this.load(); },
  async load() {
    const lang = app.globalData.currentLang || 'zh', owner = app.privateStorageKey('wm_public_route_plans');
    const copy = COPY[lang] || COPY.zh;
    this.setData({copy,loading:true,error:'',filterOpen:false,closeLabel:CLOSE_LABEL[lang] || CLOSE_LABEL.en}); wx.setNavigationBarTitle({title:copy.title});
    try {
      const [travel,food] = await Promise.all([api.baliRouteData(),api.baliFood()]);
      if (owner !== app.privateStorageKey('wm_public_route_plans') || lang !== (app.globalData.currentLang || 'zh')) return;
      this.travel = travel; this.food = food.restaurants; this.owner = owner;
      this.plans = wx.getStorageSync(owner) || {};
      const route = travel.routes.find(item => item.id === this.routeId);
      this.routeFamily = route;
      this.plan = route ? this.plans[route.id] || {route_id:route.id,days:route.free_outline.map(day=>({region_id:day.region_id,theme:day.theme,place_ids:(day.suggested_poi_ids || []).slice()}))} : null;
      const regions = [{id:'',label:copy.all}].concat(travel.regions.map(item=>({id:item.id,label:localized(item.name,lang)})));
      const labels = ids => [{id:'',label:copy.all}].concat(ids.map(id=>({id,label:copy[id]})));
      const days = this.plan ? this.plan.days.map((day,index)=>({id:index,label:dayLabel(copy,index,day.theme,lang)})) : [];
      this.setData({regions,categories:labels(['local','seafood','asian','cafe','atmosphere']),cuisines:TAXONOMY.collectOptions(this.food,'cuisine',lang,copy.all),scenes:TAXONOMY.collectOptions(this.food,'scene',lang,copy.all),budgets:labels(['low','mid','high']),meals:labels(['breakfast','lunch','dinner','brunch','dessert']),days,dayIndex:Math.max(0,Math.min(Number.isInteger(this.initialDay)?this.initialDay:0,Math.max(days.length-1,0))),hasPlan:!!this.plan,loading:false});
      this.filter();
    } catch (err) {
      if (owner !== app.privateStorageKey('wm_public_route_plans') || lang !== (app.globalData.currentLang || 'zh')) return;
      this.setData({loading:false,error:err.message || copy.failed});
    }
  },
  openFilter(e) {
    const key = e.currentTarget.dataset.key, field = FILTER_FIELDS[key];
    if (!field || this.data.loading || this.data.error) return;
    const options = this.data[field[0]];
    if (!options || !options.length) return;
    this.setData({filterOpen:true,filterKey:key,filterTitle:this.data.copy[field[1]],filterOptions:options,filterSelected:this.data[key]});
  },
  closeFilter() { this.setData({filterOpen:false}); },
  selectFilter(e) {
    if (!this.data.filterOpen || this.owner !== app.privateStorageKey('wm_public_route_plans')) { this.closeFilter(); return; }
    const key = this.data.filterKey, field = FILTER_FIELDS[key], index = Number(e.currentTarget.dataset.index);
    if (!field || !Number.isInteger(index) || index < 0 || index >= this.data[field[0]].length) return;
    this.setData({[key]:index,filterOpen:false}); this.filter();
  },
  change(e) { const key = e.currentTarget.dataset.key, index = Number(e.detail.value); const list = key === 'dayIndex' ? this.data.days : FILTER_FIELDS[key] && this.data[FILTER_FIELDS[key][0]]; if (!list || !Number.isInteger(index) || index < 0 || index >= list.length) return; this.setData({[key]:index}); this.filter(); },
  filter() {
    const d = this.data, lang = app.globalData.currentLang || 'zh';
    this.setData({addLabel:d.copy.add.replace('{day}',d.dayIndex + 1)});
    const category = d.categories[d.categoryIndex] || {id:''}, cuisine = d.cuisines[d.cuisineIndex] || {id:''}, scene = d.scenes[d.sceneIndex] || {id:''}, budget = d.budgets[d.budgetIndex] || {id:''}, meal = d.meals[d.mealIndex] || {id:''};
    const filters = {category:category.id,cuisine:cuisine.id,scene:scene.id,price:budget.id,meal:meal.id};
    const baseFilters = {category:filters.category,price:filters.price,meal:filters.meal};
    let items = this.plan ? engine.foodCandidates(this.plan.days[d.dayIndex],this.food,baseFilters) : this.food.filter(item=>item.published && (!baseFilters.price || item.priceLevel===baseFilters.price) && (!baseFilters.meal || item.suitableDayparts.includes(baseFilters.meal)));
    items = TAXONOMY.filter(items,{category:filters.category,cuisine:filters.cuisine,scene:filters.scene});
    const region = (d.regions[d.regionIndex] || {id:''}).id;
    if (region) items = items.filter(item=>item.region===region);
    this.setData({items:items.map(item=>({...item,categoryLabel:d.copy[item.category],budgetLabel:d.copy[item.priceLevel],mealLabel:item.suitableDayparts.map(mealId=>d.copy[mealId]).join(' · '),spend:item.referenceSpend?'IDR '+Number(item.referenceSpend).toLocaleString():'',dateLabel:(item.lastVerified?d.copy.checked:d.copy.research)+': '+(item.lastVerified || item.researchDate)}))});
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
