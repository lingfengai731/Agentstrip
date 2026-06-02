// utils/const.js — 常量
const DESTINATIONS = [
  { id: 'bali',      flag: '🌺', name: '巴厘岛',   region: '印度尼西亚', accent: '#E07A12' },
  { id: 'kyoto',     flag: '🌸', name: '京都',     region: '日本',       accent: '#C47BAB' },
  { id: 'paris',     flag: '🗼', name: '巴黎',     region: '法国',       accent: '#6B9FD4' },
  { id: 'santorini', flag: '🏝️', name: '圣托里尼', region: '希腊',       accent: '#5BA4B8' },
];

const AGENTS = [
  { id: 'planner',  icon: '🗺️', name: '旅程规划师', desc: '行程设计·路线优化' },
  { id: 'hotel',    icon: '🏨', name: '住宿顾问',   desc: '酒店推荐·性价比' },
  { id: 'food',     icon: '🍜', name: '美食探索家', desc: '本地餐厅·隐藏小馆' },
  { id: 'activity', icon: '🏄', name: '活动策划师', desc: '体验项目·文化游' },
  { id: 'budget',   icon: '💰', name: '预算管家',   desc: '费用预测·汇率' },
  { id: 'search',   icon: '🔍', name: '实时搜索',   desc: '联网·最新资讯' },
];

const LANGS = [
  { id: 'zh', flag: '🇨🇳', label: '中文' },
  { id: 'en', flag: '🇬🇧', label: 'English' },
  { id: 'ja', flag: '🇯🇵', label: '日本語' },
  { id: 'ko', flag: '🇰🇷', label: '한국어' },
  { id: 'id', flag: '🇮🇩', label: 'Bahasa Indonesia' },
];

module.exports = { DESTINATIONS, AGENTS, LANGS };
