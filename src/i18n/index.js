import { computed, reactive } from 'vue';
import ru from './ru.js';
import kk from './kk.js';

const DICTS = { ru, kk };

function detectLocale() {
  try {
    const params = new URLSearchParams(window.location.search);
    const lang = (params.get('lang') || '').toLowerCase();
    if (lang === 'kk' || lang === 'kz' || lang === 'kaz') return 'kk';
    return 'ru';
  } catch {
    return 'ru';
  }
}

const state = reactive({
  locale: detectLocale(),
});

function resolve(path, dict) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), dict);
}

function interpolate(tpl, vars) {
  if (!vars || typeof tpl !== 'string') return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}

export function useI18n() {
  const t = (path, vars) => {
    const dict = DICTS[state.locale] || DICTS.ru;
    const fallback = DICTS.ru;
    const v = resolve(path, dict) ?? resolve(path, fallback);
    return interpolate(v, vars);
  };

  const tip = (key) => {
    const dict = DICTS[state.locale] || DICTS.ru;
    const fallback = DICTS.ru;
    return resolve(`tips.${key}`, dict) ?? resolve(`tips.${key}`, fallback) ?? { title: '', text: '' };
  };

  const pluralYears = (n) => {
    const dict = DICTS[state.locale] || DICTS.ru;
    return dict.pluralYears(n);
  };

  const locale = computed({
    get: () => state.locale,
    set: (v) => { state.locale = v in DICTS ? v : 'ru'; },
  });

  const dict = computed(() => DICTS[state.locale] || DICTS.ru);

  return { t, tip, pluralYears, locale, dict };
}
