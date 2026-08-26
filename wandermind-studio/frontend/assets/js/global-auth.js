(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var referralCode = (params.get('ref') || '').trim().toUpperCase();
  if (/^[A-Z0-9]{6,16}$/.test(referralCode)) {
    localStorage.setItem('wm_studio_referral_code', referralCode);
  }

  if (/\/ai-tool(?:\.html)?$/.test(window.location.pathname)) return;

  var langPicker = document.getElementById('langPicker');
  if (!langPicker) return;
  var hostList = langPicker.closest('ul');
  if (!hostList) return;

  var labels = {
    zh: { login: '登录', account: '我的账户' },
    en: { login: 'Sign in', account: 'My account' },
    ja: { login: 'ログイン', account: 'アカウント' },
    ko: { login: '로그인', account: '내 계정' },
    id: { login: 'Masuk', account: 'Akun saya' }
  };

  var style = document.createElement('style');
  style.textContent = [
    '.wm-global-auth-item{display:flex;align-items:center}',
    '.wm-global-auth-link{display:flex!important;align-items:center;gap:7px;white-space:nowrap}',
    '.wm-global-auth-link .fa{color:#d97706}',
    'body.dark .wm-global-auth-link .fa{color:#fcbf1e}',
    '@media (min-width:992px) and (max-width:1199px){.wm-global-auth-label{display:none}}',
    '@media (max-width:360px){.navbar-brand{font-size:22px!important;gap:3px!important}.navbar-brand small{display:none!important}.wm-logo-img{width:26px!important;height:26px!important}}',
    '@media (max-width:991px){.wm-global-auth-item{justify-content:center;margin:4px 0!important}.wm-global-auth-link{justify-content:center}}'
  ].join('');
  document.head.appendChild(style);

  var item = document.createElement('li');
  item.className = 'nav-item ml-2 wm-global-auth-item';
  var langItem = langPicker.closest('li');
  if (langItem) hostList.insertBefore(item, langItem);
  else hostList.appendChild(item);

  function currentLanguage() {
    return (langPicker.value || localStorage.getItem('wm_studio_lang') || 'en').toLowerCase();
  }

  function readUser() {
    try {
      var token = localStorage.getItem('wm_studio_token');
      var user = JSON.parse(localStorage.getItem('wm_studio_user') || 'null');
      return token && user ? user : null;
    } catch (_) {
      return null;
    }
  }

  function render() {
    var lang = currentLanguage();
    var text = labels[lang] || labels.en;
    var user = readUser();
    var returnPath = window.location.pathname + window.location.search + window.location.hash;
    var href = 'ai-tool.html';
    if (!user) {
      href += '?auth=login&return=' + encodeURIComponent(returnPath);
      var savedRef = localStorage.getItem('wm_studio_referral_code');
      if (savedRef) href += '&ref=' + encodeURIComponent(savedRef);
    }
    item.innerHTML =
      '<a class="nav-link wm-global-auth-link" href="' + href + '">' +
      '<span class="fa ' + (user ? 'fa-user' : 'fa-sign-in') + '" aria-hidden="true"></span>' +
      '<span class="wm-global-auth-label">' + (user ? text.account : text.login) + '</span>' +
      '</a>';
  }

  langPicker.addEventListener('change', render);
  document.addEventListener('wm:language-change', render);
  window.addEventListener('storage', render);
  render();
})();
