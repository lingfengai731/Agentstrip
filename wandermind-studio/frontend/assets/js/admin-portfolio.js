(function () {
  'use strict';

  var LANGS = ['zh', 'en', 'ja', 'ko', 'id'];
  var token = localStorage.getItem('wm_studio_token') || '';
  var state = { assets: [], files: [], storageReady: false, editingId: '', queueEditingId: '', draggingId: '', manifestByHash: {}, manifestLoaded: false, manifestError: false, poiCatalog: [], catalogLoaded: false };
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
      viewPortfolio:'View Bali Portfolio',eyebrow:'Editorial workspace',title:'Portfolio Content Manager',subtitle:'Upload an image, review the automatic suggestions if needed, and publish without redeploying the website.',checking:'Checking storage…',ready:'Object storage ready',blocked:'Object storage not configured',uploadTitle:'Upload images',uploadSub:'Images go directly from this browser to object storage. Render never stores the file.',dropTitle:'Drop images here or choose files',dropSub:'JPG, PNG, WebP, AVIF or HEIC · up to 25 MB each',theme:'Primary theme',subCategory:'Sub-category',region:'Region',area:'Area',placeName:'Place name',placeType:'Place type',prominence:'Prominence',routeIds:'Route IDs',extensionIds:'Extension IDs',tags:'Tags',mood:'Mood',photoStyle:'Photography style',verification:'Verification status',listHelp:'Separate values with commas.',localizedCopy:'Localized title, description and alt text',saveDraft:'Upload as draft',uploadPublish:'Upload and publish',libraryTitle:'Portfolio library',librarySub:'Drag to reorder, or use the move buttons for keyboard control.',loadingAssets:'Loading portfolio assets…',editAsset:'Edit portfolio asset',saveChanges:'Save changes',replaceImage:'Replace image',cancel:'Cancel',titleField:'Title',description:'Description',altText:'Alt text',search:'Search place or title',allStatuses:'All statuses',empty:'No assets match this view.',preview:'Preview',edit:'Edit',publish:'Publish',hide:'Hide',archive:'Archive',moveUp:'Move up',moveDown:'Move down',draft:'Draft',published:'Published',hidden:'Hidden',archived:'Archived',analysing:'Reading file details…',queued:'Ready to upload',uploading:'Uploading',saving:'Saving metadata…',complete:'Complete',failed:'Failed',selectFiles:'Choose at least one valid image.',storageMissing:'Configure the three Cloudinary environment variables before uploading. Existing Portfolio content is unaffected.',adminOnly:'This page requires an administrator account.',sessionExpired:'Your session has expired. Sign in again to continue.',publishNeedsMetadata:'Publishing requires a place name, title and alt text.',changesSaved:'Portfolio asset updated.',orderSaved:'Portfolio order updated.',replacementSaved:'Image replaced; metadata was preserved.',uploadFinished:'Upload queue finished.',formatError:'This file type is not supported.',sizeError:'This image is larger than 25 MB.',networkError:'The request could not be completed. Try again.',landscapes:'Landscapes',culture:'Culture',experiences:'Experiences',supporting:'Supporting',signature:'Signature',iconic:'Iconic',pendingReview:'Pending review',captionOnly:'Caption only',baliNamed:'Bali named',routeLinked:'Route linked'
    },
    zh: {
      viewPortfolio:'查看巴厘岛作品集',eyebrow:'内容编辑工作区',title:'Portfolio 内容管理器',subtitle:'上传图片后自动建议资料；需要时再修改，无需重新部署即可发布。',checking:'正在检查存储…',ready:'对象存储已就绪',blocked:'对象存储尚未配置',uploadTitle:'上传图片',uploadSub:'图片从浏览器直接进入对象存储，Render 不保存图片文件。',dropTitle:'拖入图片，或点击选择文件',dropSub:'JPG、PNG、WebP、AVIF 或 HEIC · 单张不超过 25 MB',theme:'主主题',subCategory:'子分类',region:'区域',area:'地点片区',placeName:'地点名称',placeType:'地点类型',prominence:'重要程度',routeIds:'路线 ID',extensionIds:'扩展模块 ID',tags:'标签',mood:'氛围',photoStyle:'摄影风格',verification:'核验状态',listHelp:'多个值用英文逗号分隔。',localizedCopy:'五语言标题、说明和替代文本',saveDraft:'上传并保存草稿',uploadPublish:'上传并发布',libraryTitle:'作品集内容库',librarySub:'可拖动排序，也可用移动按钮完成键盘操作。',loadingAssets:'正在读取作品集内容…',editAsset:'编辑作品集图片',saveChanges:'保存修改',replaceImage:'替换图片',cancel:'取消',titleField:'标题',description:'说明',altText:'替代文本',search:'搜索地点或标题',allStatuses:'全部状态',empty:'当前筛选没有内容。',preview:'预览',edit:'编辑',publish:'发布',hide:'隐藏',archive:'归档',moveUp:'上移',moveDown:'下移',draft:'草稿',published:'已发布',hidden:'已隐藏',archived:'已归档',analysing:'正在读取文件信息…',queued:'等待上传',uploading:'正在上传',saving:'正在保存元数据…',complete:'完成',failed:'失败',selectFiles:'请至少选择一张有效图片。',storageMissing:'请先配置三个 Cloudinary 环境变量再上传；现有作品集不受影响。',adminOnly:'此页面仅限管理员账户。',sessionExpired:'登录已过期，请重新登录后继续。',publishNeedsMetadata:'发布前必须填写地点名称、标题和替代文本。',changesSaved:'作品集内容已更新。',orderSaved:'作品集顺序已更新。',replacementSaved:'图片已替换，原元数据已保留。',uploadFinished:'上传队列已处理完成。',formatError:'不支持这种文件格式。',sizeError:'图片超过 25 MB。',networkError:'请求未完成，请重试。',landscapes:'自然风景',culture:'文化',experiences:'体验',supporting:'补充内容',signature:'核心内容',iconic:'标志性内容',pendingReview:'待核验',captionOnly:'仅说明可用',baliNamed:'巴厘岛地点已确认',routeLinked:'已关联路线'
    },
    ja: {
      viewPortfolio:'バリのポートフォリオを見る',eyebrow:'編集ワークスペース',title:'Portfolio コンテンツ管理',subtitle:'画像を追加すると情報が自動提案され、必要な場合だけ修正して公開できます。',checking:'ストレージを確認中…',ready:'オブジェクトストレージ準備完了',blocked:'ストレージ未設定',uploadTitle:'画像をアップロード',uploadSub:'画像はブラウザから直接ストレージへ送られ、Render には保存されません。',dropTitle:'画像をドロップ、またはファイルを選択',dropSub:'JPG、PNG、WebP、AVIF、HEIC · 1枚25MBまで',theme:'主テーマ',subCategory:'サブカテゴリー',region:'地域',area:'エリア',placeName:'場所名',placeType:'場所タイプ',prominence:'重要度',routeIds:'ルートID',extensionIds:'拡張ID',tags:'タグ',mood:'雰囲気',photoStyle:'撮影スタイル',verification:'確認状態',listHelp:'複数の値はカンマで区切ります。',localizedCopy:'多言語のタイトル・説明・代替テキスト',saveDraft:'下書きとしてアップロード',uploadPublish:'アップロードして公開',libraryTitle:'ポートフォリオ一覧',librarySub:'ドラッグ、または移動ボタンで並べ替えできます。',loadingAssets:'アセットを読み込み中…',editAsset:'アセットを編集',saveChanges:'変更を保存',replaceImage:'画像を差し替え',cancel:'キャンセル',titleField:'タイトル',description:'説明',altText:'代替テキスト',search:'場所またはタイトルを検索',allStatuses:'すべての状態',empty:'該当するアセットはありません。',preview:'プレビュー',edit:'編集',publish:'公開',hide:'非表示',archive:'アーカイブ',moveUp:'上へ',moveDown:'下へ',draft:'下書き',published:'公開中',hidden:'非表示',archived:'アーカイブ済み',analysing:'ファイル情報を確認中…',queued:'アップロード待ち',uploading:'アップロード中',saving:'メタデータを保存中…',complete:'完了',failed:'失敗',selectFiles:'有効な画像を1枚以上選択してください。',storageMissing:'アップロード前にCloudinaryの3つの環境変数を設定してください。既存コンテンツには影響しません。',adminOnly:'管理者アカウントが必要です。',sessionExpired:'セッションが切れました。再度ログインしてください。',publishNeedsMetadata:'公開には場所名、タイトル、代替テキストが必要です。',changesSaved:'アセットを更新しました。',orderSaved:'表示順を更新しました。',replacementSaved:'メタデータを保ったまま画像を差し替えました。',uploadFinished:'アップロード処理が完了しました。',formatError:'この形式は対応していません。',sizeError:'画像は25MBを超えています。',networkError:'処理できませんでした。再試行してください。',landscapes:'風景',culture:'文化',experiences:'体験',supporting:'補助',signature:'代表',iconic:'象徴的',pendingReview:'確認待ち',captionOnly:'キャプションのみ',baliNamed:'バリ地点確認済み',routeLinked:'ルート連携済み'
    },
    ko: {
      viewPortfolio:'발리 포트폴리오 보기',eyebrow:'편집 작업 공간',title:'Portfolio 콘텐츠 관리자',subtitle:'이미지를 올리면 정보가 자동 제안되며 필요한 경우에만 수정한 뒤 공개할 수 있습니다.',checking:'저장소 확인 중…',ready:'객체 저장소 준비됨',blocked:'저장소 미설정',uploadTitle:'이미지 업로드',uploadSub:'이미지는 브라우저에서 저장소로 직접 전송되며 Render에 저장되지 않습니다.',dropTitle:'이미지를 끌어놓거나 파일 선택',dropSub:'JPG, PNG, WebP, AVIF, HEIC · 파일당 최대 25MB',theme:'주요 테마',subCategory:'하위 분류',region:'지역',area:'구역',placeName:'장소 이름',placeType:'장소 유형',prominence:'중요도',routeIds:'경로 ID',extensionIds:'확장 ID',tags:'태그',mood:'분위기',photoStyle:'사진 스타일',verification:'검증 상태',listHelp:'여러 값은 쉼표로 구분하세요.',localizedCopy:'다국어 제목, 설명, 대체 텍스트',saveDraft:'초안으로 업로드',uploadPublish:'업로드 후 공개',libraryTitle:'포트폴리오 라이브러리',librarySub:'드래그하거나 이동 버튼으로 순서를 바꿀 수 있습니다.',loadingAssets:'자산 불러오는 중…',editAsset:'자산 편집',saveChanges:'변경 저장',replaceImage:'이미지 교체',cancel:'취소',titleField:'제목',description:'설명',altText:'대체 텍스트',search:'장소 또는 제목 검색',allStatuses:'모든 상태',empty:'조건에 맞는 자산이 없습니다.',preview:'미리보기',edit:'편집',publish:'공개',hide:'숨기기',archive:'보관',moveUp:'위로',moveDown:'아래로',draft:'초안',published:'공개됨',hidden:'숨김',archived:'보관됨',analysing:'파일 정보 확인 중…',queued:'업로드 준비됨',uploading:'업로드 중',saving:'메타데이터 저장 중…',complete:'완료',failed:'실패',selectFiles:'유효한 이미지를 하나 이상 선택하세요.',storageMissing:'업로드 전에 Cloudinary 환경 변수 3개를 설정하세요. 기존 포트폴리오는 영향을 받지 않습니다.',adminOnly:'관리자 계정이 필요합니다.',sessionExpired:'세션이 만료되었습니다. 다시 로그인하세요.',publishNeedsMetadata:'공개하려면 장소 이름, 제목, 대체 텍스트가 필요합니다.',changesSaved:'자산이 업데이트되었습니다.',orderSaved:'표시 순서가 업데이트되었습니다.',replacementSaved:'메타데이터를 유지하며 이미지를 교체했습니다.',uploadFinished:'업로드 대기열 처리가 완료되었습니다.',formatError:'지원하지 않는 형식입니다.',sizeError:'이미지가 25MB를 초과합니다.',networkError:'요청을 완료하지 못했습니다. 다시 시도하세요.',landscapes:'풍경',culture:'문화',experiences:'체험',supporting:'보조',signature:'대표',iconic:'상징적',pendingReview:'검토 대기',captionOnly:'캡션 전용',baliNamed:'발리 장소 확인',routeLinked:'경로 연결됨'
    },
    id: {
      viewPortfolio:'Lihat Portfolio Bali',eyebrow:'Ruang kerja editorial',title:'Pengelola Konten Portfolio',subtitle:'Unggah gambar untuk menerima saran otomatis, ubah bila perlu, lalu terbitkan tanpa deploy ulang.',checking:'Memeriksa penyimpanan…',ready:'Penyimpanan objek siap',blocked:'Penyimpanan belum diatur',uploadTitle:'Unggah gambar',uploadSub:'Gambar dikirim langsung dari browser ke penyimpanan. Render tidak menyimpan file.',dropTitle:'Tarik gambar ke sini atau pilih file',dropSub:'JPG, PNG, WebP, AVIF, atau HEIC · maks. 25 MB per file',theme:'Tema utama',subCategory:'Subkategori',region:'Wilayah',area:'Area',placeName:'Nama tempat',placeType:'Jenis tempat',prominence:'Tingkat kepentingan',routeIds:'ID rute',extensionIds:'ID ekstensi',tags:'Tag',mood:'Suasana',photoStyle:'Gaya fotografi',verification:'Status verifikasi',listHelp:'Pisahkan beberapa nilai dengan koma.',localizedCopy:'Judul, deskripsi, dan teks alternatif multibahasa',saveDraft:'Unggah sebagai draf',uploadPublish:'Unggah dan terbitkan',libraryTitle:'Pustaka Portfolio',librarySub:'Seret untuk mengurutkan, atau gunakan tombol pindah untuk keyboard.',loadingAssets:'Memuat aset…',editAsset:'Edit aset Portfolio',saveChanges:'Simpan perubahan',replaceImage:'Ganti gambar',cancel:'Batal',titleField:'Judul',description:'Deskripsi',altText:'Teks alternatif',search:'Cari tempat atau judul',allStatuses:'Semua status',empty:'Tidak ada aset yang cocok.',preview:'Pratinjau',edit:'Edit',publish:'Terbitkan',hide:'Sembunyikan',archive:'Arsipkan',moveUp:'Naik',moveDown:'Turun',draft:'Draf',published:'Terbit',hidden:'Tersembunyi',archived:'Diarsipkan',analysing:'Membaca informasi file…',queued:'Siap diunggah',uploading:'Mengunggah',saving:'Menyimpan metadata…',complete:'Selesai',failed:'Gagal',selectFiles:'Pilih setidaknya satu gambar yang valid.',storageMissing:'Atur tiga variabel Cloudinary sebelum mengunggah. Portfolio yang ada tidak terpengaruh.',adminOnly:'Halaman ini memerlukan akun administrator.',sessionExpired:'Sesi berakhir. Masuk lagi untuk melanjutkan.',publishNeedsMetadata:'Publikasi memerlukan nama tempat, judul, dan teks alternatif.',changesSaved:'Aset Portfolio diperbarui.',orderSaved:'Urutan Portfolio diperbarui.',replacementSaved:'Gambar diganti dan metadata dipertahankan.',uploadFinished:'Antrean unggahan selesai.',formatError:'Format file tidak didukung.',sizeError:'Gambar lebih besar dari 25 MB.',networkError:'Permintaan tidak dapat diselesaikan. Coba lagi.',landscapes:'Lanskap',culture:'Budaya',experiences:'Pengalaman',supporting:'Pendukung',signature:'Unggulan',iconic:'Ikonik',pendingReview:'Menunggu tinjauan',captionOnly:'Hanya keterangan',baliNamed:'Lokasi Bali terverifikasi',routeLinked:'Terhubung ke rute'
    }
  };

  var QUEUE_COPY = {
    en:{manifestChecking:'Loading the existing content library…',manifestReady:'Existing content library ready. Known images get their curated metadata; new images get automatic suggestions.',manifestLoadFailed:'The existing content library could not be loaded. New images still receive automatic suggestions.',manifestMatched:'Existing image matched',manifestUnmatched:'New image · auto-filled',metadataConfirmed:'Metadata updated',editMetadata:'Review suggestions',queueReviewTitle:'Review image details',queueReviewHelp:'Automatic suggestions are optional. Correct anything that needs more context before publishing.',saveQueueMetadata:'Save details',duplicateFile:'This image is already in the upload queue.',duplicateAsset:'This image already exists in the Portfolio library.',uploadFinishedWithErrors:'The upload queue finished with errors. Review the failed images and retry.',archiveConfirm:'Archive this Portfolio image? You can keep its metadata and restore its status later.',skipContent:'Skip to content'},
    zh:{manifestChecking:'正在读取现有内容库…',manifestReady:'现有内容库已就绪：旧图片沿用已整理资料，新图片自动生成建议。',manifestLoadFailed:'现有内容库暂时无法读取；新图片仍会自动生成建议。',manifestMatched:'已匹配现有图片',manifestUnmatched:'新图片 · 已自动填写',metadataConfirmed:'资料已修改',editMetadata:'核对自动建议',queueReviewTitle:'核对图片资料',queueReviewHelp:'自动建议不是发布门禁；只有需要补充语境时才修改。',saveQueueMetadata:'保存资料',duplicateFile:'该图片已在上传队列中。',duplicateAsset:'该图片已存在于 Portfolio 内容库中。',uploadFinishedWithErrors:'上传队列已处理，但存在失败项；请查看失败图片并重试。',archiveConfirm:'确认归档这张 Portfolio 图片吗？元数据会保留，之后仍可恢复状态。',skipContent:'跳到主要内容'},
    ja:{manifestChecking:'既存コンテンツライブラリを読み込み中…',manifestReady:'既存ライブラリの準備完了。既知の画像は編集済み情報、新規画像は自動提案を使います。',manifestLoadFailed:'既存ライブラリを読み込めませんが、新規画像には自動提案が生成されます。',manifestMatched:'既存画像に一致',manifestUnmatched:'新規画像・自動入力済み',metadataConfirmed:'情報を更新済み',editMetadata:'自動提案を確認',queueReviewTitle:'画像情報を確認',queueReviewHelp:'自動提案は任意です。必要な場合だけ公開前に修正してください。',saveQueueMetadata:'情報を保存',duplicateFile:'この画像はすでにアップロード待ちです。',duplicateAsset:'この画像はすでに Portfolio に登録されています。',uploadFinishedWithErrors:'アップロード処理は完了しましたが、失敗した画像があります。確認して再試行してください。',archiveConfirm:'この Portfolio 画像をアーカイブしますか？メタデータは保持され、後で状態を戻せます。',skipContent:'メインコンテンツへ移動'},
    ko:{manifestChecking:'기존 콘텐츠 라이브러리 불러오는 중…',manifestReady:'기존 라이브러리가 준비되었습니다. 기존 이미지는 편집된 정보, 새 이미지는 자동 제안을 사용합니다.',manifestLoadFailed:'기존 라이브러리를 불러오지 못했지만 새 이미지에는 자동 제안이 생성됩니다.',manifestMatched:'기존 이미지 일치',manifestUnmatched:'새 이미지 · 자동 입력됨',metadataConfirmed:'정보 수정됨',editMetadata:'자동 제안 검토',queueReviewTitle:'이미지 정보 검토',queueReviewHelp:'자동 제안은 선택 사항입니다. 필요한 내용만 게시 전에 수정하세요.',saveQueueMetadata:'정보 저장',duplicateFile:'이 이미지는 이미 업로드 대기열에 있습니다.',duplicateAsset:'이 이미지는 이미 Portfolio 라이브러리에 있습니다.',uploadFinishedWithErrors:'업로드 처리가 끝났지만 실패한 이미지가 있습니다. 확인 후 다시 시도하세요.',archiveConfirm:'이 Portfolio 이미지를 보관하시겠습니까? 메타데이터는 유지되며 나중에 상태를 복원할 수 있습니다.',skipContent:'본문으로 건너뛰기'},
    id:{manifestChecking:'Memuat pustaka konten yang ada…',manifestReady:'Pustaka siap. Gambar lama memakai metadata kurasi; gambar baru mendapat saran otomatis.',manifestLoadFailed:'Pustaka lama tidak dapat dimuat, tetapi gambar baru tetap mendapat saran otomatis.',manifestMatched:'Cocok dengan gambar lama',manifestUnmatched:'Gambar baru · terisi otomatis',metadataConfirmed:'Data diperbarui',editMetadata:'Tinjau saran otomatis',queueReviewTitle:'Tinjau detail gambar',queueReviewHelp:'Saran otomatis bersifat opsional. Ubah hanya jika konteksnya perlu diperbaiki sebelum terbit.',saveQueueMetadata:'Simpan detail',duplicateFile:'Gambar ini sudah ada dalam antrean unggahan.',duplicateAsset:'Gambar ini sudah ada di pustaka Portfolio.',uploadFinishedWithErrors:'Antrean selesai, tetapi beberapa gambar gagal. Tinjau gambar yang gagal lalu coba lagi.',archiveConfirm:'Arsipkan gambar Portfolio ini? Metadata tetap tersimpan dan status dapat dipulihkan nanti.',skipContent:'Lewati ke konten utama'}
  };
  var SIMPLE_UPLOAD_COPY = {
    en:{autoFillTitle:'Image details are filled automatically',autoFillHelp:'The filename and Bali place library suggest the theme, place, routes and five-language copy. Publish immediately or review one image from its queue card.',autoMetadata:'Curated details',manualMetadataNeeded:'Automatic suggestions',reviewAutoMetadata:'View or edit details',draftUploadFinished:'Draft saved. The image, database record and preview are ready in the library.',publishedUploadFinished:'Upload published. The image and metadata are now available in the Portfolio.',uploadRolledBack:'Metadata was rejected, so the unlinked cloud file was removed. This image is ready to retry.',uploadRecovered:'The server had already saved this image. Its completed state has been restored.',uploadRecoveryPending:'The save result is not confirmed. The cloud file was kept; retry safe recovery before uploading again.',retryRecovery:'Retry safe recovery',uploadCleanupFailed:'The save was rejected, but cloud cleanup could not be confirmed. Retry cleanup before uploading again.',retryCleanup:'Retry cloud cleanup'},
    zh:{autoFillTitle:'图片资料会自动填写',autoFillHelp:'系统根据文件名和 Bali 地点库建议主题、地点、路线及五语言文案；可以直接发布，也可在单张卡片里修改。',autoMetadata:'已整理资料',manualMetadataNeeded:'自动建议资料',reviewAutoMetadata:'查看或修改资料',draftUploadFinished:'草稿已保存：图片、数据库记录和预览均已就绪。',publishedUploadFinished:'图片已发布，图片和资料已进入 Portfolio。',uploadRolledBack:'资料被明确拒绝保存，未关联的云端文件已清理；这张图片可以重新上传。',uploadRecovered:'服务器其实已经保存了这张图片，现已恢复为完成状态。',uploadRecoveryPending:'保存结果尚未确认，系统已保留云端文件；重新上传前请先安全重试保存。',retryRecovery:'安全重试保存',uploadCleanupFailed:'资料被明确拒绝保存，但云端清理未能确认；重新上传前请先重试清理。',retryCleanup:'重试云端清理'},
    ja:{autoFillTitle:'画像情報は自動入力されます',autoFillHelp:'ファイル名とバリの場所ライブラリからテーマ、場所、ルート、5言語文を提案します。そのまま公開するか、画像カードから修正できます。',autoMetadata:'編集済み情報',manualMetadataNeeded:'自動提案',reviewAutoMetadata:'情報を確認・編集',draftUploadFinished:'下書きを保存しました。画像、データベース記録、プレビューの準備が完了しました。',publishedUploadFinished:'画像を公開しました。画像と情報が Portfolio に反映されました。',uploadRolledBack:'保存が拒否されたため、未登録のクラウド画像を削除しました。再アップロードできます。',uploadRecovered:'サーバーには画像が保存済みでした。完了状態を復元しました。',uploadRecoveryPending:'保存結果を確認できないため、クラウド画像を保持しました。再アップロード前に安全な保存再試行を行ってください。',retryRecovery:'安全に保存を再試行',uploadCleanupFailed:'保存は拒否されましたが、クラウド削除を確認できませんでした。再アップロード前に削除を再試行してください。',retryCleanup:'クラウド削除を再試行'},
    ko:{autoFillTitle:'이미지 정보가 자동 입력됩니다',autoFillHelp:'파일명과 발리 장소 라이브러리로 테마·장소·경로·5개 언어 문구를 제안합니다. 바로 공개하거나 이미지 카드에서 수정하세요.',autoMetadata:'편집된 정보',manualMetadataNeeded:'자동 제안',reviewAutoMetadata:'정보 보기 또는 수정',draftUploadFinished:'초안이 저장되었습니다. 이미지, 데이터베이스 기록, 미리보기가 준비되었습니다.',publishedUploadFinished:'이미지가 공개되어 Portfolio에 이미지와 정보가 반영되었습니다.',uploadRolledBack:'저장이 명확히 거부되어 연결되지 않은 클라우드 파일을 삭제했습니다. 다시 업로드할 수 있습니다.',uploadRecovered:'서버에 이미지가 이미 저장되어 있어 완료 상태를 복원했습니다.',uploadRecoveryPending:'저장 결과를 확인할 수 없어 클라우드 파일을 유지했습니다. 다시 업로드하기 전에 안전한 저장 재시도를 실행하세요.',retryRecovery:'안전한 저장 재시도',uploadCleanupFailed:'저장은 거부되었지만 클라우드 정리를 확인하지 못했습니다. 다시 업로드하기 전에 정리를 재시도하세요.',retryCleanup:'클라우드 정리 재시도'},
    id:{autoFillTitle:'Detail gambar terisi otomatis',autoFillHelp:'Nama file dan pustaka tempat Bali menyarankan tema, lokasi, rute, dan teks lima bahasa. Terbitkan langsung atau ubah dari kartu gambar.',autoMetadata:'Data terkurasi',manualMetadataNeeded:'Saran otomatis',reviewAutoMetadata:'Lihat atau ubah detail',draftUploadFinished:'Draf tersimpan. Gambar, catatan database, dan pratinjau sudah siap.',publishedUploadFinished:'Gambar telah diterbitkan dan data sudah tersedia di Portfolio.',uploadRolledBack:'Penyimpanan ditolak, jadi file cloud yang belum terhubung sudah dihapus. Gambar siap diunggah ulang.',uploadRecovered:'Server ternyata sudah menyimpan gambar ini. Status selesai telah dipulihkan.',uploadRecoveryPending:'Hasil penyimpanan belum terkonfirmasi. File cloud dipertahankan; coba pemulihan aman sebelum mengunggah ulang.',retryRecovery:'Coba pemulihan aman',uploadCleanupFailed:'Penyimpanan ditolak, tetapi pembersihan cloud belum terkonfirmasi. Coba pembersihan lagi sebelum mengunggah ulang.',retryCleanup:'Coba lagi pembersihan cloud'}
  };
  var PUBLISH_GATE_COPY = {
    en:{publishNeedsMetadata:'Publishing requires a place name plus title, description and alt text in all five languages.',rightsNotice:'Publishing records that this administrator confirms WanderMind has image usage rights and any required portrait consent.',adminApproved:'Approved by an administrator'},
    zh:{publishNeedsMetadata:'发布前必须填写地点名称，并补齐五语言标题、说明和替代文本。',rightsNotice:'点击发布即记录：当前管理员确认 WanderMind 已取得图片使用许可及适用的肖像授权。',adminApproved:'管理员已批准'},
    ja:{publishNeedsMetadata:'公開には場所名と、5言語すべてのタイトル・説明・代替テキストが必要です。',rightsNotice:'公開すると、管理者が画像利用許可と必要な肖像同意を確認した記録が残ります。',adminApproved:'管理者承認済み'},
    ko:{publishNeedsMetadata:'공개하려면 장소 이름과 5개 언어의 제목, 설명, 대체 텍스트가 모두 필요합니다.',rightsNotice:'공개하면 관리자가 이미지 사용 권한과 필요한 초상 동의를 확인한 기록이 저장됩니다.',adminApproved:'관리자 승인됨'},
    id:{publishNeedsMetadata:'Publikasi memerlukan nama tempat serta judul, deskripsi, dan teks alternatif lengkap dalam lima bahasa.',rightsNotice:'Saat diterbitkan, sistem mencatat bahwa administrator mengonfirmasi hak penggunaan gambar dan persetujuan potret yang diperlukan.',adminApproved:'Disetujui administrator'}
  };
  LANGS.forEach(function (lang) { Object.assign(COPY[lang], QUEUE_COPY[lang], SIMPLE_UPLOAD_COPY[lang], PUBLISH_GATE_COPY[lang]); });

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

  async function loadSuggestionCatalog() {
    if (state.catalogLoaded) return;
    try {
      var response = await fetch('../assets/data/bali-travel-data.json?v=20260831p6', { cache:'no-store' });
      if (!response.ok) throw new Error('catalog');
      var payload = await response.json();
      state.poiCatalog = Array.isArray(payload.pois) ? payload.pois : [];
    } catch (_) { state.poiCatalog = []; }
    state.catalogLoaded = true;
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

  function normalizedWords(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(function (word) { return word.length > 1; });
  }

  function catalogMatch(file) {
    var words = normalizedWords(fileStem(file.name));
    if (!words.length) return null;
    var best = null;
    var bestScore = 0;
    state.poiCatalog.forEach(function (poi) {
      var nameWords = normalizedWords([poi.id, poi.name, poi.node_id, (poi.tags || []).join(' ')].join(' '));
      var score = words.reduce(function (total, word) { return total + (nameWords.indexOf(word) >= 0 ? 1 : 0); }, 0);
      var normalizedName = normalizedWords(poi.name).join(' ');
      if (normalizedName && words.join(' ').indexOf(normalizedName) >= 0) score += 5;
      if (score > bestScore) { best = poi; bestScore = score; }
    });
    return bestScore >= Math.min(2, words.length) ? best : null;
  }

  function inferTheme(value) {
    value = String(value || '').toLowerCase();
    if (/temple|palace|museum|market|craft|silver|culture|village/.test(value)) return 'culture';
    if (/experience|dolphin|wildlife|boat|class|yoga|spa|atv|hike|trek|diving|snorkel/.test(value)) return 'experiences';
    return 'landscapes';
  }

  function automaticCopy(place) {
    return {
      title:{zh:place,en:place,ja:place,ko:place,id:place},
      description:{
        zh:place + '，巴厘岛旅程中的一个现场瞬间。',
        en:'A WanderMind travel moment at ' + place + ', Bali.',
        ja:place + 'で過ごす、バリ旅のひととき。',
        ko:place + '에서 만난 발리 여행의 한순간.',
        id:'Momen perjalanan WanderMind di ' + place + ', Bali.'
      },
      alt_text:{
        zh:place + '的巴厘岛旅行照片',
        en:'Travel photo at ' + place + ' in Bali',
        ja:place + 'で撮影したバリ旅行の写真',
        ko:place + '에서 촬영한 발리 여행 사진',
        id:'Foto perjalanan Bali di ' + place
      }
    };
  }

  function automaticSuggestion(file) {
    var poi = catalogMatch(file);
    var place = poi && poi.name || fileStem(file.name) || 'Bali moment';
    var copy = automaticCopy(place);
    var routes = poi && Array.isArray(poi.route_ids) ? poi.route_ids.slice() : [];
    var tags = poi && Array.isArray(poi.tags) ? poi.tags.slice() : normalizedWords(place);
    var type = poi && poi.type || tags.join(' ');
    return {
      destination:'bali', primary_theme:inferTheme(type), sub_category:String(type || '').replace(/_/g, '-'),
      region:poi && poi.region_id || '', area:poi && String(poi.node_id || '').replace(/_/g, ' ') || '',
      place_name:place, place_type:String(type || '').replace(/_/g, ' '), prominence:routes.length ? 'signature' : 'supporting',
      route_ids:routes, extension_ids:[], tags:tags, mood:'', photography_style:'',
      title:copy.title, description:copy.description, alt_text:copy.alt_text,
      verification_status:routes.length ? 'route-linked' : poi ? 'bali-named' : 'pending-review', status:'draft'
    };
  }

  function recordMetadata(record, status) {
    var metadata = JSON.parse(JSON.stringify(record.metadata || automaticSuggestion(record.file)));
    metadata.status = status || 'draft';
    var stem = fileStem(record.file.name);
    metadata.title = metadata.title || {};
    metadata.alt_text = metadata.alt_text || {};
    metadata.description = metadata.description || {};
    if (!Object.keys(metadata.title).length) metadata.title = automaticCopy(stem).title;
    if (!Object.keys(metadata.description).length) metadata.description = automaticCopy(stem).description;
    if (!Object.keys(metadata.alt_text).length) metadata.alt_text = automaticCopy(stem).alt_text;
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
    if (response.status === 401) {
      showAlert(t('sessionExpired')); window.setTimeout(redirectToLogin, 700);
      var authError = new Error('AUTH'); authError.status = 401; throw authError;
    }
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var responseError = new Error(payload.detail || t('networkError'));
      responseError.status = response.status;
      throw responseError;
    }
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
    var filterOptions = document.getElementById('statusFilter').options;
    filterOptions[0].textContent = t('allStatuses'); filterOptions[1].textContent = t('draft'); filterOptions[2].textContent = t('published'); filterOptions[3].textContent = t('hidden'); filterOptions[4].textContent = t('archived');
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
      verification_status:String(data.get('verification_status') || 'caption-only'), status:status || 'draft',
      admin_approval:Boolean(data.get('admin_approval'))
    };
  }

  function hasCompletePublishedMetadata(metadata) {
    return Boolean(metadata.place_name) && ['title','description','alt_text'].every(function (field) {
      return LANGS.every(function (lang) { return Boolean((metadata[field] || {})[lang]); });
    });
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
    await Promise.all([loadApprovalManifest(), loadSuggestionCatalog()]);
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
        record.metadata = record.manifestMatch ? approvedSuggestion(record.manifestItem, file) : automaticSuggestion(file);
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
      var metadata = item.metadata || {};
      var summaryParts = [localeValue(metadata.title) || metadata.place_name, metadata.region, (metadata.route_ids || []).join(' / ')].filter(Boolean);
      var metadataSummary = item.sha256 && summaryParts.length ? '<div class="wm-queue-meta"><strong>' + escapeHtml(t(item.manifestMatch ? 'autoMetadata' : 'manualMetadataNeeded')) + '：</strong> ' + escapeHtml(summaryParts.join(' · ')) + '</div>' : '';
      var actions = item.state === 'queued' ? '<div class="wm-queue-actions"><button class="wm-btn wm-btn-secondary" type="button" data-queue-edit="' + escapeHtml(item.id) + '">' + escapeHtml(t(item.manifestMatch ? 'reviewAutoMetadata' : 'editMetadata')) + '</button></div>' :
        item.state === 'recoveryPending' ? '<div class="wm-queue-actions"><button class="wm-btn wm-btn-danger" type="button" data-queue-recovery="' + escapeHtml(item.id) + '">' + escapeHtml(t('retryRecovery')) + '</button></div>' :
        item.state === 'cleanupFailed' ? '<div class="wm-queue-actions"><button class="wm-btn wm-btn-danger" type="button" data-queue-cleanup="' + escapeHtml(item.id) + '">' + escapeHtml(t('retryCleanup')) + '</button></div>' : '';
      return '<div class="wm-queue-item"><img src="' + escapeHtml(item.preview) + '" width="58" height="58" alt=""><div class="wm-queue-main"><div class="wm-queue-head"><div><span class="wm-queue-name">' + escapeHtml(item.file.name) + '</span><span class="wm-queue-meta">' + escapeHtml(meta) + '</span></div></div>' + badges + metadataSummary + '<div class="wm-progress" role="progressbar" aria-label="' + escapeHtml(item.file.name) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Number(item.progress || 0) + '"><span style="width:' + Number(item.progress || 0) + '%"></span></div><div class="wm-queue-state">' + escapeHtml(stateText) + '</div>' + actions + '</div></div>';
    }).join('');
    bindQueueEvents();
  }

  function bindQueueEvents() {
    queue.querySelectorAll('[data-queue-edit]').forEach(function (button) {
      button.addEventListener('click', function () { openQueueEditor(button.dataset.queueEdit); });
    });
    queue.querySelectorAll('[data-queue-cleanup]').forEach(function (button) {
      button.addEventListener('click', function () { retryUploadCleanup(button.dataset.queueCleanup); });
    });
    queue.querySelectorAll('[data-queue-recovery]').forEach(function (button) {
      button.addEventListener('click', function () { retryUploadRecovery(button.dataset.queueRecovery); });
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

  function uploadCleanupPayload(signature, uploaded) {
    if (!signature.cleanup) return null;
    return {
      destination:'bali', cloudinary_public_id:uploaded.public_id,
      cloudinary_version:uploaded.version, response_signature:uploaded.signature,
      cleanup_timestamp:signature.cleanup.timestamp, cleanup_token:signature.cleanup.token
    };
  }

  async function runUploadCleanup(record) {
    if (!record.cleanup) throw new Error(t('uploadCleanupFailed'));
    var result = await api('/api/admin/portfolio/upload-cleanup', { method:'POST', body:record.cleanup });
    if (result.result === 'registered') {
      record.state = 'complete'; record.error = t('uploadRecovered'); record.cleanup = null; record.pendingMetadata = null;
      renderQueue(); return 'registered';
    }
    record.state = 'queued'; record.progress = 0; record.error = t('uploadRolledBack'); record.cleanup = null; record.pendingMetadata = null;
    renderQueue(); return result.result;
  }

  function isDeterministicSaveRejection(error) {
    var status = Number(error && error.status || 0);
    return status >= 400 && status < 500 && [401, 403, 408, 425, 429].indexOf(status) < 0;
  }

  async function recoverSavedUpload(record) {
    try {
      await api('/api/admin/portfolio/assets', { method:'POST', body:record.pendingMetadata });
      record.state = 'complete'; record.error = t('uploadRecovered'); record.cleanup = null; record.pendingMetadata = null;
      renderQueue(); return;
    } catch (saveError) {
      if (!isDeterministicSaveRejection(saveError)) throw saveError;
    }
    try { await runUploadCleanup(record); }
    catch (cleanupFailure) {
      cleanupFailure.cleanupFailed = true;
      throw cleanupFailure;
    }
  }

  async function retryUploadRecovery(id) {
    var record = state.files.find(function (item) { return item.id === id; });
    if (!record || !record.cleanup || !record.pendingMetadata) return;
    clearAlert(); record.state = 'saving'; record.error = ''; renderQueue();
    try { await recoverSavedUpload(record); }
    catch (error) {
      record.state = error.cleanupFailed ? 'cleanupFailed' : 'recoveryPending';
      record.error = t(error.cleanupFailed ? 'uploadCleanupFailed' : 'uploadRecoveryPending');
      renderQueue();
    }
  }

  async function retryUploadCleanup(id) {
    var record = state.files.find(function (item) { return item.id === id; });
    if (!record || !record.cleanup) return;
    clearAlert(); record.state = 'saving'; record.error = ''; renderQueue();
    try { await runUploadCleanup(record); }
    catch (_) { record.state = 'cleanupFailed'; record.error = t('uploadCleanupFailed'); renderQueue(); }
  }

  async function uploadRecord(record, status) {
    record.state = 'uploading'; record.error = ''; renderQueue();
    var signature = await api('/api/admin/portfolio/upload-signature', { method:'POST', body:{ destination:'bali', filename:record.file.name } });
    var uploaded = await uploadToCloudinary(record.file, signature, function (progress) { record.progress = progress; renderQueue(); });
    record.state = 'saving'; record.progress = 100; renderQueue();
    var metadata = recordMetadata(record, status);
    metadata.admin_approval = status === 'published';
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
    record.cleanup = uploadCleanupPayload(signature, uploaded);
    record.pendingMetadata = metadata;
    try {
      await api('/api/admin/portfolio/assets', { method:'POST', body:metadata });
    } catch (saveError) {
      if (!isDeterministicSaveRejection(saveError)) {
        var recoveryError = new Error(t('uploadRecoveryPending'));
        recoveryError.recoveryPending = true;
        throw recoveryError;
      }
      try {
        var cleanupResult = await runUploadCleanup(record);
        if (cleanupResult === 'registered') return;
      } catch (_) {
        var cleanupError = new Error(t('uploadCleanupFailed'));
        cleanupError.cleanupFailed = true;
        throw cleanupError;
      }
      var rolledBackError = new Error(t('uploadRolledBack'));
      rolledBackError.rolledBack = true;
      throw rolledBackError;
    }
    record.state = 'complete'; record.error = ''; record.cleanup = null; record.pendingMetadata = null; renderQueue();
  }

  async function submitUploads(event) {
    event.preventDefault(); clearAlert();
    var selected = state.files.filter(function (item) { return item.state === 'queued'; });
    if (!selected.length) return showAlert(t('selectFiles'));
    if (!state.storageReady) return showAlert(t('storageMissing'));
    var status = event.submitter && event.submitter.dataset.status || 'draft';
    if (status === 'published' && selected.some(function (record) {
      var itemMetadata = recordMetadata(record, status);
      return !hasCompletePublishedMetadata(itemMetadata);
    })) return showAlert(t('publishNeedsMetadata'));
    var buttons = uploadForm.querySelectorAll('button[type="submit"]');
    buttons.forEach(function (button) { button.disabled = true; });
    var failedCount = 0;
    for (var record of selected) {
      try { await uploadRecord(record, status); }
      catch (error) {
        failedCount += 1;
        record.state = error.rolledBack ? 'queued' : error.recoveryPending ? 'recoveryPending' : error.cleanupFailed ? 'cleanupFailed' : 'failed';
        record.error = error.message || t('networkError'); renderQueue();
      }
    }
    buttons.forEach(function (button) { button.disabled = !state.storageReady; });
    showAlert(t(failedCount ? 'uploadFinishedWithErrors' : status === 'published' ? 'publishedUploadFinished' : 'draftUploadFinished'));
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
      var approvalNote = asset.admin_approved ? '<p class="wm-help">' + escapeHtml(t('adminApproved')) + '</p>' : '';
      return '<article class="wm-asset" data-asset-id="' + escapeHtml(asset.id) + '" draggable="' + (allowDrag ? 'true' : 'false') + '">' +
        '<img src="' + escapeHtml(asset.thumbnail_url) + '" width="112" height="94" alt="' + escapeHtml(localeValue(asset.alt_text)) + '" loading="lazy"><div><div class="wm-asset-top"><div><h3>' + escapeHtml(localeValue(asset.title) || asset.place_name || asset.original_filename) + '</h3><p>' + escapeHtml([asset.area,asset.region,asset.primary_theme].filter(Boolean).join(' · ')) + '</p></div><span class="wm-chip" data-status="' + escapeHtml(asset.status) + '">' + escapeHtml(statusLabel(asset.status)) + '</span></div>' +
        '<p>' + escapeHtml(asset.width + ' × ' + asset.height + ' · ' + String(asset.format || '').toUpperCase() + ' · ' + (asset.verification_status || '')) + '</p>' + approvalNote +
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
      '<details class="wm-locales"><summary>' + escapeHtml(t('localizedCopy')) + '</summary><div class="wm-locales-grid">' + localizedFields('editor', asset) + '</div></details>';
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
    if (asset.status === 'published' && !hasCompletePublishedMetadata(metadata)) return showAlert(t('publishNeedsMetadata'));
    try { await api('/api/admin/portfolio/assets/' + encodeURIComponent(asset.id), { method:'PATCH', body:metadata }); closeEditor(); showAlert(t('changesSaved')); await loadAssets(); }
    catch (error) { showAlert(error.message || t('networkError')); }
  }

  async function changeStatus(id, status) {
    clearAlert();
    var asset = state.assets.find(function (item) { return item.id === id; });
    var adminApproval = status === 'published';
    if (status === 'published' && !hasCompletePublishedMetadata(asset)) return showAlert(t('publishNeedsMetadata'));
    if (status === 'archived' && !window.confirm(t('archiveConfirm'))) return;
    try { await api('/api/admin/portfolio/assets/' + encodeURIComponent(id), { method:'PATCH', body:{ status:status, admin_approval:adminApproval } }); await loadAssets(); }
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
      var adminApproval = asset.status === 'published';
      await api('/api/admin/portfolio/assets/' + encodeURIComponent(asset.id) + '/replace', { method:'POST', body:{
        original_filename:file.name, sha256:details[0], file_bytes:uploaded.bytes, width:uploaded.width || details[1].width, height:uploaded.height || details[1].height,
        format:uploaded.format || fileFormat(file), image_metadata:uploaded.image_metadata || {}, cloudinary_asset_id:uploaded.asset_id,
        cloudinary_public_id:uploaded.public_id, cloudinary_version:uploaded.version, secure_url:uploaded.secure_url, response_signature:uploaded.signature,
        admin_approval:adminApproval
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
    if (!token) return redirectToLogin();
    try {
      await Promise.all([loadApprovalManifest(), loadSuggestionCatalog()]);
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
