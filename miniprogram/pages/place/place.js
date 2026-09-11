const { loadBaliMedia } = require('../../utils/bali-media.js');
const app = getApp();

const COPY = require('../../utils/browse-copy.js');

function localizedPoiField(value, lang) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.zh || '';
}

Page({
  data: { copy: COPY.zh, loading: true, error: '', place: null, images: [], current: 0, routeId: '' },

  onLoad(options) {
    this.setData({copy:COPY[app.globalData.currentLang] || COPY.zh});
    this.options = options || {};
    this.setData({ routeId: this.options.routeId || '' });
    this.loadPlace();
  },

  async loadPlace() {
    this.setData({ loading: true, error: '' });
    try {
      const media = await loadBaliMedia(app.globalData.currentLang || 'zh');
      const id = this.options.id || '';
      const assetKey = this.options.asset || '';
      const selectedAsset = media.allImages.find(image => image.key === assetKey);
      const poi = id ? media.poiById[id] : null;
      let images = poi ? (media.imagesByPoi[id] || []) : [];
      if (selectedAsset && !images.some(image => image.key === selectedAsset.key)) images = [selectedAsset, ...images];
      if (!images.length && selectedAsset) images = [selectedAsset];
      if (!poi && !selectedAsset) throw new Error(this.data.copy.notFound);
      const current = selectedAsset ? Math.max(0, images.findIndex(image => image.key === selectedAsset.key)) : 0;
      const lang = app.globalData.currentLang || 'zh';
      const primaryImage = selectedAsset || images.find(image => image.description || image.alt) || null;
      const poiHasLocalizedName = poi && (poi.name_i18n || poi.localized_name);
      const title = poi
        ? (poiHasLocalizedName ? poi.displayName : ((lang !== 'en' && primaryImage && primaryImage.title) || poi.displayName))
        : selectedAsset.title;
      const localizedPoiNotes = poi && typeof poi.notes === 'object'
        ? (poi.notes[lang] || poi.notes.en || poi.notes.zh || '')
        : (lang === 'en' && poi ? poi.notes : '');
      const description = poi
        ? (primaryImage && (primaryImage.description || primaryImage.alt)) || localizedPoiNotes || this.data.copy.placeDefault
        : (selectedAsset.description || selectedAsset.alt || this.data.copy.placeDefault);
      this.setData({
        loading: false,
        place: {
          id,
          title,
          description,
          region: (poi && poi.region_id) || (selectedAsset && selectedAsset.region) || '',
          type: (poi && poi.type) || (selectedAsset && selectedAsset.subCategory) || '',
          routes: (poi && poi.route_ids) || (selectedAsset && selectedAsset.routeIds) || [],
          routesText: ((poi && poi.route_ids) || (selectedAsset && selectedAsset.routeIds) || []).join(' · '),
          officialUrl: (poi && poi.official_url) || '',
          bookingUrl: (poi && poi.booking_url) || '',
          verificationStatus: (poi && poi.verification_status) || (selectedAsset && selectedAsset.verificationStatus) || '',
          supplierNote: poi ? localizedPoiField(poi.supplier_note, lang) : '',
        },
        images,
        current,
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || this.data.copy.placeFailed });
    }
  },

  onSlide(e) { this.setData({ current: e.detail.current }); },

  markImageFailed(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.images[index]) return;
    const images = this.data.images.map((item, itemIndex) => itemIndex === index ? { ...item, imageFailed: true } : item);
    this.setData({ images });
  },

  copyLink(e) {
    const value = e.currentTarget.dataset.value;
    if (!value) return;
    wx.setClipboardData({ data: value, success: () => wx.showToast({ title: this.data.copy.copied, icon: 'success' }), fail: () => wx.showToast({ title: this.data.copy.copyFailed, icon:'none' }) });
  },

  backToTrips() { wx.switchTab({ url: '/pages/itinerary/itinerary' }); },
  retry() { this.loadPlace(); },
});
