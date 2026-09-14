const assert = require('node:assert/strict');
const data = require('../wandermind-studio/frontend/assets/data/bali-travel-data.json');
const catalog = require('../wandermind-studio/frontend/assets/data/bali-extensions.json');
const engine = require('../wandermind-studio/frontend/assets/js/bali-itinerary.js');
const pois = data.pois.concat(catalog.pois);
assert.equal(data.routes.length, 6);
assert.equal(new Set(pois.map(p => p.id)).size, pois.length);
for (const ext of catalog.extensions) {
  assert.equal(ext.departure_port, 'Sanur');
  assert.equal(ext.duration_days, 1);
  assert.ok(ext.source.every(s => s.url.startsWith('https://')));
  for (const lang of ['zh','en','ja','ko','id']) assert.ok(ext.name[lang] && ext.summary[lang]);
  for (const id of ext.poi_ids) assert.ok(pois.some(p => p.id === id), id);
}
const mainland = engine.candidates({region_id:'G3',place_ids:['sanur_beach']}, pois, [], catalog);
assert.ok(mainland.length);
assert.ok(mainland.every(p => p.node_id === 'sanur'));
const west = engine.candidates({region_id:'G3',place_ids:['kelingking_beach']}, pois, [], catalog);
assert.ok(west.every(p => p.node_id === 'nusa_penida_west'));
let plan = {route_id:'R1',days:[{region_id:'G1',place_ids:[]}]};
plan = engine.append(plan, catalog, 'penida-west');
plan = engine.append(plan, catalog, 'penida-west');
assert.equal(plan.days.length, 2, 'no duplicate module');
plan = engine.append(plan, catalog, 'penida-east');
plan = engine.append(plan, catalog, 'penida-snorkeling');
assert.equal(plan.days.length, 4, 'three modules use three separate days');
assert.equal(engine.append(plan, catalog, 'invented').days.length, 4);
assert.equal(engine.remove(plan, 'penida-east').days.length, 3);
assert.equal(engine.append({route_id:'R2',days:[]}, catalog, 'penida-west').days.length, 0);
assert.deepEqual(engine.candidates(plan.days[3],pois,['penida_snorkeling_session'],catalog).map(p=>p.id).sort(),
  ['crystal_bay','gamat_bay','manta_bay','toyapakeh_wall'].sort());
console.log('Bali extension catalog and geographic contracts passed');
