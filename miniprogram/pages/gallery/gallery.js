const { loadBaliMedia, clearCache } = require('../../utils/bali-media.js');
const app = getApp();

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'landscapes', label: '自然风景' },
  { id: 'culture', label: '文化与寺庙' },
  { id: 'experiences', label: '在地体验' },
  { id: 'foodDining', label: '美食专辑' },
];

const COPY = require('../../utils/browse-copy.js');
const UPDATE_COPY = {zh:'新增作品暂未更新，已显示可用图库。',en:'New uploads could not refresh. Available photos are shown.',ja:'新しい作品を更新できませんでした。表示可能な写真を掲載しています。',ko:'새 사진을 갱신하지 못했어요. 이용 가능한 사진을 표시합니다.',id:'Unggahan baru belum diperbarui. Foto yang tersedia tetap ditampilkan.'};

Page({
  data: { copy: COPY.zh, loading: true, error: '', filter: 'all', filters: FILTERS, assets: [], visibleAssets: [], totalCount: 0, visibleCount: 0 },

  onLoad() { const copy = COPY[app.globalData.currentLang] || COPY.zh; this.setData({copy, filters: FILTERS.map(item => ({...item,label:copy[item.id]}))}); wx.setNavigationBarTitle({title:copy.galleryTitle}); this.loadGallery(); },

  onPullDownRefresh() {
    clearCache();
    this.loadGallery(true).finally(() => wx.stopPullDownRefresh());
  },

  async loadGallery(refresh = false) {
    const request = this.loadRequest = (this.loadRequest || 0) + 1;
    this.setData({ loading: true, error: '' });
    try {
      const media = await loadBaliMedia(app.globalData.currentLang || 'zh', refresh);
      if (request !== this.loadRequest) return;
      this.setData({ assets: media.gallery, totalCount: media.gallery.length, loading: false });
      this.applyFilter(this.data.filter);
      // Add administrator-published assets without blocking the shipped gallery.
      loadBaliMedia(app.globalData.currentLang || 'zh', false, true).then(updated => {
        if (request !== this.loadRequest) return;
        this.setData({assets:updated.gallery,totalCount:updated.gallery.length}); this.applyFilter(this.data.filter);
      }).catch(() => {
        if (request === this.loadRequest) this.setData({error:UPDATE_COPY[app.globalData.currentLang] || UPDATE_COPY.zh});
      });
    } catch (error) {
      if (request !== this.loadRequest) return;
      this.setData({ loading: false, error: error.message || this.data.copy.galleryFailed });
    }
  },
  onUnload() { this.loadRequest = (this.loadRequest || 0) + 1; },

  applyFilter(filter) {
    const visibleAssets = filter === 'all'
      ? this.data.assets
      : this.data.assets.filter(item => filter === 'foodDining' ? item.album === 'Food & Dining' : item.theme === filter);
    this.setData({ filter, visibleAssets, visibleCount: visibleAssets.length });
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
