# 📋 Руководство разработчика — интеграция калькулятора Pro Life Gold

> **Для кого этот документ:** для разработчика, который создаёт **новый UI** для сайта страховщика.  
> Вам не нужно знать Vue. Вы пишете свой HTML/React/что угодно, а формулы расчёта просто импортируете как готовую библиотеку.

---

## 🧠 Главная идея

Проект состоит из **двух полностью независимых частей**:

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│        UI (дизайн)          │     │     РАСЧЁТЫ (математика)     │
│                             │     │                             │
│  Поля, кнопки, вёрстка      │──→  │  src/core/calculator.js     │
│  (вы пишете это заново      │     │  src/core/actuarial.js      │
│   в стиле вашего сайта)     │  ←──│  src/core/riders.js         │
│                             │     │  src/config/product.js      │
└─────────────────────────────┘     └─────────────────────────────┘
       Ваша работа                       Уже готово, не трогать
```

**Ваша задача:** написать только левую часть. Правая часть уже сделана — вы просто вызываете её функции.

---

## ⚡ Минимальный рабочий пример (copy-paste)

Вот полный пример: создаёте форму, собираете данные, вызываете расчёт, получаете результат.

```js
// 1. Импортируем классы из готового ядра
import { ActuarialEngine }  from './src/core/actuarial.js';
import { PolicyCalculator } from './src/core/calculator.js';
import { RidersCalculator } from './src/core/riders.js';
import { PRODUCT_CONFIG }   from './src/config/product.js';

// 2. Создаём движок ОДИН РАЗ при загрузке страницы (не на каждый клик!)
const engine     = new ActuarialEngine(PRODUCT_CONFIG);
const calculator = new PolicyCalculator(engine, PRODUCT_CONFIG);
const ridersCalc = new RidersCalculator(engine, PRODUCT_CONFIG);

// 3. Вызываем при нажатии кнопки «Рассчитать»
function calculate() {
  // --- Собираем данные из ваших полей формы ---
  const inputs = {
    dob:             '1985-06-15',          // из поля "Дата рождения"
    gender:          'male',                // 'male' или 'female'
    term:            20,                    // из слайдера "Срок" (15..40)
    frequency:       'annual',              // из выпадашки "Периодичность"
    mode:            'sa_to_premium',       // из переключателя "Режим"
    sumAssured:      10_000_000,            // из поля "Страховая сумма" (KZT)
    // premium:      500_000,              // ← если mode = 'premium_to_sa'
    deathBenefitType: 'full_sum_assured',  // обычно не меняется
  };

  // --- Основной расчёт ---
  const result = calculator.fullCalculation(inputs);

  // --- Расчёт райдеров (если пользователь выбрал доп. покрытия) ---
  const x = PolicyCalculator.calculateAge(inputs.dob); // возраст в годах
  const t = inputs.frequency === 'single' ? 1 : inputs.term;

  const ridersResult = ridersCalc.calculateAllRiders({
    x,
    n: inputs.term,
    t,
    gender: inputs.gender,
    frequency: inputs.frequency,
    sumAssured: result.sumAssured,
    annualPremium: result.annualPremium,
    ridersSelection: {
      accidental_death:            { enabled: true },   // включён
      disability_accident_lumpsum: { enabled: false },  // выключен
      trauma:                      { enabled: true, sum: 5_000_000 },
      hospitalization:             { enabled: false },
    },
  });

  // --- Итоговая сумма с доп. покрытиями ---
  const totalRiderPremium = Object.values(ridersResult.riders)
    .reduce((sum, r) => sum + (r.riderPremium ?? 0), 0);

  const totalPremium = result.grossPremium + totalRiderPremium;

  // --- Выводим результаты в ваш UI ---
  console.log('Годовой взнос (KZT):', result.grossPremium);
  console.log('Страховая сумма (KZT):', result.sumAssured);
  console.log('Итого с доп. покрытиями:', totalPremium);
}
```

---

## 📝 Все поля формы — подробно

### Обязательные поля

| Поле | Тип UI-элемента | Значения | Примечание |
|------|----------------|----------|------------|
| **Дата рождения** `dob` | Текстовое поле | Строка `YYYY-MM-DD` | Показывать пользователю в формате ДД.ММ.ГГГГ, передавать в расчёт как `2000-01-30` |
| **Пол** `gender` | Радио-кнопки | `'male'` / `'female'` | |
| **Срок страхования** `term` | Слайдер + число | Целое число от **15** до **40** | Максимальный срок зависит от возраста (см. ниже) |
| **Периодичность взносов** `frequency` | Выпадающий список | `'annual'` / `'semiannual'` / `'quarterly'` / `'monthly'` / `'single'` | |
| **Режим расчёта** `mode` | Переключатель | `'sa_to_premium'` / `'premium_to_sa'` | Определяет, какое из двух полей ниже показывать |
| **Страховая сумма** `sumAssured` | Числовое поле | Любое число > 0 (KZT) | Показывать только если `mode = 'sa_to_premium'` |
| **Взнос** `premium` | Числовое поле | Любое число > 0 (KZT) | Показывать только если `mode = 'premium_to_sa'` |

### Необязательные поля (аннуитет)

Аннуитет — это пенсионные выплаты по окончании договора. Показываются только если пользователь включил галочку «Аннуитетные выплаты».

| Поле | Тип UI-элемента | Значения | Примечание |
|------|----------------|----------|------------|
| **Периодичность выплат** `annuityFrequency` | Выпадающий список | `'annual'` / `'semiannual'` / `'quarterly'` / `'monthly'` | |
| **Срок выплат** `annuityTerm` | Слайдер | Целое число от **1** до **50** | |
| **Гарантированный период** `guaranteedPeriod` | Слайдер | От **0** до значения `annuityTerm` | 0 = гарантированный период отключён |

Чтобы включить аннуитет, добавьте в inputs:
```js
annuityFrequency: 'annual',
annuityTerm: 10,       // 10 лет выплат
guaranteedPeriod: 5,   // из них 5 лет гарантированы
```

### Дополнительные покрытия (райдеры)

Каждый райдер — отдельный чекбокс. Передаются в `ridersCalc.calculateAllRiders(...)`.

| Поле | Название для пользователя | Нужна ли сумма покрытия? |
|------|--------------------------|--------------------------|
| `accidental_death` | Смерть от несчастного случая | ❌ Нет — привязан к страховой сумме |
| `disability_accident_lumpsum` | Инвалидность I–II гр. от НС | ❌ Нет — привязан к страховой сумме |
| `trauma` | Телесные травмы от НС | ✅ Да — пользователь вводит сумму (KZT) |
| `hospitalization` | Госпитализация от НС | ✅ Да — пользователь вводит сумму (KZT) |

---

## 🔗 Зависимости между полями

Важно соблюдать эти правила в UI, чтобы не передавались некорректные данные:

```
Дата рождения → вычисляем возраст (лет)
     │
     └─→ Максимальный срок = min(40, 70 - возраст)
               │
               └─→ Если срок > максимального → автоматически уменьшить

Режим расчёта
     ├─→ 'sa_to_premium'  → показать поле СТРАХОВАЯ СУММА, скрыть ВЗНОС
     └─→ 'premium_to_sa'  → показать поле ВЗНОС, скрыть СТРАХОВАЯ СУММА

Галочка "Аннуитет"
     ├─→ выключена → поля аннуитета скрыты, annuityTerm = 0
     └─→ включена  → показать блок аннуитета

Гарантированный период
     └─→ не может быть больше Срока выплат (annuityTerm)
```

---

## 📊 Что возвращает расчёт (result)

Самые полезные поля из объекта `result`:

| Поле | Описание |
|------|----------|
| `result.grossPremium` | **Итоговый взнос** (основной, без доп. покрытий), KZT |
| `result.sumAssured` | **Страховая сумма**, KZT |
| `result.annualPremium` | Годовой взнос (до применения коэффициента периодичности) |
| `result.reserves` | Массив резервов по годам `[{year, reserve, surrenderValue}, ...]` |
| `result.bonuses` | Массив бонусов к выкупной сумме по годам |
| `result.annuity.annuityPayment` | Размер одной аннуитетной выплаты, KZT |
| `ridersResult.riders.accidental_death.riderPremium` | Доп. взнос за конкретный райдер |

**Пример отображения:**
```js
// Годовой взнос
document.getElementById('result-premium').textContent =
  result.grossPremium.toLocaleString('ru-RU') + ' ₸';

// Страховая сумма
document.getElementById('result-sa').textContent =
  result.sumAssured.toLocaleString('ru-RU') + ' ₸';

// Перевод в USD (если нужно)
const usdRate = 510; // курс, берёте откуда хотите
document.getElementById('result-premium-usd').textContent =
  '$' + Math.round(result.grossPremium / usdRate).toLocaleString('ru-RU');
```

---

## ✅ Checklist для разработчика

- [ ] Запустить проект локально: `npm install && npm run dev` — посмотреть как работает
- [ ] Создать движок **один раз** при загрузке страницы (не пересоздавать каждый раз)
- [ ] Реализовать зависимость: максимальный срок = `min(40, 70 - возраст)`
- [ ] Реализовать: при `mode='sa_to_premium'` → поле «Страховая сумма», иначе → «Взнос»
- [ ] Передавать даты строго в формате `YYYY-MM-DD`
- [ ] Все суммы передавать в **тенге (KZT)** — USD пересчитывать только для отображения
- [ ] Если `frequency = 'single'` — срок уплаты = 1 год (единовременный), это особый режим
- [ ] Добавить debounce на пересчёт (не считать на каждое нажатие клавиши, а через ~500мс)

---

## ❓ Частые вопросы

**Q: Мне нужен Vue/Node.js на сервере?**  
A: Нет. Файлы из `core/` и `config/` — это чистый JavaScript без зависимостей. Работают в любом браузере или Node.js. Если сайт на другом фреймворке — просто скопируйте папки `src/core/` и `src/config/` в свой проект.

**Q: Как работает режим `premium_to_sa`?**  
A: Пользователь вводит взнос → калькулятор обратным счётом находит страховую сумму. Если при этом включены райдеры, используйте метод `calculator.calculateSumAssuredWithRiders(...)` (см. `INTEGRATION_GUIDE.md`, секция 6).

**Q: Все суммы в тенге?**  
A: Да. Внутри ядра только KZT. Для отображения в USD: `usdAmount = Math.round(kztAmount / usdRate)`.

**Q: Откуда брать курс USD?**  
A: Из любого внешнего источника (ЦБ РК API, хардкод, пользовательский ввод). В текущем UI это реализовано в `src/composables/useCurrencyRate.js`.
