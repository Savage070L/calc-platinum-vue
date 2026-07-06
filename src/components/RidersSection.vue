<template>
  <div class="riders-section">

    <!-- ── Группа 1: Смерть ─── -->
    <div class="rider-group-label">{{ t('riders.groupDeath') }}</div>

    <div class="rider-check-row">
      <label class="rider-chk-wrap">
        <input type="checkbox" v-model="local.accidental_death.enabled" class="rider-chk" />
        <span class="rider-chk-box"></span>
      </label>
      <span class="rider-name">
        {{ t('riders.accidentalDeath') }}
        <InfoTooltip v-bind="tip('accidentalDeath')" />
      </span>
    </div>

    <div class="rider-check-row">
      <label class="rider-chk-wrap">
        <input type="checkbox" v-model="local.traffic_death.enabled" class="rider-chk" />
        <span class="rider-chk-box"></span>
      </label>
      <span class="rider-name">
        {{ t('riders.trafficDeath') }}
        <InfoTooltip v-bind="tip('trafficDeath')" />
      </span>
    </div>

    <!-- ── Группа 2: Инвалидность ─── -->
    <div class="rider-group-label">{{ t('riders.groupDisability') }}</div>

    <div class="rider-check-row">
      <label class="rider-chk-wrap">
        <input type="checkbox" v-model="local.premium_waiver.enabled" class="rider-chk" />
        <span class="rider-chk-box"></span>
      </label>
      <span class="rider-name">
        {{ t('riders.premiumWaiver') }}
        <InfoTooltip v-bind="tip('premiumWaiver')" />
      </span>
    </div>

    <div class="rider-check-row">
      <label class="rider-chk-wrap">
        <input type="checkbox" v-model="local.disability_any_lumpsum.enabled" class="rider-chk" />
        <span class="rider-chk-box"></span>
      </label>
      <span class="rider-name">
        {{ t('riders.disabilityAnyLumpsum') }}
        <InfoTooltip v-bind="tip('disabilityAnyLumpsum')" />
      </span>
    </div>

    <div class="rider-check-row">
      <label class="rider-chk-wrap">
        <input type="checkbox" v-model="local.disability_accident_lumpsum.enabled" class="rider-chk" />
        <span class="rider-chk-box"></span>
      </label>
      <span class="rider-name">
        {{ t('riders.disabilityAccidentLumpsum') }}
        <InfoTooltip v-bind="tip('disabilityAccidentLumpsum')" />
      </span>
    </div>

    <!-- ── Группа 2: Травмы и госпитализация ─── -->
    <div class="rider-group-label">{{ t('riders.groupTraumaHosp') }}</div>

    <div class="rider-check-row with-select">
      <label class="rider-chk-wrap">
        <input type="checkbox" v-model="local.trauma.enabled" class="rider-chk" />
        <span class="rider-chk-box"></span>
      </label>
      <div class="rider-row-content">
        <span class="rider-name">
          {{ t('riders.trauma') }}
          <span class="rider-hint">{{ t('riders.chooseSum') }}</span>
          <InfoTooltip v-bind="tip('trauma')" />
        </span>
        <select v-model.number="local.trauma.sum" class="select-green">
          <option v-for="v in TRAUMA_SUMS" :key="v" :value="v">{{ fmtKzt(v) }}</option>
        </select>
      </div>
    </div>

    <div class="rider-check-row with-select">
      <label class="rider-chk-wrap">
        <input type="checkbox" v-model="local.temporary_disability.enabled" class="rider-chk" />
        <span class="rider-chk-box"></span>
      </label>
      <div class="rider-row-content">
        <span class="rider-name">
          {{ t('riders.temporaryDisability') }}
          <span class="rider-hint">{{ t('riders.chooseSum') }}</span>
          <InfoTooltip v-bind="tip('temporaryDisability')" />
        </span>
        <select v-model.number="local.temporary_disability.sum" class="select-green">
          <option v-for="v in MILLION_RANGE_SUMS" :key="v" :value="v">{{ fmtKzt(v) }}</option>
        </select>
      </div>
    </div>

    <div class="rider-check-row with-select">
      <label class="rider-chk-wrap">
        <input type="checkbox" v-model="local.hospitalization.enabled" class="rider-chk" />
        <span class="rider-chk-box"></span>
      </label>
      <div class="rider-row-content">
        <span class="rider-name">
          {{ t('riders.hospitalization') }}
          <span class="rider-hint">{{ t('riders.chooseSum') }}</span>
          <InfoTooltip v-bind="tip('hospitalization')" />
        </span>
        <select v-model.number="local.hospitalization.sum" class="select-green">
          <option v-for="v in MILLION_RANGE_SUMS" :key="v" :value="v">{{ fmtKzt(v) }}</option>
        </select>
      </div>
    </div>

    <!-- ── Группа 3: Критические заболевания ─── -->
    <div class="rider-group-label">{{ t('riders.groupCi') }}</div>

    <div class="rider-check-row with-select">
      <label class="rider-chk-wrap">
        <input type="checkbox" v-model="local.critical_illness.enabled" class="rider-chk" />
        <span class="rider-chk-box"></span>
      </label>
      <div class="rider-row-content">
        <span class="rider-name">
          {{ t('riders.criticalIllness') }}
          <span class="rider-hint">{{ t('riders.chooseSum') }}</span>
          <InfoTooltip v-bind="tip('criticalIllness')" />
        </span>
        <select v-model.number="local.critical_illness.sum" class="select-green">
          <option v-for="v in MILLION_RANGE_SUMS" :key="v" :value="v">{{ fmtKzt(v) }}</option>
        </select>
      </div>
    </div>

    <!-- ── Группа 4: Дополнительный застрахованный ─── -->
    <div class="rider-group-label">{{ t('riders.groupExtraInsured') }}</div>

    <div class="rider-check-row with-select">
      <label class="rider-chk-wrap">
        <input type="checkbox" v-model="local.trauma_extra.enabled" class="rider-chk" />
        <span class="rider-chk-box"></span>
      </label>
      <div class="rider-row-content">
        <span class="rider-name">
          {{ t('riders.traumaExtra') }}
          <span class="rider-hint">{{ t('riders.chooseSum') }}</span>
          <InfoTooltip v-bind="tip('traumaExtra')" />
        </span>
        <select v-model.number="local.trauma_extra.sum" class="select-green">
          <option v-for="v in TRAUMA_SUMS" :key="v" :value="v">{{ fmtKzt(v) }}</option>
        </select>
      </div>
    </div>

    <div v-if="t('riders.legend')" class="rider-legend">{{ t('riders.legend') }}</div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import InfoTooltip from './InfoTooltip.vue';
import { useI18n } from '../i18n/index.js';

const { t, tip } = useI18n();

const props = defineProps({ modelValue: { type: Object, required: true } });
const emit = defineEmits(['update:modelValue']);

const TRAUMA_SUMS         = [500_000, 1_000_000, 1_500_000, 2_000_000];
const MILLION_RANGE_SUMS  = [1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000];

function fmtKzt(v) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₸';
}

const local = ref({
  // Смерть и инвалидность
  accidental_death:            { enabled: false, ...props.modelValue.accidental_death },
  traffic_death:               { enabled: false, ...props.modelValue.traffic_death },
  premium_waiver:              { enabled: false, ...props.modelValue.premium_waiver },
  disability_any_lumpsum:      { enabled: false, ...props.modelValue.disability_any_lumpsum },
  disability_accident_lumpsum: { enabled: false, ...props.modelValue.disability_accident_lumpsum },
  // Травмы и госпитализация
  trauma:                      { enabled: false, sum: 1_000_000, ...props.modelValue.trauma },
  temporary_disability:        { enabled: false, sum: 1_000_000, ...props.modelValue.temporary_disability },
  hospitalization:             { enabled: false, sum: 1_000_000, ...props.modelValue.hospitalization },
  // Критические заболевания
  critical_illness:            { enabled: false, sum: 1_000_000, ...props.modelValue.critical_illness },
  // Дополнительный застрахованный
  trauma_extra:                { enabled: false, sum: 1_000_000, ...props.modelValue.trauma_extra },
});

// Взаимоисключения внутри блока «Инвалидность»: освобождение от взносов, инв. (ЛП) и инв. (НС)
// логически конфликтуют — выбор одного снимает остальные.
const DISABILITY_KEYS = ['premium_waiver', 'disability_any_lumpsum', 'disability_accident_lumpsum'];
function setupDisabilityExclusion() {
  for (const key of DISABILITY_KEYS) {
    watch(() => local.value[key].enabled, (on) => {
      if (!on) return;
      for (const other of DISABILITY_KEYS) {
        if (other !== key && local.value[other].enabled) {
          local.value[other].enabled = false;
        }
      }
    });
  }
}
setupDisabilityExclusion();

// Аналогично для блока «Смерть»: смерть от НС и смерть в ДТП взаимоисключают друг друга.
watch(() => local.value.accidental_death.enabled, (on) => {
  if (on && local.value.traffic_death.enabled) local.value.traffic_death.enabled = false;
});
watch(() => local.value.traffic_death.enabled, (on) => {
  if (on && local.value.accidental_death.enabled) local.value.accidental_death.enabled = false;
});

watch(local, (val) => emit('update:modelValue', { ...val }), { deep: true });
</script>

<style scoped>
.rider-group-label {
  font-size: 15px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--rider-group, var(--text-light, #5FBDF5));
  margin: 10px 0 5px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(95,189,245,0.25);
}

.rider-check-row {
  display: grid; grid-template-columns: 22px 1fr;
  gap: 12px; align-items: center;
  padding: 8px 0;
  min-height: 52px;
}
.rider-check-row.with-select { align-items: center; }

.rider-chk-wrap {
  position: relative; display: inline-flex; align-items: center; cursor: pointer; flex-shrink: 0;
}
.rider-chk {
  position: absolute; opacity: 0; width: 0; height: 0;
}
.rider-chk-box {
  display: block; width: 20px; height: 20px;
  border-radius: 5px;
  border: none;
  background: rgba(255,255,255,0.15);
  transition: all 0.2s ease;
  position: relative;
}
.rider-chk:checked ~ .rider-chk-box {
  background: linear-gradient(135deg, #A1C95A, #5C8E2F);
}
.rider-chk:checked ~ .rider-chk-box::after {
  content: '✓';
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px; color: white; font-weight: 800;
}

.rider-name {
  font-size: 17px; color: var(--text-main, #E8F4FD); font-weight: 500;
  line-height: 1.3; flex: 1; min-width: 0;
}
.rider-hint {
  font-size: 13px; color: var(--text-light, #7FB3D3);
  font-weight: 400; display: inline; margin-left: 6px;
  white-space: nowrap;
}

.rider-row-content {
  display: flex; align-items: center;
  gap: 16px; flex-wrap: nowrap;
  min-width: 0;
}

.rider-row-content select {
  flex-shrink: 0; width: 160px; padding: 8px 12px;
  border: 1px solid var(--border-color, rgba(74,114,149,0.2));
  border-radius: 8px; font-size: 16px;
  background: var(--surface, #294A69);
  box-shadow: var(--shadow-in);
  color: var(--text-main, #E8F4FD);
  outline: none;
  font-family: 'SF Mono', 'Menlo', monospace; font-weight: 600;
  cursor: pointer;
}
.rider-row-content select:focus { border-color: var(--accent, #5C8E2F); }

/* ── Brand-green select (rider sum) ── */
.rider-row-content select.select-green {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: transparent;
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='white' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>"),
    linear-gradient(135deg, #A1C95A 0%, #5C8E2F 100%);
  background-repeat: no-repeat, no-repeat;
  background-position: right 12px center, center;
  background-size: 12px 8px, auto;
  color: #FFFFFF;
  font-weight: 700;
  border: none;
  padding-right: 32px;
  box-shadow: none;
}
.rider-row-content select.select-green:focus {
  border: none;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.35);
}
.rider-row-content select.select-green option {
  background: #FFFFFF;
  color: #1A2E3F;
  font-weight: 600;
}

.rider-name :deep(.info-btn) {
  border-color: rgba(255,255,255,0.5);
  color: rgba(255,255,255,0.6);
}
.rider-name :deep(.info-btn:hover),
.rider-name :deep(.info-btn.active) {
  background: rgba(255,255,255,0.9);
  border-color: white;
  color: #294A69;
}
.rider-legend {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-color, rgba(74,114,149,0.2));
  font-size: 13px;
  font-weight: 600;
  color: var(--text-light, #7FB3D3);
}

@media (max-width: 720px) {
  .rider-group-label {
    font-size: 13px;
  }

  .rider-name {
    font-size: 16px;
    line-height: 1.25;
  }

  .rider-hint {
    display: inline;
    margin-left: 0;
    font-size: 12px;
    white-space: nowrap;
  }

  .rider-row-content { flex-wrap: wrap; gap: 8px; }
  .rider-row-content select { width: 100%; }
}
</style>
