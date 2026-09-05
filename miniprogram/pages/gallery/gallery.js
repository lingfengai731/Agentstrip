const { loadBaliMedia, clearCache } = require('../../utils/bali-media.js');
const app = getApp();

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'landscapes', label: '自然风景' },
  { id: 'culture', label: '文化与寺庙' },
  { id: 'experiences', label: '在地体验' },
];

Page({
  data: { loading: true, error: '', filter: 'all', filters: FILTERS, assets: [], visibleAssets: [] },

  onLoad() { this.loadGallery(); },

  onPullDownRefresh() {
    clearCache();
    this.loadGallery(true).finally(() => wx.stopPullDownRefresh());
  },

  async loadGallery(refresh = false) {
    this.setData({ loading: true, error: '' });
    try {
      const media = await loadBaliMedia(app.globalData.currentLang || 'zh', refresh);
      this.setData({ assets: media.gallery, loading: false });
      this.applyFilter(this.data.filter);
    } catch (error) {
      this.setData({ loading: false, error: error.message || '作品集暂时无法加载' });
    }
  },

  applyFilter(filter) {
    const visibleAssets = filter === 'all'
      ? this.data.assets
      : this.data.assets.filter(item => item.theme === filter);
    this.setData({ filter, visibleAssets });
  },

  chooseFilter(e) { this.applyFilter(e.currentTarget.dataset.id); },

  openAsset(e) {
    const asset = this.data.visibleAssets[e.currentTarget.dataset.index];
    if (!asset) return;
    const query = asset.primaryPoiId
      ? `id=${encodeURIComponent(asset.primaryPoiId)}&asset=${encodeURIComponent(asset.key)}`
      : `asset=${encodeURIComponent(asset.key)}`;
    wx.navigateTo({ url: `/pages/place/place?${query}` });
  },

  markImageFailed(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const assets = this.data.assets.map(item => item.key === key ? { ...item, imageFailed: true } : item);
    this.setData({ assets });
    this.applyFilter(this.data.filter);
  },

  retry() { clearCache(); this.loadGallery(true); },
});
