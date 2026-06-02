// utils/areas.js — 各目的地的住宿区域数据
// q 字段会拼接到 SerpAPI Google Hotels 搜索关键词上，缩小到指定区域

const HOTEL_AREAS = {
  bali: [
    { key: 'all',       q: '',                 name: '全部',         tag: '综合' },
    { key: 'seminyak',  q: 'Seminyak',         name: '水明漾',       tag: '时尚海滩' },
    { key: 'canggu',    q: 'Canggu',           name: '仓古',         tag: '数字游民' },
    { key: 'ubud',      q: 'Ubud',             name: '乌布',         tag: '文化雨林' },
    { key: 'uluwatu',   q: 'Uluwatu',          name: '乌鲁瓦图',     tag: '蜜月悬崖' },
    { key: 'sanur',     q: 'Sanur',            name: '沙努尔',       tag: '家庭安静' },
    { key: 'jimbaran',  q: 'Jimbaran',         name: '金巴兰',       tag: '海鲜悬崖' },
    { key: 'kuta',      q: 'Kuta',             name: '库塔',         tag: '夜生活' },
    { key: 'nusa-dua',  q: 'Nusa Dua',         name: '努沙杜瓦',     tag: '高端度假' },
    { key: 'lembongan', q: 'Nusa Lembongan',   name: '蓝梦岛',       tag: '离岛浮潜' },
  ],
  kyoto: [
    { key: 'all',           q: '',                      name: '全部',     tag: '综合' },
    { key: 'gion',          q: 'Gion',                  name: '祇园',     tag: '传统茶屋' },
    { key: 'kawaramachi',   q: 'Kawaramachi Downtown',  name: '河原町',   tag: '市中心' },
    { key: 'higashiyama',   q: 'Higashiyama',           name: '东山',     tag: '寺庙密集' },
    { key: 'arashiyama',    q: 'Arashiyama',            name: '嵐山',     tag: '竹林安静' },
    { key: 'kyoto-station', q: 'Kyoto Station',         name: '京都站',   tag: '交通枢纽' },
  ],
  paris: [
    { key: 'all',             q: '',                                       name: '全部',     tag: '综合' },
    { key: 'marais',          q: 'Le Marais 4th arrondissement',           name: '玛黑区',   tag: '综合首选' },
    { key: 'saint-germain',   q: 'Saint-Germain-des-Pres 6th',             name: '圣日耳曼', tag: '文艺优雅' },
    { key: 'montmartre',      q: 'Montmartre 18th arrondissement',         name: '蒙马特',   tag: '电影感' },
    { key: 'latin-quarter',   q: 'Latin Quarter 5th arrondissement',       name: '拉丁区',   tag: '性价比' },
    { key: 'champs-elysees',  q: 'Champs-Elysees 8th arrondissement',      name: '香榭丽舍', tag: '奢华商务' },
    { key: 'louvre',          q: 'Louvre 1st arrondissement',              name: '卢浮宫',   tag: '核心经典' },
  ],
  santorini: [
    { key: 'all',        q: '',             name: '全部',         tag: '综合' },
    { key: 'oia',        q: 'Oia',          name: '伊亚',         tag: '蜜月奢华' },
    { key: 'fira',       q: 'Fira',         name: '菲拉',         tag: '首都便利' },
    { key: 'imerovigli', q: 'Imerovigli',   name: '伊姆罗维利',   tag: '静奢悬崖' },
    { key: 'kamari',     q: 'Kamari',       name: '卡马里',       tag: '黑沙海滩' },
    { key: 'perissa',    q: 'Perissa',      name: '佩里萨',       tag: '平价海滩' },
  ],
  custom: [
    { key: 'all', q: '', name: '全部', tag: '综合' },
  ],
};

const DEPARTURE_CITIES = [
  { iata: 'PVG', name: '上海', flag: '🇨🇳' },
  { iata: 'PEK', name: '北京', flag: '🇨🇳' },
  { iata: 'CAN', name: '广州', flag: '🇨🇳' },
  { iata: 'SZX', name: '深圳', flag: '🇨🇳' },
  { iata: 'CTU', name: '成都', flag: '🇨🇳' },
  { iata: 'HKG', name: '香港', flag: '🇭🇰' },
  { iata: 'HGH', name: '杭州', flag: '🇨🇳' },
  { iata: 'XIY', name: '西安', flag: '🇨🇳' },
];

module.exports = { HOTEL_AREAS, DEPARTURE_CITIES };
