const FULL_DAY_RATE = 700000;
const HALF_DAY_RATE = 500000;
const OVERTIME_RATE = 70000;
const COPY = require('../pages/driver/copy.js');

function fill(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (
    values[key] == null ? '' : String(values[key])
  ));
}

function wholeNumber(value, max = 14) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(Math.floor(number), max);
}

function idr(value) {
  return `IDR ${Number(value || 0).toLocaleString('en-US')}`;
}

function calculate(input = {}, labels = COPY.zh) {
  const copy = { ...COPY.zh, ...(labels || {}) };
  const fullDays = wholeNumber(input.fullDays);
  const halfDays = wholeNumber(input.halfDays);
  const people = Math.max(1, wholeNumber(input.people, 12));
  const services = Array.isArray(input.services) ? input.services : [];
  const total = fullDays * FULL_DAY_RATE + halfDays * HALF_DAY_RATE;
  const breakdown = [];
  if (fullDays) breakdown.push(fill(copy.estimateFullDay, { count: fullDays, price: idr(FULL_DAY_RATE) }));
  if (halfDays) breakdown.push(fill(copy.estimateHalfDay, { count: halfDays, price: idr(HALF_DAY_RATE) }));
  const additions = [];
  if (services.includes('airport_transfer')) {
    additions.push(copy.estimateAirportTransfer);
  }
  if (services.includes('penida')) {
    additions.push(fill(copy.estimatePenida, { price: idr(250000 * people), people }));
  }
  return {
    fullDays,
    halfDays,
    total,
    totalLabel: total ? idr(total) : copy.estimateNoDays,
    breakdown,
    additions,
  };
}

module.exports = {
  calculate,
  constants: { fullDayRate: FULL_DAY_RATE, halfDayRate: HALF_DAY_RATE, overtimeRate: OVERTIME_RATE },
};
