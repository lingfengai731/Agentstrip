(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WMBaliFoodTaxonomy = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  var languages = ['zh', 'en', 'ja', 'ko', 'id'];
  var labelRows = {
    cuisine: [
      ['local', '本地菜 / Warung', 'Local / Warung', '地元料理 / Warung', '현지 음식 / Warung', 'Lokal / Warung'],
      ['seafood', '海鲜料理', 'Seafood', 'シーフード', '해산물', 'Hidangan laut'],
      ['asian', '亚洲风味', 'Asian flavours', 'アジア料理', '아시아 음식', 'Cita rasa Asia'],
      ['cafe', '咖啡馆', 'Cafe', 'カフェ', '카페', 'Kafe'],
      ['atmosphere', '氛围用餐', 'Atmosphere-led dining', '雰囲気を楽しむ料理', '분위기 중심 식사', 'Bersantap dengan suasana'],
      ['Southeast Asian', '东南亚菜', 'Southeast Asian', '東南アジア料理', '동남아 요리', 'Masakan Asia Tenggara'],
      ['Indonesian', '印尼菜', 'Indonesian', 'インドネシア料理', '인도네시아 요리', 'Masakan Indonesia'],
      ['Modern Indonesian', '现代印尼菜', 'Modern Indonesian', 'モダンインドネシア料理', '모던 인도네시아 요리', 'Masakan Indonesia modern'],
      ['Latin American', '拉丁美洲菜', 'Latin American', 'ラテンアメリカ料理', '라틴아메리카 요리', 'Masakan Amerika Latin'],
      ['Argentinian', '阿根廷菜', 'Argentinian', 'アルゼンチン料理', '아르헨티나 요리', 'Masakan Argentina'],
      ['Mexican', '墨西哥菜', 'Mexican', 'メキシコ料理', '멕시코 요리', 'Masakan Meksiko'],
      ['Balinese', '巴厘岛菜', 'Balinese', 'バリ料理', '발리 요리', 'Masakan Bali'],
      ['Balinese-influenced', '巴厘风味融合', 'Balinese-influenced', 'バリ風', '발리풍', 'Sentuhan Bali'],
      ['Locally sourced tapas', '本地食材小食', 'Locally sourced tapas', '地元食材のタパス', '현지 식재료 타파스', 'Tapas berbahan lokal'],
      ['international', '国际风味', 'International', 'インターナショナル', '인터내셔널', 'Internasional'],
      ['International', '国际菜', 'International', 'インターナショナル', '인터내셔널', 'Internasional'],
      ['seafood', '海鲜料理', 'Seafood', 'シーフード', '해산물', 'Hidangan laut'],
      ['modern coastal', '现代海岸风味', 'Modern coastal', 'モダンな海辺料理', '모던 해안 요리', 'Pesisir modern'],
      ['Pan-Asian', '泛亚洲菜', 'Pan-Asian', '汎アジア料理', '범아시아 요리', 'Masakan Pan-Asia'],
      ['haute cuisine', '高级料理', 'Haute cuisine', 'オートキュイジーヌ', '오트 퀴진', 'Haute cuisine'],
      ['Italian', '意大利菜', 'Italian', 'イタリア料理', '이탈리아 요리', 'Masakan Italia'],
      ['Southern Italian', '意大利南部菜', 'Southern Italian', '南イタリア料理', '남부 이탈리아 요리', 'Masakan Italia Selatan'],
      ['Mediterranean', '地中海菜', 'Mediterranean', '地中海料理', '지중해 요리', 'Masakan Mediterania'],
      ['Middle Eastern', '中东菜', 'Middle Eastern', '中東料理', '중동 요리', 'Masakan Timur Tengah'],
      ['French', '法餐', 'French', 'フランス料理', '프랑스 요리', 'Masakan Prancis'],
      ['Japanese', '日本料理', 'Japanese', '日本料理', '일본 요리', 'Masakan Jepang'],
      ['Izakaya', '居酒屋', 'Izakaya', '居酒屋', '이자카야', 'Izakaya'],
      ['fusion', '融合菜', 'Fusion', 'フュージョン', '퓨전', 'Fusion'],
      ['Dessert', '甜品', 'Dessert', 'デザート', '디저트', 'Hidangan penutup'],
      ['contemporary', '当代菜', 'Contemporary', 'コンテンポラリー', '컨템퍼러리', 'Kontemporer'],
      ['hyper-local', '极本地食材', 'Hyper-local', '超ローカル', '초지역 식재료', 'Sangat lokal'],
      ['regional Indonesian', '印尼地方菜', 'Regional Indonesian', 'インドネシア各地の料理', '인도네시아 지역 요리', 'Masakan daerah Indonesia'],
      ['regional archipelago', '群岛地方风味', 'Regional archipelago', '群島の郷土料理', '군도 지역 요리', 'Masakan kepulauan daerah'],
      ['Modern Australian', '现代澳洲菜', 'Modern Australian', 'モダンオーストラリア料理', '모던 오스트레일리아 요리', 'Masakan Australia modern'],
      ['Modern European', '现代欧洲菜', 'Modern European', 'モダンヨーロッパ料理', '모던 유럽 요리', 'Masakan Eropa modern'],
      ['Indonesian-inspired', '印尼风味灵感', 'Indonesian-inspired', 'インドネシア風', '인도네시아풍', 'Terinspirasi Indonesia']
    ],
    scene: [
      ['local', '本地氛围', 'Local setting', '地元の雰囲気', '현지 분위기', 'Suasana lokal'],
      ['seafood', '海鲜场景', 'Seafood setting', 'シーフードの食事', '해산물 식사', 'Suasana hidangan laut'],
      ['asian', '亚洲风味氛围', 'Asian atmosphere', 'アジアの雰囲気', '아시아 분위기', 'Suasana Asia'],
      ['cafe', '咖啡馆', 'Cafe', 'カフェ', '카페', 'Kafe'],
      ['atmosphere', '氛围用餐', 'Atmosphere', '雰囲気を楽しむ', '분위기 있는 식사', 'Suasana bersantap'],
      ['Indonesian design', '印尼设计', 'Indonesian design', 'インドネシアデザイン', '인도네시아 디자인', 'Desain Indonesia'],
      ['evening dining', '夜间用餐', 'Evening dining', '夜のダイニング', '저녁 식사', 'Santap malam'],
      ['modern dining room', '现代餐厅空间', 'Modern dining room', 'モダンなダイニングルーム', '모던 다이닝룸', 'Ruang makan modern'],
      ['cocktail bar', '鸡尾酒吧', 'Cocktail bar', 'カクテルバー', '칵테일 바', 'Bar koktail'],
      ['wood-fired', '柴火风味', 'Wood-fired', '薪火料理', '장작불', 'Masakan kayu bakar'],
      ['warehouse-style dining room', '仓库风餐厅', 'Warehouse-style dining room', '倉庫風のダイニング', '창고형 다이닝룸', 'Ruang makan bergaya gudang'],
      ['wood-fired cooking', '柴火烹饪', 'Wood-fired cooking', '薪火料理', '장작불 요리', 'Masakan dengan kayu bakar'],
      ['terrace', '露台', 'Terrace', 'テラス', '테라스', 'Teras'],
      ['rooftop bar', '屋顶酒吧', 'Rooftop bar', 'ルーフトップバー', '루프톱 바', 'Bar rooftop'],
      ['archipelago-focused dining', '群岛主题用餐', 'Archipelago-focused dining', '群島をテーマにした食事', '군도 중심 식사', 'Santap bertema kepulauan'],
      ['beach-club setting', '海滩俱乐部环境', 'Beach-club setting', 'ビーチクラブの雰囲気', '비치클럽 분위기', 'Suasana beach club'],
      ['courtyard', '庭院', 'Courtyard', '中庭', '안뜰', 'Halaman dalam'],
      ['open kitchen', '开放式厨房', 'Open kitchen', 'オープンキッチン', '오픈 키친', 'Dapur terbuka'],
      ['tasting-menu', '品鉴菜单', 'Tasting menu', 'テイスティングメニュー', '테이스팅 메뉴', 'Menu degustasi'],
      ['beachfront', '海滨', 'Beachfront', 'ビーチフロント', '해변가', 'Tepi pantai'],
      ['sunset', '日落时段', 'Sunset', 'サンセット', '석양', 'Matahari terbenam'],
      ['poolside', '池畔', 'Poolside', 'プールサイド', '수영장 옆', 'Tepi kolam'],
      ['sandy beach', '沙滩', 'Sandy beach', '砂浜', '모래 해변', 'Pantai berpasir'],
      ['open-air grill', '户外烤炉', 'Open-air grill', '屋外グリル', '야외 그릴', 'Panggangan terbuka'],
      ['oceanfront', '海景', 'Oceanfront', 'オーシャンフロント', '바다 앞', 'Tepi laut'],
      ['private cabanas', '私人凉亭', 'Private cabanas', 'プライベートカバナ', '전용 카바나', 'Cabana pribadi'],
      ['fine dining', '精致餐饮', 'Fine dining', 'ファインダイニング', '파인 다이닝', 'Santap mewah'],
      ['resort dining room', '度假村餐厅', 'Resort dining room', 'リゾートのダイニングルーム', '리조트 다이닝룸', 'Ruang makan resor'],
      ['all-day restaurant', '全日餐厅', 'All-day restaurant', 'オールデイダイニング', '올데이 레스토랑', 'Restoran sepanjang hari'],
      ['gelateria', '意式冰淇淋店', 'Gelateria', 'ジェラテリア', '젤라테리아', 'Gelateria'],
      ['shaded terrace', '遮荫露台', 'Shaded terrace', '日陰のテラス', '그늘진 테라스', 'Teras teduh'],
      ['jazz', '爵士乐', 'Jazz', 'ジャズ', '재즈', 'Jazz'],
      ['street-side', '街边', 'Street-side', '通り沿い', '거리 노변', 'Pinggir jalan'],
      ['casual dining', '休闲用餐', 'Casual dining', 'カジュアルダイニング', '캐주얼 다이닝', 'Santap kasual'],
      ['live music', '现场音乐', 'Live music', 'ライブ音楽', '라이브 음악', 'Musik live'],
      ['experimental', '实验性用餐', 'Experimental', '実験的な食事', '실험적 다이닝', 'Santap eksperimental'],
      ['garden/terrace', '花园 / 露台', 'Garden / terrace', 'ガーデン / テラス', '정원 / 테라스', 'Taman / teras'],
      ['garden dining', '花园用餐', 'Garden dining', 'ガーデンダイニング', '가든 다이닝', 'Santap di taman'],
      ['family-style', '家庭式分享', 'Family-style', 'ファミリースタイル', '패밀리 스타일', 'Gaya keluarga'],
      ['refined casual', '精致休闲', 'Refined casual', '上質なカジュアル', '세련된 캐주얼', 'Kasual berkelas'],
      ['sharing', '分享式用餐', 'Sharing', 'シェアスタイル', '함께 나누는 식사', 'Santap berbagi'],
      ['contemporary', '当代空间', 'Contemporary', 'コンテンポラリー', '컨템퍼러리', 'Kontemporer'],
      ['bar', '酒吧', 'Bar', 'バー', '바', 'Bar'],
      ['rice-field', '稻田景观', 'Rice-field', '田園風景', '논밭 풍경', 'Persawahan'],
      ['cooking school', '烹饪学校', 'Cooking school', '料理教室', '쿠킹 스쿨', 'Sekolah memasak'],
      ['pavilion', '凉亭', 'Pavilion', 'パビリオン', '파빌리온', 'Paviliun']
    ]
  };
  var labels = {};
  languages.forEach(function (lang) {
    labels[lang] = {cuisine:{},scene:{}};
    Object.keys(labelRows).forEach(function (field) {
      labelRows[field].forEach(function (row) { labels[lang][field][row[0]] = row[languages.indexOf(lang) + 1]; });
    });
  });

  function values(value) {
    if (Array.isArray(value)) return value;
    return value == null || value === '' ? [] : [value];
  }
  function has(value, selected) { return !selected || values(value).indexOf(selected) >= 0; }
  function matches(item, filters) {
    filters = filters || {};
    return !!item && has(item.category, filters.category) && has(item.cuisine, filters.cuisine) && has(item.scene, filters.scene);
  }
  function filter(items, filters) { return (Array.isArray(items) ? items : []).filter(function (item) { return matches(item, filters); }); }
  function collectOptions(items, field, lang, allLabel) {
    var map = (labels[lang] || labels.en)[field] || {}, seen = {}, result = [{id:'',label:allLabel}];
    (Array.isArray(items) ? items : []).forEach(function (item) {
      if (!item || item.published !== true) return;
      values(item[field]).forEach(function (id) {
        if (!seen[id] && Object.prototype.hasOwnProperty.call(map, id)) {
          seen[id] = true; result.push({id:id,label:map[id]});
        }
      });
    });
    return result;
  }
  return {languages:languages.slice(),labels:labels,values:values,matches:matches,filter:filter,collectOptions:collectOptions};
});
