const { loadBaliMedia } = require('../../utils/bali-media.js');
const app = getApp();

Page({
  data: { loading: true, error: '', place: null, images: [], current: 0, routeId: '' },

  onLoad(options) {
    this.options = options || {};
    this.setData({ routeId: options.routeId || '' });
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
      if (!poi && !selectedAsset) throw new Error('没有找到这个地点或照片');
      const current = selectedAsset ? Math.max(0, images.findIndex(image => image.key === selectedAsset.key)) : 0;
      const title = poi ? poi.displayName : selectedAsset.title;
      const description = poi
        ? (selectedAsset && selectedAsset.description) || poi.notes || '这里是路线中的一个真实地点，出发前请再次确认开放时间与现场条件。'
        : selectedAsset.description;
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
        },
        images,
        current,
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '地点详情暂时无法加载' });
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
    wx.setClipboardData({ data: value, success: () => wx.showToast({ title: '链接已复制', icon: 'success' }) });
  },

  backToTrips() { wx.switchTab({ url: '/pages/itinerary/itinerary' }); },
  retry() { this.loadPlace(); },
});
