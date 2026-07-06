/**
 * v-fit-text: shrinks an element's font-size until its content fits within its
 * parent's content box. Re-runs on parent resize and on content updates.
 *
 * Usage:
 *   <span v-fit-text>{{ value }}</span>
 *   <span v-fit-text="{ min: 12, max: 56 }">{{ value }}</span>
 */

function computeAvailableWidth(el) {
  const parent = el.parentElement;
  if (!parent) return 0;
  const cs = getComputedStyle(parent);
  const pad = parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
  return parent.clientWidth - pad - 1;
}

function fitOne(el) {
  const opts = el._fitOpts || {};
  const min = opts.min ?? 10;
  const max = opts.max ?? 60;
  const available = computeAvailableWidth(el);
  if (available <= 0) return;

  // Start at max, shrink until fits. Preserves scale for short values.
  let size = max;
  el.style.fontSize = size + 'px';
  // scrollWidth also accounts for overflow
  while (el.scrollWidth > available && size > min) {
    size -= 1;
    el.style.fontSize = size + 'px';
  }
}

export const vFitText = {
  mounted(el, binding) {
    const opts = (binding && typeof binding.value === 'object' && binding.value) || {};
    el._fitOpts = opts;

    const run = () => fitOne(el);
    el._fitRun = run;

    const parent = el.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => run());
      ro.observe(parent);
      el._fitRO = ro;
    }

    const mo = new MutationObserver(() => run());
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    el._fitMO = mo;

    // Initial pass: сразу же (элемент уже в DOM — убирает вспышку крупного
    // шрифта до первого paint), затем контрольный прогон после отрисовки.
    run();
    requestAnimationFrame(() => requestAnimationFrame(run));
  },

  updated(el, binding) {
    if (binding && typeof binding.value === 'object' && binding.value) {
      el._fitOpts = binding.value;
    }
    if (el._fitRun) requestAnimationFrame(el._fitRun);
  },

  beforeUnmount(el) {
    if (el._fitRO) el._fitRO.disconnect();
    if (el._fitMO) el._fitMO.disconnect();
    el._fitRO = null;
    el._fitMO = null;
    el._fitRun = null;
  },
};
