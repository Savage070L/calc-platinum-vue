<template>
  <div class="input-form">
    <h2 class="form-title">{{ t('dataHeader') }}</h2>

    <div class="form-grid">
      <!-- Дата рождения | Пол -->
      <div class="form-group dob-group" :class="{ 'attention-next': needsDob }">
        <label for="dob" class="label-row">
          {{ t('form.dob') }}
        </label>
        <!-- Desktop / планшет: нативный date-picker -->
        <input
          id="dob"
          type="date"
          v-model="local.dob"
          :max="todayIso"
          min="1900-01-01"
          class="neu-input dob-input-desktop"
        />
        <!-- Mobile: ручной ввод цифр с маской ДД.ММ.ГГГГ -->
        <input
          id="dob-mobile"
          type="text"
          inputmode="numeric"
          autocomplete="bday"
          placeholder="ДД.ММ.ГГГГ"
          :value="dobMasked"
          @input="onDobMaskedInput"
          @blur="onDobMaskedBlur"
          maxlength="10"
          class="neu-input dob-input-mobile"
          aria-label="Дата рождения"
        />
        <span v-if="needsDob" class="next-pill">{{ t('form.nextStepDob') }}</span>
      </div>

      <div class="form-group" :class="{ 'attention-next': needsGender }">
        <label class="label-row">
          {{ t('form.gender') }}
          <span v-if="needsGender" class="next-pill">{{ t('form.nextStepGender') }}</span>
        </label>
        <div class="radio-group">
          <label class="radio-pill">
            <input type="radio" v-model="local.gender" value="male" />
            <span>{{ t('form.male') }}</span>
          </label>
          <label class="radio-pill">
            <input type="radio" v-model="local.gender" value="female" />
            <span>{{ t('form.female') }}</span>
          </label>
        </div>
      </div>

      <!-- Режим расчёта | Валюта расчёта | Курс доллара — в одну строку -->
      <div class="three-col-row full-width">
        <div class="form-group three-col-item three-col-item--wide">
          <label for="mode" class="label-row">{{ t('form.mode') }} <InfoTooltip v-bind="tip('mode')" /></label>
          <select id="mode" v-model="local.mode" class="neu-input select-green">
            <option value="premium_to_sa">{{ t('form.modePremiumToSa') }}</option>
            <option value="sa_to_premium">{{ t('form.modeSaToPremium') }}</option>
          </select>
        </div>

        <!-- Pro Life Platinum — продукт только в долларах: переключатель валюты убран,
             ввод всегда в USD (currencyMode зафиксирован в 'USD'). -->

        <div class="form-group three-col-item three-col-item--slim">
          <label class="label-row">
            {{ t('form.usdRate') }}
            <button
              class="cw-refresh-label"
              type="button"
              :disabled="cwRef?.isLoading"
              :title="cwRef?.isManual ? t('form.resetRate') : t('form.refreshRate')"
              @click="cwRef?.fetchRate()"
            >
              <span :class="{ 'cw-spin': cwRef?.isLoading }">↻</span>
            </button>
          </label>
          <CurrencyWidget ref="cwRef" />
        </div>
      </div>

      <!-- Сумма | Периодичность — в одну строку -->
      <div class="two-col-row full-width">
        <div class="form-group two-col-item" v-if="local.mode === 'sa_to_premium'" :class="{ 'attention-next': needsAmount }">
          <label for="sumAssured" class="label-row">
            {{ t('form.sumAssured') }} ({{ isUsdInput ? 'USD' : 'KZT' }})
            <InfoTooltip v-bind="tip('sumAssured')" />
          </label>
          <div class="input-wrap">
            <span v-if="isUsdInput && !needsAmount" class="input-affix input-prefix">$</span>
            <input
              ref="sumAssuredInput"
              id="sumAssured"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              :value="needsAmount ? t('form.nextStepAmount') : displaySumAssured"
              :class="['neu-input', { 'hint-mode': needsAmount }]"
              @focus="markAmountTouched"
              @input="(e) => { markAmountTouched(); onSumInput(e); maybeAutoCommit(e); }"
              @blur="commitAmount"
              @keydown.enter="commitAmount"
            />
            <span v-if="!isUsdInput && !needsAmount" class="input-affix input-suffix">₸</span>
          </div>
        </div>

        <div class="form-group two-col-item" v-if="local.mode === 'premium_to_sa'" :class="{ 'attention-next': needsAmount }">
          <label for="premium" class="label-row">
            {{ t('form.premium') }} ({{ isUsdInput ? 'USD' : 'KZT' }})
            <InfoTooltip v-bind="tip('premium')" />
          </label>
          <div class="input-wrap">
            <span v-if="isUsdInput && !needsAmount" class="input-affix input-prefix">$</span>
            <input
              ref="premiumInput"
              id="premium"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              :value="needsAmount ? t('form.nextStepAmount') : displayPremium"
              :class="['neu-input', { 'hint-mode': needsAmount }]"
              @focus="markAmountTouched"
              @input="(e) => { markAmountTouched(); onPremInput(e); maybeAutoCommit(e); }"
              @blur="commitAmount"
              @keydown.enter="commitAmount"
            />
            <span v-if="!isUsdInput && !needsAmount" class="input-affix input-suffix">₸</span>
          </div>
        </div>

        <div class="form-group two-col-item">
          <label class="label-row">
            {{ t('form.frequency') }}
            <InfoTooltip v-bind="tip('frequency')" />
          </label>
          <!-- Platinum: всегда единовременный взнос — статичное поле, не выбор -->
          <div class="neu-input static-field">{{ t('form.freq.single') }}</div>
        </div>
      </div>

      <!-- Срок страхования — слайдер, на всю ширину -->
      <div class="form-group term-group full-width" :class="{ 'attention-next': needsTerm }">
        <div class="term-header">
          <label class="label-row">
            {{ t('form.term') }}
            <InfoTooltip v-bind="tip('term')" />
            <span v-if="needsTerm" class="next-pill">{{ t('form.nextStepTerm') }}</span>
          </label>
          <span class="term-badge">
            <input
              type="text"
              inputmode="numeric"
              :value="termInteracted ? local.term : ''"
              :style="{ width: termInputWidth }"
              placeholder="__"
              @focus="onTermBadgeFocus"
              @click="onTermBadgeClick"
              @input="onTermBadgeInput"
              @blur="onTermBadgeBlur"
              @keydown.enter.prevent="$event.target.blur()"
              class="term-badge-input"
              aria-label="Срок страхования"
            />
            <span class="term-badge-word">{{ termWord }}</span>
          </span>
        </div>
        <input
          type="range"
          v-model.number="local.term"
          :min="minTerm"
          :max="maxTermAllowed"
          :style="termSliderStyle"
          class="term-slider"
          @mousedown="markTermInteraction"
          @touchstart="markTermInteraction"
          @keydown="markTermInteraction"
          @input="markTermInteraction"
          @change="markTermTouched"
          @mouseup="markTermTouched"
          @touchend="markTermTouched"
          @keyup="markTermTouched"
        />
      </div>

    </div>

    <div class="annuity-toggle-wrap">
      <label class="annuity-toggle-label">
        <span class="toggle-icon-wrap">
          <input type="checkbox" v-model="local.enableAnnuity" class="annuity-chk" />
          <span class="custom-chk"></span>
        </span>
        <span class="toggle-text">{{ t('form.enableAnnuity') }}</span>
        <InfoTooltip v-bind="tip('annuity')" />
        <span class="toggle-arrow">{{ local.enableAnnuity ? '▲' : '▼' }}</span>
      </label>
    </div>

    <div v-if="local.enableAnnuity" class="form-grid annuity-grid">
      <!-- Периодичность выплат -->
      <div class="form-group full-width">
        <label for="annuityFrequency" class="label-row">{{ t('form.annuityFrequency') }} <InfoTooltip v-bind="tip('annuityFrequency')" /></label>
        <select id="annuityFrequency" v-model="local.annuityFrequency" class="neu-input select-green" required>
          <option value="annual">{{ t('form.annuityFreq.annual') }}</option>
          <option value="semiannual">{{ t('form.annuityFreq.semiannual') }}</option>
          <option value="quarterly">{{ t('form.annuityFreq.quarterly') }}</option>
          <option value="monthly">{{ t('form.annuityFreq.monthly') }}</option>
        </select>
      </div>

      <!-- Срок выплат — слайдер -->
      <div class="form-group term-group full-width">
        <div class="term-header">
          <label class="label-row">{{ t('form.annuityTerm') }} <InfoTooltip v-bind="tip('annuityTerm')" /></label>
          <span class="term-badge">{{ pluralYears(local.annuityTerm) }}</span>
        </div>
        <input
          type="range"
          v-model.number="local.annuityTerm"
          min="1"
          max="50"
          :style="annuityTermSliderStyle"
          class="term-slider"
        />
      </div>

      <!-- Гарантированный период — слайдер -->
      <div class="form-group term-group full-width">
        <div class="term-header">
          <label class="label-row">{{ t('form.guaranteedPeriod') }} <InfoTooltip v-bind="tip('guaranteedPeriod')" /></label>
          <span class="term-badge">{{ pluralYears(local.guaranteedPeriod) }}</span>
        </div>
        <input
          type="range"
          v-model.number="local.guaranteedPeriod"
          min="0"
          :max="local.annuityTerm"
          :style="guaranteedPeriodSliderStyle"
          class="term-slider"
        />
        <span v-if="local.guaranteedPeriod === 0" class="hint">{{ t('form.noGuaranteedPeriod') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { PolicyCalculator } from '../core/calculator.js';
import { PRODUCT_CONFIG } from '../config/product.js';
import InfoTooltip from './InfoTooltip.vue';
import CurrencyWidget from './CurrencyWidget.vue';
import { useCurrencyRate } from '../composables/useCurrencyRate.js';
import { useI18n } from '../i18n/index.js';

const { t, tip, pluralYears } = useI18n();
const { currencyMode, usdRate } = useCurrencyRate();

const props = defineProps({ modelValue: { type: Object, required: true } });
const emit = defineEmits(['update:modelValue', 'term-touched', 'amount-committed']);

function commitAmount(e) {
  const v = e?.target?.value;
  if (typeof v === 'string' && v.trim()) e.target.blur?.();
  emit('amount-committed');
}

// Auto-advance to the next step once the user typed at least 2 digits.
function maybeAutoCommit(e) {
  const digits = String(e?.target?.value || '').replace(/\D/g, '');
  if (digits.length >= 2) emit('amount-committed');
}
const { minTerm, maxTerm, maxExitAge } = PRODUCT_CONFIG;

const local = ref({ ...props.modelValue });

const todayIso = computed(() => new Date().toISOString().slice(0, 10));

// ── Мобильный ввод даты рождения (маска ДД.ММ.ГГГГ) ──────────────────────────
// На мобильных native <input type="date"> неудобен — переключаемся
// на text-input с маской из цифр.
const dobMasked = computed(() => {
  const iso = local.value.dob;
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
});

function onDobMaskedInput(e) {
  // Оставляем только цифры, ограничиваем 8 знаков и расставляем точки.
  const digits = String(e.target.value).replace(/\D/g, '').slice(0, 8);
  let masked = '';
  if (digits.length >= 1) masked  = digits.slice(0, 2);
  if (digits.length >= 3) masked += '.' + digits.slice(2, 4);
  if (digits.length >= 5) masked += '.' + digits.slice(4, 8);
  e.target.value = masked;

  // При полностью введённой дате — конвертируем в ISO и кладём в local.dob
  if (digits.length === 8) {
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yy = digits.slice(4, 8);
    const dNum = +dd, mNum = +mm, yNum = +yy;
    if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12 && yNum >= 1900) {
      // Проверяем, что дата ВАЛИДНА (например, не «31 февраля»).
      const dt = new Date(yNum, mNum - 1, dNum);
      if (dt.getFullYear() === yNum
          && dt.getMonth() === mNum - 1
          && dt.getDate() === dNum) {
        local.value.dob = `${yy}-${mm}-${dd}`;
        return;
      }
    }
    local.value.dob = '';   // невалидная — сбрасываем
  } else {
    local.value.dob = '';   // не полная — пусто
  }
}

function onDobMaskedBlur() {
  // Частичный ввод оставляем как есть: local.dob уже пуст, ошибка покажется ниже.
}

// Visual cue: sequentially highlight the next required field
// (DOB → Gender → Term → Frequency → Amount). A first-time user clearly
// sees what to fill in to get a minimum calculation.
const touched = ref({ term: false, amount: false });

// If user starts over (clears DOB), reset touch state.
watch(() => local.value.dob, (v) => {
  if (!v) touched.value = { term: false, amount: false };
});
const currentStep = computed(() => {
  const v = local.value;
  if (!v.dob) return 'dob';
  if (!v.gender) return 'gender';
  const amountFilled = v.mode === 'premium_to_sa'
    ? (v.premium > 0)
    : (v.sumAssured > 0);
  if (!touched.value.amount && !amountFilled) return 'amount';
  if (!touched.value.amount && amountFilled) return 'amount';
  if (!v.frequency) return 'frequency';
  if (!touched.value.term) return 'term';
  return null;
});

const needsDob       = computed(() => currentStep.value === 'dob');
const needsGender    = computed(() => currentStep.value === 'gender');
const needsTerm      = computed(() => currentStep.value === 'term');
const needsFrequency = computed(() => currentStep.value === 'frequency');
const needsAmount    = computed(() => currentStep.value === 'amount');

function markTermTouched()   { touched.value.term = true; emit('term-touched'); }
// Local-only flag: any first interaction with the slider or badge.
// Used to switch the badge from "___ лет" placeholder to the actual value.
const termInteracted = ref(false);
function markTermInteraction() { termInteracted.value = true; }
function markAmountTouched() { touched.value.amount = true; }

// Editable term badge: only the word ("год"/"года"/"лет"/"жыл") next to the input.
const termWord = computed(() => {
  const full = pluralYears(local.value.term);
  return full.replace(/^\d+\s*/, '');
});
const termInputWidth = computed(() => {
  const len = termInteracted.value
    ? (String(local.value.term ?? '').length || 1)
    : 2; // placeholder "__" reserves 2 char-widths
  return `${Math.max(len, 1) * 0.75 + 0.4}em`;
});

function placeCaretAtEnd(input) {
  if (!input || typeof input.setSelectionRange !== 'function') return;
  // Defer so it runs after the browser's default click-based caret placement.
  requestAnimationFrame(() => {
    const len = input.value.length;
    input.setSelectionRange(len, len);
  });
}

function onTermBadgeFocus(e) {
  markTermInteraction();
  placeCaretAtEnd(e.target);
}
function onTermBadgeClick(e) {
  // Re-clicks while already focused — keep caret at the end too.
  placeCaretAtEnd(e.target);
}
function onTermBadgeInput(e) {
  markTermInteraction();
  const raw = e.target.value.replace(/\D/g, '');
  if (raw === '') { e.target.value = ''; return; }
  let num = parseInt(raw, 10);
  if (num > maxTermAllowed.value) num = maxTermAllowed.value;
  e.target.value = String(num);
  local.value.term = num;
}
function onTermBadgeBlur(e) {
  let num = parseInt(e.target.value, 10);
  if (isNaN(num)) num = local.value.term;
  if (num < minTerm) num = minTerm;
  if (num > maxTermAllowed.value) num = maxTermAllowed.value;
  local.value.term = num;
  e.target.value = String(num);
  markTermTouched();
}

// ── DOM refs ─────────────────────────────────────
const sumAssuredInput = ref(null);
const premiumInput   = ref(null);
const cwRef          = ref(null);

// ── Number formatting ─────────────────────────────
function fmtNum(n) {
  if (!n) return '';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

const isUsdInput = computed(() => currencyMode.value === 'USD' && !!usdRate.value);

const usdInputVal = ref({ sumAssured: null, premium: null });

const displaySumAssured = computed(() => {
  if (isUsdInput.value) {
    const usd = usdInputVal.value.sumAssured ?? (local.value.sumAssured ? Math.round(local.value.sumAssured / usdRate.value) : 0);
    return fmtNum(usd);
  }
  return fmtNum(local.value.sumAssured);
});
const displayPremium = computed(() => {
  if (isUsdInput.value) {
    const usd = usdInputVal.value.premium ?? (local.value.premium ? Math.round(local.value.premium / usdRate.value) : 0);
    return fmtNum(usd);
  }
  return fmtNum(local.value.premium);
});

function makeNumHandler(field) {
  return function (e) {
    const input = e.target;
    const cursor = input.selectionStart;
    const digitsBeforeCursor = input.value.slice(0, cursor).replace(/[^\d]/g, '').length;
    const allDigits = input.value.replace(/[^\d]/g, '');
    const inputNum = parseInt(allDigits, 10) || 0;
    if (isUsdInput.value && usdRate.value) {
      usdInputVal.value[field] = inputNum;
      local.value[field] = Math.round(inputNum * usdRate.value);
    } else {
      usdInputVal.value[field] = null;
      local.value[field] = inputNum;
    }
    const formatted = fmtNum(inputNum);
    input.value = formatted;
    nextTick(() => {
      const fmt = input.value;
      let digitsSeen = 0, newPos = fmt.length;
      for (let i = 0; i < fmt.length; i++) {
        if (/\d/.test(fmt[i])) {
          digitsSeen++;
          if (digitsSeen === digitsBeforeCursor) { newPos = i + 1; break; }
        }
      }
      if (digitsBeforeCursor === 0) newPos = 0;
      input.setSelectionRange(newPos, newPos);
    });
  };
}

const onSumInput  = makeNumHandler('sumAssured');
const onPremInput = makeNumHandler('premium');

// ── Lifecycle & watchers ──────────────────────────────────
watch(local, (val) => {
  emit('update:modelValue', { ...val });
}, { deep: true });

watch([currencyMode, usdRate], ([newMode, newRate], [oldMode]) => {
  if (newMode === 'USD' && newRate) {
    if (oldMode !== 'USD') {
      usdInputVal.value.sumAssured = local.value.sumAssured ? Math.round(local.value.sumAssured / newRate) : 0;
      usdInputVal.value.premium    = local.value.premium    ? Math.round(local.value.premium    / newRate) : 0;
    } else {
      if (usdInputVal.value.sumAssured !== null)
        local.value.sumAssured = Math.round(usdInputVal.value.sumAssured * newRate);
      if (usdInputVal.value.premium !== null)
        local.value.premium    = Math.round(usdInputVal.value.premium    * newRate);
    }
  } else if (newMode === 'KZT') {
    usdInputVal.value.sumAssured = null;
    usdInputVal.value.premium    = null;
  }
  nextTick(() => {
    if (sumAssuredInput.value) sumAssuredInput.value.value = displaySumAssured.value;
    if (premiumInput.value)    premiumInput.value.value    = displayPremium.value;
  });
});

watch(() => props.modelValue, (val) => {
  Object.assign(local.value, val);
}, { deep: true });

// ── Computed ──────────────────────────────────────────────
const currentAge     = computed(() => local.value.dob ? PolicyCalculator.calculateAge(local.value.dob) : null);
const exitAge        = computed(() => currentAge.value && local.value.term ? currentAge.value + local.value.term : null);
const maxTermAllowed = computed(() => currentAge.value ? Math.min(maxTerm, maxExitAge - currentAge.value) : maxTerm);

watch(maxTermAllowed, (max) => {
  if (local.value.term > max) {
    local.value.term = Math.max(minTerm, max);
  }
});

const termSliderStyle = computed(() => {
  const min = minTerm, max = maxTermAllowed.value, val = local.value.term;
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  return {
    background: `linear-gradient(to right, #5C8E2F 0%, #A1C95A ${pct}%, rgba(255,255,255,0.22) ${pct}%, rgba(255,255,255,0.14) 100%)`,
  };
});

const annuityTermSliderStyle = computed(() => {
  const min = 1, max = 50, val = local.value.annuityTerm || 1;
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  return {
    background: `linear-gradient(to right, #5C8E2F 0%, #A1C95A ${pct}%, rgba(255,255,255,0.22) ${pct}%, rgba(255,255,255,0.14) 100%)`,
  };
});

const guaranteedPeriodSliderStyle = computed(() => {
  const min = 0, max = local.value.annuityTerm || 1, val = local.value.guaranteedPeriod || 0;
  const pct = max > 0 ? (val / max) * 100 : 0;
  return {
    background: `linear-gradient(to right, #5C8E2F 0%, #A1C95A ${pct}%, rgba(255,255,255,0.22) ${pct}%, rgba(255,255,255,0.14) 100%)`,
  };
});
</script>

<style scoped>
.form-title {
  font-size: 15px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 2px;
  color: var(--text-main);
  margin-bottom: 16px; padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
  text-align: center;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.full-width { grid-column: 1 / -1; }

.three-col-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-end;
}
.three-col-row .label-row {
  min-height: 30px;
  display: flex;
  align-items: flex-end;
}
.three-col-item {
  flex: 1 1 160px;
  min-width: 0;
}
.three-col-item--wide {
  flex: 1.07 1 160px;
}
.three-col-item--narrow {
  flex: 1.05 1 170px;
}
.three-col-item--slim {
  flex: 0.85 1 140px;
}

.two-col-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-end;
}
.two-col-row .label-row {
  min-height: 30px;
  display: flex;
  align-items: flex-end;
}
.two-col-item {
  flex: 1 1 200px;
  min-width: 0;
}

.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label {
  font-size: 12px; font-weight: 600;
  color: var(--text-light);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.label-row {
  display: flex; align-items: center; gap: 5px;
  flex-wrap: wrap;
  row-gap: 4px;
}

.cw-refresh-label {
  background: none; border: none; color: rgba(255,255,255,0.5);
  cursor: pointer; font-size: 14px; padding: 0 2px;
  transition: color 0.2s;
}
.cw-refresh-label:hover { color: #A1C95A; }
.cw-refresh-label:disabled { opacity: 0.3; cursor: not-allowed; }
@keyframes cw-spin-anim { to { transform: rotate(360deg); } }
.cw-spin { display: inline-block; animation: cw-spin-anim 0.8s linear infinite; }

/* ── Inputs ─────────────────────────── */
.neu-input {
  width: 100%; padding: 10px 13px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 12px; font-weight: 600;
  background: var(--surface);
  box-shadow: var(--shadow-in);
  color: var(--text-main);
  outline: none;
  transition: border-color 0.2s ease;
  height: 42px;
  box-sizing: border-box;
  font-family: inherit;
}
.neu-input:focus { border-color: var(--accent); box-shadow: var(--shadow-btn-press); }
/* Статичное поле (Platinum: периодичность всегда «единовременный») —
   вид как у обычного тёмного .neu-input, но без выпадающего списка и выбора */
.neu-input.static-field {
  display: flex;
  align-items: center;
  cursor: default;
  user-select: none;
}
.neu-input.hint-mode {
  color: rgba(255,255,255,0.55);
  -webkit-text-fill-color: rgba(255,255,255,0.55);
  font-style: italic;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  animation: hintShift 1.1s ease-in-out infinite;
}
@keyframes hintShift {
  0%, 100% {
    padding-left: 13px;
    color: rgba(255,255,255,0.55);
    -webkit-text-fill-color: rgba(255,255,255,0.55);
  }
  50% {
    padding-left: 22px;
    color: rgba(255,255,255,0.85);
    -webkit-text-fill-color: rgba(255,255,255,0.85);
  }
}
select#frequency.placeholder-shown { font-weight: 400; font-size: 12px; }
select#frequency:not(.placeholder-shown) { font-weight: 600; font-size: 14px; }
select#annuityFrequency { font-size: 14px; font-weight: 600; }

/* ── Brand-green selects (frequency / mode / currency) ─── */
select.select-green {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: transparent;
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='white' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>"),
    linear-gradient(135deg, #A1C95A 0%, #5C8E2F 100%);
  background-repeat: no-repeat, no-repeat;
  background-position: right 14px center, center;
  background-size: 12px 8px, auto;
  color: #FFFFFF;
  font-weight: 700;
  border: none;
  padding-right: 36px;
  cursor: pointer;
}
select.select-green:focus {
  border: none;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.35);
}
select.select-green.placeholder-shown {
  color: rgba(255,255,255,0.85);
}
select.select-green option {
  background: #FFFFFF;
  color: #1A2E3F;
  font-weight: 600;
}
select.select-green option:disabled {
  color: rgba(26,46,63,0.4);
}

/* По умолчанию (desktop / планшет) показываем native date-picker, мобильный input скрыт */
.dob-input-mobile { display: none; }
.dob-input-desktop { display: block; }

@media (max-width: 720px) {
  /* На мобильных native date-picker неудобен — показываем text-input с маской */
  .dob-input-desktop { display: none; }
  .dob-input-mobile  { display: block; }
}

input[type="date"].neu-input {
  font-size: 14px; font-weight: 600;
  color-scheme: dark;
}
input[type="date"].neu-input::-webkit-calendar-picker-indicator {
  filter: invert(0.85);
  cursor: pointer;
  opacity: 0.7;
}
input[type="date"].neu-input::-webkit-calendar-picker-indicator:hover { opacity: 1; }

.input-wrap {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 10px 13px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow-in);
  transition: border-color 0.2s ease;
  height: 42px;
  box-sizing: border-box;
}
.input-wrap:focus-within { border-color: var(--accent); box-shadow: var(--shadow-btn-press); }
.input-wrap .neu-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  font-size: 16px;
  font-weight: 700;
}
.input-wrap .neu-input:focus { border: none; box-shadow: none; }
.input-affix {
  font-size: 14px; font-weight: 600; color: #E7F4FD; flex-shrink: 0;
}

/* ── Radio pills ─────────────────────── */
.radio-group { display: flex; gap: 7px; }
.mode-toggle { display: flex; gap: 7px; }
.radio-pill { flex: 1; position: relative; }
.radio-pill input { display: none; }
.radio-pill span {
  display: flex; align-items: center; justify-content: center;
  text-align: center; white-space: nowrap;
  padding: 10px 14px; border-radius: 10px;
  cursor: pointer; font-size: 12px; font-weight: 600;
  background: var(--surface);
  box-shadow: var(--shadow-btn);
  color: var(--text-light);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
  height: 42px;
}
.radio-pill input:checked + span {
  background: linear-gradient(135deg, #A1C95A, #5C8E2F);
  color: white; border: none;
}
.pill-faded span { opacity: 0.45; }

/* ── Term slider ─────────────────────── */
.term-header { display: flex; align-items: center; justify-content: space-between; padding-right: 4px; }
.term-badge {
  background: var(--surface, #294A69);
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 700;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(95,189,245,0.30));
  height: 42px;
  min-width: 110px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: 'SF Mono', 'Menlo', monospace;
}
.term-badge:focus-within {
  border-color: var(--accent, #79B740);
}
.term-badge-input {
  all: unset;
  font-family: inherit;
  font-size: 16px;
  font-weight: 700;
  color: #FFFFFF;
  -webkit-text-fill-color: #FFFFFF;
  text-align: right;
  cursor: text;
  caret-color: #FFFFFF;
  min-width: 1ch;
  box-sizing: content-box;
  background: transparent;
  border: none;
  outline: none;
}
.term-badge-input:focus {
  outline: none;
  box-shadow: none;
  background: transparent;
}
.term-badge-input::selection {
  background: rgba(95,189,245,0.30);
  color: #FFFFFF;
}
.term-badge-input::placeholder {
  color: rgba(255,255,255,0.40);
  font-weight: 700;
  letter-spacing: 0.05em;
  -webkit-text-fill-color: rgba(255,255,255,0.40);
}
.term-badge-input::-moz-placeholder { color: rgba(255,255,255,0.40); opacity: 1; }
.term-badge-input::-webkit-outer-spin-button,
.term-badge-input::-webkit-inner-spin-button {
  -webkit-appearance: none; margin: 0;
}
.term-badge-word {
  color: rgba(255,255,255,0.70);
  font-weight: 600;
  font-size: 14px;
}
.term-slider {
  margin-top: 12px;
  width: 100%;
  height: 8px;
  border-radius: 6px;
}
.term-slider::-webkit-slider-thumb {
  width: 26px; height: 26px;
  background: linear-gradient(135deg, #FFFFFF 0%, #DCEEFF 100%);
  border: 3px solid #A1C95A;
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
}
.term-slider::-moz-range-thumb {
  width: 26px; height: 26px;
  background: linear-gradient(135deg, #FFFFFF 0%, #DCEEFF 100%);
  border: 3px solid #A1C95A;
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
}
.term-slider::-webkit-slider-thumb:hover,
.term-slider::-moz-range-thumb:hover {
  border-color: #79B740;
  transform: scale(1.1);
}

/* ── Hints ───────────────────────────── */
.hint { font-size: 12px; color: var(--text-light); }
.hint-warn { color: #ff5252; }


/* ── Annuity toggle ─────────────────────── */
.annuity-toggle-wrap { margin-top: 16px; }
.annuity-toggle-label {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 15px;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid rgba(74,114,149,0.22);
  background: rgba(74,114,149,0.07);
  transition: background 0.2s ease, border-color 0.2s ease;
  user-select: none;
}
.annuity-toggle-label:hover {
  background: rgba(74,114,149,0.12);
  border-color: rgba(74,114,149,0.4);
}
.toggle-icon-wrap { position: relative; width: 18px; height: 18px; flex-shrink: 0; }
.annuity-chk { position: absolute; opacity: 0; width: 0; height: 0; }
.custom-chk {
  display: block; width: 18px; height: 18px;
  border-radius: 5px;
  border: none;
  background: rgba(255,255,255,0.15);
  transition: all 0.2s ease;
  position: relative;
}
.annuity-chk:checked ~ .custom-chk {
  background: linear-gradient(135deg, #A1C95A, #5C8E2F);
}
.annuity-chk:checked ~ .custom-chk::after {
  content: '✓';
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px; color: white; font-weight: 800;
}
.toggle-text {
  font-size: 13px; font-weight: 700;
  color: #5FBDF5;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex: 1;
}
.toggle-arrow { font-size: 10px; color: #5FBDF5; }

.annuity-grid {
  margin-top: 12px; padding: 12px; border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--surface); box-shadow: var(--shadow-in);
}

/* ── Attention prompt: highlight the next required field ── */
.attention-next .neu-input,
.attention-next .input-wrap {
  border-color: #A1C95A;
  border-radius: 10px;
  animation: attentionPulse 1.1s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(161,201,90,0.55);
}
.attention-next .input-wrap .neu-input {
  border-color: #A1C95A;
  animation: none;
  box-shadow: none;
}
.attention-next .radio-group {
  border-radius: 12px;
  animation: attentionPulseOutline 1.1s ease-in-out infinite;
}
.attention-next .term-slider {
  border-radius: 6px;
  animation: attentionPulseOutline 1.1s ease-in-out infinite;
}
.attention-next .term-badge {
  animation: termBadgePop 1.1s ease-in-out infinite;
  transform-origin: center;
}
@keyframes termBadgePop {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(161,201,90,0.55);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(161,201,90,0);
    transform: scale(1.06);
  }
}
@keyframes attentionPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(161,201,90,0.55);
    border-color: #A1C95A;
  }
  50% {
    box-shadow: 0 0 0 6px rgba(161,201,90,0);
    border-color: #79B740;
  }
}
@keyframes attentionPulseOutline {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(161,201,90,0.55);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(161,201,90,0);
  }
}
.next-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #A1C95A, #5C8E2F);
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: none;
  white-space: nowrap;
  animation: pillBob 1.1s ease-in-out infinite;
}
.next-pill::before {
  content: '←';
  font-size: 13px;
  font-weight: 900;
}

/* All form-pills float below their form-group on mobile/tablet,
   pointing up at the field. Riders pill (in InsuranceCalculator) is
   in a different scope so this rule does NOT affect it. */
.dob-group,
.form-group { position: relative; }

@media (max-width: 1120px) {
  .next-pill {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    margin-left: 0 !important;
    white-space: nowrap !important;
    z-index: 10;
    pointer-events: none;
    animation: pillBobUp 1.1s ease-in-out infinite !important;
  }
  .next-pill::before {
    content: '↑';
  }
}
@keyframes pillBobUp {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50%      { transform: translateX(-50%) translateY(-3px); }
}
@keyframes pillBob {
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(-3px); }
}

@media (max-width: 720px) {
  .next-pill {
    font-size: 12px;
    padding: 4px 10px;
    margin-left: 6px;
    line-height: 1.2;
  }
  /* DOB & Gender — more prominent + symmetric borders on mobile */
  #dob.neu-input,
  .radio-pill span {
    box-sizing: border-box;
    height: 44px;
    border-width: 2px;
    border-color: rgba(95,189,245,0.60);
  }
  /* iOS Safari adds extra padding to native <input type="date">.
     Strip it so the field matches the radio pill height pixel-for-pixel. */
  #dob.neu-input {
    -webkit-appearance: none;
    appearance: none;
    line-height: 1.2;
    padding: 0 13px;
  }
  #dob.neu-input:focus {
    border-color: var(--accent, #79B740);
  }
}
@media (max-width: 480px) {
  .next-pill {
    margin-left: 4px;
    padding: 3px 8px;
    font-size: 11px;
  }
  .next-pill::before { font-size: 12px; }
}
@media (min-width: 1121px) {
  /* On desktop the placeholder + connector arrows already guide the user;
     hide redundant inline pills inside the form. */
  .next-pill { display: none; }
  .attention-next .neu-input,
  .attention-next .input-wrap,
  .attention-next .radio-group,
  .attention-next .term-slider,
  .attention-next .term-badge {
    animation: none !important;
    box-shadow: none !important;
  }
}

@media (max-width: 720px) {
  /* Grid/flex children should never overflow their container */
  .input-form,
  .form-grid,
  .form-group,
  .three-col-row,
  .three-col-item,
  .three-col-item--wide,
  .three-col-item--narrow,
  .three-col-item--slim {
    min-width: 0;
    max-width: 100%;
  }
  .neu-input,
  .input-wrap,
  select,
  input {
    min-width: 0;
    max-width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* Reorder blocks on mobile to match the step sequence:
     DOB → Gender → Sum/Frequency → Term → (Mode/Currency/USD at the end). */
  .form-grid > .two-col-row.full-width  { order: 3; }
  .form-grid > .term-group.full-width   { order: 4; }
  .form-grid > .three-col-row.full-width { order: 5; }

  /* Level 2 row: 1st item (Mode) takes full width; 2nd + 3rd (Currency + USD)
     share a row at half-each. */
  .three-col-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: stretch;
  }
  .three-col-row > .three-col-item:first-child {
    grid-column: 1 / -1;
  }
  .three-col-item,
  .three-col-item--wide,
  .three-col-item--narrow,
  .three-col-item--slim {
    flex: 0 0 auto;
    width: 100%;
  }
  .three-col-row .label-row {
    min-height: 0;
    align-items: center;
  }

  /* Level 3 row: Sum and Frequency each on their own line on mobile. */
  .two-col-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .two-col-item {
    flex: 0 0 auto;
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .term-header {
    flex-wrap: wrap;
    gap: 8px;
  }

  .radio-group,
  .mode-toggle {
    flex-direction: row;
  }

  .radio-pill span {
    min-height: 34px;
    height: auto;
    white-space: nowrap;
    line-height: 1.2;
    padding: 6px 8px;
    font-size: 9px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .radio-pill {
    flex: 1 1 0;
    min-width: 0;
  }

  .annuity-toggle-label {
    align-items: flex-start;
  }

  .toggle-text {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .form-title {
    font-size: 13px;
    letter-spacing: 1px;
    margin-bottom: 10px;
    padding-bottom: 8px;
  }
  .form-group label { font-size: 11px; }
  .neu-input,
  .input-wrap {
    height: 36px;
    padding: 8px 10px;
    font-size: 13px;
  }
  .input-wrap .neu-input { font-size: 15px; }
  .term-badge {
    font-size: 15px;
    padding: 8px 12px;
    min-width: 96px;
    height: 38px;
  }
  .term-badge-input { font-size: 15px; }
  .term-badge-word { font-size: 13px; }
  .term-header {
    gap: 6px;
    padding-right: 0;
  }
  .form-grid { gap: 10px; }
  .annuity-toggle-label {
    padding: 9px 12px;
    gap: 8px;
  }
  .toggle-text { font-size: 11px; letter-spacing: 0.03em; }
}
</style>
