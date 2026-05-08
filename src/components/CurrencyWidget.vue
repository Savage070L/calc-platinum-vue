<template>
  <div class="cw-wrap" :class="{ 'cw--manual': isManual }">
    <input
      ref="inputRef"
      class="cw-input"
      type="text"
      inputmode="decimal"
      :value="inputVal"
      :placeholder="isLoading ? '…' : '—'"
      :disabled="isLoading"
      autocomplete="off"
      spellcheck="false"
      title="Введите курс вручную"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown.enter.prevent="($event.target).blur()"
    />
    <span class="cw-suffix">
      <span class="cw-suffix-symbol">₸</span>
      <span class="cw-suffix-meta" v-if="!isManual && displayDate" v-fit-text="{ min: 6, max: 9 }">{{ t('form.nbrk') }} {{ displayDate }}</span>
      <span class="cw-suffix-meta cw-suffix-meta--manual" v-else-if="isManual">{{ t('form.manualRate') }}</span>
    </span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCurrencyRate } from '../composables/useCurrencyRate.js';
import { useI18n } from '../i18n/index.js';

const { t } = useI18n();
const { usdRate } = useCurrencyRate();

// ── State ─────────────────────────────────
const inputVal   = ref('');
const nbrkRate   = ref(null);
const fetchDate  = ref('');
const isLoading  = ref(false);
const isManual   = ref(false);
const inputRef   = ref(null);

// ── Derived ───────────────────────────────
// Date formatted as dd.mm.yy
const displayDate = computed(() => {
  if (isLoading.value) return '';
  if (!fetchDate.value) return '';
  const parts = fetchDate.value.split('.');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2].slice(2)}`;
  }
  return fetchDate.value;
});

defineExpose({ displayDate, isManual, fetchRate, isLoading });

// ── Input handlers ────────────────────────
function onFocus(e) {
  e.target.select();
}

function onBlur() {
  const num = parseFloat(String(inputVal.value).replace(',', '.'));
  if (!isNaN(num) && num > 0) {
    inputVal.value = num.toFixed(2);
  } else if (nbrkRate.value) {
    inputVal.value = nbrkRate.value.toFixed(2);
    isManual.value = false;
  }
}

function onInput(e) {
  let raw = e.target.value;
  // Strip everything but digits and decimal separators; normalize comma → dot.
  raw = raw.replace(/[^\d.,]/g, '').replace(',', '.');
  // Keep only the first dot.
  const firstDot = raw.indexOf('.');
  if (firstDot !== -1) {
    raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');
  }
  // Limit to 2 digits after the decimal point.
  if (firstDot !== -1) {
    const [intPart, decPart = ''] = raw.split('.');
    raw = intPart + '.' + decPart.slice(0, 2);
  }
  // Reflect the cleaned value back into the DOM input if it diverged.
  if (e.target.value !== raw) e.target.value = raw;
  inputVal.value = raw;
  const num = parseFloat(raw);
  if (!isNaN(num) && num > 0) {
    usdRate.value  = num;
    isManual.value = true;
  }
}

// ── Fetch rate from local JSON (updated by GitHub Actions) ──
async function fetchRate() {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res  = await fetch(`${base}usd-rate.json?t=${Date.now()}`, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.rate && data.rate > 0) {
      nbrkRate.value  = data.rate;
      usdRate.value   = data.rate;
      inputVal.value  = data.rate.toFixed(2);
      fetchDate.value = data.date || '';
      isManual.value  = false;
      cacheData(data.rate);
    }
  } catch (err) {
    console.warn('[CurrencyWidget] fetch error:', err.message);
    loadFromCache();
  } finally {
    isLoading.value = false;
  }
}

function cacheData(rate) {
  try {
    localStorage.setItem('nbrk_usd_cache', JSON.stringify({
      rate, date: fetchDate.value, ts: Date.now(),
    }));
  } catch (_) {}
}

function loadFromCache() {
  try {
    const c = JSON.parse(localStorage.getItem('nbrk_usd_cache') || 'null');
    if (c && Date.now() - c.ts < 86_400_000) {
      nbrkRate.value  = c.rate;
      usdRate.value   = c.rate;
      inputVal.value  = Number(c.rate).toFixed(2);
      fetchDate.value = c.date ? c.date : '';
      isManual.value  = false;
    }
  } catch (_) {}
}

onMounted(fetchRate);
</script>

<style scoped>
/* ── Wrapper — flex row, styled like .neu-input ── */
.cw-wrap {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 10px 10px 10px 13px;
  border: 1px solid var(--border-color, rgba(95,189,245,0.30));
  border-radius: 10px;
  background: var(--surface, #294A69);
  transition: border-color 0.2s ease;
  height: 42px;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
.cw-wrap:focus-within {
  border-color: #4A7295;
}
.cw--manual {
  border-color: rgba(255, 183, 77, 0.35);
}

/* ── Input — bare, no border ── */
.cw-input {
  flex: 0 0 auto;
  width: 62px;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  outline: none;
}
.cw-input:disabled {
  color: rgba(255,255,255,0.3);
  cursor: not-allowed;
}
.cw-input::placeholder { color: rgba(255,255,255,0.25); }

/* ── ₸ suffix + meta ── */
.cw-suffix {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
.cw-suffix-symbol {
  font-size: 14px;
  font-weight: 600;
  color: #E7F4FD;
  flex-shrink: 0;
  margin-left: 0;
}
.cw-suffix-meta {
  font-size: 8px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
  letter-spacing: 0.02em;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cw-suffix-meta--manual {
  color: rgba(255, 183, 77, 0.55);
}

/* ── Refresh button ── */
.cw-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgba(144, 202, 249, 0.6);
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.18s;
}
.cw-refresh:hover:not(:disabled) {
  background: rgba(74, 114, 149, 0.15);
  color: #A8BDD3;
}
.cw-refresh:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cw--manual .cw-refresh {
  color: rgba(255, 183, 77, 0.7);
}
.cw--manual .cw-refresh:hover:not(:disabled) {
  background: rgba(255, 183, 77, 0.15);
}

/* ── Spin animation ── */
.cw-spin {
  display: inline-block;
  animation: cwSpin 0.75s linear infinite;
}
@keyframes cwSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
