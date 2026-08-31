import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'wandermind-studio', 'frontend');
const publicPages = ['index.html', 'about.html', 'services.html', 'bali.html', 'ai-tool.html', 'contact.html', 'find-driver.html'];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : '';
}

function check(condition, message) {
  assert.ok(condition, message);
}

for (const page of publicPages) {
  const source = fs.readFileSync(path.join(frontend, page), 'utf8');
  const links = [...source.matchAll(/<a\b[^>]*class="[^"]*\bsearch-search\b[^"]*"[^>]*>[\s\S]*?<\/a>/g)].map((match) => match[0]);
  check(links.length === 1, `${page}: expected one top search link`);
  check(attribute(links[0], 'href') === 'search.html', `${page}: search link must target search.html`);
  check(attribute(links[0], 'aria-label') === 'Search WanderMind', `${page}: search link needs an accessible fallback label`);
  check(links[0].includes('data-i18n="searchAriaLabel"'), `${page}: search link needs localized aria text`);
  check(links[0].includes('data-i18n-attr="aria-label"'), `${page}: search link needs data-i18n-attr`);
  check(links[0].includes('aria-hidden="true"'), `${page}: search icon must be decorative`);
  check(/assets\/js\/i18n\.js\?v=[A-Za-z0-9_-]+/.test(source), `${page}: shared i18n must be loaded with a cache version`);
  check(!source.includes('href="#search"'), `${page}: stale hash search link remains`);
  check(!source.includes('id="search"'), `${page}: stale legacy search target remains`);
  check(/search-search\.nav-link\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px[^}]*height:\s*44px/s.test(source), `${page}: desktop search target is not 44px`);
}

const searchPage = read('wandermind-studio/frontend/search.html');
check(searchPage.includes('<form id="site-search-form" class="wm-search-form" role="search" action="search.html" method="get">'), 'search.html: native GET form is missing');
check(searchPage.includes('<input id="site-search-input" type="search" name="q"'), 'search.html: shareable q input is missing');
check(searchPage.includes('id="site-search-status"'), 'search.html: live status is missing');
check(searchPage.includes('id="site-search-results"'), 'search.html: results list is missing');
check(searchPage.includes('assets/js/site-search.js?v=search1'), 'search.html: site-search.js is not loaded');
check(searchPage.includes('assets/js/i18n.js?v=search1'), 'search.html: shared i18n is not cache-busted for search strings');
check(searchPage.includes('data-i18n="themeToggleLabel"'), 'search.html: theme toggle needs a localized label');

const searchScript = read('wandermind-studio/frontend/assets/js/site-search.js');
check(searchScript.includes("verification_status === 'retired'"), 'site-search.js: retired records are not excluded');
check(searchScript.includes("'bali.html?route='"), 'site-search.js: Bali route URL strategy is missing');
check(searchScript.includes("'#route-families'"), 'site-search.js: Bali route anchor is missing');
check(searchScript.includes("normalize('NFKD')"), 'site-search.js: Unicode normalization is missing');
check(!searchScript.includes('innerHTML'), 'site-search.js: results must not render unescaped innerHTML');

const css = read('wandermind-studio/frontend/assets/css/style-starter.css');
check(css.includes('.w3l-header-4 a.search-search'), 'style-starter.css: shared search target styles are missing');
check(/\.w3l-header-4 a\.search-search[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/.test(css), 'style-starter.css: search target is not touch-safe');
check(css.includes('.wm-search-page'), 'style-starter.css: search page styles are missing');
check(css.includes('overflow-x: hidden'), 'style-starter.css: search page overflow guard is missing');
check(!/\.w3l-header-4 \.navbar \.search-search\.nav-link\s*\{[^}]*display:\s*none/s.test(css), 'style-starter.css: search is still hidden in the medium desktop media query');

const i18nSource = read('wandermind-studio/frontend/assets/js/i18n.js');
const i18nContext = {
  console,
  navigator: { language: 'en' },
  localStorage: { getItem: () => null, setItem: () => {} },
  CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  document: {
    addEventListener: () => {},
    dispatchEvent: () => {},
    documentElement: { setAttribute: () => {} }
  }
};
vm.runInNewContext(`${i18nSource}\nthis.__LANGS = LANGS;`, i18nContext, { filename: 'i18n.js' });
for (const lang of ['en', 'zh', 'ja', 'ko', 'id']) {
  const dictionary = i18nContext.__LANGS[lang];
  check(dictionary, `i18n: missing ${lang} dictionary`);
  for (const key of ['searchPageTitle', 'searchAriaLabel', 'themeToggleLabel', 'searchTitle', 'searchInputPlaceholder', 'searchSubmit', 'searchResultsHeading', 'searchPrompt', 'searchLoading', 'searchResultCount', 'searchResultPage', 'searchResultRoute', 'searchResultPoi', 'searchNoResults', 'searchDataUnavailable', 'searchStatusPending', 'searchStatusSupplier', 'searchStatusUnavailable']) {
    check(typeof dictionary[key] === 'string' && dictionary[key].length > 0, `i18n: ${lang}.${key} is missing`);
  }
}

const data = JSON.parse(read('wandermind-studio/frontend/assets/data/bali-travel-data.json'));
const routeIds = new Set((data.routes || []).map((route) => route.id));
check(routeIds.size === 6 && ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].every((id) => routeIds.has(id)), 'Bali data: expected R1-R6 routes');
check((data.pois || []).length === 62, 'Bali data: expected 62 POIs');
for (const poi of data.pois || []) {
  for (const id of poi.route_ids || []) check(routeIds.has(id), `${poi.id}: invalid route id ${id}`);
}

console.log('site-search checks passed: 7 links, GET form, 5-language keys, R1-R6, 62 POIs, retired guard, 44px/overflow CSS');
