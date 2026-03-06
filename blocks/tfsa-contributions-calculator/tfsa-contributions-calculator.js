import { createTag } from '../../scripts/shared.js';

/** CRA TFSA annual contribution limits by year (2009 = start). 2026 may be updated by CRA. */
const CRA_ANNUAL_LIMITS = {
  2009: 5000,
  2010: 5000,
  2011: 5000,
  2012: 5000,
  2013: 5500,
  2014: 5500,
  2015: 10000,
  2016: 5500,
  2017: 5500,
  2018: 5500,
  2019: 6000,
  2020: 6000,
  2021: 6000,
  2022: 6000,
  2023: 6500,
  2024: 7000,
  2025: 7000,
  2026: 7000,
};

const DEFAULTS = {
  currentYear: new Date().getFullYear(),
  yearBecameEligible: 2009,
  currentYearLimit: 7000,
  unusedRoomCarried: 0,
  withdrawalsLastYear: 0,
  contributionsThisYear: 0,
  withdrawalsThisYear: 0,
  monthsOverContribution: 0,
  useCraTotalRoom: false,
  craTotalRoom: 0,
};

/**
 * Sum of CRA annual limits from eligibility year through endYear (inclusive).
 * Use for "total room from limits" (e.g. 2009 or year turned 18 / came to Canada).
 * @param {number} eligibilityYear - First year of eligibility (e.g. 2009 or year turned 18).
 * @param {number} endYear - Last year to include.
 * @returns {number}
 */
function getCumulativeLimitThrough(eligibilityYear, endYear) {
  let sum = 0;
  const start = Math.max(2009, eligibilityYear);
  const end = Math.min(endYear, Math.max(...Object.keys(CRA_ANNUAL_LIMITS).map(Number)));
  for (let y = start; y <= end; y += 1) {
    sum += CRA_ANNUAL_LIMITS[y] ?? 0;
  }
  return sum;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function buildInput({
  id, label, value, min, max, step, suffix, tooltip,
}) {
  const row = createTag('label', { class: 'tfsa-contributions-calculator-row', for: id });
  const labelEl = createTag('span', { class: 'tfsa-contributions-calculator-label' }, label);
  if (tooltip) {
    const tip = createTag('span', { class: 'tfsa-contributions-calculator-tip', title: tooltip, 'aria-label': 'More information' });
    tip.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
    labelEl.append(tip);
  }
  const wrap = createTag('span', { class: 'tfsa-contributions-calculator-input-wrap' });
  const input = createTag('input', {
    id,
    type: 'number',
    inputmode: 'decimal',
    min,
    max,
    step,
    value: String(value),
  });
  wrap.append(input);
  if (suffix) wrap.append(createTag('span', { class: 'tfsa-contributions-calculator-suffix' }, suffix));
  row.append(labelEl, wrap);
  return { row, input };
}

function buildToggle(id, label, checked) {
  const row = createTag('label', { class: 'tfsa-contributions-calculator-row tfsa-contributions-calculator-toggle', for: id });
  const input = createTag('input', {
    id,
    type: 'checkbox',
    checked: checked ? 'checked' : undefined,
  });
  row.append(createTag('span', { class: 'tfsa-contributions-calculator-label' }, label), input);
  return { row, input };
}

/**
 * CRA-accurate TFSA room and penalty logic.
 * Total room from limits = sum of CRA annual limits from eligibility year (e.g. 2009 or year came to Canada) through current year.
 * Starting room = unused room + current year limit + last year withdrawals (or CRA total if opted).
 * Remaining room = starting room − contributions this year.
 * Over-contribution = max(0, -remaining room).
 * Penalty = over-contribution × 1% × months over-contributed.
 * Projected next year room (excl. next year limit) = max(0, remaining room) + withdrawals this year.
 */
function calculate(values) {
  const currentYear = Math.max(2009, Math.round(toNumber(values.currentYear, DEFAULTS.currentYear)));
  const yearBecameEligible = Math.max(2009, Math.min(currentYear, Math.round(toNumber(values.yearBecameEligible, DEFAULTS.yearBecameEligible))));
  const currentYearLimit = Math.max(0, toNumber(values.currentYearLimit, DEFAULTS.currentYearLimit));
  const unusedRoomCarried = Math.max(0, toNumber(values.unusedRoomCarried, DEFAULTS.unusedRoomCarried));
  const withdrawalsLastYear = Math.max(0, toNumber(values.withdrawalsLastYear, DEFAULTS.withdrawalsLastYear));
  const contributionsThisYear = Math.max(0, toNumber(values.contributionsThisYear, DEFAULTS.contributionsThisYear));
  const withdrawalsThisYear = Math.max(0, toNumber(values.withdrawalsThisYear, DEFAULTS.withdrawalsThisYear));
  const monthsOverContribution = Math.max(0, Math.min(12, Math.round(toNumber(values.monthsOverContribution, DEFAULTS.monthsOverContribution))));
  const useCraTotalRoom = Boolean(values.useCraTotalRoom);
  const craTotalRoom = Math.max(0, toNumber(values.craTotalRoom, DEFAULTS.craTotalRoom));

  const cumulativeLimitThroughLastYear = getCumulativeLimitThrough(yearBecameEligible, currentYear - 1);
  const cumulativeLimitThroughThisYear = getCumulativeLimitThrough(yearBecameEligible, currentYear);

  const startingRoom = useCraTotalRoom
    ? craTotalRoom
    : unusedRoomCarried + currentYearLimit + withdrawalsLastYear;

  const remainingRoom = startingRoom - contributionsThisYear;
  const overContribution = Math.max(0, -remainingRoom);
  const estimatedPenalty = overContribution * 0.01 * monthsOverContribution;
  const projectedCarryForward = Math.max(0, remainingRoom) + withdrawalsThisYear;

  return {
    currentYear,
    yearBecameEligible,
    cumulativeLimitThroughLastYear,
    cumulativeLimitThroughThisYear,
    startingRoom,
    remainingRoom,
    overContribution,
    estimatedPenalty,
    projectedCarryForward,
  };
}

function metric(title, value, note) {
  return createTag('div', { class: 'tfsa-contributions-calculator-metric' }, [
    createTag('h3', {}, title),
    createTag('p', { class: 'tfsa-contributions-calculator-metric-value' }, value),
    createTag('p', { class: 'tfsa-contributions-calculator-metric-note' }, note),
  ]);
}

function buildLegend() {
  const legend = createTag('details', { class: 'tfsa-contributions-calculator-legend' });
  legend.append(
    createTag('summary', {}, 'How to read this calculator'),
    createTag('div', { class: 'tfsa-contributions-calculator-legend-content' }, [
      createTag('ul', {}, [
        createTag('li', {}, 'Total room from limits = sum of CRA annual limits from 2009 (or the year you became eligible, e.g. year you turned 18 or came to Canada) through the current year.'),
        createTag('li', {}, 'Starting room this year = unused room carried forward + current year limit + withdrawals made in the previous year (CRA adds back prior-year withdrawals in the following year).'),
        createTag('li', {}, 'Remaining room = starting room minus contributions made this year (transfers between TFSAs do not use room).'),
        createTag('li', {}, 'Over-contribution = amount by which contributions exceed your room. CRA may charge a tax of 1% per month on the excess.'),
        createTag('li', {}, 'Projected carry-forward = remaining room (if positive) plus withdrawals made this year; next year\'s new limit is added by CRA and is not included here.'),
      ]),
      createTag('p', { class: 'tfsa-contributions-calculator-disclaimer' }, 'Estimates only. Confirm with CRA My Account.'),
    ]),
  );
  return legend;
}

/**
 * Decorates the tfsa-contributions-calculator block.
 * @param {Element} block
 */
export default function decorate(block) {
  block.textContent = '';
  block.classList.add('tfsa-contributions-calculator');

  const legend = buildLegend();
  const layout = createTag('div', { class: 'tfsa-contributions-calculator-layout' });
  const form = createTag('form', { class: 'tfsa-contributions-calculator-form' });
  const group = createTag('div', { class: 'tfsa-contributions-calculator-group' });
  form.append(group);

  const output = createTag('section', {
    class: 'tfsa-contributions-calculator-output',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  layout.append(form, output);
  block.append(legend, layout);

  const refs = {};
  const add = (cfg) => {
    const { row, input } = buildInput(cfg);
    group.append(row);
    refs[cfg.id] = input;
  };

  const addToggle = (id, label, checked) => {
    const { row, input } = buildToggle(id, label, checked);
    group.append(row);
    refs[id] = input;
  };

  add({
    id: 'tfsa-current-year',
    label: 'Current year',
    value: DEFAULTS.currentYear,
    min: 2009,
    max: 2100,
    step: 1,
    tooltip: 'Tax year you are calculating TFSA room for. CRA limits are set per calendar year.',
  });
  add({
    id: 'tfsa-year-eligible',
    label: 'Year you became eligible',
    value: DEFAULTS.yearBecameEligible,
    min: 2009,
    max: 2100,
    step: 1,
    tooltip: 'TFSA started in 2009. Use 2009 if eligible since then, or the year you turned 18 (and were a Canadian resident), or the year you became a resident of Canada.',
  });
  add({
    id: 'tfsa-current-year-limit',
    label: 'Current year TFSA limit',
    value: DEFAULTS.currentYearLimit,
    min: 0,
    step: 500,
    suffix: 'CAD',
    tooltip: 'Annual contribution limit for this year. CRA publishes the amount each year; 2025 limit is $7,000.',
  });
  add({
    id: 'tfsa-unused-room',
    label: 'Unused room carried into this year',
    value: DEFAULTS.unusedRoomCarried,
    min: 0,
    step: 500,
    suffix: 'CAD',
    tooltip: 'Total unused contribution room from all prior years as of Jan 1 of the current year.',
  });
  add({
    id: 'tfsa-withdrawals-last-year',
    label: 'Withdrawals made last year (add back this year)',
    value: DEFAULTS.withdrawalsLastYear,
    min: 0,
    step: 500,
    suffix: 'CAD',
    tooltip: 'Total amount withdrawn from your TFSA in the previous calendar year; this room is added back in the current year.',
  });
  add({
    id: 'tfsa-contributions-this-year',
    label: 'Contributions made this year (exclude transfers)',
    value: DEFAULTS.contributionsThisYear,
    min: 0,
    step: 500,
    suffix: 'CAD',
    tooltip: 'Total contributions to your TFSA this year. Do not include direct transfers from another TFSA.',
  });
  add({
    id: 'tfsa-withdrawals-this-year',
    label: 'Withdrawals made this year (add back next year)',
    value: DEFAULTS.withdrawalsThisYear,
    min: 0,
    step: 500,
    suffix: 'CAD',
    tooltip: 'Withdrawals in the current year; this amount is added back to your room next calendar year.',
  });
  add({
    id: 'tfsa-months-over',
    label: 'Months of over-contribution (for penalty estimate)',
    value: DEFAULTS.monthsOverContribution,
    min: 0,
    max: 12,
    step: 1,
    tooltip: 'Number of months the excess amount stayed in the TFSA. CRA tax is 1% of the highest excess in the month, per month.',
  });

  addToggle('tfsa-use-cra-room', 'Use CRA-reported total room instead of calculating', DEFAULTS.useCraTotalRoom);
  add({
    id: 'tfsa-cra-total-room',
    label: 'CRA total contribution room (from My Account)',
    value: DEFAULTS.craTotalRoom,
    min: 0,
    step: 500,
    suffix: 'CAD',
    tooltip: 'Your total TFSA contribution room as shown in CRA My Account for the start of this year. When enabled, this replaces the calculated starting room.',
  });

  function values() {
    return {
      currentYear: refs['tfsa-current-year'].value,
      yearBecameEligible: refs['tfsa-year-eligible'].value,
      currentYearLimit: refs['tfsa-current-year-limit'].value,
      unusedRoomCarried: refs['tfsa-unused-room'].value,
      withdrawalsLastYear: refs['tfsa-withdrawals-last-year'].value,
      contributionsThisYear: refs['tfsa-contributions-this-year'].value,
      withdrawalsThisYear: refs['tfsa-withdrawals-this-year'].value,
      monthsOverContribution: refs['tfsa-months-over'].value,
      useCraTotalRoom: refs['tfsa-use-cra-room'].checked,
      craTotalRoom: refs['tfsa-cra-total-room'].value,
    };
  }

  function render() {
    const useCra = refs['tfsa-use-cra-room'].checked;
    refs['tfsa-cra-total-room'].disabled = !useCra;

    const result = calculate(values());
    output.textContent = '';
    output.append(
      metric(
        `Total TFSA room from limits (${result.yearBecameEligible}–${result.currentYear})`,
        money(result.cumulativeLimitThroughThisYear),
        result.yearBecameEligible === 2009
          ? 'Sum of CRA annual limits from 2009 through current year. If you were eligible since 2009 and never contributed or withdrew, this is your total room.'
          : `Sum of CRA annual limits from the year you became eligible (${result.yearBecameEligible}) through current year.`,
      ),
      metric(
        'Starting TFSA room this year',
        money(result.startingRoom),
        'Unused room carried in + current year limit + prior-year withdrawals (or CRA total if used). Should not exceed total room from limits unless you have prior-year withdrawals.',
      ),
      metric(
        'Remaining room',
        money(result.remainingRoom),
        result.remainingRoom >= 0
          ? 'Amount you can still contribute this year without creating an excess.'
          : 'Negative means you have over-contributed; the excess is shown below.',
      ),
      metric(
        'Over-contribution amount',
        money(result.overContribution),
        result.overContribution > 0
          ? 'Amount that exceeds your room. Consider withdrawing the excess; CRA may assess a 1% per month tax.'
          : 'No excess; contributions are within your room.',
      ),
      metric(
        'Estimated penalty (1% per month)',
        money(result.estimatedPenalty),
        'Rough estimate only. CRA calculates tax on the highest excess in each month. Confirm with CRA.',
      ),
      metric(
        'Projected carry-forward to next year (excluding next year limit)',
        money(result.projectedCarryForward),
        'Remaining room (if positive) plus this year\'s withdrawals. Next year\'s new limit is added by CRA.',
      ),
    );
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  render();
}
