<template>
  <!-- inert: свёрнутый контент недоступен для фокуса и скрин-ридеров -->
  <div class="sc" :class="{ 'sc-open': show }" :inert="!show">
    <div class="sc-inner">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
});
</script>

<style scoped>
/* Плавное раскрытие до автоматической высоты: grid-rows 0fr → 1fr.
   Без JS-измерений; в браузерах без анимации fr-единиц блок просто
   открывается/закрывается мгновенно (поведение как у v-show). */
.sc {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.34s cubic-bezier(0.33, 1, 0.68, 1);
}
.sc.sc-open {
  grid-template-rows: 1fr;
}
.sc-inner {
  overflow: hidden;
  min-height: 0;
  opacity: 0;
  transform: translateY(-6px);
  transition: opacity 0.22s ease, transform 0.3s cubic-bezier(0.33, 1, 0.68, 1);
}
.sc.sc-open .sc-inner {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s ease 0.06s, transform 0.34s cubic-bezier(0.33, 1, 0.68, 1);
}
</style>
