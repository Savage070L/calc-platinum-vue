<template>
  <span class="info-wrap" ref="btnRef">
    <button
      class="info-btn"
      type="button"
      :class="{ active: open }"
      @click.stop="toggle"
    >i</button>

    <Teleport to="body">
      <!-- backdrop to close on outside click -->
      <div v-if="open" class="info-backdrop" @click="open = false" />

      <div v-if="open" class="info-popup" :style="popupStyle">
        <div class="popup-head">
          <span class="popup-title-text">{{ title }}</span>
          <button class="popup-x" type="button" @click="open = false">✕</button>
        </div>
        <div class="popup-body" v-html="text" />
      </div>
    </Teleport>
  </span>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';

defineProps({
  title: { type: String, required: true },
  text:  { type: String, required: true },
});

const open   = ref(false);
const btnRef = ref(null);
const pos    = ref({ left: 0, top: 0 });

function toggle() {
  open.value = !open.value;
  if (open.value) nextTick(calcPos);
}

function calcPos() {
  if (!btnRef.value) return;
  const r = btnRef.value.getBoundingClientRect();
  const W = 320;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Horizontal: try to align left edge with button; clamp so popup stays in viewport
  let left = r.left;
  if (left + W > vw - 12) left = vw - W - 12;
  if (left < 12) left = 12;

  // Vertical: below button; if not enough room, above
  let top = r.bottom + 8;
  if (top + 280 > vh) top = Math.max(12, r.top - 288);

  pos.value = { left, top };
}

const popupStyle = computed(() => ({
  left: pos.value.left + 'px',
  top:  pos.value.top  + 'px',
}));
</script>

<style>
/* ── Info button ─────────────────────────────── */
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
  cursor: pointer;
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

/* ── Backdrop ───────────────────────────────── */
.info-backdrop {
  position: fixed; inset: 0;
  z-index: 9990;
  background: transparent;
}

/* ── Popup ──────────────────────────────────── */
.info-popup {
  position: fixed;
  z-index: 9999;
  background: #ffffff;
  border: 1px solid rgba(45,81,113,0.18);
  border-radius: 14px;
  width: 320px;
  overflow: hidden;
  animation: popIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both;
}
@keyframes popIn {
  from { opacity: 0; transform: scale(0.88) translateY(-6px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}

.popup-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px 10px;
  background: linear-gradient(135deg, #294A69, #2D5171);
  gap: 8px;
}
.popup-title-text {
  font-size: 13px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.5px;
  color: white; flex: 1;
}
.popup-x {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.2);
  color: white;
  font-size: 11px; font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; padding: 0;
  transition: background 0.15s;
}
.popup-x:hover { background: rgba(255,255,255,0.35); }

.popup-body {
  padding: 13px 15px 15px;
  font-size: 13px; line-height: 1.6;
  color: #1A2E3F;
}
.popup-body b { font-weight: 700; color: #1F3A55; }
.popup-body br + br { display: block; margin-top: 6px; }
</style>
