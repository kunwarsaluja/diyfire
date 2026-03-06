import { createTag } from '../../scripts/shared.js';

const DEFAULTS = {
  currentAge: 30,
  targetAge: 55,
  currentAssets: 50000,
  monthlyExpenses: 3000,
  annualSpend: 36000,
  inflationRate: 2.5,
  returnRate: 7,
  debtMonthly: 0,
  fixedMonthly: 0,
  oneTimeExpenses: 0,
  safetyMargin: 10,
  withdrawalRate: 4,
  leanMax: 50000,
  chubbyMax: 150000,
};

const PRESETS = [
  { key: 'lean', label: 'LeanFIRE', annualSpend: 40000 },
  { key: 'chubby', label: 'ChubbyFIRE', annualSpend: 90000 },
  { key: 'fat', label: 'FatFIRE', annualSpend: 180000 },
  { key: 'coast', label: 'CoastFIRE' },
];

function currency(value) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildInput({ id, label, type = 'number', min, max, step, value, suffix, tooltip }) {
  const row = createTag('label', { class: 'fire-calculator-row', for: id });
  const labelWrap = createTag('span', { class: 'fire-calculator-label' }, label);
  if (tooltip) {
    labelWrap.append(createTag('span', { class: 'fire-calculator-tip', title: tooltip }, ' ?'));
  }
  row.append(labelWrap);

  const inputWrap = createTag('span', { class: 'fire-calculator-input-wrap' });
  const input = createTag('input', {
    id,
    type,
    inputmode: type === 'number' ? 'decimal' : undefined,
    min,
    max,
    step,
    value: String(value),
  });
  inputWrap.append(input);
  if (suffix) inputWrap.append(createTag('span', { class: 'fire-calculator-suffix' }, suffix));
  row.append(inputWrap);
  return { row, input };
}

function buildRangeRow({
  id, label, min, max, step, value, tooltip,
}) {
  const row = createTag('div', { class: 'fire-calculator-row' });
  const labelWrap = createTag('span', { class: 'fire-calculator-label' }, label);
  if (tooltip) {
    labelWrap.append(createTag('span', { class: 'fire-calculator-tip', title: tooltip }, ' ?'));
  }
  const inputWrap = createTag('span', { class: 'fire-calculator-input-wrap' });
  const input = createTag('input', {
    id,
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
  });
  const valueEl = createTag('span', { class: 'fire-calculator-suffix' }, `${value}%`);
  inputWrap.append(input, valueEl);
  row.append(labelWrap, inputWrap);
  return { row, input, valueEl };
}

function effectiveRealReturn({ inflationAdjusted, returnRate, inflationRate }) {
  const nominal = returnRate / 100;
  if (!inflationAdjusted) return nominal;
  const inflation = inflationRate / 100;
  return ((1 + nominal) / (1 + inflation)) - 1;
}

function pickFireLabel({ annualSpendWithMargin, leanMax, chubbyMax, isCoast, currentAssets, fireNumber }) {
  if (isCoast && currentAssets < fireNumber) return 'CoastFIRE';
  if (annualSpendWithMargin <= leanMax) return 'LeanFIRE';
  if (annualSpendWithMargin <= chubbyMax) return 'ChubbyFIRE';
  return 'FatFIRE';
}

function calculate(values) {
  const currentAge = Math.max(0, toNumber(values.currentAge, DEFAULTS.currentAge));
  const targetAge = Math.max(currentAge, toNumber(values.targetAge, DEFAULTS.targetAge));
  const years = Math.max(0, targetAge - currentAge);

  const currentAssets = Math.max(0, toNumber(values.currentAssets, DEFAULTS.currentAssets));
  const monthlyExpenses = Math.max(0, toNumber(values.monthlyExpenses, DEFAULTS.monthlyExpenses));
  const debtMonthly = Math.max(0, toNumber(values.debtMonthly, DEFAULTS.debtMonthly));
  const fixedMonthly = Math.max(0, toNumber(values.fixedMonthly, DEFAULTS.fixedMonthly));
  const oneTimeExpenses = Math.max(0, toNumber(values.oneTimeExpenses, DEFAULTS.oneTimeExpenses));
  const safetyMargin = Math.max(0, toNumber(values.safetyMargin, DEFAULTS.safetyMargin));

  const annualSpendInput = Math.max(0, toNumber(values.annualSpend, DEFAULTS.annualSpend));
  const annualSpendBase = annualSpendInput || (monthlyExpenses * 12);
  const annualWithCommitments = annualSpendBase + ((debtMonthly + fixedMonthly) * 12);
  const annualSpendWithMargin = annualWithCommitments * (1 + (safetyMargin / 100));
  const annualNeed = annualSpendWithMargin + oneTimeExpenses;

  const withdrawalRate = Math.max(1, toNumber(values.withdrawalRate, DEFAULTS.withdrawalRate));
  const fireMultiple = 100 / withdrawalRate;
  const fireNumber = annualNeed * fireMultiple;

  const returnRate = toNumber(values.returnRate, DEFAULTS.returnRate);
  const inflationRate = toNumber(values.inflationRate, DEFAULTS.inflationRate);
  const realReturn = effectiveRealReturn({
    inflationAdjusted: values.inflationAdjusted,
    returnRate,
    inflationRate,
  });
  const growthFactor = (1 + realReturn) ** years;
  const projectedPortfolio = currentAssets * growthFactor;
  const coastAssetsNeeded = growthFactor > 0 ? (fireNumber / growthFactor) : fireNumber;

  const gapToFire = Math.max(0, fireNumber - projectedPortfolio);
  const isCoast = projectedPortfolio >= fireNumber;
  const leanMax = Math.max(0, toNumber(values.leanMax, DEFAULTS.leanMax));
  const chubbyMax = Math.max(leanMax, toNumber(values.chubbyMax, DEFAULTS.chubbyMax));
  const label = pickFireLabel({
    annualSpendWithMargin,
    leanMax,
    chubbyMax,
    isCoast,
    currentAssets,
    fireNumber,
  });

  return {
    currentAge,
    targetAge,
    years,
    annualNeed,
    fireNumber,
    fireMultiple,
    projectedPortfolio,
    coastAssetsNeeded,
    gapToFire,
    label,
    realReturn: realReturn * 100,
    isCoast,
  };
}

function buildMetric(title, value, note) {
  const card = createTag('div', { class: 'fire-calculator-metric' });
  card.append(
    createTag('h3', {}, title),
    createTag('p', { class: 'fire-calculator-metric-value' }, value),
    createTag('p', { class: 'fire-calculator-metric-note' }, note),
  );
  return card;
}

function buildLegend() {
  const legend = createTag('details', { class: 'fire-calculator-legend' });
  legend.append(
    createTag('summary', {}, 'How to read this calculator'),
    createTag('ul', {}, [
      createTag('li', {}, 'FIRE number: portfolio needed to support annual spending.'),
      createTag('li', {}, 'Withdrawal rate: lower rate means a bigger FIRE target.'),
      createTag('li', {}, 'CoastFIRE: current assets can grow to FIRE by target age.'),
      createTag('li', {}, 'Gap to FIRE: amount still needed based on your assumptions.'),
    ]),
  );
  return legend;
}

/**
 * Decorates the fire-calculator block.
 * @param {Element} block
 */
export default function decorate(block) {
  block.textContent = '';
  block.classList.add('fire-calculator');

  const layout = createTag('div', { class: 'fire-calculator-layout' });
  const form = createTag('form', { class: 'fire-calculator-form' });
  const output = createTag('section', { class: 'fire-calculator-output', 'aria-live': 'polite' });
  const essentials = createTag('div', { class: 'fire-calculator-group' });
  const optional = createTag('details', { class: 'fire-calculator-optional' });
  const optionalSummary = createTag('summary', {}, 'Optional inputs');
  const optionalGroup = createTag('div', { class: 'fire-calculator-group' });
  optional.append(optionalSummary, optionalGroup);
  form.append(essentials, optional);

  const inputRefs = {};
  const addInput = (cfg, target = essentials) => {
    const { row, input } = buildInput(cfg);
    target.append(row);
    inputRefs[cfg.id] = input;
  };

  addInput({
    id: 'fc-current-age', label: 'Current age', min: 16, max: 100, value: DEFAULTS.currentAge,
  });
  addInput({
    id: 'fc-target-age', label: 'Target retirement age', min: 16, max: 100, value: DEFAULTS.targetAge,
  });
  addInput({
    id: 'fc-current-assets', label: 'Current investable assets', min: 0, step: 1000, value: DEFAULTS.currentAssets, suffix: 'CAD',
  });
  addInput({
    id: 'fc-monthly-expenses', label: 'Current monthly expenses', min: 0, step: 50, value: DEFAULTS.monthlyExpenses, suffix: 'CAD',
  });
  addInput({
    id: 'fc-annual-spend', label: 'Desired annual spend (today)', min: 0, step: 500, value: DEFAULTS.annualSpend, suffix: 'CAD', tooltip: 'Expected yearly retirement spend in today\'s dollars.',
  });

  const inflationToggleRow = createTag('label', { class: 'fire-calculator-row fire-calculator-toggle', for: 'fc-inflation-toggle' });
  const inflationToggle = createTag('input', {
    id: 'fc-inflation-toggle',
    type: 'checkbox',
    checked: 'checked',
  });
  inflationToggleRow.append(
    createTag('span', { class: 'fire-calculator-label' }, 'Inflation-adjusted?'),
    inflationToggle,
  );
  essentials.append(inflationToggleRow);

  const inflationRange = buildRangeRow({
    id: 'fc-inflation-rate',
    label: 'Inflation rate',
    min: 0,
    max: 20,
    step: 0.1,
    value: DEFAULTS.inflationRate,
  });
  essentials.append(inflationRange.row);
  inputRefs['fc-inflation-rate'] = inflationRange.input;

  const returnRange = buildRangeRow({
    id: 'fc-return-rate',
    label: 'Expected return',
    min: -10,
    max: 30,
    step: 0.1,
    value: DEFAULTS.returnRate,
    tooltip: 'With inflation-adjusted on, nominal return is converted to real return.',
  });
  essentials.append(returnRange.row);
  inputRefs['fc-return-rate'] = returnRange.input;
  addInput({
    id: 'fc-debt-monthly', label: 'Debt payments (monthly)', min: 0, step: 50, value: DEFAULTS.debtMonthly, suffix: 'CAD',
  }, optionalGroup);
  addInput({
    id: 'fc-fixed-monthly', label: 'Other fixed commitments (monthly)', min: 0, step: 50, value: DEFAULTS.fixedMonthly, suffix: 'CAD',
  }, optionalGroup);
  addInput({
    id: 'fc-one-time', label: 'One-time retirement expenses', min: 0, step: 500, value: DEFAULTS.oneTimeExpenses, suffix: 'CAD',
  }, optionalGroup);
  const safetyRange = buildRangeRow({
    id: 'fc-safety-margin',
    label: 'Safety margin',
    min: 0,
    max: 100,
    step: 1,
    value: DEFAULTS.safetyMargin,
  });
  optionalGroup.append(safetyRange.row);
  inputRefs['fc-safety-margin'] = safetyRange.input;

  const wrWrap = createTag('div', { class: 'fire-calculator-row fire-calculator-withdrawal' });
  wrWrap.append(
    createTag('span', { class: 'fire-calculator-label' }, [
      'Withdrawal rate',
      createTag('span', { class: 'fire-calculator-tip', title: 'FIRE number = annual spend divided by withdrawal rate.' }, ' ?'),
    ]),
  );
  const wrSlider = createTag('input', {
    id: 'fc-withdrawal-rate',
    type: 'range',
    min: '2.5',
    max: '6',
    step: '0.1',
    value: String(DEFAULTS.withdrawalRate),
  });
  const wrValue = createTag('span', { class: 'fire-calculator-suffix' }, `${DEFAULTS.withdrawalRate}%`);
  wrWrap.append(createTag('span', { class: 'fire-calculator-input-wrap' }, [wrSlider, wrValue]));
  essentials.append(wrWrap);

  const tiersTitle = createTag('h3', { class: 'fire-calculator-subtitle' }, 'FIRE category thresholds');
  optionalGroup.append(tiersTitle);
  addInput({
    id: 'fc-lean-max', label: 'LeanFIRE max annual spend', min: 0, step: 1000, value: DEFAULTS.leanMax, suffix: 'CAD',
  }, optionalGroup);
  addInput({
    id: 'fc-chubby-max', label: 'ChubbyFIRE max annual spend', min: 0, step: 1000, value: DEFAULTS.chubbyMax, suffix: 'CAD',
  }, optionalGroup);

  const presetsWrap = createTag('div', { class: 'fire-calculator-presets' });
  presetsWrap.append(createTag('p', { class: 'fire-calculator-presets-label' }, 'Try a preset:'));
  const legend = buildLegend();
  const presetButtons = PRESETS.map((preset) => createTag('button', {
    type: 'button',
    class: 'fire-calculator-preset-btn',
    'data-preset': preset.key,
  }, preset.label));
  presetsWrap.append(...presetButtons);

  function getValues() {
    return {
      currentAge: inputRefs['fc-current-age'].value,
      targetAge: inputRefs['fc-target-age'].value,
      currentAssets: inputRefs['fc-current-assets'].value,
      monthlyExpenses: inputRefs['fc-monthly-expenses'].value,
      annualSpend: inputRefs['fc-annual-spend'].value,
      inflationAdjusted: inflationToggle.checked,
      inflationRate: inputRefs['fc-inflation-rate'].value,
      returnRate: inputRefs['fc-return-rate'].value,
      debtMonthly: inputRefs['fc-debt-monthly'].value,
      fixedMonthly: inputRefs['fc-fixed-monthly'].value,
      oneTimeExpenses: inputRefs['fc-one-time'].value,
      safetyMargin: inputRefs['fc-safety-margin'].value,
      withdrawalRate: wrSlider.value,
      leanMax: inputRefs['fc-lean-max'].value,
      chubbyMax: inputRefs['fc-chubby-max'].value,
    };
  }

  function render() {
    wrValue.textContent = `${toNumber(wrSlider.value, DEFAULTS.withdrawalRate).toFixed(1)}%`;
    inflationRange.valueEl.textContent = `${toNumber(inflationRange.input.value, DEFAULTS.inflationRate).toFixed(1)}%`;
    returnRange.valueEl.textContent = `${toNumber(returnRange.input.value, DEFAULTS.returnRate).toFixed(1)}%`;
    safetyRange.valueEl.textContent = `${Math.round(toNumber(safetyRange.input.value, DEFAULTS.safetyMargin))}%`;
    inputRefs['fc-inflation-rate'].disabled = !inflationToggle.checked;
    const result = calculate(getValues());

    output.textContent = '';
    output.append(
      buildMetric(
        'Your FIRE number',
        currency(result.fireNumber),
        `Estimated portfolio needed for your target spending (${result.fireMultiple.toFixed(1)}x annual spend).`,
      ),
      buildMetric(
        'FIRE category',
        result.label,
        'Style tier is based on spend thresholds; CoastFIRE is based on growth from current assets.',
      ),
      buildMetric(
        'Years remaining',
        `${Math.round(result.years)} years`,
        'Time to your target retirement age.',
      ),
      buildMetric(
        'Projected portfolio at retirement',
        currency(result.projectedPortfolio),
        `Uses ${result.realReturn.toFixed(2)}% ${inflationToggle.checked ? 'real' : 'nominal'} return.`,
      ),
      buildMetric(
        'Gap to FIRE',
        result.gapToFire > 0 ? currency(result.gapToFire) : 'On track',
        result.gapToFire > 0
          ? 'Amount still needed to reach your FIRE number.'
          : 'On track to hit FIRE without new contributions.',
      ),
    );
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const presetKey = btn.getAttribute('data-preset');
      const preset = PRESETS.find((item) => item.key === presetKey);
      if (!preset) return;

      if (preset.key === 'coast') {
        const result = calculate(getValues());
        inputRefs['fc-current-assets'].value = String(Math.max(0, Math.ceil(result.coastAssetsNeeded)));
      } else {
        inputRefs['fc-annual-spend'].value = String(preset.annualSpend);
      }

      presetButtons.forEach((button) => button.classList.remove('is-active'));
      btn.classList.add('is-active');
      render();
    });
  });

  form.addEventListener('input', render);
  form.addEventListener('change', render);

  layout.append(form, output);
  block.append(presetsWrap, legend, layout);
  render();
}
