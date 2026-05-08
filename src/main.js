import { createApp } from 'vue';
import App from './App.vue';
import { useI18n } from './i18n/index.js';
import { vFitText } from './directives/fitText.js';

const { locale, t } = useI18n();
document.documentElement.lang = locale.value;
document.title = t('appTitle');

const app = createApp(App);
app.directive('fit-text', vFitText);
app.mount('#app');
