<template>
  <div class="chart-card" v-if="chartData.length >= 2">
    <h3>
      <span class="icon">📈</span>
      График страхового резерва
    </h3>

    <div class="chart-wrap" @mouseleave="hideTooltip">
      <svg
        ref="svgEl"
        :viewBox="`0 0 ${W} ${H}`"
        width="100%"
        height="auto"
        class="chart-svg"
        @mousemove="onMouseMove"
        @mouseleave="hideTooltip"
      >
        <defs>
          <linearGradient id="reserveAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#2D5171" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#2D5171" stop-opacity="0.02"/>
          </linearGradient>
          <linearGradient id="savingsAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#8BC353" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#8BC353" stop-opacity="0.02"/>
          </linearGradient>
        </defs>

        <!-- Horizontal grid lines -->
        <line
          v-for="(gl, i) in gridLines" :key="'gl'+i"
          :x1="ML" :y1="gl.y" :x2="W - MR" :y2="gl.y"
          stroke="rgba(45,81,113,0.1)" stroke-width="1"
        />

        <!-- Y labels -->
        <text
          v-for="(gl, i) in gridLines" :key="'yl'+i"
          :x="ML - 8" :y="gl.y + 4"
          text-anchor="end" font-size="11" fill="#5A7A96"
          font-family="SF Mono, Menlo, monospace"
        >{{ gl.label }}</text>

        <!-- X labels -->
        <text
          v-for="(xl, i) in xLabels" :key="'xl'+i"
          :x="xl.x" :y="H - MB + 17"
          text-anchor="middle" font-size="11" fill="#5A7A96"
        >{{ xl.label }}</text>

        <!-- Axes -->
        <line :x1="ML" :y1="MT" :x2="ML" :y2="MT+IH"
          stroke="rgba(45,81,113,0.2)" stroke-width="1"/>
        <line :x1="ML" :y1="MT+IH" :x2="W-MR" :y2="MT+IH"
          stroke="rgba(45,81,113,0.2)" stroke-width="1"/>

        <!-- Area fills (straight segments) -->
        <path :d="savingsAreaPath" fill="url(#savingsAreaGrad)"/>
        <path :d="reserveAreaPath" fill="url(#reserveAreaGrad)"/>

        <!-- Savings line (green, dashed) -->
        <polyline
          :points="savingsPolyline"
          fill="none"
          stroke="#8BC353"
          stroke-width="2"
          stroke-dasharray="7,4"
          opacity="0.85"
        />

        <!-- Reserve line (blue, solid) -->
        <polyline
          :points="reservePolyline"
          fill="none"
          stroke="#2D5171"
          stroke-width="2.5"
        />

        <!-- ── Hover overlay ───────────────── -->
        <g v-if="tooltip.visible">
          <!-- Vertical reference line -->
          <line
            :x1="tooltip.x" :y1="MT"
            :x2="tooltip.x" :y2="MT+IH"
            stroke="rgba(0,0,0,0.12)"
            stroke-width="1"
            stroke-dasharray="4,3"
          />
          <!-- Dot on reserve line -->
          <circle
            :cx="tooltip.x" :cy="tooltip.reserveY"
            r="5" fill="#2D5171" stroke="white" stroke-width="2"
          />
          <!-- Dot on savings line -->
          <circle
            :cx="tooltip.x" :cy="tooltip.savingsY"
            r="4" fill="#8BC353" stroke="white" stroke-width="2"
          />

          <!-- Tooltip box -->
          <g :transform="`translate(${tooltipBoxX}, ${tooltipBoxY})`">
            <rect
              x="0" y="0" :width="TW" :height="TH" rx="8"
              fill="#0B1F35" opacity="0.93"
            />
            <!-- Year / Date header -->
            <text x="10" y="18" fill="#A8BDD3" font-size="12" font-weight="700">
              Год {{ tooltip.year }} ({{ tooltip.date }})
            </text>
            <!-- Reserve row -->
            <circle cx="14" cy="31" r="4" fill="#2D5171"/>
            <text x="24" y="35" fill="#B3D9FF" font-size="11">
              Страх. резерв: {{ tooltip.reserveVal }}
            </text>
            <!-- Savings row -->
            <circle cx="14" cy="49" r="4" fill="#8BC353"/>
            <text x="24" y="53" fill="#C0DDA3" font-size="11">
              Простые нак.: {{ tooltip.savingsVal }}
            </text>
          </g>
        </g>
      </svg>
    </div>

    <!-- Legend -->
    <div class="chart-legend">
      <div class="legend-item">
        <span class="legend-line blue-solid"></span>
        <span>Страховой резерв</span>
      </div>
      <div class="legend-item">
        <span class="legend-line green-dashed"></span>
        <span>Простые накопления</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { formatMoney } from '../composables/useInsuranceCalc.js';

const props = defineProps({ result: { type: Object, default: null } });

/* ── Chart dimensions ─────────────────── */
const W = 600, H = 260;
const ML = 78, MR = 16, MT = 18, MB = 38;
const IW = W - ML - MR;
const IH = H - MT - MB;

/* ── Tooltip box dimensions ─────────────── */
const TW = 190, TH = 62;

/* ── SVG ref for coordinate mapping ─────── */
const svgEl = ref(null);

/* ── Data ───────────────────────────────── */
const chartData = computed(() => props.result?.reserves ?? []);

// Фактически уплачиваемая сумма в год (для периодических взносов)
// или единовременный взнос (для single).
const annualPremium = computed(() => {
  if (!props.result) return 0;
  const freq = props.result.frequency;
  if (freq === 'single') return props.result.grossPremium || 0;
  const mult = { annual: 1, semiannual: 2, quarterly: 4, monthly: 12 };
  return (props.result.grossPremium || 0) * (mult[freq] || 1);
});

// Простые накопления для года N:
// - periodic: накопленная сумма = N × годовой взнос
// - single:   одна выплата, сумма фиксирована
function simpleSavingsForYear(yearNum) {
  if (props.result?.frequency === 'single') return annualPremium.value;
  return yearNum * annualPremium.value;
}

// Policy anniversary date for year N
function policyDate(yearNum) {
  const base = props.result?.calcDate || new Date().toISOString().slice(0, 10);
  const [y, m, d] = base.split('-');
  return `${d}.${m}.${parseInt(y, 10) + yearNum}`;
}

const maxVal = computed(() => {
  if (!chartData.value.length) return 1;
  // Clamp negative reserves to 0 for scale calculation
  const reserveMax = Math.max(...chartData.value.map(d => Math.max(0, d.reserve || 0)));
  const lastYear   = chartData.value[chartData.value.length - 1]?.year || 0;
  const savingsMax = simpleSavingsForYear(lastYear);
  return Math.max(reserveMax, savingsMax, 1) * 1.1;
});

/* ── Scale helpers ──────────────────────── */
function xPos(i, n) { return ML + (n > 1 ? i / (n - 1) : 0) * IW; }
function yPos(v)    { return MT + IH - (v / maxVal.value) * IH; }
const f = n => n.toFixed(2);

/* ── Polyline strings (straight lines) ──── */
const reservePolyline = computed(() => {
  const data = chartData.value, n = data.length;
  if (n < 2) return '';
  // Clamp negative reserves to 0
  return data.map((d, i) => `${f(xPos(i, n))},${f(yPos(Math.max(0, d.reserve || 0)))}`).join(' ');
});

const savingsPolyline = computed(() => {
  const data = chartData.value, n = data.length;
  if (n < 2) return '';
  return data.map((d, i) => `${f(xPos(i, n))},${f(yPos(simpleSavingsForYear(d.year)))}`).join(' ');
});

/* ── Area paths ─────────────────────────── */
function polylineToArea(ptStr) {
  if (!ptStr) return '';
  const pts = ptStr.trim().split(' ');
  if (!pts.length) return '';
  const first = pts[0], last = pts[pts.length - 1];
  const firstX = first.split(',')[0];
  const lastX  = last.split(',')[0];
  const bottom = f(MT + IH);
  return `M ${firstX},${bottom} L ${pts.join(' L ')} L ${lastX},${bottom} Z`;
}

const reserveAreaPath  = computed(() => polylineToArea(reservePolyline.value));
const savingsAreaPath  = computed(() => polylineToArea(savingsPolyline.value));

/* ── Grid ───────────────────────────────── */
const gridLines = computed(() => {
  const count = 4;
  return Array.from({ length: count + 1 }, (_, i) => {
    const v = (maxVal.value / count) * i;
    return { y: yPos(v), label: fmtAxis(v) };
  });
});

// X-axis labels every 5 years, always include year 1 and the last year
const xLabels = computed(() => {
  const data = chartData.value, n = data.length;
  if (!n) return [];
  return data.reduce((acc, d, i) => {
    if (d.year === 1 || d.year % 5 === 0 || i === n - 1)
      acc.push({ x: xPos(i, n), label: d.year });
    return acc;
  }, []);
});

function fmtAxis(v) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

/* ── Tooltip ────────────────────────────── */
const tooltip = reactive({
  visible: false,
  x: 0, reserveY: 0, savingsY: 0,
  year: 0, age: 0, date: '',
  reserveVal: '', savingsVal: '',
});

const tooltipBoxX = computed(() => {
  // Flip to left side if too close to right edge
  return tooltip.x + 15 + TW > W - MR
    ? tooltip.x - 15 - TW
    : tooltip.x + 15;
});
const tooltipBoxY = computed(() => {
  const top = Math.min(tooltip.reserveY, tooltip.savingsY) - 10;
  return Math.max(MT, Math.min(top, MT + IH - TH));
});

function onMouseMove(e) {
  if (!svgEl.value) return;
  const data = chartData.value, n = data.length;
  if (n < 2) return;

  // Convert client coords → SVG coords
  const pt = svgEl.value.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const svgPt = pt.matrixTransform(svgEl.value.getScreenCTM().inverse());

  const frac = (svgPt.x - ML) / IW;
  const idx   = Math.max(0, Math.min(Math.round(frac * (n - 1)), n - 1));
  const d     = data[idx];
  const reserveVal = Math.max(0, d.reserve || 0);
  const savingsVal = simpleSavingsForYear(d.year);

  tooltip.visible    = true;
  tooltip.x          = xPos(idx, n);
  tooltip.reserveY   = yPos(reserveVal);
  tooltip.savingsY   = yPos(savingsVal);
  tooltip.year       = d.year;
  tooltip.age        = d.age;
  tooltip.date       = policyDate(d.year);
  tooltip.reserveVal = formatMoney(reserveVal, 'KZT');
  tooltip.savingsVal = formatMoney(savingsVal, 'KZT');
}

function hideTooltip() { tooltip.visible = false; }
</script>

<style scoped>
.chart-card {
  background: var(--surface, #F5F8FF);
  border-radius: var(--radius, 20px);
  padding: 18px 20px;
  box-shadow: var(--shadow-out);
  animation: fadeIn 0.5s ease-out both;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

h3 {
  font-size: 15px; font-weight: 700;
  color: var(--text-main);
  margin-bottom: 14px;
  display: flex; align-items: center; gap: 9px;
}
h3 .icon {
  font-size: 17px; width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: var(--shadow-out-sm);
}

.chart-wrap {
  border-radius: 12px; overflow: hidden;
  background: linear-gradient(135deg, rgba(45,81,113,0.03) 0%, rgba(255,255,255,0.7) 100%);
  border: 1px solid var(--border-color, rgba(45,81,113,0.12));
  user-select: none;
}
.chart-svg { display: block; cursor: crosshair; }

/* Legend */
.chart-legend {
  display: flex; gap: 20px; margin-top: 12px; justify-content: center;
}
.legend-item {
  display: flex; align-items: center; gap: 7px;
  font-size: 12px; color: var(--text-light); font-weight: 500;
}
.legend-line {
  display: inline-block; width: 28px; height: 3px; border-radius: 2px;
}
.blue-solid { background: #2D5171; }
.green-dashed {
  background: repeating-linear-gradient(
    to right, #8BC353 0, #8BC353 6px, transparent 6px, transparent 10px
  );
}
</style>
