<template>
  <div id="app">
    <main class="app-main">
      <InsuranceCalculator />
    </main>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import InsuranceCalculator from './components/InsuranceCalculator.vue';

// ── iframe height sync ───────────────────────────────────────────
// When embedded in a parent site via <iframe>, post the current document
// height so the parent can resize the iframe to avoid inner scrollbars and
// empty space below the content.
let resizeObserver = null;
let lastHeight = 0;

function sendHeight() {
  if (window.parent === window) return; // not inside an iframe — nothing to do
  const h = document.documentElement.scrollHeight;
  if (h === lastHeight) return;
  lastHeight = h;
  window.parent.postMessage({ type: 'resize', height: h }, '*');
}

onMounted(() => {
  sendHeight();
  resizeObserver = new ResizeObserver(sendHeight);
  resizeObserver.observe(document.body);
  window.addEventListener('load', sendHeight);
});

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect();
  window.removeEventListener('load', sendHeight);
});
</script>

<style>
:root {
  /* Blue / Green palette */
  --primary:         #2D5171;
  --primary-dark:    #294A69;
  --primary-light:   #4A7295;
  --primary-pale:    #E5ECF3;
  --secondary:       #79B740;
  --secondary-light: #8BC353;
  --secondary-pale:  #EEF6E0;

  /* Surfaces */
  --bg:          #FFFFFF;
  --surface:     #FFFFFF;
  --panel-dark:  #0B1F35;
  --panel-dark-2:#152D4A;
  --panel-light: #FFFFFF;

  /* Text */
  --text-main:   #1A2E3F;
  --text-light:  #5A7A96;
  --accent:      #2D5171;
  --accent-hover:#4A7295;

  /* Borders */
  --border-color: rgba(45,81,113,0.14);

  /* Shadows disabled — flat UI on white background */
  --shadow-out:       none;
  --shadow-out-sm:    none;
  --shadow-in:        none;
  --shadow-btn:       none;
  --shadow-btn-press: none;

  --radius: 20px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  overflow-x: hidden;
}

html {
  overflow-x: hidden;
}

/* ── Global range slider ─── */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 5px;
  border-radius: 5px;
  outline: none;
  cursor: pointer;
  width: 100%;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-light), var(--primary));
  cursor: pointer;
  transition: transform 0.15s ease;
}
input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}
input[type="range"]::-moz-range-thumb {
  width: 22px; height: 22px;
  border: none; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-light), var(--primary));
  cursor: pointer;
}

/* ── Единый плавно вращающийся шеврон (заменяет текстовые ▲/▼) ── */
.chev {
  display: inline-block;
  transition: transform 0.3s cubic-bezier(0.33, 1, 0.68, 1);
}
.chev.open { transform: rotate(180deg); }

/* ── Видимый фокус для клавиатурной навигации ── */
button:focus-visible,
select:focus-visible,
[role="button"]:focus-visible {
  outline: 2px solid #A1C95A;
  outline-offset: 2px;
}

/* ── Уважение к prefers-reduced-motion: гасим декоративные keyframe-анимации.
   transition-duration НЕ трогаем: нулевые transition ломают синхронные
   замеры v-fit-text, а короткие transitions — это state-feedback, не motion. ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
</style>

<style scoped>
.app-header {
  background: var(--panel-dark);
  padding: 13px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}
.app-header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(to right, transparent 0%, var(--primary) 25%, var(--primary-light) 50%, var(--secondary-light) 75%, transparent 100%);
  opacity: 0.7;
}

.logo-pill {
  display: flex; align-items: center; gap: 7px;
  background: var(--panel-dark-2);
  border: 1px solid rgba(74,114,149,0.2);
  border-radius: 14px;
  padding: 7px 16px;
}
.logo-icon { font-size: 16px; }
.logo-text {
  font-size: 14px; font-weight: 700;
  background: linear-gradient(135deg, #A8BDD3, #4A7295);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 0.03em;
}

.header-center { flex: 1; text-align: center; }
.app-title {
  font-size: 20px; font-weight: 800; letter-spacing: 0.06em;
  background: linear-gradient(135deg, #A8BDD3 0%, #4A7295 40%, #2D5171 70%, #8BC353 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-wrap: balance;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-badge {
  background: linear-gradient(135deg, var(--primary-light), var(--primary));
  color: white;
  font-size: 12px; font-weight: 800;
  padding: 5px 14px;
  border-radius: 20px;
  letter-spacing: 0.1em;
  flex-shrink: 0;
}

.app-main { min-height: calc(100vh - 64px); background: #FFFFFF; }

@media (max-width: 720px) {
  .app-header { padding: 10px 14px; flex-wrap: wrap; gap: 6px; }
  .app-title { font-size: 14px; }
  .header-center { order: 3; flex: 100%; }
  .logo-text { font-size: 13px; }
}

@media (max-width: 860px) {
  :root {
    --shadow-out:    0 2px 6px rgba(25,60,110,0.07);
    --shadow-out-sm: 0 1px 3px rgba(25,60,110,0.05);
    --shadow-btn:    0 1px 4px rgba(25,60,110,0.07);
    --radius: 14px;
  }
}
</style>
