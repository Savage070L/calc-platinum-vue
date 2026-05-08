<template>
  <div class="reserves-block" v-if="result?.reserves?.length" ref="cardRef">
    <h3 class="reserves-toggle" @click="showTable = !showTable">
      <span class="icon">📋</span>
      <span class="reserves-title">{{ t('table.toggle') }}</span>
      <InfoTooltip v-bind="tip('table')" />
      <span class="reserves-arrow">{{ showTable ? '▲' : '▼' }}</span>
    </h3>
    <div v-show="showTable" class="reserves-body">
      <div class="table-wrapper" ref="wrapperRef" :style="wrapperStyle">
        <table class="data-table">
          <colgroup>
            <col class="c-year" />
            <col class="c-date" />
            <col class="c-surrender" />
          </colgroup>
          <thead>
            <tr>
              <th class="th-year">{{ t('table.year') }} <InfoTooltip v-bind="tip('colYear')" /></th>
              <th class="th-date">{{ t('table.date') }} <InfoTooltip v-bind="tip('colDate')" /></th>
              <th class="th-surrender">{{ t('table.surrender') }} <InfoTooltip v-bind="tip('colSurrender')" /></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in tableRows" :key="row.year" :class="{ even: idx % 2 === 0 }">
              <td class="col-year">{{ row.year }}</td>
              <td class="col-date">{{ policyDate(row.year) }}</td>
              <td class="col-surrender">
                {{ fmtP(row.surrender) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { formatMoney } from '../composables/useInsuranceCalc.js';
import InfoTooltip from './InfoTooltip.vue';
import { useI18n } from '../i18n/index.js';

const { t, tip } = useI18n();
function fmtP(kzt) { return fmt(kzt); }

const props = defineProps({ result: { type: Object, default: null } });

const showTable = ref(window.innerWidth > 720);

// В выкупной таблице 1-й год всегда показываем как 0 ₸ (стандарт продукта).
const tableRows = computed(() =>
  (props.result?.reserves ?? []).map((r) =>
    r.year === 1 ? { ...r, surrender: 0 } : r
  )
);

function policyDate(yearNum) {
  const base = props.result?.calcDate || new Date().toISOString().slice(0, 10);
  const [y, m, d] = base.split('-');
  return `${d}.${m}.${parseInt(y, 10) + yearNum}`;
}

// ── Align table bottom with the bottom of the Riders card on the left ──
const cardRef    = ref(null);
const wrapperRef = ref(null);
const maxH       = ref(0);

const wrapperStyle = computed(() => (
  maxH.value > 0
    ? { height: maxH.value + 'px', overflowY: 'auto' }
    : {}
));

let anchorEl = null;
let ro = null;
let rafId = null;

function recompute() {
  if (typeof window === 'undefined' || window.innerWidth <= 1120) {
    maxH.value = 0;
    return;
  }
  if (!wrapperRef.value || !anchorEl) return;
  const wrapRect = wrapperRef.value.getBoundingClientRect();
  const anchorRect = anchorEl.getBoundingClientRect();

  // Account for any spacing that lives BELOW the table-wrapper but
  // still above the visual end of the right side (.reserves-block
  // border + padding, surrounding .results-section bottom-padding, etc.)
  // so that the right side ends exactly at anchor.bottom, not below it.
  let bottomBuffer = 0;
  const block = wrapperRef.value.closest('.reserves-block');
  if (block) {
    const bs = getComputedStyle(block);
    bottomBuffer += (parseFloat(bs.borderBottomWidth) || 0)
                  + (parseFloat(bs.paddingBottom) || 0);
  }
  const section = wrapperRef.value.closest('.results-section');
  if (section) {
    const ss = getComputedStyle(section);
    bottomBuffer += (parseFloat(ss.paddingBottom) || 0)
                  + (parseFloat(ss.borderBottomWidth) || 0);
  }

  const avail = Math.max(160, anchorRect.bottom - bottomBuffer - wrapRect.top);
  maxH.value = avail;
}

function scheduleRecompute() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(recompute);
}

onMounted(() => {
  nextTick(() => {
    // Anchor to the Riders card's bottom — that's the visible end of the left-side content.
    anchorEl = document.querySelector('.riders-card') || document.querySelector('.left-column');
    if (!anchorEl) return;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleRecompute);
      ro.observe(anchorEl);
      if (wrapperRef.value) ro.observe(wrapperRef.value);
    }
    window.addEventListener('resize', scheduleRecompute);
    scheduleRecompute();
  });
});

onBeforeUnmount(() => {
  if (ro) ro.disconnect();
  window.removeEventListener('resize', scheduleRecompute);
  if (rafId) cancelAnimationFrame(rafId);
});

watch(showTable, () => nextTick(scheduleRecompute));
watch(() => props.result, () => nextTick(scheduleRecompute));

function fmt(v) { return formatMoney(v) + '\u00A0₸'; }
</script>

<style scoped>
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Reserves block (single card matching "Детализация") ── */
.reserves-block {
  background: var(--surface, #F5F8FF);
  color: #1B2838;
  border: 2px solid #2D5171;
  border-radius: var(--radius, 20px);
  padding: 20px;
  animation: slideDown 0.3s ease-out both;
}
.reserves-toggle {
  cursor: pointer;
  user-select: none;
  margin: 0; padding: 0;
  font-size: 22px; font-weight: 700;
  color: #1B2838;
  display: flex; align-items: center; gap: 8px;
}
.reserves-toggle .icon {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%; background: rgba(74,114,149,0.12);
  font-size: 18px;
}
.reserves-title { flex: 0 0 auto; }
.reserves-arrow {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.5;
}
.reserves-body { margin-top: 12px; }
.table-wrapper {
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  border-radius: 12px;
}

/* ── Table ─────────────────────────── */
.data-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-family: 'SF Mono', 'Menlo', monospace;
}

.data-table col.c-year      { width: 20%; }
.data-table col.c-date      { width: 35%; }
.data-table col.c-surrender { width: 45%; }

/* Header — sticky so it stays visible while scrolling */
.data-table thead tr {
  background: linear-gradient(135deg, #3D6286, #1B344E);
}
.data-table th {
  color: white;
  padding: 13px 12px;
  text-align: center;
  font-weight: 700; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.5px;
  white-space: normal;
  border: none;
  position: sticky;
  top: 0;
  z-index: 2;
  background: linear-gradient(135deg, #3D6286, #1B344E);
}

/* Rows */
.data-table tbody tr {
  border-bottom: 1px solid rgba(62, 100, 135, 0.1);
  transition: background 0.13s ease;
}
.data-table tbody tr:nth-child(odd) td {
  background: rgba(124, 186, 66, 0.06);
}
.data-table tbody tr:nth-child(even) td {
  background: rgba(62, 100, 135, 0.06);
}
.data-table tbody tr:hover td {
  background: var(--primary-pale, #E5ECF3);
}

.data-table td {
  padding: 11px 12px;
  text-align: center;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 16px; font-weight: 600;
  color: var(--text-main, #1A2E3F);
  border: none;
  border-right: 1px solid rgba(45, 81, 113, 0.08);
}
.data-table td:last-child { border-right: none; }

/* Year — bold blue */
.col-year {
  font-size: 18px; font-weight: 800;
  color: #294A69;
}

/* Date — same weight/font as others, slightly muted */
.col-date {
  font-size: 16px; font-weight: 600;
  color: #2D5171;
}

/* Surrender value */
.col-surrender {
  font-size: 18px; font-weight: 700;
  color: #3F6620;
}

/* Info button inside blue header — white style */
.data-table th :deep(.info-btn) {
  border-color: rgba(255,255,255,0.6);
  color: rgba(255,255,255,0.7);
  opacity: 1;
}
.data-table th :deep(.info-btn:hover),
.data-table th :deep(.info-btn.active) {
  background: rgba(255,255,255,0.25);
  border-color: white;
  color: white;
  transform: scale(1.1);
}
/* Info button in toggle button row */
.toggle-btn :deep(.info-btn) {
  border-color: rgba(45,81,113,0.5);
  color: rgba(45,81,113,0.6);
}
.toggle-btn :deep(.info-btn:hover),
.toggle-btn :deep(.info-btn.active) {
  background: #2D5171;
  border-color: #2D5171;
  color: white;
}

@media (max-width: 720px) {
  .data-table { min-width: 0; }

  .reserves-block { padding: 14px; }
  .reserves-toggle {
    font-size: 16px;
    flex-wrap: wrap;
    row-gap: 6px;
  }
  .reserves-toggle .reserves-title {
    flex: 1 1 auto;
    min-width: 0;
    word-break: break-word;
  }
  .reserves-toggle .icon { width: 26px; height: 26px; font-size: 15px; }

  /* Same proportional widths on mobile — no horizontal scroll */
  .data-table col.c-year      { width: 20%; }
  .data-table col.c-date      { width: 35%; }
  .data-table col.c-surrender { width: 45%; }

  .data-table th {
    font-size: 10px;
    padding: 8px 4px;
  }

  .data-table td {
    font-size: 12px;
    padding: 8px 4px;
  }

  .col-year {
    font-size: 13px;
  }
  .col-surrender {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .reserves-block { padding: 12px; }
  .reserves-toggle { font-size: 14px; gap: 6px; }
  .reserves-toggle .icon { width: 24px; height: 24px; font-size: 13px; }
  .reserves-arrow { font-size: 11px; }
}
</style>
