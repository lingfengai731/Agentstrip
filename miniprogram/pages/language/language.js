const { LANGS } = require('../../utils/const.js');
const app = getApp();
const COPY = {
  zh: { title: '选择你的语言', subtitle: '路线名称、规划回复与底部导航会同步更新。', updated: '语言已更新' },
  en: { title: 'Choose your language', subtitle: 'Route names, planning replies and tab labels will update.', updated: 'Language updated' },
  ja: { title: '言語を選択', subtitle: 'ルート名、プランの回答、下部タブの表示言語が変わります。', updated: '言語を更新しました' },
  ko: { title: '언어 선택', subtitle: '경로 이름, 여행 계획 답변과 하단 메뉴에 적용됩니다.', updated: '언어가 변경되었습니다' },
  id: { title: 'Pilih bahasa', subtitle: 'Nama rute, balasan rencana dan menu bawah akan diperbarui.', updated: 'Bahasa diperbarui' },
};

Page({
  data: { languages: LANGS, current: 'zh', copy: COPY.zh },
  onShow() { this.refresh(app.globalData.currentLang || 'zh'); },
  refresh(lang) {
    const copy = COPY[lang] || COPY.zh;
    this.setData({ current: COPY[lang] ? lang : 'zh', copy });
    wx.setNavigationBarTitle({ title: copy.title });
  },
  choose(e) {
    const lang = e.currentTarget.dataset.id;
    if (!COPY[lang]) return;
    app.setLang(lang);
    this.refresh(lang);
    wx.showToast({ title: COPY[lang].updated, icon: 'success' });
    setTimeout(() => {
      wx.navigateBack({
        delta: 1,
        success: () => setTimeout(() => app.updateTabBarLanguage(), 0),
      });
    }, 450);
  },
});
