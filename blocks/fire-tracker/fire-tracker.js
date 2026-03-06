import { createTag } from '../../scripts/shared.js';

const DEFAULTS = {
  currentAge: 35,
  targetAge: 60,
  grossIncome: 100000,
  afterTaxIncome: 73000,
  province: 'Ontario',
  currentAssets: 180000,
  monthlyExpenses: 3500,
  monthlySavings: 1800,
  monthlyOtherContributions: 0,
  debtMonthly: 0,
  fixedMonthly: 0,
  oneTimeExpenses: 0,
  safetyMargin: 10,
  expectedReturn: 5,
  inflationRate: 2.2,
  withdrawalRate: 4,
  leanMax: 50000,
  chubbyMax: 150000,
  cash: 20000,
  tfsa: 65000,
  rrsp: 110000,
  nonRegistered: 25000,
  otherAssets: 0,
  homeValue: 0,
  creditCardDebt: 0,
  mortgageDebt: 0,
  otherDebt: 0,
};

const PRESETS = {
  conservative: { expectedReturn: 4, inflationRate: 2.5, withdrawalRate: 3.5 },
  balanced: { expectedReturn: 5, inflationRate: 2.2, withdrawalRate: 4 },
  aggressive: { expectedReturn: 6.5, inflationRate: 2.2, withdrawalRate: 4.5 },
};

const FEDERAL_TAX = {
  brackets: [
    { upTo: 55867, rate: 0.15 },
    { upTo: 111733, rate: 0.205 },
    { upTo: 173205, rate: 0.26 },
    { upTo: 246752, rate: 0.29 },
    { upTo: Infinity, rate: 0.33 },
  ],
  bpa: 15705,
};

const PROVINCIAL_TAX = {
  Ontario: { bpa: 12399, brackets: [{ upTo: 51446, rate: 0.0505 }, { upTo: 102894, rate: 0.0915 }, { upTo: 150000, rate: 0.1116 }, { upTo: 220000, rate: 0.1216 }, { upTo: Infinity, rate: 0.1316 }] },
  Alberta: { bpa: 21885, brackets: [{ upTo: 148269, rate: 0.1 }, { upTo: 177922, rate: 0.12 }, { upTo: 237230, rate: 0.13 }, { upTo: 355845, rate: 0.14 }, { upTo: Infinity, rate: 0.15 }] },
  'British Columbia': { bpa: 12580, brackets: [{ upTo: 47937, rate: 0.0506 }, { upTo: 95875, rate: 0.077 }, { upTo: 110076, rate: 0.105 }, { upTo: 133664, rate: 0.1229 }, { upTo: 181232, rate: 0.147 }, { upTo: 252752, rate: 0.168 }, { upTo: Infinity, rate: 0.205 }] },
  Manitoba: { bpa: 15000, brackets: [{ upTo: 47000, rate: 0.108 }, { upTo: 100000, rate: 0.1275 }, { upTo: Infinity, rate: 0.174 }] },
  'New Brunswick': { bpa: 13144, brackets: [{ upTo: 49958, rate: 0.094 }, { upTo: 99916, rate: 0.14 }, { upTo: 185064, rate: 0.16 }, { upTo: Infinity, rate: 0.195 }] },
  'Newfoundland and Labrador': { bpa: 10991, brackets: [{ upTo: 43198, rate: 0.087 }, { upTo: 86395, rate: 0.145 }, { upTo: 154244, rate: 0.158 }, { upTo: 215943, rate: 0.173 }, { upTo: 275870, rate: 0.183 }, { upTo: 551739, rate: 0.193 }, { upTo: 1103478, rate: 0.208 }, { upTo: Infinity, rate: 0.213 }] },
  'Nova Scotia': { bpa: 8481, brackets: [{ upTo: 29590, rate: 0.0879 }, { upTo: 59180, rate: 0.1495 }, { upTo: 93000, rate: 0.1667 }, { upTo: 150000, rate: 0.175 }, { upTo: Infinity, rate: 0.21 }] },
  'Prince Edward Island': { bpa: 14000, brackets: [{ upTo: 32656, rate: 0.0965 }, { upTo: 64313, rate: 0.1363 }, { upTo: 105000, rate: 0.1665 }, { upTo: 140000, rate: 0.18 }, { upTo: Infinity, rate: 0.1875 }] },
  Quebec: { bpa: 18056, brackets: [{ upTo: 51780, rate: 0.14 }, { upTo: 103545, rate: 0.19 }, { upTo: 126000, rate: 0.24 }, { upTo: Infinity, rate: 0.2575 }] },
  Saskatchewan: { bpa: 18000, brackets: [{ upTo: 52057, rate: 0.105 }, { upTo: 148734, rate: 0.125 }, { upTo: Infinity, rate: 0.145 }] },
  'Northwest Territories': { bpa: 17373, brackets: [{ upTo: 50597, rate: 0.059 }, { upTo: 101198, rate: 0.086 }, { upTo: 164525, rate: 0.122 }, { upTo: Infinity, rate: 0.1405 }] },
  Nunavut: { bpa: 17925, brackets: [{ upTo: 53268, rate: 0.04 }, { upTo: 106537, rate: 0.07 }, { upTo: 173205, rate: 0.09 }, { upTo: Infinity, rate: 0.115 }] },
  Yukon: { bpa: 15705, brackets: [{ upTo: 55867, rate: 0.064 }, { upTo: 111733, rate: 0.09 }, { upTo: 173205, rate: 0.109 }, { upTo: 500000, rate: 0.128 }, { upTo: Infinity, rate: 0.15 }] },
};

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

function percent(value, digits = 1) {
  return `${(value || 0).toFixed(digits)}%`;
}

function progressiveTax(income, brackets) {
  let tax = 0;
  let previous = 0;
  for (let i = 0; i < brackets.length; i += 1) {
    const { upTo, rate } = brackets[i];
    const taxable = Math.max(0, Math.min(income, upTo) - previous);
    tax += taxable * rate;
    previous = upTo;
    if (income <= upTo) break;
  }
  return tax;
}

function estimateCppEiAnnual(grossAnnual) {
  const cpp = Math.min(grossAnnual * 0.0595, 3867);
  const ei = Math.min(grossAnnual * 0.0166, 1049);
  return cpp + ei;
}

function annualGrowthFactor(rate, years) {
  return (1 + rate) ** years;
}

function futureValueWithContribution(principal, annualContribution, annualRate, years) {
  if (years <= 0) return principal;
  if (Math.abs(annualRate) < 0.000001) return principal + (annualContribution * years);
  const growth = annualGrowthFactor(annualRate, years);
  return (principal * growth) + (annualContribution * ((growth - 1) / annualRate));
}

function estimateYearsToFire(start, annualContribution, annualRate, target, maxYears = 80) {
  if (target <= 0) return 0;
  if (start >= target) return 0;
  let portfolio = start;
  for (let year = 1; year <= maxYears; year += 1) {
    portfolio = (portfolio * (1 + annualRate)) + annualContribution;
    if (portfolio >= target) return year;
  }
  return null;
}

function effectiveReturn(expectedReturn, inflationRate, inflationAdjusted) {
  const nominal = expectedReturn / 100;
  if (!inflationAdjusted) return nominal;
  const inflation = inflationRate / 100;
  return ((1 + nominal) / (1 + inflation)) - 1;
}

function fireStyle(annualNeed, leanMax, chubbyMax) {
  if (annualNeed <= leanMax) return 'LeanFIRE';
  if (annualNeed <= chubbyMax) return 'ChubbyFIRE';
  return 'FatFIRE';
}

function buildNumberRow({
  id, label, value, suffix, min = 0, max, step = 1, tooltip,
}) {
  const row = createTag('label', { class: 'fire-tracker-row', for: id });
  const labelEl = createTag('span', { class: 'fire-tracker-label' }, label);
  if (tooltip) {
    labelEl.append(createTag('span', { class: 'fire-tracker-tip', title: tooltip }, ' ?'));
  }
  const wrap = createTag('span', { class: 'fire-tracker-input' });
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
  if (suffix) wrap.append(createTag('span', { class: 'fire-tracker-suffix' }, suffix));
  row.append(labelEl, wrap);
  return { row, input };
}

function buildRangeRow({
  id, label, value, min, max, step, tooltip,
}) {
  const row = createTag('div', { class: 'fire-tracker-row' });
  const labelEl = createTag('span', { class: 'fire-tracker-label' }, label);
  if (tooltip) {
    labelEl.append(createTag('span', { class: 'fire-tracker-tip', title: tooltip }, ' ?'));
  }
  const wrap = createTag('span', { class: 'fire-tracker-input' });
  const input = createTag('input', {
    id,
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
  });
  const valueEl = createTag('span', { class: 'fire-tracker-suffix' }, `${value}%`);
  wrap.append(input, valueEl);
  row.append(labelEl, wrap);
  return { row, input, valueEl };
}

function buildToggleRow(id, label, checked = false) {
  const row = createTag('label', { class: 'fire-tracker-row fire-tracker-toggle', for: id });
  const input = createTag('input', {
    id,
    type: 'checkbox',
    checked: checked ? 'checked' : undefined,
  });
  row.append(createTag('span', { class: 'fire-tracker-label' }, label), input);
  return { row, input };
}

function metric(title, value, note) {
  return createTag('div', { class: 'fire-tracker-metric' }, [
    createTag('h3', {}, title),
    createTag('p', { class: 'fire-tracker-metric-value' }, value),
    createTag('p', { class: 'fire-tracker-metric-note' }, note),
  ]);
}

function buildLegend() {
  const legend = createTag('details', { class: 'fire-tracker-legend' });
  legend.append(
    createTag('summary', {}, 'How to read this tracker'),
    createTag('ul', {}, [
      createTag('li', {}, 'FIRE number: target portfolio for your spending assumptions.'),
      createTag('li', {}, 'Readiness: whether projected target-age portfolio reaches FIRE.'),
      createTag('li', {}, 'CoastFIRE: current assets can grow to FIRE without new savings.'),
      createTag('li', {}, 'Tax estimate: federal + provincial estimate, can be overridden.'),
    ]),
  );
  return legend;
}

function calculate(values) {
  const currentAge = Math.max(18, toNumber(values.currentAge, DEFAULTS.currentAge));
  const targetAge = Math.max(currentAge, toNumber(values.targetAge, DEFAULTS.targetAge));
  const yearsToTargetAge = targetAge - currentAge;

  const grossIncome = Math.max(0, toNumber(values.grossIncome, DEFAULTS.grossIncome));
  const overrideAfterTax = Boolean(values.overrideAfterTax);
  const province = values.province || DEFAULTS.province;
  const provinceTax = PROVINCIAL_TAX[province] || PROVINCIAL_TAX[DEFAULTS.province];

  const federalTaxRaw = progressiveTax(grossIncome, FEDERAL_TAX.brackets);
  const provincialTaxRaw = progressiveTax(grossIncome, provinceTax.brackets);
  const federalCredit = FEDERAL_TAX.bpa * FEDERAL_TAX.brackets[0].rate;
  const provincialCredit = provinceTax.bpa * provinceTax.brackets[0].rate;
  const estimatedIncomeTax = Math.max(0, (federalTaxRaw - federalCredit) + (provincialTaxRaw - provincialCredit));
  const cppEiAnnual = estimateCppEiAnnual(grossIncome);
  const estimatedEffectiveTaxRate = grossIncome > 0 ? (estimatedIncomeTax / grossIncome) * 100 : 0;
  const autoAfterTax = Math.max(0, grossIncome - estimatedIncomeTax - cppEiAnnual);
  const afterTaxIncome = overrideAfterTax
    ? Math.max(0, toNumber(values.afterTaxIncome, DEFAULTS.afterTaxIncome))
    : autoAfterTax;

  const monthlyExpenses = Math.max(0, toNumber(values.monthlyExpenses, DEFAULTS.monthlyExpenses));
  const monthlySavings = Math.max(0, toNumber(values.monthlySavings, DEFAULTS.monthlySavings));
  const monthlyOtherContributions = Math.max(0, toNumber(values.monthlyOtherContributions, DEFAULTS.monthlyOtherContributions));
  const debtMonthly = Math.max(0, toNumber(values.debtMonthly, DEFAULTS.debtMonthly));
  const fixedMonthly = Math.max(0, toNumber(values.fixedMonthly, DEFAULTS.fixedMonthly));
  const oneTimeExpenses = Math.max(0, toNumber(values.oneTimeExpenses, DEFAULTS.oneTimeExpenses));
  const safetyMargin = Math.max(0, toNumber(values.safetyMargin, DEFAULTS.safetyMargin));

  const annualSpendBase = (monthlyExpenses + debtMonthly + fixedMonthly) * 12;
  const annualNeed = (annualSpendBase * (1 + (safetyMargin / 100))) + oneTimeExpenses;

  const currentAssets = Math.max(0, toNumber(values.currentAssets, DEFAULTS.currentAssets));
  const annualSavings = Math.max(0, (monthlySavings + monthlyOtherContributions) * 12);
  const savingsRate = afterTaxIncome > 0 ? (annualSavings / afterTaxIncome) * 100 : 0;

  const expectedReturn = toNumber(values.expectedReturn, DEFAULTS.expectedReturn);
  const inflationRate = toNumber(values.inflationRate, DEFAULTS.inflationRate);
  const adjustedAnnualReturn = effectiveReturn(expectedReturn, inflationRate, values.inflationAdjusted);

  const withdrawalRate = Math.max(1, toNumber(values.withdrawalRate, DEFAULTS.withdrawalRate));
  const fireNumber = annualNeed / (withdrawalRate / 100);
  const yearsToFire = estimateYearsToFire(currentAssets, annualSavings, adjustedAnnualReturn, fireNumber);
  const projectedAtTargetAge = futureValueWithContribution(
    currentAssets,
    annualSavings,
    adjustedAnnualReturn,
    yearsToTargetAge,
  );
  const gapAtTargetAge = Math.max(0, fireNumber - projectedAtTargetAge);
  const retirementYear = yearsToFire === null ? 'Beyond projection' : String(new Date().getFullYear() + yearsToFire);

  const coastPortfolio = currentAssets * annualGrowthFactor(adjustedAnnualReturn, yearsToTargetAge);
  const isCoast = coastPortfolio >= fireNumber;
  const leanMax = Math.max(0, toNumber(values.leanMax, DEFAULTS.leanMax));
  const chubbyMax = Math.max(leanMax, toNumber(values.chubbyMax, DEFAULTS.chubbyMax));
  const style = isCoast ? 'CoastFIRE' : fireStyle(annualNeed, leanMax, chubbyMax);

  const cash = Math.max(0, toNumber(values.cash, DEFAULTS.cash));
  const tfsa = Math.max(0, toNumber(values.tfsa, DEFAULTS.tfsa));
  const rrsp = Math.max(0, toNumber(values.rrsp, DEFAULTS.rrsp));
  const nonRegistered = Math.max(0, toNumber(values.nonRegistered, DEFAULTS.nonRegistered));
  const otherAssets = Math.max(0, toNumber(values.otherAssets, DEFAULTS.otherAssets));
  const homeValue = Math.max(0, toNumber(values.homeValue, DEFAULTS.homeValue));
  const creditCardDebt = Math.max(0, toNumber(values.creditCardDebt, DEFAULTS.creditCardDebt));
  const mortgageDebt = Math.max(0, toNumber(values.mortgageDebt, DEFAULTS.mortgageDebt));
  const otherDebt = Math.max(0, toNumber(values.otherDebt, DEFAULTS.otherDebt));
  const totalAssets = cash + tfsa + rrsp + nonRegistered + otherAssets + homeValue;
  const totalDebts = creditCardDebt + mortgageDebt + otherDebt;
  const netWorth = totalAssets - totalDebts;

  const readiness = gapAtTargetAge > 0 ? 'Gap to Fill' : 'On Track';
  const monthlySurplus = (afterTaxIncome / 12) - (monthlyExpenses + debtMonthly + fixedMonthly);

  return {
    afterTaxIncome,
    estimatedEffectiveTaxRate,
    annualNeed,
    fireNumber,
    savingsRate,
    annualSavings,
    monthlySurplus,
    adjustedAnnualReturn,
    yearsToFire,
    projectedAtTargetAge,
    gapAtTargetAge,
    readiness,
    retirementYear,
    style,
    isCoast,
    yearsToTargetAge,
    netWorth,
    totalAssets,
    totalDebts,
  };
}

/**
 * Decorates the fire-tracker block.
 * @param {Element} block
 */
export default function decorate(block) {
  block.textContent = '';
  block.classList.add('fire-tracker');

  const root = createTag('div', { class: 'fire-tracker-root' });
  const presets = createTag('div', { class: 'fire-tracker-presets' });
  presets.append(createTag('p', { class: 'fire-tracker-presets-label' }, 'Plan assumptions:'));
  const legend = buildLegend();
  const presetButtons = [
    createTag('button', { type: 'button', 'data-preset': 'conservative' }, 'Conservative'),
    createTag('button', { type: 'button', 'data-preset': 'balanced' }, 'Balanced'),
    createTag('button', { type: 'button', 'data-preset': 'aggressive' }, 'Aggressive'),
  ];
  presets.append(...presetButtons);

  const layout = createTag('div', { class: 'fire-tracker-layout' });
  const form = createTag('form', { class: 'fire-tracker-form' });
  const essentials = createTag('div', { class: 'fire-tracker-group' });
  const optional = createTag('details', { class: 'fire-tracker-optional' });
  optional.append(createTag('summary', {}, 'Optional details'));
  const optionalGroup = createTag('div', { class: 'fire-tracker-group' });
  optional.append(optionalGroup);
  form.append(essentials, optional);

  const output = createTag('section', { class: 'fire-tracker-output', 'aria-live': 'polite' });
  layout.append(form, output);
  root.append(presets, legend, layout);
  block.append(root);

  const refs = {};

  const addNumber = (cfg, target = essentials) => {
    const { row, input } = buildNumberRow(cfg);
    target.append(row);
    refs[cfg.id] = input;
  };

  addNumber({ id: 'ft-current-age', label: 'Current age', value: DEFAULTS.currentAge, min: 18, max: 100 });
  addNumber({ id: 'ft-target-age', label: 'Target retirement age', value: DEFAULTS.targetAge, min: 18, max: 100 });
  addNumber({ id: 'ft-gross-income', label: 'Gross annual income', value: DEFAULTS.grossIncome, step: 1000, suffix: 'CAD' });

  const overrideTax = buildToggleRow('ft-override-after-tax', 'Override after-tax estimate', false);
  essentials.append(overrideTax.row);
  refs['ft-override-after-tax'] = overrideTax.input;

  addNumber({ id: 'ft-after-tax-income', label: 'After-tax income', value: DEFAULTS.afterTaxIncome, step: 1000, suffix: 'CAD' });
  const provinceRow = createTag('label', { class: 'fire-tracker-row', for: 'ft-province' });
  const provinceLabel = createTag('span', { class: 'fire-tracker-label' }, 'Province');
  provinceLabel.append(createTag('span', {
    class: 'fire-tracker-tip',
    title: 'Tax estimate uses federal and provincial progressive brackets with basic credits. Estimates only.',
  }, ' ?'));
  const provinceSelect = createTag('select', { id: 'ft-province' }, Object.keys(PROVINCIAL_TAX).map((name) => createTag('option', { value: name, selected: name === DEFAULTS.province ? 'selected' : undefined }, name)));
  provinceRow.append(provinceLabel, provinceSelect);
  essentials.append(provinceRow);
  refs['ft-province'] = provinceSelect;

  addNumber({ id: 'ft-current-assets', label: 'Current investable assets', value: DEFAULTS.currentAssets, step: 1000, suffix: 'CAD' });
  addNumber({ id: 'ft-monthly-expenses', label: 'Monthly expenses', value: DEFAULTS.monthlyExpenses, step: 50, suffix: 'CAD' });
  addNumber({ id: 'ft-monthly-savings', label: 'Monthly savings/investments', value: DEFAULTS.monthlySavings, step: 50, suffix: 'CAD' });
  addNumber({ id: 'ft-monthly-others', label: 'Others (monthly)', value: DEFAULTS.monthlyOtherContributions, step: 50, suffix: 'CAD' });

  const returnRange = buildRangeRow({
    id: 'ft-expected-return',
    label: 'Expected return',
    value: DEFAULTS.expectedReturn,
    min: -2,
    max: 12,
    step: 0.1,
  });
  essentials.append(returnRange.row);
  refs['ft-expected-return'] = returnRange.input;

  const inflationToggle = buildToggleRow('ft-inflation-adjusted', 'Inflation-adjusted return', true);
  essentials.append(inflationToggle.row);
  refs['ft-inflation-adjusted'] = inflationToggle.input;

  const inflationRange = buildRangeRow({
    id: 'ft-inflation-rate',
    label: 'Inflation rate',
    value: DEFAULTS.inflationRate,
    min: 0,
    max: 8,
    step: 0.1,
  });
  essentials.append(inflationRange.row);
  refs['ft-inflation-rate'] = inflationRange.input;

  const withdrawalRange = buildRangeRow({
    id: 'ft-withdrawal-rate',
    label: 'Withdrawal rate',
    value: DEFAULTS.withdrawalRate,
    min: 2.5,
    max: 6,
    step: 0.1,
    tooltip: 'FIRE number = annual spending need divided by withdrawal rate.',
  });
  essentials.append(withdrawalRange.row);
  refs['ft-withdrawal-rate'] = withdrawalRange.input;

  addNumber({ id: 'ft-debt-monthly', label: 'Debt payments (monthly)', value: DEFAULTS.debtMonthly, step: 50, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-fixed-monthly', label: 'Other fixed commitments (monthly)', value: DEFAULTS.fixedMonthly, step: 50, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-one-time', label: 'One-time retirement expenses', value: DEFAULTS.oneTimeExpenses, step: 500, suffix: 'CAD' }, optionalGroup);

  const safetyRange = buildRangeRow({
    id: 'ft-safety-margin',
    label: 'Safety margin',
    value: DEFAULTS.safetyMargin,
    min: 0,
    max: 40,
    step: 1,
  });
  optionalGroup.append(safetyRange.row);
  refs['ft-safety-margin'] = safetyRange.input;

  addNumber({ id: 'ft-lean-max', label: 'LeanFIRE max annual spend', value: DEFAULTS.leanMax, step: 1000, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-chubby-max', label: 'ChubbyFIRE max annual spend', value: DEFAULTS.chubbyMax, step: 1000, suffix: 'CAD' }, optionalGroup);

  optionalGroup.append(createTag('h3', { class: 'fire-tracker-subtitle' }, 'Net worth snapshot (optional)'));
  addNumber({ id: 'ft-cash', label: 'Cash', value: DEFAULTS.cash, step: 1000, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-tfsa', label: 'TFSA', value: DEFAULTS.tfsa, step: 1000, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-rrsp', label: 'RRSP', value: DEFAULTS.rrsp, step: 1000, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-non-registered', label: 'Non-registered', value: DEFAULTS.nonRegistered, step: 1000, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-other-assets', label: 'Other assets', value: DEFAULTS.otherAssets, step: 1000, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-home-value', label: 'Home value', value: DEFAULTS.homeValue, step: 1000, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-credit-card-debt', label: 'Credit card debt', value: DEFAULTS.creditCardDebt, step: 1000, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-mortgage-debt', label: 'Mortgage debt', value: DEFAULTS.mortgageDebt, step: 1000, suffix: 'CAD' }, optionalGroup);
  addNumber({ id: 'ft-other-debt', label: 'Other debt', value: DEFAULTS.otherDebt, step: 1000, suffix: 'CAD' }, optionalGroup);

  function getValues() {
    return {
      currentAge: refs['ft-current-age'].value,
      targetAge: refs['ft-target-age'].value,
      grossIncome: refs['ft-gross-income'].value,
      overrideAfterTax: refs['ft-override-after-tax'].checked,
      afterTaxIncome: refs['ft-after-tax-income'].value,
      province: refs['ft-province'].value,
      currentAssets: refs['ft-current-assets'].value,
      monthlyExpenses: refs['ft-monthly-expenses'].value,
      monthlySavings: refs['ft-monthly-savings'].value,
      monthlyOtherContributions: refs['ft-monthly-others'].value,
      expectedReturn: refs['ft-expected-return'].value,
      inflationAdjusted: refs['ft-inflation-adjusted'].checked,
      inflationRate: refs['ft-inflation-rate'].value,
      withdrawalRate: refs['ft-withdrawal-rate'].value,
      debtMonthly: refs['ft-debt-monthly'].value,
      fixedMonthly: refs['ft-fixed-monthly'].value,
      oneTimeExpenses: refs['ft-one-time'].value,
      safetyMargin: refs['ft-safety-margin'].value,
      leanMax: refs['ft-lean-max'].value,
      chubbyMax: refs['ft-chubby-max'].value,
      cash: refs['ft-cash'].value,
      tfsa: refs['ft-tfsa'].value,
      rrsp: refs['ft-rrsp'].value,
      nonRegistered: refs['ft-non-registered'].value,
      otherAssets: refs['ft-other-assets'].value,
      homeValue: refs['ft-home-value'].value,
      creditCardDebt: refs['ft-credit-card-debt'].value,
      mortgageDebt: refs['ft-mortgage-debt'].value,
      otherDebt: refs['ft-other-debt'].value,
    };
  }

  function render() {
    returnRange.valueEl.textContent = `${toNumber(returnRange.input.value, DEFAULTS.expectedReturn).toFixed(1)}%`;
    inflationRange.valueEl.textContent = `${toNumber(inflationRange.input.value, DEFAULTS.inflationRate).toFixed(1)}%`;
    withdrawalRange.valueEl.textContent = `${toNumber(withdrawalRange.input.value, DEFAULTS.withdrawalRate).toFixed(1)}%`;
    safetyRange.valueEl.textContent = `${Math.round(toNumber(safetyRange.input.value, DEFAULTS.safetyMargin))}%`;

    const manual = refs['ft-override-after-tax'].checked;
    refs['ft-after-tax-income'].disabled = !manual;
    refs['ft-province'].disabled = manual;
    refs['ft-inflation-rate'].disabled = !refs['ft-inflation-adjusted'].checked;

    const result = calculate(getValues());
    if (!manual) {
      refs['ft-after-tax-income'].value = String(Math.round(result.afterTaxIncome));
    }

    const yearsLabel = result.yearsToFire === null ? 'Beyond projection' : `${result.yearsToFire} years`;
    output.textContent = '';
    output.append(
      metric('FIRE number', money(result.fireNumber), 'Estimated portfolio needed to support your annual spending need.'),
      metric('Readiness', result.readiness, result.readiness === 'On Track' ? `Projected to reach target by age ${toNumber(refs['ft-target-age'].value, DEFAULTS.targetAge)}.` : 'Projected portfolio at target age is below your FIRE number.'),
      metric('FIRE style', result.style, result.isCoast ? 'Current assets can grow to your FIRE number by target age without new contributions.' : 'Style based on annual spending thresholds.'),
      metric('Years to FIRE', yearsLabel, result.yearsToFire === null ? 'At current assumptions, FIRE is outside the 80-year projection window.' : `Estimated retirement year: ${result.retirementYear}.`),
      metric('Projected portfolio at target age', money(result.projectedAtTargetAge), `Uses ${percent(result.adjustedAnnualReturn * 100, 2)} annual return over ${result.yearsToTargetAge} years.`),
      metric('Gap at target age', result.gapAtTargetAge > 0 ? money(result.gapAtTargetAge) : 'No gap', result.gapAtTargetAge > 0 ? 'Additional amount needed to hit your FIRE number by target age.' : 'Your target-age projection covers your FIRE number.'),
      metric('Savings rate', percent(result.savingsRate), `Annual savings: ${money(result.annualSavings)}.`),
      metric('Monthly surplus', money(result.monthlySurplus), 'After-tax monthly income minus expenses and fixed commitments.'),
      metric('Estimated effective tax', percent(result.estimatedEffectiveTaxRate), 'Federal + provincial progressive bracket estimate (before manual override).'),
      metric('Net worth snapshot', money(result.netWorth), `Assets ${money(result.totalAssets)} minus debts ${money(result.totalDebts)}.`),
    );
  }

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-preset');
      const preset = PRESETS[key];
      if (!preset) return;
      refs['ft-expected-return'].value = String(preset.expectedReturn);
      refs['ft-inflation-rate'].value = String(preset.inflationRate);
      refs['ft-withdrawal-rate'].value = String(preset.withdrawalRate);
      presetButtons.forEach((btn) => btn.classList.remove('is-active'));
      button.classList.add('is-active');
      render();
    });
  });

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  render();
}
