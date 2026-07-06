<template>
  <div class="insurance-calculator" ref="calcRef">

    <!-- Connector arrows from placeholder steps to form fields -->
    <svg
      v-if="!loading && !(result && manuallyTriggered) && arrowPaths.length"
      class="ph-arrows"
      :viewBox="`0 0 ${vp.w} ${vp.h}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker id="ph-arrow-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#A1C95A" />
        </marker>
      </defs>
      <path
        v-for="(p, i) in arrowPaths"
        :key="i"
        :d="p.d"
        stroke="#A1C95A"
        stroke-width="2.5"
        stroke-dasharray="8 5"
        stroke-linecap="round"
        fill="none"
        marker-end="url(#ph-arrow-head)"
        class="ph-arrow-path"
      />
    </svg>

    <!-- ── LEFT: Form Card ─────────────────── -->
    <div class="left-column">

      <!-- Form Card -->
      <div class="form-card">
        <InputForm
          v-model="formData"
          @term-touched="termTouched = true"
          @amount-committed="amountCommitted = true"
        />
        <div class="form-errors" v-if="errors.length > 0 && isFormComplete">
          <div v-for="err in errors" :key="err" class="error-item">⚠ {{ err }}</div>
        </div>
      </div>

      <!-- Mobile-only: explicit "Recalculate" button shown after first calc
           when the form values have changed. Auto-calc still runs in the
           background — this button just gives the user clear confirmation. -->
      <button
        v-if="manuallyTriggered && pendingRecalc"
        type="button"
        class="recalc-btn"
        @click="handleRecalc"
      >
        {{ t('placeholder.calculate') }}
      </button>

    </div>

    <!-- ── RIGHT: Results ────── -->
    <div class="right-column">

      <!-- Loading state -->
      <div class="calc-loading" v-if="loading">
        <div class="loading-dots"><span></span><span></span><span></span></div>
        <span>{{ t('calculating') }}</span>
      </div>

      <!-- Results — shown after the user manually triggered the first calc.
           :key forces a remount on recalc so the count-up animations re-fire. -->
      <div class="results-section" v-else-if="result && manuallyTriggered" :key="recalcKey">
        <ResultsSummary :result="result" />
        <ReservesTable :result="result" />
      </div>

      <!-- Placeholder — form not yet complete -->
      <div class="calc-placeholder" v-else>
        <div class="ph-glow"></div>
        <div class="ph-icon-chip">
          <svg viewBox="0 0 32 32" class="ph-icon" aria-hidden="true">
            <path d="M7 4h18a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <rect x="8" y="8" width="16" height="6" rx="1.5" fill="currentColor" opacity="0.18"/>
            <circle cx="11" cy="18.5" r="1.5" fill="currentColor"/>
            <circle cx="16" cy="18.5" r="1.5" fill="currentColor"/>
            <circle cx="21" cy="18.5" r="1.5" fill="currentColor"/>
            <circle cx="11" cy="23.5" r="1.5" fill="currentColor"/>
            <circle cx="16" cy="23.5" r="1.5" fill="currentColor"/>
            <circle cx="21" cy="23.5" r="1.5" fill="currentColor"/>
          </svg>
        </div>
        <h3 class="ph-title">{{ t('placeholder.title') }}</h3>
        <p class="ph-subtitle">{{ t('placeholder.subtitle') }}</p>
        <ul class="ph-steps">
          <li class="ph-step" :class="{ 'ph-step-done': step1Done }">
            <span class="ph-step-num">{{ step1Done ? '✓' : '1' }}</span>
            <span class="ph-step-text">{{ t('placeholder.step1') }}</span>
          </li>
          <li class="ph-step" :class="{ 'ph-step-done': step2Done }">
            <span class="ph-step-num">{{ step2Done ? '✓' : '2' }}</span>
            <span class="ph-step-text">{{ t('placeholder.step2') }}</span>
          </li>
          <li class="ph-step" :class="{ 'ph-step-done': step3Done }">
            <span class="ph-step-num">{{ step3Done ? '✓' : '3' }}</span>
            <span class="ph-step-text">{{ t('placeholder.step3') }}</span>
          </li>
          <li class="ph-step" :class="{ 'ph-step-done': step5Done }">
            <span class="ph-step-num">{{ step5Done ? '✓' : '4' }}</span>
            <span class="ph-step-text">{{ t('placeholder.step5') }}</span>
          </li>
        </ul>
        <button
          type="button"
          class="ph-calc-btn"
          :class="{ 'ph-calc-btn--ready': allStepsDone }"
          :disabled="!allStepsDone"
          @click="handleCalculate"
        >
          {{ t('placeholder.calculate') }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useInsuranceCalc } from '../composables/useInsuranceCalc.js';
import { useCurrencyRate } from '../composables/useCurrencyRate.js';
import InputForm from './InputForm.vue';
import ResultsSummary from './ResultsSummary.vue';
import ReservesTable from './ReservesTable.vue';
import { useI18n } from '../i18n/index.js';

const { t } = useI18n();

const { result, loading, errors, calculate, reset } = useInsuranceCalc();
const { usdRate, currencyMode } = useCurrencyRate();

const formData = ref({
  dob: '',
  gender: '',
  term: 10,           // дефолт в середине допустимого диапазона 1-20
  frequency: 'single', // Pro Life Platinum: только единовременный взнос
  mode: 'premium_to_sa',
  sumAssured: 0,
  premium: 0,
  enableAnnuity: false,
  annuityFrequency: 'annual',
  annuityTerm: 10,
  guaranteedPeriod: 10,
  // Pro Life Platinum: дополнительные покрытия не предусмотрены
  riders: {},
});

currencyMode.value = 'USD';

// Form is "complete" when all minimum required fields are present
const isFormComplete = computed(() => {
  const { dob, gender, term, frequency, mode, sumAssured, premium } = formData.value;
  if (!dob || !gender || !term || !frequency) return false;
  if (mode === 'sa_to_premium' && (!sumAssured || sumAssured <= 0)) return false;
  if (mode === 'premium_to_sa' && (!premium || premium <= 0)) return false;
  return true;
});

// User interaction flags (set true only on explicit input completion).
const termTouched     = ref(false);
const amountCommitted = ref(false);

// ── Step completion states (per individual field) ──
// Step 1: full ISO date (YYYY-MM-DD) — native <input type="date"> only
// produces a non-empty value when the year has 4 digits and the date is valid.
const step1Done = computed(() => {
  const v = formData.value.dob || '';
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1900;
});
const step2Done = computed(() => !!formData.value.gender);
// Step 3: requires the user to finish entering the value (blur / enter).
const step3Done = computed(() => {
  if (!amountCommitted.value) return false;
  const f = formData.value;
  return f.mode === 'premium_to_sa'
    ? (f.premium > 0)
    : (f.sumAssured > 0);
});
const step4Done = computed(() => !!formData.value.frequency);
// Step 5: requires the user to release the slider OR finish typing in the badge.
const step5Done = computed(() => termTouched.value && Number(formData.value.term) > 0);

const allStepsDone = computed(() =>
  step1Done.value && step2Done.value && step3Done.value &&
  step4Done.value && step5Done.value
);

// User must explicitly press the "Рассчитать" button before results show.
const manuallyTriggered = ref(false);
function handleCalculate() {
  if (!allStepsDone.value) return;
  manuallyTriggered.value = true;
}

// Pending recalc — on mobile we show a visible "Рассчитать" button between
// the form and the results so the user has explicit confirmation that the
// auto-calc has just refreshed.
const pendingRecalc = ref(false);
const recalcKey     = ref(0);

watch(formData, () => {
  if (manuallyTriggered.value) pendingRecalc.value = true;
}, { deep: true });

function handleRecalc() {
  pendingRecalc.value = false;
  // Bump the key so the results section remounts and re-fires the
  // count-up animations (the values run up to their new amounts again).
  recalcKey.value++;
  nextTick(() => {
    const el = document.querySelector('.results-section');
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// ── Connector arrows from placeholder steps → form fields ──
const calcRef     = ref(null);
const vp          = ref({ w: 0, h: 0 });
const arrowPaths  = ref([]);

const stepFieldMap = [
  { stepSel: '.ph-steps .ph-step:nth-child(1)', fieldSel: '#dob',                                   done: step1Done },
  { stepSel: '.ph-steps .ph-step:nth-child(2)', fieldSel: '.input-form .form-group .radio-group',  done: step2Done, anchor: 'bottom-center' },
  { stepSel: '.ph-steps .ph-step:nth-child(3)', fieldSel: '#premium, #sumAssured',                  done: step3Done },
  { stepSel: '.ph-steps .ph-step:nth-child(4)', fieldSel: '.term-slider',                           done: step5Done },
];

function computeArrows() {
  if (typeof window === 'undefined') return;
  // Hide arrows only when results are actually displayed (loading or manually-triggered).
  // While the placeholder is still visible, arrows must keep guiding the user.
  if (loading.value || (result.value && manuallyTriggered.value)) {
    arrowPaths.value = [];
    return;
  }
  if (window.innerWidth <= 1120) { arrowPaths.value = []; return; }
  const root = calcRef.value;
  if (!root) return;
  const rootRect = root.getBoundingClientRect();
  vp.value = { w: rootRect.width, h: rootRect.height };

  // Only show ONE arrow at a time — the first incomplete step.
  const out = [];
  const m = stepFieldMap.find(s => !s.done.value);
  if (m) {
    const stepEl  = root.querySelector(m.stepSel);
    const fieldEl = document.querySelector(m.fieldSel);
    if (stepEl && fieldEl) {
      const sR = stepEl.getBoundingClientRect();
      const fR = fieldEl.getBoundingClientRect();
      const sx = sR.left - rootRect.left;
      const sy = sR.top + sR.height / 2 - rootRect.top;

      let d;
      if (m.anchor === 'bottom-center') {
        // Land on the bottom-center of the field (e.g. between "МУЖСКОЙ" / "ЖЕНСКИЙ"),
        // approaching from below so the arrowhead points UP into the gap.
        const cx = fR.left + fR.width / 2 - rootRect.left;
        const ty = fR.bottom + 6 - rootRect.top;     // arrow tip — just below field
        const turnY = ty + 28;                        // bend further below
        d = `M ${sx} ${sy} L ${cx} ${turnY} L ${cx} ${ty}`;
      } else {
        // Default: land on the right-mid edge of the field.
        const fx = fR.right - rootRect.left + 8;
        const fy = fR.top + fR.height / 2 - rootRect.top;
        d = `M ${sx} ${sy} L ${fx} ${fy}`;
      }
      out.push({ d });
    }
  }
  arrowPaths.value = out;
}

let arrowsRO = null;
let arrowsRaf = null;
function scheduleArrows() {
  if (arrowsRaf) cancelAnimationFrame(arrowsRaf);
  arrowsRaf = requestAnimationFrame(computeArrows);
}

onMounted(() => {
  nextTick(scheduleArrows);
  if (typeof ResizeObserver !== 'undefined' && calcRef.value) {
    arrowsRO = new ResizeObserver(scheduleArrows);
    arrowsRO.observe(calcRef.value);
  }
  window.addEventListener('resize', scheduleArrows);
  window.addEventListener('scroll', scheduleArrows, { passive: true });
});

onBeforeUnmount(() => {
  if (arrowsRO) arrowsRO.disconnect();
  if (arrowsRaf) cancelAnimationFrame(arrowsRaf);
  window.removeEventListener('resize', scheduleArrows);
  window.removeEventListener('scroll', scheduleArrows);
});

// Recompute when state changes (form values, mode, touched flags, etc.)
watch(
  [result, loading, formData, termTouched, amountCommitted, manuallyTriggered],
  () => nextTick(scheduleArrows),
  { deep: true }
);

// Гарантированный период всегда следует за сроком выплат
watch(() => formData.value.annuityTerm, (newTerm) => {
  formData.value.guaranteedPeriod = newTerm;
});

// Auto-calculate whenever form data changes (debounced 350ms)
let calcTimer = null;
watch(formData, () => {
  clearTimeout(calcTimer);
  calcTimer = setTimeout(() => {
    if (isFormComplete.value) {
      calculate(formData.value);
    } else {
      reset();
    }
  }, 350);
}, { deep: true });

// On narrow screens (stacked layout), scroll to the results once they first
// appear so the user instantly sees that the calculation is ready.
let hasScrolledToResults = false;
watch(result, (r, prev) => {
  if (!r || prev || hasScrolledToResults) return;
  if (typeof window === 'undefined' || window.innerWidth > 1120) return;
  hasScrolledToResults = true;
  nextTick(() => {
    const el = document.querySelector('.result-section-header') || document.querySelector('.top-badges');
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
});
</script>

<style scoped>
/* ── Page grid ─────────────────────────────── */
.insurance-calculator {
  position: relative;
  display: grid;
  grid-template-columns: minmax(520px, 700px) minmax(560px, 1fr);
  gap: 16px;
  padding: 12px;
  max-width: 1880px;
  margin: 0 auto;
  align-items: stretch;
}

/* SVG overlay with connector arrows — placeholder → form fields */
.ph-arrows {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
  overflow: visible;
  filter: drop-shadow(0 0 8px rgba(161,201,90,0.65));
}
.ph-arrow-path {
  animation: phDashMove 0.9s linear infinite;
}
@keyframes phDashMove {
  to { stroke-dashoffset: -26; }
}

/* ── Left column: stacked cards ────────────── */
.left-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Form Card (brand blue) ────────────────── */
.form-card {
  /* Theme variable overrides for child components */
  --surface:          #294A69;
  --text-main:        #FFFFFF;
  --text-light:       #5FBDF5;
  --accent:           #79B740;
  --accent-hover:     #8BC353;
  --border-color:     rgba(95,189,245,0.30);
  --shadow-btn:       none;
  --shadow-out-sm:    none;
  --shadow-in:        none;
  --shadow-btn-press: none;

  background: linear-gradient(170deg, #2D5171 0%, #0F1F33 100%);
  border-radius: 22px;
  padding: 1.4rem 1.3rem 1.6rem;
}

/* ── Riders Card (brand blue) ──────────────── */
.riders-card {
  --surface:      #294A69;
  --text-main:    #FFFFFF;
  --text-light:   #5FBDF5;
  --accent:       #79B740;
  --rider-group:  #5FBDF5;
  --border-color: rgba(95,189,245,0.30);
  --shadow-in:    none;
  --shadow-btn:   none;
  --shadow-btn-press: none;

  background: linear-gradient(135deg, #2D5171 0%, #0F1F33 100%);
  border-radius: 22px;
  padding: 16px 18px;
}

.riders-card-header {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 0;
  padding-bottom: 0;
  font-size: 18px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 1px;
  color: #FFFFFF;
}
.riders-header-text {
  flex: 1 1 auto;
  min-width: 0;
}
.riders-pill-row {
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
}
.riders-pill-row .next-pill {
  margin-left: 0;
  padding: 10px 22px;
  font-size: 16px;
  border-radius: 999px;
  animation: pillBobV 1.1s ease-in-out infinite;
}
.riders-pill-row .next-pill::before {
  content: '↓';
  font-size: 18px;
  font-weight: 900;
}
@keyframes pillBobV {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(4px); }
}

@media (max-width: 480px) {
  .riders-pill-row .next-pill {
    padding: 8px 18px;
    font-size: 14px;
  }
  .riders-pill-row .next-pill::before {
    font-size: 16px;
  }
}
.riders-card-header.expanded {
  margin-bottom: 8px;
  padding-bottom: 10px;
}

/* Info icons brighter on dark cards */
.form-card :deep(.info-btn),
.riders-card :deep(.info-btn) {
  border-color: rgba(255,255,255,0.65);
  color: rgba(255,255,255,0.85);
  opacity: 1;
}
.form-card :deep(.info-btn:hover),
.form-card :deep(.info-btn.active),
.riders-card :deep(.info-btn:hover),
.riders-card :deep(.info-btn.active) {
  background: rgba(255,255,255,0.95);
  border-color: white;
  color: #2D5171;
  transform: scale(1.1);
}
.rc-icon { font-size: 22px; }
.riders-toggle { cursor: pointer; user-select: none; }
.riders-arrow { margin-left: auto; font-size: 13px; opacity: 0.5; }

/* ── Attention prompt: highlight Riders block as the next step ── */
.riders-card.attention-next {
  border: 2px solid #A1C95A;
  animation: ridersAttention 1.3s ease-in-out infinite;
}
@keyframes ridersAttention {
  0%, 100% {
    box-shadow:
      0 0 0 0 rgba(161,201,90,0.65),
      0 0 14px 0 rgba(161,201,90,0.35) inset;
    border-color: #A1C95A;
  }
  50% {
    box-shadow:
      0 0 0 12px rgba(161,201,90,0),
      0 0 28px 4px rgba(161,201,90,0.55) inset;
    border-color: #79B740;
  }
}
.next-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #A1C95A, #5C8E2F);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: none;
  white-space: nowrap;
  animation: pillBob 1.1s ease-in-out infinite;
}
.next-pill::before {
  content: '←';
  font-size: 12px;
  font-weight: 900;
}
@keyframes pillBob {
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(-3px); }
}

/* ── Recalc button (mobile only, after first calc + on change) ── */
.recalc-btn {
  display: none;
  width: 100%;
  margin-top: 6px;
  padding: 16px 24px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #A1C95A 0%, #5C8E2F 100%);
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(121,183,64,0.45),
              inset 0 1px 0 rgba(255,255,255,0.30);
  animation: recalcPulse 1.1s ease-in-out infinite;
  transition: transform 0.15s ease, box-shadow 0.25s ease;
}
.recalc-btn:hover { transform: translateY(-1px); }
.recalc-btn:active { transform: translateY(0); }
@keyframes recalcPulse {
  0%, 100% {
    box-shadow: 0 8px 22px rgba(121,183,64,0.45),
                inset 0 1px 0 rgba(255,255,255,0.30);
  }
  50% {
    box-shadow: 0 12px 32px rgba(121,183,64,0.70),
                inset 0 1px 0 rgba(255,255,255,0.40);
  }
}
@media (max-width: 1120px) {
  .recalc-btn { display: block; }
}
@media (max-width: 480px) {
  .recalc-btn {
    padding: 14px 18px;
    font-size: 13px;
    border-radius: 12px;
  }
}

@media (max-width: 480px) {
  .next-pill {
    margin-left: 8px;
    padding: 3px 8px;
    font-size: 10px;
  }
}
@media (min-width: 1121px) {
  .next-pill { display: none; }
  /* keep the riders-card.attention-next glow visible on desktop —
     it acts as the destination indicator for the step-6 arrow */
}

/* ── Right column ──────────────────────────── */
.right-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  max-width: 100%;
}

/* ── Results section (unified dark navy card) ─ */
.results-section {
  display: flex; flex-direction: column; gap: 14px;
  min-width: 0; max-width: 100%;
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(170deg, #2D5171 0%, #0F1F33 100%);
  flex: 1;
  min-height: 0;
}

/* Restyle inner blocks to fit the dark navy theme */
.results-section :deep(.total-block) {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(95,189,245,0.22);
  color: #E8F4FD;
}
.results-section :deep(.total-block h3),
.results-section :deep(.total-block .detail-toggle) {
  color: #FFFFFF;
}
.results-section :deep(.total-block .icon) {
  background: rgba(161,201,90,0.18);
}
.results-section :deep(.total-block .detail-arrow) {
  color: #A8BDD3;
  opacity: 1;
}
.results-section :deep(.total-header-row) {
  border-bottom-color: rgba(255,255,255,0.14);
}
.results-section :deep(.hcol-label),
.results-section :deep(.hcol-sum),
.results-section :deep(.hcol-prem) {
  color: #B3D9FF;
  opacity: 1;
}
.results-section :deep(.total-row) {
  border-bottom-color: rgba(255,255,255,0.08);
}
.results-section :deep(.total-label) {
  color: #FFFFFF;
  opacity: 1;
}
.results-section :deep(.total-sum) {
  color: #A1C95A;
}
.results-section :deep(.total-value) {
  color: #FFFFFF;
}

/* Reserves block — same translucent style as Детализация */
.results-section :deep(.reserves-block) {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(95,189,245,0.22);
  color: #E8F4FD;
}
.results-section :deep(.reserves-toggle),
.results-section :deep(.reserves-toggle .reserves-title) {
  color: #FFFFFF;
}
.results-section :deep(.reserves-toggle .icon) {
  background: rgba(161,201,90,0.18);
}
.results-section :deep(.reserves-arrow) {
  color: #A8BDD3;
  opacity: 1;
}
.results-section :deep(.data-table tbody tr) {
  border-bottom-color: rgba(255,255,255,0.08);
}
.results-section :deep(.data-table tbody tr:nth-child(odd) td) {
  background: rgba(161,201,90,0.07);
}
.results-section :deep(.data-table tbody tr:nth-child(even) td) {
  background: rgba(95,189,245,0.05);
}
.results-section :deep(.data-table tbody tr:hover td) {
  background: rgba(95,189,245,0.16);
}
.results-section :deep(.data-table td) {
  color: #E8F4FD;
  border-right-color: rgba(255,255,255,0.06);
}
.results-section :deep(.col-year) {
  color: #5FBDF5;
}
.results-section :deep(.col-date) {
  color: #B3D9FF;
}
.results-section :deep(.col-surrender) {
  color: #A1C95A;
}

/* Info icons — white on dark inside results section */
.results-section :deep(.info-btn) {
  border-color: rgba(255,255,255,0.55);
  color: rgba(255,255,255,0.75);
  opacity: 1;
}
.results-section :deep(.info-btn:hover),
.results-section :deep(.info-btn.active) {
  background: rgba(255,255,255,0.95);
  border-color: white;
  color: #2D5171;
}
/* Header buttons inside the table thead keep light style (already on blue gradient) */
.results-section :deep(.data-table th .info-btn) {
  border-color: rgba(255,255,255,0.7);
  color: rgba(255,255,255,0.85);
}

/* ── Form errors ───────────────────────────── */
.form-errors { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }
.error-item {
  font-size: 13px; color: #ff8a80;
  background: rgba(220,38,38,0.12);
  border-radius: 8px; padding: 7px 10px;
  border: 1px solid rgba(220,38,38,0.2);
}

/* ── Placeholder ───────────────────────────── */
.calc-placeholder {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 56px 28px 44px;
  border-radius: 22px;
  background: linear-gradient(170deg, #2D5171 0%, #0F1F33 100%);
  overflow: hidden;
  animation: phFadeIn 0.5s ease-out both;
  flex: 1;
  min-height: 0;
}
.ph-glow {
  position: absolute;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, rgba(161,201,90,0.18) 0%, transparent 60%);
  pointer-events: none;
}
.ph-icon-chip {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 22px;
  background: linear-gradient(135deg, #A1C95A 0%, #5C8E2F 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  box-shadow: 0 10px 28px rgba(121,183,64,0.40),
              inset 0 1px 0 rgba(255,255,255,0.30);
}
.ph-icon {
  width: 40px;
  height: 40px;
}
.ph-title {
  position: relative;
  margin: 6px 0 0;
  font-size: 20px;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: 0.04em;
  text-align: center;
}
.ph-subtitle {
  position: relative;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #A8BDD3;
  text-align: center;
  max-width: 380px;
  line-height: 1.4;
}
.ph-steps {
  position: relative;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 360px;
}
.ph-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(95,189,245,0.18);
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  color: #E8F4FD;
}
.ph-step-num {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4A7295 0%, #2D5171 100%);
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(45,81,113,0.45);
  transition: background 0.25s ease, box-shadow 0.25s ease;
}
.ph-step-text {
  transition: opacity 0.25s ease, text-decoration-color 0.25s ease;
}
.ph-step-done {
  border-color: rgba(95,189,245,0.10);
}
.ph-step-done .ph-step-text {
  opacity: 0.55;
  text-decoration: line-through;
  text-decoration-color: rgba(255,255,255,0.55);
  text-decoration-thickness: 2px;
}
.ph-step-done .ph-step-num {
  background: linear-gradient(135deg, #A1C95A 0%, #5C8E2F 100%);
  box-shadow: 0 2px 8px rgba(121,183,64,0.50);
  font-size: 14px;
  opacity: 1;
}
/* ── Calculate button ── */
.ph-calc-btn {
  position: relative;
  margin-top: 22px;
  min-width: 280px;
  padding: 22px 56px;
  border-radius: 16px;
  border: 2px solid rgba(161,201,90,0.50);
  background: rgba(161,201,90,0.10);
  color: rgba(255,255,255,0.55);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: not-allowed;
  opacity: 0.55;
  transition:
    background 0.3s ease,
    color 0.3s ease,
    box-shadow 0.3s ease,
    border-color 0.3s ease,
    opacity 0.3s ease,
    transform 0.15s ease;
}
.ph-calc-btn--ready {
  background: linear-gradient(135deg, #A1C95A 0%, #5C8E2F 100%);
  border-color: transparent;
  color: #FFFFFF;
  cursor: pointer;
  opacity: 1;
  box-shadow: 0 10px 28px rgba(121,183,64,0.45),
              inset 0 1px 0 rgba(255,255,255,0.30);
  animation: phCalcPulse 1.4s ease-in-out infinite;
}
.ph-calc-btn--ready:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 34px rgba(121,183,64,0.60),
              inset 0 1px 0 rgba(255,255,255,0.35);
}
.ph-calc-btn--ready:active {
  transform: translateY(0);
}
@keyframes phCalcPulse {
  0%, 100% {
    box-shadow: 0 10px 28px rgba(121,183,64,0.45),
                inset 0 1px 0 rgba(255,255,255,0.30);
  }
  50% {
    box-shadow: 0 14px 36px rgba(121,183,64,0.70),
                inset 0 1px 0 rgba(255,255,255,0.40);
  }
}
@keyframes phFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes phChipPulse {
  0%, 100% {
    box-shadow: 0 10px 28px rgba(121,183,64,0.40),
                inset 0 1px 0 rgba(255,255,255,0.30);
  }
  50% {
    box-shadow: 0 14px 36px rgba(121,183,64,0.60),
                inset 0 1px 0 rgba(255,255,255,0.40);
  }
}

@media (max-width: 480px) {
  .calc-placeholder {
    padding: 36px 18px 28px;
    border-radius: 18px;
    gap: 10px;
  }
  .ph-icon-chip { width: 60px; height: 60px; border-radius: 18px; }
  .ph-icon { width: 32px; height: 32px; }
  .ph-title { font-size: 17px; }
  .ph-subtitle { font-size: 13px; }
  .ph-step { padding: 10px 12px; font-size: 13px; }
  .ph-step-num { width: 24px; height: 24px; font-size: 12px; }
  .ph-calc-btn {
    padding: 16px 28px;
    font-size: 15px;
    min-width: 0;
    width: 100%;
    margin-top: 16px;
    border-radius: 14px;
  }
}

/* ── Loading ───────────────────────────────── */
.calc-loading {
  display: flex; align-items: center; justify-content: center;
  gap: 12px; padding: 36px 20px;
  color: var(--text-light, #5A7A96); font-size: 14px; font-weight: 500;
  background: var(--surface, #F5F8FF);
  border-radius: 20px;
}
.loading-dots { display: flex; gap: 5px; }
.loading-dots span {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary, #2D5171);
  animation: dotBounce 1.2s infinite ease-in-out;
}
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40%           { transform: scale(1.2); opacity: 1; }
}

/* ── Responsive ────────────────────────────── */
@media (max-width: 1120px) {
  .insurance-calculator {
    grid-template-columns: minmax(0, 1fr);
    padding: 14px;
    gap: 14px;
  }
}

@media (max-width: 720px) {
  .insurance-calculator {
    padding: 6px;
    gap: 10px;
    max-width: 100%;
    width: 100%;
  }
  .left-column,
  .right-column {
    max-width: 100%;
    min-width: 0;
  }

  .form-card,
  .riders-card {
    padding: 12px;
    border-radius: 18px;
  }

  .riders-card-header {
    font-size: 16px;
    letter-spacing: 0.6px;
  }
  .next-pill {
    font-size: 10px;
    padding: 3px 8px;
    margin-left: 6px;
    white-space: normal;
    line-height: 1.2;
  }
}

@media (max-width: 480px) {
  .insurance-calculator {
    padding: 4px;
    gap: 8px;
  }
  .form-card,
  .riders-card {
    padding: 10px;
    border-radius: 14px;
  }
  .riders-card-header {
    font-size: 13px;
    letter-spacing: 0.3px;
  }
  .next-pill {
    font-size: 9px;
    padding: 3px 7px;
    margin-left: 4px;
  }
}
</style>
