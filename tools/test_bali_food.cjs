const assert = require('node:assert/strict');
const data = require('../wandermind-studio/frontend/assets/data/bali-food.json');
const travel = require('../wandermind-studio/frontend/assets/data/bali-travel-data.json');
const catalog = require('../wandermind-studio/frontend/assets/data/bali-extensions.json');
const engine = require('../wandermind-studio/frontend/assets/js/bali-itinerary.js');
const copy = require('../wandermind-studio/frontend/assets/js/bali-food-copy.js');
const fs = require('node:fs');
assert.equal(fs.readFileSync(require.resolve('../miniprogram/utils/bali-itinerary.js'),'utf8').trim(),fs.readFileSync(require.resolve('../wandermind-studio/frontend/assets/js/bali-itinerary.js'),'utf8').trim(),'shared itinerary engine must stay identical');
assert.deepEqual(require('../miniprogram/utils/bali-food-copy.js'),copy);
assert.equal(data.restaurants.length,50);
assert.equal(new Set(data.restaurants.map(item => item.id)).size,50);
assert.equal(data.restaurants.filter(item => item.published).length,40);
assert.ok(data.restaurants.filter(item => /yuki.*canggu/i.test(item.id)).every(item => !item.published));
for (const item of data.restaurants) {
  assert.ok(travel.regions.some(region => region.id === item.region));
  assert.equal(item.coordinates,null,'unverified coordinates never become distance facts');
  if (item.published) assert.ok(item.source.some(source => /^https:\/\//.test(source.url)));
  assert.ok(item.suitableDayparts.every(meal => ['breakfast','lunch','dinner','brunch','dessert'].includes(meal)));
}
for (const lang of ['zh','en','ja','ko','id']) {
  assert.ok(Object.entries(copy[lang]).every(([key,value]) => typeof value === 'string' && (value.length || key === 'daySuffix')));
  assert.deepEqual(Object.keys(copy[lang]),Object.keys(copy.en));
}
const ubud = data.restaurants.find(item => item.published && item.region === 'G4' && item.suitableDayparts.includes('lunch'));
let plan = {route_id:'R1',days:[{region_id:'G4',place_ids:[]}]};
const original = JSON.stringify(plan);
plan = engine.addFood(plan,0,ubud,'lunch');
assert.equal(original,JSON.stringify({route_id:'R1',days:[{region_id:'G4',place_ids:[]}]}));
plan = engine.addFood(plan,0,ubud,'dinner');
assert.equal(plan.days[0].food_stops.length,1);
assert.deepEqual(engine.diningStops(plan),[{day:1,restaurant_id:ubud.id,meal:'dinner'}]);
assert.throws(() => engine.addFood(plan,0,ubud,'anything'));
assert.throws(() => engine.addFood(plan,4,ubud,'lunch'));
const island = data.restaurants.find(item => item.published && item.node_id.startsWith('nusa_penida'));
assert.ok(island);
assert.equal(engine.foodCandidates({region_id:'G3'},[island],{}).length,0);
plan = engine.append(plan,catalog,'penida-west');
plan = engine.addFood(plan,1,island,'lunch');
plan = engine.append(plan,catalog,'penida-east');
assert.equal(plan.days[1].food_stops[0].restaurant_id,island.id,'adding another module preserves previous food');
assert.throws(() => engine.addFood(plan,0,island,'lunch'));
assert.equal(engine.foodCandidates(plan.days[0],[ubud],{category:'seafood'}).length,0);
assert.ok(travel.pois.some(item => item.id === 'pererenan_beach' && item.region_id === 'G1'));
console.log('Food source/draft/localization/geography/persistence contracts passed');
