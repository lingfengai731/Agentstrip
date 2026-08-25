(function () {
  'use strict';

  var ENDPOINT = '/api/marketing/events';
  var ATTRIBUTION_KEY = 'wm_marketing_attribution';
  var SESSION_PREFIX = 'wm_marketing_once:';
  var allowedEvents = {
    page_view: true,
    home_ai_plan: true,
    home_professional_route: true,
    bali_public_route_select: true,
    bali_professional_route_start: true,
    driver_form_start: true,
    driver_request_submitted: true
  };

  function token(value) {
    var raw = String(value || '').trim().toLowerCase();
    if (/@|:\/\//.test(raw) || (raw.match(/\d/g) || []).length >= 7) return '';
    return raw
      .replace(/[^a-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
  }

  function readAttribution() {
    var params = new URLSearchParams(window.location.search);
    var current = {
      source: token(params.get('utm_source')),
      medium: token(params.get('utm_medium')),
      campaign: token(params.get('utm_campaign')),
      content: token(params.get('utm_content'))
    };
    if (current.source || current.medium || current.campaign || current.content) {
      try { sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(current)); } catch (_) {}
      return current;
    }
    try {
      var saved = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || '{}');
      return {
        source: token(saved.source),
        medium: token(saved.medium),
        campaign: token(saved.campaign),
        content: token(saved.content)
      };
    } catch (_) {
      return current;
    }
  }

  function language() {
    var lang = '';
    try { lang = localStorage.getItem('wm_studio_lang') || ''; } catch (_) {}
    lang = lang || document.documentElement.lang || 'en';
    return ['zh', 'en', 'ja', 'ko', 'id'].indexOf(lang) >= 0 ? lang : 'en';
  }

  function deviceClass() {
    var width = window.innerWidth || document.documentElement.clientWidth || 1440;
    if (width <= 767) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  function track(eventName, detail) {
    if (!allowedEvents[eventName]) return false;
    var attribution = readAttribution();
    var payload = {
      event_name: eventName,
      page_path: window.location.pathname || '/',
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      content: token(detail && detail.content) || attribution.content,
      lang: language(),
      device_class: deviceClass()
    };
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: 'application/json' })
      )) return true;
    } catch (_) {}
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        credentials: 'same-origin'
      }).catch(function () {});
      return true;
    } catch (_) {
      return false;
    }
  }

  function once(key, eventName, detail) {
    try {
      if (sessionStorage.getItem(SESSION_PREFIX + key)) return;
    } catch (_) {}
    if (track(eventName, detail)) {
      try { sessionStorage.setItem(SESSION_PREFIX + key, '1'); } catch (_) {}
    }
  }

  window.wmTrack = track;

  document.addEventListener('DOMContentLoaded', function () {
    track('page_view');

    document.addEventListener('submit', function (event) {
      if (!event.target || !event.target.matches('.wm-brief-form')) return;
      var isProfessional = event.submitter && event.submitter.name === 'professional';
      track(isProfessional ? 'home_professional_route' : 'home_ai_plan');
    }, true);

    window.addEventListener('wm:bali-route-selected', function (event) {
      track('bali_public_route_select', {
        content: event.detail && event.detail.routeId
      });
    });

    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href*="#professional-planner"]');
      if (link && /bali(?:\.html)?$/i.test(window.location.pathname)) {
        track('bali_professional_route_start');
      }
    });

    document.addEventListener('focusin', function (event) {
      if (event.target && event.target.closest('#fd-form-card')) {
        once('driver-form-start', 'driver_form_start');
      }
    });
  });
})();
