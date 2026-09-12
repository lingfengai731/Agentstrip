// utils/const.js — 常量
const DESTINATIONS = [
  { id: 'bali',      mark: 'BALI', name: '巴厘岛',   region: '印度尼西亚', accent: '#E07A12' },
];

// Retain future destination definitions without presenting unresearched products to customers.
const FUTURE_DESTINATIONS = [
  { id: 'kyoto',     mark: 'KYO', name: '京都',     region: '日本',       accent: '#C47BAB' },
  { id: 'paris',     mark: 'PAR', name: '巴黎',     region: '法国',       accent: '#6B9FD4' },
  { id: 'santorini', mark: 'JTR', name: '圣托里尼', region: '希腊',       accent: '#5BA4B8' },
];

const AGENTS = [
  { id: 'planner',  icon: 'route', name: '旅程规划师', desc: '行程设计·路线优化' },
  { id: 'hotel',    icon: 'hotel', name: '住宿顾问',   desc: '酒店推荐·性价比' },
  { id: 'food',     icon: 'food', name: '美食探索家', desc: '本地餐厅·隐藏小馆' },
  { id: 'activity', icon: 'activity', name: '活动策划师', desc: '体验项目·文化游' },
  { id: 'budget',   icon: 'budget', name: '预算管家',   desc: '费用预测·汇率' },
  { id: 'search',   icon: 'search', name: '实时搜索',   desc: '联网·最新资讯' },
];

const LANGS = [
  { id: 'zh', mark: '中', label: '中文' },
  { id: 'en', mark: 'EN', label: 'English' },
  { id: 'ja', mark: '日', label: '日本語' },
  { id: 'ko', mark: '한', label: '한국어' },
  { id: 'id', mark: 'ID', label: 'Bahasa Indonesia' },
];

module.exports = { DESTINATIONS, FUTURE_DESTINATIONS, AGENTS, LANGS };
