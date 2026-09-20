// Explicit, read-only phone diagnostics. Never read auth, account or trip data.
const COPY = {
  zh: {check:'检查连接', title:'连接检查', api:'路线服务', image:'图片下载', ok:'可连接', domain:'域名未获微信允许，请联系站主配置', timeout:'连接超时，请切换 Wi-Fi/移动流量再试', tls:'安全连接失败', network:'连接失败', copy:'复制结果', close:'关闭', help:'不会重新提交行程。图片需配置 downloadFile 合法域名；接口需配置 request 合法域名。'},
  en: {check:'Check connection',title:'Connection check',api:'Route service',image:'Image download',ok:'Reachable',domain:'Domain not allowed by WeChat; contact the site owner',timeout:'Timed out; try Wi-Fi or mobile data',tls:'Secure connection failed',network:'Connection failed',copy:'Copy results',close:'Close',help:'This does not resubmit your trip. Images need a downloadFile domain; APIs need a request domain.'},
  ja: {check:'接続を確認',title:'接続確認',api:'ルートサービス',image:'画像の取得',ok:'接続可能',domain:'WeChatで許可されていないドメインです。管理者に連絡してください',timeout:'時間切れです。Wi-Fiまたはモバイル通信をお試しください',tls:'安全な接続に失敗',network:'接続失敗',copy:'結果をコピー',close:'閉じる',help:'行程は再送信しません。画像にはdownloadFile、APIにはrequestドメイン設定が必要です。'},
  ko: {check:'연결 확인',title:'연결 확인',api:'일정 서비스',image:'사진 다운로드',ok:'연결 가능',domain:'WeChat에서 허용되지 않은 도메인입니다. 관리자에게 문의하세요',timeout:'시간 초과. Wi-Fi 또는 모바일 데이터로 다시 시도하세요',tls:'보안 연결 실패',network:'연결 실패',copy:'결과 복사',close:'닫기',help:'일정을 다시 제출하지 않습니다. 사진은 downloadFile, API는 request 도메인 설정이 필요합니다.'},
  id: {check:'Periksa koneksi',title:'Pemeriksaan koneksi',api:'Layanan rute',image:'Unduh foto',ok:'Terhubung',domain:'Domain belum diizinkan WeChat; hubungi pengelola',timeout:'Waktu habis; coba Wi-Fi atau data seluler',tls:'Koneksi aman gagal',network:'Koneksi gagal',copy:'Salin hasil',close:'Tutup',help:'Tidak mengirim ulang perjalanan. Foto perlu domain downloadFile; API perlu domain request.'},
};
function classify(error) {
  const message=String(error && (error.errMsg || error.message) || '');
  return /domain|合法域名/i.test(message)?'DOMAIN':/timeout|timed out/i.test(message)?'TIMEOUT':/ssl|tls|certificate/i.test(message)?'TLS':'NETWORK';
}
function probe(kind,url) {
  return new Promise(resolve=>{
    let done=false,task;
    const finish=result=>{if(done)return;done=true;clearTimeout(timer);resolve(result);};
    const timer=setTimeout(()=>{finish('TIMEOUT');if(task&&task.abort)task.abort();},10000);
    try {
      const options={url,timeout:10000,
        success:res=>{
          finish(res.statusCode>=200&&res.statusCode<300?'OK':'HTTP_'+res.statusCode);
          if(kind==='downloadFile'&&res.tempFilePath) {
            try {wx.getFileSystemManager().unlink({filePath:res.tempFilePath,fail(){}});} catch (_) {}
          }
        },fail:error=>finish(classify(error))};
      task=kind==='downloadFile'?wx.downloadFile(options):wx.request({...options,method:'GET'});
    } catch(error){finish(classify(error));}
  });
}
function host(url){return (String(url||'').match(/^https:\/\/([^/]+)/)||[])[1]||'—';}
function retryUrl(url,count){
  const [base,query='']=String(url).split('?');
  const parts=query.split('&').filter(x=>x&&!/^wm_retry=/.test(x));
  parts.push('wm_retry='+count);
  return base+'?'+parts.join('&');
}
async function checkConnection(imageUrl='') {
  const app=getApp(),c=COPY[app.globalData.currentLang]||COPY.zh;
  const origin=app.globalData.apiBase;
  const targets=[{label:c.api,kind:'request',url:origin+'/healthz'}];
  if(/^https:\/\//.test(imageUrl)) targets.push({label:c.image,kind:'downloadFile',url:imageUrl});
  const results=await Promise.all(targets.map(async t=>({...t,result:await probe(t.kind,t.url)})));
  const text='WanderMind 20260920n1\n'+results.map(t=>t.label+' · '+t.kind+' · '+host(t.url)+'\n'+(c[t.result.toLowerCase()]||t.result)+' ['+t.result+']').join('\n\n')+'\n\n'+c.help;
  wx.showModal({title:c.title,content:text,confirmText:c.copy,cancelText:c.close,success:r=>{if(r.confirm)wx.setClipboardData({data:text});}});
  return results;
}
module.exports={COPY,checkConnection,classify,retryUrl};
