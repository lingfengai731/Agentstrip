const FULL_DAY_RATE = 700000;
const HALF_DAY_RATE = 500000;
const OVERTIME_RATE = 70000;

function wholeNumber(value, max = 14) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(Math.floor(number), max);
}

function idr(value) {
  return `IDR ${Number(value || 0).toLocaleString('en-US')}`;
}

function calculate(input = {}) {
  const fullDays = wholeNumber(input.fullDays);
  const halfDays = wholeNumber(input.halfDays);
  const people = Math.max(1, wholeNumber(input.people, 12));
  const services = Array.isArray(input.services) ? input.services : [];
  const total = fullDays * FULL_DAY_RATE + halfDays * HALF_DAY_RATE;
  const breakdown = [];
  if (fullDays) breakdown.push(`${fullDays} 个全天 × ${idr(FULL_DAY_RATE)}`);
  if (halfDays) breakdown.push(`${halfDays} 个半天 × ${idr(HALF_DAY_RATE)}`);
  const additions = [];
  if (services.includes('airport_transfer')) {
    additions.push('机场接送按区域约 IDR 225,000–750,000，未计入上方合计');
  }
  if (services.includes('penida')) {
    additions.push(`佩妮达往返船票约 ${idr(250000 * people)}（${people} 人）+ 岛上用车 IDR 650,000–700,000，未计入上方合计`);
  }
  return {
    fullDays,
    halfDays,
    total,
    totalLabel: total ? idr(total) : '请选择全天或半天天数',
    breakdown,
    additions,
  };
}

module.exports = {
  calculate,
  constants: { fullDayRate: FULL_DAY_RATE, halfDayRate: HALF_DAY_RATE, overtimeRate: OVERTIME_RATE },
};
