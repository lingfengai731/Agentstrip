const api = require('./api.js');

const SITE_ORIGIN = 'https://wandermind.cc/';
const GALLERY_THEMES = new Set(['landscapes', 'culture', 'experiences']);
const GALLERY_VERIFICATION = new Set(['route-linked', 'bali-named']);
const EXISTING_WEBSITE_GALLERY = new Set([
  '15c41f6a0fe7fec3', 'c0298c79fcf3616a', '7cf7c3dd8615bea9', 'ee5a7046b62327d5',
  '96a75cd30d5a6e07', '6e8cc0274dcff01f', '9455a6e3607e34b2', '3d75af3a6b693c12',
  '4671473d0993bb44', '90284f633c68bb89', '6258d4a12b1cb8f6', '4f8f83b5fce5b55f',
  '8955be34cbcf96c6', 'c987ff171a0833ca', '682e4b7b296cd26a', 'a637d36cf0e9f53a',
  '5ea1261626ebac26', '428ea37c1c091836', '0ee069026ef64d7f', '29de3c2fb9bba0e2',
  '0d506b671814e0ab', 'acd8a19f6733e4aa', '42b78576f468c0bd', '1a8f10505d9638bd',
  'c1fb58324abc9d99', '958a849b74bf16e2', 'f7cd422d0d2322bc', 'd88c9dbefc6f7316',
  'bf353bdc35abb350', '90b2d9be2187fd87', 'b22399d29ef1b1f2', 'e01a06997abce63b',
  '6041280b5b63473b', '3dbbb9c3f2873236', 'aa067adb970c08b1', '9e500f1e79a63ed8',
  '5edfe367fc23ca02',
]);
let cachedPromise = null;

function localized(value, lang = 'zh', fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.zh || fallback;
}

function absoluteUrl(value) {
  const path = String(value || '').trim();
  if (!path) return '';
  if (/^https:\/\//i.test(path)) return path;
  if (/^http:\/\//i.test(path)) return '';
  return SITE_ORIGIN + path.replace(/^\/+/, '');
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function imageIdentity(item) {
  return String(item.sha256 || item.source_sha256 || item.id || item.web_url || item.image_url || '');
}

function normalizeRights(rights) {
  const data = rights || {};
  const creator = String(data.creator || data.license_or_owner || '').trim();
  const license = String(data.license_name || '').trim();
  return {
    status: data.status || '',
    credit: [creator, license].filter(Boolean).join(' · ') || 'WanderMind Portfolio',
    sourceUrl: absoluteUrl(data.source_url || ''),
    licenseUrl: absoluteUrl(data.license_url || ''),
  };
}

function normalizeStaticImage(item, source, lang) {
  const titleFallback = item.place_name || localized(item.alt_text, lang, '巴厘岛真实瞬间');
  return {
    key: imageIdentity(item),
    source,
    title: localized(item.title, lang, titleFallback),
    description: localized(item.description, lang, localized(item.alt_text, lang, '')),
    alt: localized(item.alt_text, lang, titleFallback),
    placeName: item.place_name || '',
    theme: item.primary_theme || item.category || '',
    subCategory: item.sub_category || '',
    region: item.region || array(item.region_ids)[0] || '',
    area: item.area || '',
    routeIds: array(item.route_ids),
    poiIds: array(item.poi_ids),
    fullUrl: absoluteUrl(item.web_url || item.web_optimized_path || item.image_url),
    thumbUrl: absoluteUrl(item.thumbnail_url || item.thumbnail_path || item.web_optimized_path || item.image_url),
    scope: item.media_scope || (array(item.poi_ids).length ? 'exact_place' : 'destination_context'),
    verificationStatus: item.verification_status || item.location_status || '',
    rights: normalizeRights(item.rights),
  };
}

function normalizePortfolioImage(item, lang) {
  return {
    key: String(item.id || item.web_url || ''),
    source: 'portfolio',
    title: localized(item.title, lang, item.place_name || '巴厘岛真实瞬间'),
    description: localized(item.description, lang, ''),
    alt: localized(item.alt_text, lang, item.place_name || '巴厘岛真实瞬间'),
    placeName: item.place_name || '',
    theme: item.primary_theme || '',
    subCategory: item.sub_category || '',
    region: item.region || '',
    area: item.area || '',
    routeIds: array(item.route_ids),
    poiIds: array(item.poi_ids),
    fullUrl: absoluteUrl(item.web_url),
    thumbUrl: absoluteUrl(item.thumbnail_url || item.web_url),
    scope: array(item.poi_ids).length ? 'exact_place' : 'destination_context',
    verificationStatus: item.verification_status || '',
    rights: { status: 'published', credit: 'WanderMind Portfolio', sourceUrl: '', licenseUrl: '' },
  };
}

function uniqueImages(images) {
  const seen = new Set();
  return images.filter(image => {
    const key = image.key || image.fullUrl;
    if (!key || !image.fullUrl || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesPoiByName(image, poi) {
  const placeKey = normalizeKey(image.placeName);
  if (!placeKey) return false;
  return [poi.name, localized(poi.name_i18n, 'en'), localized(poi.localized_name, 'en')]
    .some(value => normalizeKey(value) === placeKey);
}

async function safeLoad(loader, fallback) {
  try { return await loader(); } catch (_) { return fallback; }
}

async function loadBaliMedia(lang = 'zh', refresh = false) {
  if (!cachedPromise || refresh) {
    cachedPromise = Promise.all([
      safeLoad(api.baliRouteData, { pois: [], routes: [] }),
      safeLoad(api.baliMediaCatalog, { images: [] }),
      safeLoad(api.imagePublishManifest, { images: [] }),
      safeLoad(() => api.publicPortfolio('bali'), { assets: [] }),
    ]);
  }
  const [travel, catalog, manifest, portfolio] = await cachedPromise;
  const pois = array(travel.pois);
  const routes = array(travel.routes);
  const poiById = {};
  pois.forEach(poi => {
    poiById[poi.id] = {
      ...poi,
      displayName: localized(poi.name_i18n || poi.localized_name, lang, poi.name || poi.id),
    };
  });

  const catalogImages = array(catalog.images).map(item => normalizeStaticImage(item, 'catalog', lang));
  const manifestImages = array(manifest.images).map(item => normalizeStaticImage(item, 'manifest', lang));
  const portfolioImages = array(portfolio.assets).map(item => normalizePortfolioImage(item, lang));
  const allImages = uniqueImages([...catalogImages, ...manifestImages, ...portfolioImages]);
  const imagesByPoi = {};
  pois.forEach(poi => {
    imagesByPoi[poi.id] = uniqueImages(allImages.filter(image =>
      image.poiIds.includes(poi.id) || matchesPoiByName(image, poi)
    ));
  });

  const gallery = uniqueImages([
    ...manifestImages.filter(image =>
      EXISTING_WEBSITE_GALLERY.has(image.key.slice(0, 16)) ||
      (GALLERY_THEMES.has(image.theme) && GALLERY_VERIFICATION.has(image.verificationStatus))
    ),
    ...portfolioImages,
  ]).map(image => {
    const namedPoi = pois.find(poi => matchesPoiByName(image, poi));
    return {
      ...image,
      primaryPoiId: image.poiIds.find(id => !!poiById[id]) || (namedPoi && namedPoi.id) || '',
    };
  });

  return { travel, routes, pois, poiById, imagesByPoi, gallery, allImages };
}

function clearCache() {
  cachedPromise = null;
}

module.exports = { absoluteUrl, localized, loadBaliMedia, clearCache };
