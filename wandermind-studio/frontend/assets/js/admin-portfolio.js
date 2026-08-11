(function () {
  'use strict';

  var LANGS = ['zh', 'en', 'ja', 'ko', 'id'];
  var token = localStorage.getItem('wm_studio_token') || '';
  var state = { assets: [], files: [], storageReady: false, editingId: '', queueEditingId: '', draggingId: '', manifestByHash: {}, manifestLoaded: false, manifestError: false };
  var pageAlert = document.getElementById('pageAlert');
  var fileInput = document.getElementById('fileInput');
  var dropzone = document.getElementById('dropzone');
  var queue = document.getElementById('uploadQueue');
  var uploadForm = document.getElementById('uploadMetadata');
  var assetList = document.getElementById('assetList');
  var dialog = document.getElementById('assetDialog');
  var queueDialog = document.getElementById('queueDialog');

  var COPY = {
    en: {
      viewPortfolio:'View Bali Portfolio',eyebrow:'Editorial workspace',title:'Portfolio Content Manager',subtitle:'Upload approved images, confirm metadata, and publish to Bali without redeploying the website.',checking:'Checking storage…',ready:'Object storage ready',blocked:'Object storage not configured',uploadTitle:'Upload approved images',uploadSub:'Images go directly from this browser to object storage. Render never stores the file.',dropTitle:'Drop images here or choose files',dropSub:'JPG, PNG, WebP, AVIF or HEIC · up to 25 MB each',theme:'Primary theme',subCategory:'Sub-category',region:'Region',area:'Area',placeName:'Place name',placeType:'Place type',prominence:'Prominence',routeIds:'Route IDs',extensionIds:'Extension IDs',tags:'Tags',mood:'Mood',photoStyle:'Photography style',verification:'Verification status',listHelp:'Separate values with commas.',localizedCopy:'Localized title, description and alt text',saveDraft:'Upload as draft',uploadPublish:'Upload and publish',libraryTitle:'Portfolio library',librarySub:'Drag to reorder, or use the move buttons for keyboard control.',loadingAssets:'Loading portfolio assets…',editAsset:'Edit portfolio asset',saveChanges:'Save changes',replaceImage:'Replace image',cancel:'Cancel',titleField:'Title',description:'Description',altText:'Alt text',search:'Search place or title',allStatuses:'All statuses',empty:'No assets match this view.',preview:'Preview',edit:'Edit',publish:'Publish',hide:'Hide',archive:'Archive',moveUp:'Move up',moveDown:'Move down',draft:'Draft',published:'Published',hidden:'Hidden',archived:'Archived',analysing:'Reading file details…',queued:'Ready to upload',uploading:'Uploading',saving:'Saving metadata…',complete:'Complete',failed:'Failed',selectFiles:'Choose at least one valid image.',storageMissing:'Configure the three Cloudinary environment variables before uploading. Existing Portfolio content is unaffected.',adminOnly:'This page requires an administrator account.',sessionExpired:'Your session has expired. Sign in again to continue.',publishNeedsMetadata:'Publishing requires a place name, title and alt text.',changesSaved:'Portfolio asset updated.',orderSaved:'Portfolio order updated.',replacementSaved:'Image replaced; metadata was preserved.',uploadFinished:'Upload queue finished.',formatError:'This file type is not supported.',sizeError:'This image is larger than 25 MB.',networkError:'The request could not be completed. Try again.',landscapes:'Landscapes',culture:'Culture',experiences:'Experiences',supporting:'Supporting',signature:'Signature',iconic:'Iconic',pendingReview:'Pending review',captionOnly:'Caption only',baliNamed:'Bali named',routeLinked:'Route linked'
    },
    zh: {
      viewPortfolio:'查看巴厘岛作品集',eyebrow:'内容编辑工作区',title:'Portfolio 内容管理器',subtitle:'上传已获授权的图片，确认元数据，无需重新部署即可发布到巴厘岛作品集。',checking:'正在检查存储…',ready:'对象存储已就绪',blocked:'对象存储尚未配置',uploadTitle:'上传已获授权的图片',uploadSub:'图片从浏览器直接进入对象存储，Render 不保存图片文件。',dropTitle:'拖入图片，或点击选择文件',dropSub:'JPG、PNG、WebP、AVIF 或 HEIC · 单张不超过 25 MB',theme:'主主题',subCategory:'子分类',region:'区域',area:'地点片区',placeName:'地点名称',placeType:'地点类型',prominence:'重要程度',routeIds:'路线 ID',extensionIds:'扩展模块 ID',tags:'标签',mood:'氛围',photoStyle:'摄影风格',verification:'核验状态',listHelp:'多个值用英文逗号分隔。',localizedCopy:'五语言标题、说明和替代文本',saveDraft:'上传并保存草稿',uploadPublish:'上传并发布',libraryTitle:'作品集内容库',librarySub:'可拖动排序，也可用移动按钮完成键盘操作。',loadingAssets:'正在读取作品集内容…',editAsset:'编辑作品集图片',saveChanges:'保存修改',replaceImage:'替换图片',cancel:'取消',titleField:'标题',description:'说明',altText:'替代文本',search:'搜索地点或标题',allStatuses:'全部状态',empty:'当前筛选没有内容。',preview:'预览',edit:'编辑',publish:'发布',hide:'隐藏',archive:'归档',moveUp:'上移',moveDown:'下移',draft:'草稿',published:'已发布',hidden:'已隐藏',archived:'已归档',analysing:'正在读取文件信息…',queued:'等待上传',uploading:'正在上传',saving:'正在保存元数据…',complete:'完成',failed:'失败',selectFiles:'请至少选择一张有效图片。',storageMissing:'请先配置三个 Cloudinary 环境变量再上传；现有作品集不受影响。',adminOnly:'此页面仅限管理员账户。',sessionExpired:'登录已过期，请重新登录后继续。',publishNeedsMetadata:'发布前必须填写地点名称、标题和替代文本。',changesSaved:'作品集内容已更新。',orderSaved:'作品集顺序已更新。',replacementSaved:'图片已替换，原元数据已保留。',uploadFinished:'上传队列已处理完成。',formatError:'不支持这种文件格式。',sizeError:'图片超过 25 MB。',networkError:'请求未完成，请重试。',landscapes:'自然风景',culture:'文化',experiences:'体验',supporting:'补充内容',signature:'核心内容',iconic:'标志性内容',pendingReview:'待核验',captionOnly:'仅说明可用',baliNamed:'巴厘岛地点已确认',routeLinked:'已关联路线'
    },
    ja: {
      viewPortfolio:'バリのポートフォリオを見る',eyebrow:'編集ワークスペース',title:'Portfolio コンテンツ管理',subtitle:'許可済み画像をアップロードし、メタデータを確認して、再デプロイせずに公開できます。',checking:'ストレージを確認中…',ready:'オブジェクトストレージ準備完了',blocked:'ストレージ未設定',uploadTitle:'許可済み画像をアップロード',uploadSub:'画像はブラウザから直接ストレージへ送られ、Render には保存されません。',dropTitle:'画像をドロップ、またはファイルを選択',dropSub:'JPG、PNG、WebP、AVIF、HEIC · 1枚25MBまで',theme:'主テーマ',subCategory:'サブカテゴリー',region:'地域',area:'エリア',placeName:'場所名',placeType:'場所タイプ',prominence:'重要度',routeIds:'ルートID',extensionIds:'拡張ID',tags:'タグ',mood:'雰囲気',photoStyle:'撮影スタイル',verification:'確認状態',listHelp:'複数の値はカンマで区切ります。',localizedCopy:'多言語のタイトル・説明・代替テキスト',saveDraft:'下書きとしてアップロード',uploadPublish:'アップロードして公開',libraryTitle:'ポートフォリオ一覧',librarySub:'ドラッグ、または移動ボタンで並べ替えできます。',loadingAssets:'アセットを読み込み中…',editAsset:'アセットを編集',saveChanges:'変更を保存',replaceImage:'画像を差し替え',cancel:'キャンセル',titleField:'タイトル',description:'説明',altText:'代替テキスト',search:'場所またはタイトルを検索',allStatuses:'すべての状態',empty:'該当するアセットはありません。',preview:'プレビュー',edit:'編集',publish:'公開',hide:'非表示',archive:'アーカイブ',moveUp:'上へ',moveDown:'下へ',draft:'下書き',published:'公開中',hidden:'非表示',archived:'アーカイブ済み',analysing:'ファイル情報を確認中…',queued:'アップロード待ち',uploading:'アップロード中',saving:'メタデータを保存中…',complete:'完了',failed:'失敗',selectFiles:'有効な画像を1枚以上選択してください。',storageMissing:'アップロード前にCloudinaryの3つの環境変数を設定してください。既存コンテンツには影響しません。',adminOnly:'管理者アカウントが必要です。',sessionExpired:'セッションが切れました。再度ログインしてください。',publishNeedsMetadata:'公開には場所名、タイトル、代替テキストが必要です。',changesSaved:'アセットを更新しました。',orderSaved:'表示順を更新しました。',replacementSaved:'メタデータを保ったまま画像を差し替えました。',uploadFinished:'アップロード処理が完了しました。',formatError:'この形式は対応していません。',sizeError:'画像は25MBを超えています。',networkError:'処理できませんでした。再試行してください。',landscapes:'風景',culture:'文化',experiences:'体験',supporting:'補助',signature:'代表',iconic:'象徴的',pendingReview:'確認待ち',captionOnly:'キャプションのみ',baliNamed:'バリ地点確認済み',routeLinked:'ルート連携済み'
    },
    ko: {
      viewPortfolio:'발리 포트폴리오 보기',eyebrow:'편집 작업 공간',title:'Portfolio 콘텐츠 관리자',subtitle:'승인된 이미지를 업로드하고 메타데이터를 확인한 뒤 재배포 없이 공개합니다.',checking:'저장소 확인 중…',ready:'객체 저장소 준비됨',blocked:'저장소 미설정',uploadTitle:'승인된 이미지 업로드',uploadSub:'이미지는 브라우저에서 저장소로 직접 전송되며 Render에 저장되지 않습니다.',dropTitle:'이미지를 끌어놓거나 파일 선택',dropSub:'JPG, PNG, WebP, AVIF, HEIC · 파일당 최대 25MB',theme:'주요 테마',subCategory:'하위 분류',region:'지역',area:'구역',placeName:'장소 이름',placeType:'장소 유형',prominence:'중요도',routeIds:'경로 ID',extensionIds:'확장 ID',tags:'태그',mood:'분위기',photoStyle:'사진 스타일',verification:'검증 상태',listHelp:'여러 값은 쉼표로 구분하세요.',localizedCopy:'다국어 제목, 설명, 대체 텍스트',saveDraft:'초안으로 업로드',uploadPublish:'업로드 후 공개',libraryTitle:'포트폴리오 라이브러리',librarySub:'드래그하거나 이동 버튼으로 순서를 바꿀 수 있습니다.',loadingAssets:'자산 불러오는 중…',editAsset:'자산 편집',saveChanges:'변경 저장',replaceImage:'이미지 교체',cancel:'취소',titleField:'제목',description:'설명',altText:'대체 텍스트',search:'장소 또는 제목 검색',allStatuses:'모든 상태',empty:'조건에 맞는 자산이 없습니다.',preview:'미리보기',edit:'편집',publish:'공개',hide:'숨기기',archive:'보관',moveUp:'위로',moveDown:'아래로',draft:'초안',published:'공개됨',hidden:'숨김',archived:'보관됨',analysing:'파일 정보 확인 중…',queued:'업로드 준비됨',uploading:'업로드 중',saving:'메타데이터 저장 중…',complete:'완료',failed:'실패',selectFiles:'유효한 이미지를 하나 이상 선택하세요.',storageMissing:'업로드 전에 Cloudinary 환경 변수 3개를 설정하세요. 기존 포트폴리오는 영향을 받지 않습니다.',adminOnly:'관리자 계정이 필요합니다.',sessionExpired:'세션이 만료되었습니다. 다시 로그인하세요.',publishNeedsMetadata:'공개하려면 장소 이름, 제목, 대체 텍스트가 필요합니다.',changesSaved:'자산이 업데이트되었습니다.',orderSaved:'표시 순서가 업데이트되었습니다.',replacementSaved:'메타데이터를 유지하며 이미지를 교체했습니다.',uploadFinished:'업로드 대기열 처리가 완료되었습니다.',formatError:'지원하지 않는 형식입니다.',sizeError:'이미지가 25MB를 초과합니다.',networkError:'요청을 완료하지 못했습니다. 다시 시도하세요.',landscapes:'풍경',culture:'문화',experiences:'체험',supporting:'보조',signature:'대표',iconic:'상징적',pendingReview:'검토 대기',captionOnly:'캡션 전용',baliNamed:'발리 장소 확인',routeLinked:'경로 연결됨'
    },
    id: {
      viewPortfolio:'Lihat Portfolio Bali',eyebrow:'Ruang kerja editorial',title:'Pengelola Konten Portfolio',subtitle:'Unggah gambar berizin, konfirmasi metadata, dan terbitkan tanpa deploy ulang.',checking:'Memeriksa penyimpanan…',ready:'Penyimpanan objek siap',blocked:'Penyimpanan belum diatur',uploadTitle:'Unggah gambar berizin',uploadSub:'Gambar dikirim langsung dari browser ke penyimpanan. Render tidak menyimpan file.',dropTitle:'Tarik gambar ke sini atau pilih file',dropSub:'JPG, PNG, WebP, AVIF, atau HEIC · maks. 25 MB per file',theme:'Tema utama',subCategory:'Subkategori',region:'Wilayah',area:'Area',placeName:'Nama tempat',placeType:'Jenis tempat',prominence:'Tingkat kepentingan',routeIds:'ID rute',extensionIds:'ID ekstensi',tags:'Tag',mood:'Suasana',photoStyle:'Gaya fotografi',verification:'Status verifikasi',listHelp:'Pisahkan beberapa nilai dengan koma.',localizedCopy:'Judul, deskripsi, dan teks alternatif multibahasa',saveDraft:'Unggah sebagai draf',uploadPublish:'Unggah dan terbitkan',libraryTitle:'Pustaka Portfolio',librarySub:'Seret untuk mengurutkan, atau gunakan tombol pindah untuk keyboard.',loadingAssets:'Memuat aset…',editAsset:'Edit aset Portfolio',saveChanges:'Simpan perubahan',replaceImage:'Ganti gambar',cancel:'Batal',titleField:'Judul',description:'Deskripsi',altText:'Teks alternatif',search:'Cari tempat atau judul',allStatuses:'Semua status',empty:'Tidak ada aset yang cocok.',preview:'Pratinjau',edit:'Edit',publish:'Terbitkan',hide:'Sembunyikan',archive:'Arsipkan',moveUp:'Naik',moveDown:'Turun',draft:'Draf',published:'Terbit',hidden:'Tersembunyi',archived:'Diarsipkan',analysing:'Membaca informasi file…',queued:'Siap diunggah',uploading:'Mengunggah',saving:'Menyimpan metadata…',complete:'Selesai',failed:'Gagal',selectFiles:'Pilih setidaknya satu gambar yang valid.',storageMissing:'Atur tiga variabel Cloudinary sebelum mengunggah. Portfolio yang ada tidak terpengaruh.',adminOnly:'Halaman ini memerlukan akun administrator.',sessionExpired:'Sesi berakhir. Masuk lagi untuk melanjutkan.',publishNeedsMetadata:'Publikasi memerlukan nama tempat, judul, dan teks alternatif.',changesSaved:'Aset Portfolio diperbarui.',orderSaved:'Urutan Portfolio diperbarui.',replacementSaved:'Gambar diganti dan metadata dipertahankan.',uploadFinished:'Antrean unggahan selesai.',formatError:'Format file tidak didukung.',sizeError:'Gambar lebih besar dari 25 MB.',networkError:'Permintaan tidak dapat diselesaikan. Coba lagi.',landscapes:'Lanskap',culture:'Budaya',experiences:'Pengalaman',supporting:'Pendukung',signature:'Unggulan',iconic:'Ikonik',pendingReview:'Menunggu tinjauan',captionOnly:'Hanya keterangan',baliNamed:'Lokasi Bali terverifikasi',routeLinked:'Terhubung ke rute'
    }
  };

  var QUEUE_COPY = {
    en:{manifestChecking:'Loading the approved image manifest…',manifestReady:'Approved manifest ready: 108 images can be matched by hash.',manifestLoadFailed:'The approved manifest could not be loaded. New files may still be saved as drafts after manual review.',manifestMatched:'Approved manifest matched',manifestUnmatched:'Not in approved manifest',metadataConfirmed:'Metadata confirmed',editMetadata:'Review metadata',queueReviewTitle:'Review image metadata',queueReviewHelp:'Approved suggestions are a starting point. Confirm the fields before publishing.',saveQueueMetadata:'Confirm metadata',duplicateFile:'This image is already in the upload queue.',duplicateAsset:'This image already exists in the Portfolio library.',publishNeedsManifestReview:'Every unpublished image must match the approved manifest or have its metadata manually confirmed.',uploadFinishedWithErrors:'The upload queue finished with errors. Review the failed images and retry.',archiveConfirm:'Archive this Portfolio image? You can keep its metadata and restore its status later.',skipContent:'Skip to content'},
    zh:{manifestChecking:'正在读取已批准图片清单…',manifestReady:'已批准清单就绪：可按哈希匹配 108 张图片。',manifestLoadFailed:'无法读取已批准清单；新图片仍可在人工核对后保存为草稿。',manifestMatched:'已匹配批准清单',manifestUnmatched:'不在批准清单中',metadataConfirmed:'元数据已确认',editMetadata:'核对元数据',queueReviewTitle:'核对单张图片元数据',queueReviewHelp:'批准清单只提供建议值；发布前请确认各字段。',saveQueueMetadata:'确认元数据',duplicateFile:'该图片已在上传队列中。',duplicateAsset:'该图片已存在于 Portfolio 内容库中。',publishNeedsManifestReview:'每张待发布图片必须匹配批准清单，或已完成人工元数据确认。',uploadFinishedWithErrors:'上传队列已处理，但存在失败项；请查看失败图片并重试。',archiveConfirm:'确认归档这张 Portfolio 图片吗？元数据会保留，之后仍可恢复状态。',skipContent:'跳到主要内容'},
    ja:{manifestChecking:'承認済み画像マニフェストを読み込み中…',manifestReady:'承認済みマニフェストの準備完了：108枚をハッシュで照合できます。',manifestLoadFailed:'承認済みマニフェストを読み込めません。新規画像は手動確認後に下書き保存できます。',manifestMatched:'承認済みマニフェスト一致',manifestUnmatched:'承認済みマニフェスト外',metadataConfirmed:'メタデータ確認済み',editMetadata:'メタデータを確認',queueReviewTitle:'画像メタデータを確認',queueReviewHelp:'承認済み候補は初期値です。公開前に各項目を確認してください。',saveQueueMetadata:'メタデータを確定',duplicateFile:'この画像はすでにアップロード待ちです。',duplicateAsset:'この画像はすでに Portfolio に登録されています。',publishNeedsManifestReview:'公開する画像は承認済みマニフェストとの一致、または手動メタデータ確認が必要です。',uploadFinishedWithErrors:'アップロード処理は完了しましたが、失敗した画像があります。確認して再試行してください。',archiveConfirm:'この Portfolio 画像をアーカイブしますか？メタデータは保持され、後で状態を戻せます。',skipContent:'メインコンテンツへ移動'},
    ko:{manifestChecking:'승인된 이미지 매니페스트를 불러오는 중…',manifestReady:'승인 매니페스트 준비 완료: 해시로 108개 이미지를 확인할 수 있습니다.',manifestLoadFailed:'승인 매니페스트를 불러오지 못했습니다. 새 이미지는 수동 검토 후 초안으로 저장할 수 있습니다.',manifestMatched:'승인 매니페스트 일치',manifestUnmatched:'승인 매니페스트에 없음',metadataConfirmed:'메타데이터 확인됨',editMetadata:'메타데이터 검토',queueReviewTitle:'이미지 메타데이터 검토',queueReviewHelp:'승인된 제안은 시작점입니다. 게시 전에 각 필드를 확인하세요.',saveQueueMetadata:'메타데이터 확인',duplicateFile:'이 이미지는 이미 업로드 대기열에 있습니다.',duplicateAsset:'이 이미지는 이미 Portfolio 라이브러리에 있습니다.',publishNeedsManifestReview:'게시할 각 이미지는 승인 매니페스트와 일치하거나 메타데이터를 수동으로 확인해야 합니다.',uploadFinishedWithErrors:'업로드 처리가 끝났지만 실패한 이미지가 있습니다. 확인 후 다시 시도하세요.',archiveConfirm:'이 Portfolio 이미지를 보관하시겠습니까? 메타데이터는 유지되며 나중에 상태를 복원할 수 있습니다.',skipContent:'본문으로 건너뛰기'},
    id:{manifestChecking:'Memuat manifest gambar yang disetujui…',manifestReady:'Manifest siap: 108 gambar dapat dicocokkan melalui hash.',manifestLoadFailed:'Manifest tidak dapat dimuat. Gambar baru masih dapat disimpan sebagai draf setelah ditinjau manual.',manifestMatched:'Cocok dengan manifest yang disetujui',manifestUnmatched:'Tidak ada di manifest yang disetujui',metadataConfirmed:'Metadata dikonfirmasi',editMetadata:'Tinjau metadata',queueReviewTitle:'Tinjau metadata gambar',queueReviewHelp:'Saran yang disetujui adalah titik awal. Konfirmasikan setiap kolom sebelum menerbitkan.',saveQueueMetadata:'Konfirmasi metadata',duplicateFile:'Gambar ini sudah ada dalam antrean unggahan.',duplicateAsset:'Gambar ini sudah ada di pustaka Portfolio.',publishNeedsManifestReview:'Setiap gambar yang akan diterbitkan harus cocok dengan manifest yang disetujui atau telah dikonfirmasi secara manual.',uploadFinishedWithErrors:'Antrean selesai, tetapi beberapa gambar gagal. Tinjau gambar yang gagal lalu coba lagi.',archiveConfirm:'Arsipkan gambar Portfolio ini? Metadata tetap tersimpan dan status dapat dipulihkan nanti.',skipContent:'Lewati ke konten utama'}
  };
  LANGS.forEach(function (lang) { Object.assign(COPY[lang], QUEUE_COPY[lang]); });

  function language() {
    var value = (document.getElementById('langPicker').value || localStorage.getItem('wm_studio_lang') || 'en').toLowerCase();
    return LANGS.indexOf(value) >= 0 ? value : 'en';
  }
  function t(key) { return (COPY[language()] || COPY.en)[key] || COPY.en[key] || key; }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]; }); }
  function showAlert(message) { pageAlert.textContent = message; pageAlert.hidden = false; }
  function clearAlert() { pageAlert.hidden = true; pageAlert.textContent = ''; }
  function redirectToLogin() { window.location.assign('../ai-tool.html?auth=login&return=' + encodeURIComponent('/admin/portfolio')); }
  function localeValue(value) { value = value || {}; return value[language()] || value.en || value.zh || Object.values(value)[0] || ''; }
  function splitList(value) { return String(value || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function fileStem(name) { return String(name || 'image').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function fileFormat(file) { var ext = String(file.name || '').split('.').pop().toLowerCase(); return ext === 'jpeg' ? 'jpg' : ext; }
  function isSupportedImageFile(file) { return ['jpg','png','webp','avif','heic'].indexOf(fileFormat(file)) >= 0; }
  function formatBytes(bytes) { if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'; return (bytes / 1024 / 1024).toFixed(1) + ' MB'; }

  function updateManifestStatus() {
    var node = document.getElementById('manifestStatus');
    if (!node) return;
    node.textContent = state.manifestError ? t('manifestLoadFailed') : state.manifestLoaded ? t('manifestReady') : t('manifestChecking');
  }

  async function loadApprovalManifest() {
    if (state.manifestLoaded || state.manifestError) return;
    try {
      var response = await fetch('../assets/data/image-publish-manifest.json?v=p2', { cache:'no-store' });
      if (!response.ok) throw new Error('manifest');
      var payload = await response.json();
      (payload.images || []).forEach(function (item) {
        var hash = String(item.sha256 || '').toLowerCase();
        if (hash) state.manifestByHash[hash] = item;
      });
      state.manifestLoaded = true;
    } catch (_) { state.manifestError = true; }
    updateManifestStatus();
  }

  function meaningfulText(value) {
    value = String(value || '').trim();
    return value && !/\?{2,}|\uFFFD/.test(value) ? value : '';
  }

  function localizedSuggestion(value) {
    var result = {};
    LANGS.forEach(function (lang) {
      var text = meaningfulText((value || {})[lang]);
      if (text) result[lang] = text;
    });
    return result;
  }

  function approvedSuggestion(item, file) {
    var stem = fileStem(file.name);
    var themes = ['landscapes','culture','experiences'];
    var theme = themes.indexOf(item.category) >= 0 ? item.category : 'landscapes';
    var routes = Array.isArray(item.route_ids) ? item.route_ids.slice() : [];
    var regions = Array.isArray(item.region_ids) ? item.region_ids.slice() : [];
    var title = localizedSuggestion(item.title);
    var description = localizedSuggestion(item.description);
    var alt = localizedSuggestion(item.alt_text);
    if (!title.en) title.en = stem;
    if (!alt.en) alt.en = stem + ' in Bali';
    return {
      destination:'bali', primary_theme:theme, sub_category:String(item.sub_category || '').trim(),
      region:regions.join(', '), area:'', place_name:stem, place_type:String(item.sub_category || '').replace(/-/g, ' '),
      prominence:routes.length ? 'signature' : 'supporting', route_ids:routes, extension_ids:[],
      tags:Array.isArray(item.tags) ? item.tags.slice() : [], mood:'', photography_style:'',
      title:title, description:description, alt_text:alt,
      verification_status:routes.length ? 'route-linked' : item.location_status === 'bali-named' ? 'bali-named' : 'caption-only', status:'draft'
    };
  }

  function recordMetadata(record, baseMetadata, status) {
    var metadata = JSON.parse(JSON.stringify(record.manifestMatch || record.metadataEdited ? record.metadata : baseMetadata));
    metadata.status = status || 'draft';
    var stem = fileStem(record.file.name);
    metadata.title = metadata.title || {};
    metadata.alt_text = metadata.alt_text || {};
    metadata.description = metadata.description || {};
    if (!Object.keys(metadata.title).length) metadata.title.en = stem;
    if (!Object.keys(metadata.alt_text).length) metadata.alt_text.en = stem + ' in Bali';
    return metadata;
  }

  async function api(path, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers || {}, { Authorization: 'Bearer ' + token });
    if (options.body && typeof options.body !== 'string') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    var response = await fetch(path, options);
    if (response.status === 401) { showAlert(t('sessionExpired')); window.setTimeout(redirectToLogin, 700); throw new Error('AUTH'); }
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.detail || t('networkError'));
    return payload;
  }

  function localizedFields(prefix, value) {
    value = value || { title:{}, description:{}, alt_text:{} };
    return LANGS.map(function (lang) {
      return '<fieldset class="wm-field wide" style="border:0;padding:0;margin:0"><legend class="wm-field-label">' + lang.toUpperCase() + '</legend>' +
        '<div class="wm-fields" style="margin-top:5px">' +
        '<div class="wm-field wide"><label for="' + prefix + '-title-' + lang + '">' + escapeHtml(t('titleField')) + '</label><input id="' + prefix + '-title-' + lang + '" name="title_' + lang + '" value="' + escapeHtml((value.title || {})[lang] || '') + '"></div>' +
        '<div class="wm-field wide"><label for="' + prefix + '-desc-' + lang + '">' + escapeHtml(t('description')) + '</label><textarea id="' + prefix + '-desc-' + lang + '" name="description_' + lang + '">' + escapeHtml((value.description || {})[lang] || '') + '</textarea></div>' +
        '<div class="wm-field wide"><label for="' + prefix + '-alt-' + lang + '">' + escapeHtml(t('altText')) + '</label><input id="' + prefix + '-alt-' + lang + '" name="alt_text_' + lang + '" value="' + escapeHtml((value.alt_text || {})[lang] || '') + '"></div>' +
        '</div></fieldset>';
    }).join('');
  }

  function applyLanguage() {
    document.documentElement.lang = language();
    localStorage.setItem('wm_studio_lang', language());
    document.querySelectorAll('[data-copy]').forEach(function (node) { node.textContent = t(node.dataset.copy); });
    document.getElementById('assetSearch').placeholder = t('search');
    document.getElementById('assetSearch').setAttribute('aria-label', t('search'));
    var themeOptions = document.getElementById('primaryTheme').options;
    themeOptions[0].textContent = t('landscapes'); themeOptions[1].textContent = t('culture'); themeOptions[2].textContent = t('experiences');
    var prominenceOptions = document.getElementById('prominence').options;
    prominenceOptions[0].textContent = t('supporting'); prominenceOptions[1].textContent = t('signature'); prominenceOptions[2].textContent = t('iconic');
    var verificationOptions = document.getElementById('verificationStatus').options;
    verificationOptions[0].textContent = t('pendingReview'); verificationOptions[1].textContent = t('captionOnly'); verificationOptions[2].textContent = t('baliNamed'); verificationOptions[3].textContent = t('routeLinked');
    var filterOptions = document.getElementById('statusFilter').options;
    filterOptions[0].textContent = t('allStatuses'); filterOptions[1].textContent = t('draft'); filterOptions[2].textContent = t('published'); filterOptions[3].textContent = t('hidden'); filterOptions[4].textContent = t('archived');
    document.getElementById('uploadLocales').innerHTML = localizedFields('upload', readLocalized(uploadForm));
    if (state.editingId) openEditor(state.editingId, true);
    if (state.queueEditingId) openQueueEditor(state.queueEditingId, true);
    updateStorageStatus();
    updateManifestStatus();
    renderQueue();
    renderAssets();
  }

  function readLocalized(form) {
    var result = { title:{}, description:{}, alt_text:{} };
    if (!form) return result;
    var data = new FormData(form);
    LANGS.forEach(function (lang) {
      ['title', 'description', 'alt_text'].forEach(function (field) {
        var value = String(data.get(field + '_' + lang) || '').trim();
        if (value) result[field][lang] = value;
      });
    });
    return result;
  }

  function metadataFromForm(form, status) {
    var data = new FormData(form);
    var localized = readLocalized(form);
    return {
      destination:'bali', primary_theme:String(data.get('primary_theme') || 'landscapes'),
      sub_category:String(data.get('sub_category') || '').trim(), region:String(data.get('region') || '').trim(),
      area:String(data.get('area') || '').trim(), place_name:String(data.get('place_name') || '').trim(),
      place_type:String(data.get('place_type') || '').trim(), prominence:String(data.get('prominence') || 'supporting'),
      route_ids:splitList(data.get('route_ids')), extension_ids:splitList(data.get('extension_ids')), tags:splitList(data.get('tags')),
      mood:String(data.get('mood') || '').trim(), photography_style:String(data.get('photography_style') || '').trim(),
      title:localized.title, description:localized.description, alt_text:localized.alt_text,
      verification_status:String(data.get('verification_status') || 'caption-only'), status:status || 'draft'
    };
  }

  async function digestFile(file) {
    var buffer = await file.arrayBuffer();
    var hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  }

  function imageDimensions(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve({ width:image.naturalWidth, height:image.naturalHeight }); };
      image.onerror = reject;
      image.src = url;
    });
  }

  async function addFiles(files) {
    clearAlert();
    var selectedFiles = Array.from(files || []);
    await loadApprovalManifest();
    for (var file of selectedFiles) {
      var record = { id:crypto.randomUUID(), file:file, preview:URL.createObjectURL(file), progress:0, state:'analysing', error:'', width:0, height:0, sha256:'', manifestMatch:false, manifestItem:null, metadata:null, metadataEdited:false };
      state.files.push(record); renderQueue();
      try {
        if (!isSupportedImageFile(file)) throw new Error(t('formatError'));
        if (file.size > 25 * 1024 * 1024) throw new Error(t('sizeError'));
        var details = await Promise.all([digestFile(file), imageDimensions(record.preview).catch(function () { return { width:0, height:0 }; })]);
        record.sha256 = details[0]; record.width = details[1].width; record.height = details[1].height;
        if (state.files.some(function (item) { return item.id !== record.id && item.sha256 === record.sha256 && item.state !== 'failed'; })) throw new Error(t('duplicateFile'));
        if (state.assets.some(function (asset) { return asset.sha256 === record.sha256; })) throw new Error(t('duplicateAsset'));
        record.manifestItem = state.manifestByHash[record.sha256] || null;
        record.manifestMatch = Boolean(record.manifestItem);
        record.metadata = record.manifestMatch ? approvedSuggestion(record.manifestItem, file) : recordMetadata(record, metadataFromForm(uploadForm, 'draft'), 'draft');
        record.state = 'queued';
      } catch (error) { record.state = 'failed'; record.error = error.message || t('networkError'); }
      renderQueue();
    }
  }

  function renderQueue() {
    queue.innerHTML = state.files.map(function (item) {
      var stateText = item.error || t(item.state);
      var meta = item.width ? item.width + ' × ' + item.height + ' · ' + formatBytes(item.file.size) + ' · ' + fileFormat(item.file).toUpperCase() : formatBytes(item.file.size);
      var badges = item.sha256 ? '<div class="wm-queue-badges"><span class="wm-chip" data-status="' + (item.manifestMatch ? 'manifest-matched' : 'manifest-unmatched') + '">' + escapeHtml(t(item.manifestMatch ? 'manifestMatched' : 'manifestUnmatched')) + '</span>' + (item.metadataEdited ? '<span class="wm-chip">' + escapeHtml(t('metadataConfirmed')) + '</span>' : '') + '</div>' : '';
      var actions = item.state === 'queued' ? '<div class="wm-queue-actions"><button class="wm-btn wm-btn-secondary" type="button" data-queue-edit="' + escapeHtml(item.id) + '">' + escapeHtml(t('editMetadata')) + '</button></div>' : '';
      return '<div class="wm-queue-item"><img src="' + escapeHtml(item.preview) + '" width="58" height="58" alt=""><div class="wm-queue-main"><div class="wm-queue-head"><div><span class="wm-queue-name">' + escapeHtml(item.file.name) + '</span><span class="wm-queue-meta">' + escapeHtml(meta) + '</span></div></div>' + badges + '<div class="wm-progress" role="progressbar" aria-label="' + escapeHtml(item.file.name) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Number(item.progress || 0) + '"><span style="width:' + Number(item.progress || 0) + '%"></span></div><div class="wm-queue-state">' + escapeHtml(stateText) + '</div>' + actions + '</div></div>';
    }).join('');
    bindQueueEvents();
  }

  function bindQueueEvents() {
    queue.querySelectorAll('[data-queue-edit]').forEach(function (button) {
      button.addEventListener('click', function () { openQueueEditor(button.dataset.queueEdit); });
    });
  }

  function openQueueEditor(id, languageRefresh) {
    var record = state.files.find(function (item) { return item.id === id; });
    if (!record || !record.metadata) return;
    state.queueEditingId = id;
    document.getElementById('queueEditorFields').innerHTML = editorMarkup(record.metadata);
    if (!languageRefresh && !queueDialog.open) queueDialog.showModal();
  }

  function closeQueueEditor() { state.queueEditingId = ''; queueDialog.close(); }

  function saveQueueEditor(event) {
    event.preventDefault(); clearAlert();
    var record = state.files.find(function (item) { return item.id === state.queueEditingId; });
    if (!record) return;
    record.metadata = metadataFromForm(event.currentTarget, 'draft');
    record.metadataEdited = true;
    closeQueueEditor(); renderQueue();
  }

  function uploadToCloudinary(file, signature, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', signature.upload_url);
      xhr.upload.onprogress = function (event) { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
      xhr.onerror = function () { reject(new Error(t('networkError'))); };
      xhr.onload = function () {
        var payload = {};
        try { payload = JSON.parse(xhr.responseText || '{}'); } catch (_) {}
        if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(payload.error && payload.error.message || t('networkError')));
        resolve(payload);
      };
      var body = new FormData();
      body.append('file', file);
      body.append('api_key', signature.api_key);
      body.append('signature', signature.signature);
      Object.keys(signature.signed_fields || {}).forEach(function (key) { body.append(key, signature.signed_fields[key]); });
      xhr.send(body);
    });
  }

  async function uploadRecord(record, baseMetadata, status) {
    record.state = 'uploading'; renderQueue();
    var signature = await api('/api/admin/portfolio/upload-signature', { method:'POST', body:{ destination:'bali', filename:record.file.name } });
    var uploaded = await uploadToCloudinary(record.file, signature, function (progress) { record.progress = progress; renderQueue(); });
    record.state = 'saving'; record.progress = 100; renderQueue();
    var metadata = recordMetadata(record, baseMetadata, status);
    metadata.original_filename = record.file.name;
    metadata.sha256 = record.sha256;
    metadata.file_bytes = uploaded.bytes;
    metadata.width = uploaded.width;
    metadata.height = uploaded.height;
    metadata.format = uploaded.format;
    metadata.image_metadata = uploaded.image_metadata || {};
    metadata.cloudinary_asset_id = uploaded.asset_id;
    metadata.cloudinary_public_id = uploaded.public_id;
    metadata.cloudinary_version = uploaded.version;
    metadata.secure_url = uploaded.secure_url;
    metadata.response_signature = uploaded.signature;
    await api('/api/admin/portfolio/assets', { method:'POST', body:metadata });
    record.state = 'complete'; renderQueue();
  }

  async function submitUploads(event) {
    event.preventDefault(); clearAlert();
    var selected = state.files.filter(function (item) { return item.state === 'queued'; });
    if (!selected.length) return showAlert(t('selectFiles'));
    if (!state.storageReady) return showAlert(t('storageMissing'));
    var status = event.submitter && event.submitter.dataset.status || 'draft';
    var metadata = metadataFromForm(uploadForm, status);
    if (status === 'published' && selected.some(function (record) { return !record.manifestMatch && !record.metadataEdited; })) return showAlert(t('publishNeedsManifestReview'));
    if (status === 'published' && selected.some(function (record) {
      var itemMetadata = recordMetadata(record, metadata, status);
      return !itemMetadata.place_name || !Object.keys(itemMetadata.title).length || !Object.keys(itemMetadata.alt_text).length;
    })) return showAlert(t('publishNeedsMetadata'));
    var buttons = uploadForm.querySelectorAll('button[type="submit"]');
    buttons.forEach(function (button) { button.disabled = true; });
    var failedCount = 0;
    for (var record of selected) {
      try { await uploadRecord(record, metadata, status); }
      catch (error) { failedCount += 1; record.state = 'failed'; record.error = error.message || t('networkError'); renderQueue(); }
    }
    buttons.forEach(function (button) { button.disabled = !state.storageReady; });
    showAlert(t(failedCount ? 'uploadFinishedWithErrors' : 'uploadFinished'));
    await loadAssets();
  }

  function statusLabel(status) { return t(status) || status; }
  function renderAssets() {
    var search = String(document.getElementById('assetSearch').value || '').trim().toLowerCase();
    var status = document.getElementById('statusFilter').value;
    var filtered = state.assets.filter(function (asset) {
      var haystack = [asset.place_name, localeValue(asset.title), asset.area, asset.region].join(' ').toLowerCase();
      return (!search || haystack.indexOf(search) >= 0) && (status === 'all' || asset.status === status);
    });
    if (!filtered.length) { assetList.innerHTML = '<div class="wm-empty">' + escapeHtml(t('empty')) + '</div>'; return; }
    var allowDrag = !search && status === 'all';
    assetList.innerHTML = filtered.map(function (asset, index) {
      var position = state.assets.findIndex(function (item) { return item.id === asset.id; });
      return '<article class="wm-asset" data-asset-id="' + escapeHtml(asset.id) + '" draggable="' + (allowDrag ? 'true' : 'false') + '">' +
        '<img src="' + escapeHtml(asset.thumbnail_url) + '" width="112" height="94" alt="' + escapeHtml(localeValue(asset.alt_text)) + '" loading="lazy"><div><div class="wm-asset-top"><div><h3>' + escapeHtml(localeValue(asset.title) || asset.place_name || asset.original_filename) + '</h3><p>' + escapeHtml([asset.area,asset.region,asset.primary_theme].filter(Boolean).join(' · ')) + '</p></div><span class="wm-chip" data-status="' + escapeHtml(asset.status) + '">' + escapeHtml(statusLabel(asset.status)) + '</span></div>' +
        '<p>' + escapeHtml(asset.width + ' × ' + asset.height + ' · ' + String(asset.format || '').toUpperCase() + ' · ' + (asset.verification_status || '')) + '</p>' +
        '<div class="wm-asset-actions"><a class="wm-btn wm-btn-secondary" href="' + escapeHtml(asset.web_url) + '" target="_blank" rel="noopener">' + escapeHtml(t('preview')) + '</a><button class="wm-btn wm-btn-secondary" type="button" data-action="edit">' + escapeHtml(t('edit')) + '</button>' +
        (asset.status !== 'published' ? '<button class="wm-btn wm-btn-primary" type="button" data-action="published">' + escapeHtml(t('publish')) + '</button>' : '') +
        (asset.status !== 'hidden' ? '<button class="wm-btn wm-btn-secondary" type="button" data-action="hidden">' + escapeHtml(t('hide')) + '</button>' : '') +
        (asset.status !== 'archived' ? '<button class="wm-btn wm-btn-danger" type="button" data-action="archived">' + escapeHtml(t('archive')) + '</button>' : '') +
        '<button class="wm-btn wm-btn-secondary" type="button" data-action="up"' + (position <= 0 ? ' disabled' : '') + '>' + escapeHtml(t('moveUp')) + '</button><button class="wm-btn wm-btn-secondary" type="button" data-action="down"' + (position >= state.assets.length - 1 ? ' disabled' : '') + '>' + escapeHtml(t('moveDown')) + '</button></div></div></article>';
    }).join('');
    bindAssetEvents();
  }

  function editorMarkup(asset) {
    function option(value, label, current) { return '<option value="' + value + '"' + (value === current ? ' selected' : '') + '>' + escapeHtml(label) + '</option>'; }
    return '<div class="wm-field"><label>' + escapeHtml(t('theme')) + '</label><select name="primary_theme">' + option('landscapes',t('landscapes'),asset.primary_theme) + option('culture',t('culture'),asset.primary_theme) + option('experiences',t('experiences'),asset.primary_theme) + '</select></div>' +
      '<div class="wm-field"><label>' + escapeHtml(t('subCategory')) + '</label><input name="sub_category" value="' + escapeHtml(asset.sub_category) + '"></div>' +
      '<div class="wm-field"><label>' + escapeHtml(t('region')) + '</label><input name="region" value="' + escapeHtml(asset.region) + '"></div><div class="wm-field"><label>' + escapeHtml(t('area')) + '</label><input name="area" value="' + escapeHtml(asset.area) + '"></div>' +
      '<div class="wm-field wide"><label>' + escapeHtml(t('placeName')) + '</label><input name="place_name" value="' + escapeHtml(asset.place_name) + '"></div>' +
      '<div class="wm-field"><label>' + escapeHtml(t('placeType')) + '</label><input name="place_type" value="' + escapeHtml(asset.place_type) + '"></div><div class="wm-field"><label>' + escapeHtml(t('prominence')) + '</label><select name="prominence">' + option('supporting',t('supporting'),asset.prominence) + option('signature',t('signature'),asset.prominence) + option('iconic',t('iconic'),asset.prominence) + '</select></div>' +
      '<div class="wm-field wide"><label>' + escapeHtml(t('routeIds')) + '</label><input name="route_ids" value="' + escapeHtml((asset.route_ids || []).join(', ')) + '"></div><div class="wm-field wide"><label>' + escapeHtml(t('extensionIds')) + '</label><input name="extension_ids" value="' + escapeHtml((asset.extension_ids || []).join(', ')) + '"></div><div class="wm-field wide"><label>' + escapeHtml(t('tags')) + '</label><input name="tags" value="' + escapeHtml((asset.tags || []).join(', ')) + '"></div>' +
      '<div class="wm-field"><label>' + escapeHtml(t('mood')) + '</label><input name="mood" value="' + escapeHtml(asset.mood) + '"></div><div class="wm-field"><label>' + escapeHtml(t('photoStyle')) + '</label><input name="photography_style" value="' + escapeHtml(asset.photography_style) + '"></div>' +
      '<div class="wm-field wide"><label>' + escapeHtml(t('verification')) + '</label><select name="verification_status">' + option('pending-review',t('pendingReview'),asset.verification_status) + option('caption-only',t('captionOnly'),asset.verification_status) + option('bali-named',t('baliNamed'),asset.verification_status) + option('route-linked',t('routeLinked'),asset.verification_status) + '</select></div>' +
      '<details class="wm-locales" open><summary>' + escapeHtml(t('localizedCopy')) + '</summary><div class="wm-locales-grid">' + localizedFields('editor', asset) + '</div></details>';
  }

  function openEditor(id, languageRefresh) {
    var asset = state.assets.find(function (item) { return item.id === id; });
    if (!asset) return;
    state.editingId = id;
    document.getElementById('editorFields').innerHTML = editorMarkup(asset);
    if (!languageRefresh && !dialog.open) dialog.showModal();
  }

  function closeEditor() { state.editingId = ''; dialog.close(); }

  async function saveEditor(event) {
    event.preventDefault(); clearAlert();
    var asset = state.assets.find(function (item) { return item.id === state.editingId; });
    if (!asset) return;
    var metadata = metadataFromForm(event.currentTarget, asset.status);
    try { await api('/api/admin/portfolio/assets/' + encodeURIComponent(asset.id), { method:'PATCH', body:metadata }); closeEditor(); showAlert(t('changesSaved')); await loadAssets(); }
    catch (error) { showAlert(error.message || t('networkError')); }
  }

  async function changeStatus(id, status) {
    clearAlert();
    if (status === 'archived' && !window.confirm(t('archiveConfirm'))) return;
    try { await api('/api/admin/portfolio/assets/' + encodeURIComponent(id), { method:'PATCH', body:{ status:status } }); await loadAssets(); }
    catch (error) { showAlert(error.message || t('networkError')); }
  }

  async function saveOrder() {
    try { await api('/api/admin/portfolio/reorder?destination=bali', { method:'POST', body:{ asset_ids:state.assets.map(function (asset) { return asset.id; }) } }); showAlert(t('orderSaved')); renderAssets(); }
    catch (error) { showAlert(error.message || t('networkError')); await loadAssets(); }
  }

  function moveAsset(id, delta) {
    var index = state.assets.findIndex(function (asset) { return asset.id === id; });
    var target = index + delta;
    if (index < 0 || target < 0 || target >= state.assets.length) return;
    var moved = state.assets.splice(index, 1)[0]; state.assets.splice(target, 0, moved); saveOrder();
  }

  function bindAssetEvents() {
    assetList.querySelectorAll('.wm-asset').forEach(function (card) {
      var id = card.dataset.assetId;
      card.querySelectorAll('[data-action]').forEach(function (button) {
        button.addEventListener('click', function () {
          var action = button.dataset.action;
          if (action === 'edit') openEditor(id);
          else if (action === 'up') moveAsset(id, -1);
          else if (action === 'down') moveAsset(id, 1);
          else changeStatus(id, action);
        });
      });
      card.addEventListener('dragstart', function () { state.draggingId = id; card.classList.add('is-dragging'); });
      card.addEventListener('dragend', function () { state.draggingId = ''; card.classList.remove('is-dragging'); });
      card.addEventListener('dragover', function (event) { if (state.draggingId) event.preventDefault(); });
      card.addEventListener('drop', function (event) {
        event.preventDefault();
        var from = state.assets.findIndex(function (asset) { return asset.id === state.draggingId; });
        var to = state.assets.findIndex(function (asset) { return asset.id === id; });
        if (from < 0 || to < 0 || from === to) return;
        var moved = state.assets.splice(from, 1)[0]; state.assets.splice(to, 0, moved); saveOrder();
      });
    });
  }

  async function replaceImage(file) {
    var asset = state.assets.find(function (item) { return item.id === state.editingId; });
    if (!asset || !file) return;
    clearAlert();
    var preview = URL.createObjectURL(file);
    try {
      if (!isSupportedImageFile(file) || file.size > 25 * 1024 * 1024) throw new Error(file.size > 25 * 1024 * 1024 ? t('sizeError') : t('formatError'));
      var details = await Promise.all([digestFile(file), imageDimensions(preview).catch(function () { return { width:0, height:0 }; })]);
      var signature = await api('/api/admin/portfolio/upload-signature', { method:'POST', body:{ destination:'bali', filename:file.name, replacement_asset_id:asset.id } });
      var uploaded = await uploadToCloudinary(file, signature, function () {});
      await api('/api/admin/portfolio/assets/' + encodeURIComponent(asset.id) + '/replace', { method:'POST', body:{
        original_filename:file.name, sha256:details[0], file_bytes:uploaded.bytes, width:uploaded.width || details[1].width, height:uploaded.height || details[1].height,
        format:uploaded.format || fileFormat(file), image_metadata:uploaded.image_metadata || {}, cloudinary_asset_id:uploaded.asset_id,
        cloudinary_public_id:uploaded.public_id, cloudinary_version:uploaded.version, secure_url:uploaded.secure_url, response_signature:uploaded.signature
      } });
      closeEditor(); showAlert(t('replacementSaved')); await loadAssets();
    } catch (error) { showAlert(error.message || t('networkError')); }
    finally { URL.revokeObjectURL(preview); }
  }

  function updateStorageStatus() {
    var node = document.getElementById('storageStatus');
    node.dataset.state = state.storageReady ? 'ready' : 'blocked';
    node.textContent = state.storageReady ? t('ready') : t('blocked');
    uploadForm.querySelectorAll('button[type="submit"]').forEach(function (button) { button.disabled = !state.storageReady; });
  }

  async function loadAssets() {
    var payload = await api('/api/admin/portfolio?destination=bali');
    state.assets = payload.assets || [];
    state.storageReady = Boolean(payload.storage_ready);
    updateStorageStatus(); renderAssets();
    if (!state.storageReady) showAlert(t('storageMissing'));
  }

  async function initialize() {
    document.getElementById('uploadLocales').innerHTML = localizedFields('upload', {});
    if (!token) return redirectToLogin();
    try {
      await loadApprovalManifest();
      var me = await api('/api/auth/me');
      if (!me || me.role !== 'admin') { showAlert(t('adminOnly')); uploadForm.hidden = true; assetList.innerHTML = ''; return; }
      await loadAssets();
    } catch (error) { if (error.message !== 'AUTH') showAlert(error.message || t('networkError')); }
  }

  document.getElementById('langPicker').value = localStorage.getItem('wm_studio_lang') || 'en';
  document.getElementById('langPicker').addEventListener('change', applyLanguage);
  fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
  ['dragenter','dragover'].forEach(function (name) { dropzone.addEventListener(name, function (event) { event.preventDefault(); dropzone.classList.add('is-dragging'); }); });
  ['dragleave','drop'].forEach(function (name) { dropzone.addEventListener(name, function (event) { event.preventDefault(); dropzone.classList.remove('is-dragging'); }); });
  dropzone.addEventListener('drop', function (event) { addFiles(event.dataTransfer.files); });
  uploadForm.addEventListener('submit', submitUploads);
  document.getElementById('assetSearch').addEventListener('input', renderAssets);
  document.getElementById('statusFilter').addEventListener('change', renderAssets);
  document.getElementById('assetEditor').addEventListener('submit', saveEditor);
  document.getElementById('queueEditor').addEventListener('submit', saveQueueEditor);
  document.querySelectorAll('[data-dialog-close]').forEach(function (button) { button.addEventListener('click', closeEditor); });
  document.querySelectorAll('[data-queue-dialog-close]').forEach(function (button) { button.addEventListener('click', closeQueueEditor); });
  document.querySelector('[data-replace]').addEventListener('click', function () { document.getElementById('replacementInput').click(); });
  document.getElementById('replacementInput').addEventListener('change', function (event) { replaceImage(event.target.files[0]); event.target.value = ''; });
  dialog.addEventListener('cancel', function (event) { event.preventDefault(); closeEditor(); });
  queueDialog.addEventListener('cancel', function (event) { event.preventDefault(); closeQueueEditor(); });
  applyLanguage();
  initialize();
})();
