/**
 * useInsuranceCalc — Vue 3 composable для расчёта полиса Pro Life Platinum
 */

import { ref, computed } from 'vue';
import { ActuarialEngine } from '../core/actuarial.js';
import { PolicyCalculator } from '../core/calculator.js';
import { RidersCalculator } from '../core/riders.js';
import { PRODUCT_CONFIG } from '../config/product.js';
import { useI18n } from '../i18n/index.js';

// Группы рейдеров (radio в UI):
//   group1: один из { accidental_death, traffic_death }
//   group2: один из { premium_waiver, disability_any_lumpsum, disability_accident_lumpsum }
//   group3: набор чекбоксов с фикс. суммой
const GROUP1 = ['accidental_death', 'traffic_death'];
const GROUP2 = ['premium_waiver', 'disability_any_lumpsum', 'disability_accident_lumpsum'];
const GROUP3 = ['trauma', 'trauma_extra', 'temporary_disability', 'hospitalization', 'critical_illness'];

const ALLOWED_RIDERS = [...GROUP1, ...GROUP2, ...GROUP3];

const SA_LINKED_KEYS = [
  'accidental_death', 'traffic_death',
  'disability_any_lumpsum', 'disability_accident_lumpsum',
];

const FIXED_SUM_KEYS = [
  'trauma', 'trauma_extra', 'temporary_disability', 'hospitalization', 'critical_illness',
];

let _engine = null;
let _calculator = null;
let _ridersCalc = null;

function getEngine() {
  if (!_engine) {
    _engine = new ActuarialEngine(PRODUCT_CONFIG);
    _calculator = new PolicyCalculator(_engine, PRODUCT_CONFIG);
    _ridersCalc = new RidersCalculator(_engine, PRODUCT_CONFIG);
  }
  return { engine: _engine, calculator: _calculator, ridersCalc: _ridersCalc };
}

export function formatMoney(value, currency = '') {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
  return currency ? `${formatted} ${currency}` : formatted;
}

export function validateInputs(inputs) {
  const { t } = useI18n();
  const errors = [];
  const {
    dob,
    gender,
    term,
    frequency,
    mode,
    sumAssured,
    premium,
    enableAnnuity,
    annuityFrequency,
    annuityTerm,
    guaranteedPeriod,
  } = inputs;
  const { minTerm, maxTerm, maxExitAge, minAge, minPremium } = PRODUCT_CONFIG;

  if (!dob) {
    errors.push(t('errors.dobRequired'));
  } else {
    const age = PolicyCalculator.calculateAge(dob);
    if (age < 0) {
      errors.push(t('errors.dobInvalid'));
    } else if (age < minAge) {
      errors.push(t('errors.minAge', { age, min: minAge }));
    } else if (age + minTerm > maxExitAge) {
      errors.push(t('errors.ageTooHigh', { age, maxAge: maxExitAge - minTerm, max: maxExitAge }));
    }
    const exitAge = age + (term || 0);
    if (term && exitAge > maxExitAge) {
      errors.push(t('errors.exitAgeExceeds', { exitAge, max: maxExitAge }));
    }
  }

  if (!gender || !['male', 'female'].includes(gender)) {
    errors.push(t('errors.genderRequired'));
  }

  if (!term || term < minTerm || term > maxTerm) {
    errors.push(t('errors.termRange', { min: minTerm, max: maxTerm }));
  }

  if (!frequency) {
    errors.push(t('errors.frequencyRequired'));
  }

  if (mode === 'sa_to_premium') {
    if (!sumAssured || sumAssured <= 0) {
      errors.push(t('errors.sumAssuredRequired'));
    }
  } else if (!premium || premium <= 0) {
    errors.push(t('errors.premiumRequired'));
  }

  // Минимальный взнос по периодичности — только в режиме premium_to_sa
  if (mode === 'premium_to_sa' && frequency && frequency !== 'single') {
    const min = minPremium?.[frequency] ?? 0;
    if (min > 0 && premium && premium < min) {
      errors.push(t('errors.minPremium', {
        frequency: t(`frequency.${frequency}`),
        min: formatMoney(min, '₸'),
      }));
    }
  }

  if (enableAnnuity) {
    if (!annuityFrequency) errors.push(t('errors.annuityFrequencyRequired'));
    if (!annuityTerm || annuityTerm <= 0) errors.push(t('errors.annuityTermRequired'));
    if (guaranteedPeriod === undefined || guaranteedPeriod === null || guaranteedPeriod < 0) {
      errors.push(t('errors.guaranteedPeriodRequired'));
    }
    if ((annuityTerm || 0) > 0 && guaranteedPeriod > annuityTerm) {
      errors.push(t('errors.guaranteedPeriodMax'));
    }
  }

  return errors;
}

export function useInsuranceCalc() {
  const result = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const errors = ref([]);

  const hasResult = computed(() => result.value !== null);
  const isValid = computed(() => errors.value.length === 0);

  function calculate(inputs) {
    errors.value = validateInputs(inputs);
    if (errors.value.length > 0) {
      error.value = errors.value.join('; ');
      result.value = null;
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const { calculator, ridersCalc } = getEngine();
      const {
        dob,
        gender,
        term,
        frequency,
        mode = 'sa_to_premium',
        sumAssured,
        premium,
        enableAnnuity = false,
        annuityFrequency = 'annual',
        annuityTerm = 0,
        guaranteedPeriod = 0,
        riders: ridersSelection = {},
        kMult = 1.0,
        lAdd = 0.0,
      } = inputs;

      const allowedRidersSelection = Object.fromEntries(
        Object.entries(ridersSelection).filter(([key]) => ALLOWED_RIDERS.includes(key))
      );

      const effectiveAnnuityTerm = enableAnnuity ? annuityTerm : 0;
      const effectiveGuaranteedPeriod = enableAnnuity ? guaranteedPeriod : 0;

      const x = PolicyCalculator.calculateAge(dob);
      const t = frequency === 'single' ? 1 : term;

      // SA-linked допы (без waiver — он считается отдельно)
      const saLinkedKeys = SA_LINKED_KEYS
        .filter((k) => allowedRidersSelection[k]?.enabled);

      const fixedRiders = FIXED_SUM_KEYS
        .filter((k) => allowedRidersSelection[k]?.enabled)
        .map((k) => [k, allowedRidersSelection[k].sum ?? 0])
        .filter(([, s]) => s > 0);

      const hasWaiver = !!allowedRidersSelection.premium_waiver?.enabled;

      let baseResult = calculator.fullCalculation({
        dob,
        gender,
        term,
        frequency,
        mode,
        sumAssured,
        premium,
        annuityFrequency,
        annuityTerm: effectiveAnnuityTerm,
        guaranteedPeriod: effectiveGuaranteedPeriod,
        saLinkedKeys,
        fixedRiders,
        hasWaiver,
        kMult,
        lAdd,
      }, ridersCalc);

      let finalResult = baseResult;
      if (mode === 'premium_to_sa' && (saLinkedKeys.length > 0 || fixedRiders.length > 0 || hasWaiver)) {
        finalResult = calculator.calculateSumAssuredWithRiders(
          dob, gender, term, frequency, premium,
          ridersCalc, saLinkedKeys, fixedRiders, hasWaiver, kMult, lAdd,
        );

        const reserves = calculator.calculateReserves(
          dob, gender, term, frequency, finalResult.sumAssured, kMult, lAdd,
        );
        const annuity = calculator.calculateAnnuity(
          x, term, finalResult.sumAssured,
          annuityFrequency, effectiveAnnuityTerm, effectiveGuaranteedPeriod,
          gender, frequency, term, kMult, lAdd,
        );

        finalResult = {
          ...finalResult,
          reserves,
          annuity,
          annuityPayment: annuity.annuityPayment,
        };
      }

      const finalRidersResult = ridersCalc.calculateAllRiders({
        x,
        n: term,
        t,
        gender,
        frequency,
        sumAssured: finalResult.sumAssured,
        BPMain: finalResult.BP_rate,
        ridersSelection: allowedRidersSelection,
        kMult,
        lAdd,
      });

      const totalRiderPremium = ALLOWED_RIDERS.reduce((sum, key) => {
        const rider = finalRidersResult.riders[key];
        return sum + (rider?.riderPremium ?? 0);
      }, 0);

      const totalPremium = finalResult.grossPremium + totalRiderPremium;
      const maturityAmount = finalResult.sumAssured;

      // Страховая сумма по доп. покрытию не может превышать СС по основному.
      const { t: ti } = useI18n();
      const finalSA = finalResult.sumAssured;
      const hasRiderOverSA = Object.values(allowedRidersSelection).some(
        (r) => r?.enabled && typeof r.sum === 'number' && r.sum > finalSA,
      );
      if (hasRiderOverSA) {
        errors.value = [...errors.value, ti('errors.riderSumExceedsSA')];
        error.value = errors.value.join('; ');
      }

      result.value = {
        ...finalResult,
        riders: finalRidersResult.riders,
        totalRiderPremium,
        totalPremium,
        maturityAmount,
        annuityPayment: enableAnnuity ? finalResult.annuityPayment : 0,
        calcDate: new Date().toISOString().slice(0, 10),
      };
    } catch (e) {
      error.value = `Ошибка расчёта: ${e.message}`;
      result.value = null;
      console.error(e);
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    result.value = null;
    error.value = null;
    errors.value = [];
    loading.value = false;
  }

  return {
    result,
    loading,
    error,
    errors,
    hasResult,
    isValid,
    calculate,
    reset,
    GROUP1,
    GROUP2,
    GROUP3,
    ALLOWED_RIDERS,
  };
}

export { GROUP1, GROUP2, GROUP3, ALLOWED_RIDERS };
