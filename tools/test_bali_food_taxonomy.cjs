const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const data = require(path.join(root, 'wandermind-studio/frontend/assets/data/bali-food.json'));
const webTaxonomy = require(path.join(root, 'wandermind-studio/frontend/assets/js/bali-food-taxonomy.js'));
const miniTaxonomy = require(path.join(root, 'miniprogram/utils/bali-food-taxonomy.js'));
const webCopy = require(path.join(root, 'wandermind-studio/frontend/assets/js/bali-food-copy.js'));
const miniCopy = require(path.join(root, 'miniprogram/utils/bali-food-copy.js'));

assert.deepEqual(webTaxonomy.languages, miniTaxonomy.languages, 'web and Mini taxonomy languages must match');
assert.deepEqual(webTaxonomy.labels, miniTaxonomy.labels, 'web and Mini taxonomy labels must match');
assert.equal(
  fs.readFileSync(path.join(root, 'wandermind-studio/frontend/assets/js/bali-food-taxonomy.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'miniprogram/utils/bali-food-taxonomy.js'), 'utf8'),
  'web and Mini taxonomy matcher source must stay identical'
);
assert.deepEqual(webCopy, miniCopy, 'web and Mini Food copy must stay identical');
assert.deepEqual(webTaxonomy.languages, ['zh', 'en', 'ja', 'ko', 'id']);

for (const field of ['cuisine', 'scene']) {
  const expected = new Set(data.restaurants.filter(item => item.published).flatMap(item => webTaxonomy.values(item[field])));
  for (const lang of webTaxonomy.languages) {
    const options = webTaxonomy.collectOptions(data.restaurants, field, lang, webCopy[lang].all);
    const actual = new Set(options.slice(1).map(item => item.id));
    assert.deepEqual(actual, expected, `${field} options must come only from explicit published metadata`);
    assert.ok(options.every(item => item.label), `${field} labels must be human-readable in ${lang}`);
  }
}

const sundara = data.restaurants.find(item => item.id === 'bali-food-sundara');
assert.ok(sundara);
assert.equal(webTaxonomy.matches(sundara, {category:'seafood', cuisine:'seafood', scene:'sunset'}), true);
assert.equal(webTaxonomy.matches(sundara, {cuisine:'Japanese'}), false);
assert.equal(webTaxonomy.matches(sundara, {cuisine:'seafood', scene:'fine dining'}), false);
assert.equal(webTaxonomy.values('seafood')[0], 'seafood', 'string metadata must match like an explicit array value');
const before = JSON.stringify(sundara);
assert.equal(webTaxonomy.filter([sundara], {cuisine:'seafood'}).length, 1);
assert.equal(JSON.stringify(sundara), before, 'taxonomy matching must not rewrite restaurant facts');

for (const lang of webTaxonomy.languages) {
  assert.ok(webCopy[lang].cuisine && webCopy[lang].scene);
  assert.ok(Object.values(webCopy[lang]).every(value => typeof value === 'string'));
  assert.ok(Object.prototype.hasOwnProperty.call(webCopy[lang], 'daySuffix'));
  assert.notEqual(webCopy[lang].handoff, '发送给司机');
}

const taxonomySources = [
  fs.readFileSync(path.join(root, 'wandermind-studio/frontend/assets/js/bali-food-taxonomy.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'miniprogram/utils/bali-food-taxonomy.js'), 'utf8'),
];
assert.ok(taxonomySources.every(source => !/halal|vegetarian/i.test(source)), 'taxonomy must not infer dietary suitability');
const webFood = fs.readFileSync(path.join(root, 'wandermind-studio/frontend/assets/js/bali-food.js'), 'utf8');
const miniFood = fs.readFileSync(path.join(root, 'miniprogram/pages/food/food.js'), 'utf8');
const miniWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/food/food.wxml'), 'utf8');
const miniWxss = fs.readFileSync(path.join(root, 'miniprogram/pages/food/food.wxss'), 'utf8');
assert.match(webFood, /food-cuisine/);
assert.match(webFood, /food-scene/);
assert.match(webFood, /taxonomy\.filter/);
assert.match(webFood, /daySuffix/);
assert.match(miniFood, /bali-food-taxonomy\.js/);
assert.match(miniFood, /cuisineIndex/);
assert.match(miniFood, /sceneIndex/);
assert.match(miniFood, /TAXONOMY\.filter/);
assert.match(miniFood, /daySuffix/);
assert.match(miniWxml, /data-key="cuisineIndex"/);
assert.match(miniWxml, /data-key="sceneIndex"/);
assert.match(miniWxss, /\.food-page picker\{[^}]*min-height:44px/);

console.log('Food taxonomy: shared exact matcher, explicit options, five-language labels, day suffixes and 44px controls passed');
