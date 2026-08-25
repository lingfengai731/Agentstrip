(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WMDriverEstimate = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var FULL_DAY_BASE = 700000;
  var HALF_DAY_BASE = 500000;
  var PER_GUEST_PER_DAY = 50000;

  function wholeNumber(value, max) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(Math.floor(parsed), max);
  }

  function calculate(input) {
    input = input || {};
    var people = wholeNumber(input.people, 40);
    var fullDays = wholeNumber(input.fullDays, 60);
    var halfDays = wholeNumber(input.halfDays, 60);
    var guestSupplement = people * PER_GUEST_PER_DAY;
    var fullDayRate = FULL_DAY_BASE + guestSupplement;
    var halfDayRate = HALF_DAY_BASE + guestSupplement;
    return {
      people: people,
      fullDays: fullDays,
      halfDays: halfDays,
      guestSupplement: guestSupplement,
      fullDayRate: fullDayRate,
      halfDayRate: halfDayRate,
      total: fullDays * fullDayRate + halfDays * halfDayRate
    };
  }

  function fill(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, function (_, key) {
      return values[key] === undefined ? '' : String(values[key]);
    });
  }

  function currentLanguage() {
    var picker = document.getElementById('langPicker');
    if (picker && picker.value) return picker.value;
    try { return localStorage.getItem('wm_studio_lang') || 'en'; } catch (_) { return 'en'; }
  }

  function localeFor(language) {
    return { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR', id: 'id-ID' }[language] || 'en-US';
  }

  function money(value, language) {
    return 'IDR ' + Number(value || 0).toLocaleString(localeFor(language));
  }

  function mount() {
    if (typeof document === 'undefined') return;
    var people = document.getElementById('fd-people');
    var fullDays = document.getElementById('fd-full-days');
    var halfDays = document.getElementById('fd-half-days');
    var total = document.getElementById('fd-estimator-total');
    var lines = document.getElementById('fd-estimator-lines');
    if (!people || !fullDays || !halfDays || !total || !lines) return;

    function render() {
      var language = currentLanguage();
      var dictionary = typeof LANGS !== 'undefined' ? (LANGS[language] || LANGS.en || {}) : {};
      var result = calculate({ people: people.value, fullDays: fullDays.value, halfDays: halfDays.value });
      var ready = result.people && (result.fullDays || result.halfDays);
      total.textContent = money(ready ? result.total : 0, language);
      lines.replaceChildren();

      if (!ready) {
        var empty = document.createElement('p');
        empty.textContent = dictionary.fdEstimateStart || 'Enter the number of travellers and driver days to see the breakdown.';
        lines.appendChild(empty);
        return;
      }

      if (result.fullDays) {
        var full = document.createElement('p');
        full.textContent = fill(dictionary.fdEstimateFullLine || '{days} full day(s) × {rate}', {
          days: result.fullDays,
          rate: money(result.fullDayRate, language)
        });
        lines.appendChild(full);
      }
      if (result.halfDays) {
        var half = document.createElement('p');
        half.textContent = fill(dictionary.fdEstimateHalfLine || '{days} half day(s) × {rate}', {
          days: result.halfDays,
          rate: money(result.halfDayRate, language)
        });
        lines.appendChild(half);
      }
      var guest = document.createElement('p');
      guest.textContent = fill(dictionary.fdEstimateGuestLine || '{people} guest(s) × IDR 50,000 = {supplement} guest supplement on each selected day.', {
        people: result.people,
        supplement: money(result.guestSupplement, language)
      });
      lines.appendChild(guest);
    }

    [people, fullDays, halfDays].forEach(function (input) {
      input.addEventListener('input', render);
      input.addEventListener('change', render);
    });
    document.addEventListener('wm:language-change', render);
    render();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }

  return {
    calculate: calculate,
    constants: {
      fullDayBase: FULL_DAY_BASE,
      halfDayBase: HALF_DAY_BASE,
      perGuestPerDay: PER_GUEST_PER_DAY
    }
  };
});
