<template>
  <span class="info-wrap" ref="btnRef">
    <button
      class="info-btn"
      type="button"
      :class="{ active: open }"
      @click.stop.prevent="onClick"
      @mouseenter="onEnter"
      @mouseleave="onLeave"
    >i</button>

    <Teleport to="body">
      <!-- Прозрачная подложка: ловит клик/тап вне закреплённой подсказки -->
      <div v-if="open && pinned" class="info-backdrop" @click="close" />

      <!-- Пузырь-подсказка у иконки — один и тот же на десктопе и мобильном -->
      <div
        v-if="open"
        class="info-tip"
        :class="[`tip-${placement}`, { pinned }]"
        :style="tipStyle"
        @mouseenter="onEnter"
        @mouseleave="onLeave"
        @click.stop
      >
        <span class="tip-arrow" :style="arrowStyle" />
        <div class="tip-title">{{ title }}</div>
        <div class="tip-body" v-html="text" />
      </div>
    </Teleport>
  </span>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';

defineProps({
  title: { type: String, required: true },
  text:  { type: String, required: true },
});

const open      = ref(false);   // подсказка видна
const pinned    = ref(false);   // закреплена кликом/тапом (не зависит от мыши)
const btnRef    = ref(null);
const pos       = ref({ left: 0, top: 0 });
const tipW      = ref(330);
const arrowLeft = ref(160);
const placement = ref('bottom'); // bottom — пузырь под иконкой, top — над ней

const canHover = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  clearTimeout(hideTimer);
});

function onKey(e) {
  if (e.key === 'Escape') close();
}

// ── Hover (только устройства с мышью): показать при наведении, спрятать при
// уходе. Небольшая задержка позволяет перевести курсор с иконки на пузырь.
let hideTimer = null;
function onEnter() {
  if (!canHover()) return;
  clearTimeout(hideTimer);
  if (!open.value) show();
}
function onLeave() {
  if (!canHover() || pinned.value) return;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { open.value = false; }, 140);
}

// Клик/тап: закрепить; повторный клик по иконке или клик вне — закрыть.
function onClick() {
  if (pinned.value) { close(); return; }
  show();
  pinned.value = true;
}

function show() {
  open.value = true;
  nextTick(calcPos);
}
function close() {
  open.value = false;
  pinned.value = false;
}

function calcPos() {
  if (!btnRef.value) return;
  const r = btnRef.value.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // На узких экранах пузырь занимает почти всю ширину
  const W = Math.min(330, vw - 24);
  tipW.value = W;

  // Горизонталь: центр пузыря по центру иконки, с прижимом к краям экрана
  let left = r.left + r.width / 2 - W / 2;
  if (left + W > vw - 12) left = vw - W - 12;
  if (left < 12) left = 12;

  // Стрелочка указывает на центр иконки
  arrowLeft.value = Math.min(Math.max(r.left + r.width / 2 - left, 16), W - 16);

  // Вертикаль: под иконкой; если не помещается — над ней
  const estH = 220;
  if (r.bottom + 10 + estH > vh && r.top - 10 - estH > 0) {
    placement.value = 'top';
    pos.value = { left, top: r.top - 10 };
  } else {
    placement.value = 'bottom';
    pos.value = { left, top: r.bottom + 10 };
  }
}

const tipStyle = computed(() => ({
  left:  pos.value.left + 'px',
  top:   pos.value.top  + 'px',
  width: tipW.value + 'px',
}));
const arrowStyle = computed(() => ({ left: arrowLeft.value + 'px' }));
</script>

<style>
/* ── Иконка (i) ─────────────────────────────── */
.info-wrap {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  position: relative;
  flex-shrink: 0;
}
.info-btn {
  width: 17px; height: 17px;
  border-radius: 50%;
  border: 1.5px solid #2D5171;
  background: transparent;
  color: #2D5171;
  font-size: 10px; font-weight: 700;
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
  cursor: help;
  display: inline-flex; align-items: center; justify-content: center;
  opacity: 0.6;
  transition: opacity 0.15s, background 0.15s, transform 0.15s;
  flex-shrink: 0; padding: 0; line-height: 1;
  outline: none;
}
.info-btn:hover, .info-btn.active {
  opacity: 1;
  background: #2D5171;
  color: white;
  transform: scale(1.1);
}

/* ── Подложка для закрытия по клику/тапу вне ── */
.info-backdrop {
  position: fixed; inset: 0;
  z-index: 9990;
  background: transparent;
}

/* ── Пузырь-подсказка ───────────────────────── */
.info-tip {
  position: fixed;
  z-index: 9999;
  background: linear-gradient(160deg, #24405C, #1B2F47);
  border: 1px solid rgba(95, 189, 245, 0.28);
  border-radius: 12px;
  padding: 12px 14px 13px;
  box-shadow: 0 14px 38px rgba(5, 14, 24, 0.55),
              inset 0 1px 0 rgba(255, 255, 255, 0.06);
  pointer-events: auto;
}
.tip-bottom { animation: tipInDown 0.16s ease-out both; transform-origin: top center; }
.tip-top    { animation: tipInUp   0.16s ease-out both; transform: translateY(-100%); transform-origin: bottom center; }
@keyframes tipInDown {
  from { opacity: 0; transform: translateY(4px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
@keyframes tipInUp {
  from { opacity: 0; transform: translateY(calc(-100% + 4px)) scale(0.97); }
  to   { opacity: 1; transform: translateY(-100%)             scale(1); }
}

/* Стрелочка к иконке */
.tip-arrow {
  position: absolute;
  width: 12px; height: 12px;
  border: 1px solid rgba(95, 189, 245, 0.28);
  transform: translateX(-50%) rotate(45deg);
}
.tip-bottom .tip-arrow {
  top: -7px;
  background: #24405C;
  border-right: none; border-bottom: none;
}
.tip-top .tip-arrow {
  bottom: -7px;
  background: #1B2F47;
  border-left: none; border-top: none;
}

.tip-title {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #A1C95A;
  margin-bottom: 6px;
}
.tip-body {
  font-size: 13.5px;
  line-height: 1.55;
  color: #E2EEF8;
}
.tip-body b { font-weight: 700; color: #FFFFFF; }

/* Закреплённая подсказка чуть заметнее */
.info-tip.pinned { border-color: rgba(161, 201, 90, 0.55); }

/* На мобильном — текст крупнее для удобства чтения */
@media (max-width: 720px) {
  .tip-title { font-size: 13px; }
  .tip-body  { font-size: 14.5px; line-height: 1.6; }
}
</style>
