# Pro Life Gold Calculator: инструкция по интеграции на сайт

## 1) Что это и где ядро расчета

Этот проект уже содержит рабочее расчетное ядро.  
UI можно полностью заменить, если сохранить контракт входов/выходов.

Ключевые файлы:
- `src/core/actuarial.js` — актуарный движок и коммутационные таблицы
- `src/core/calculator.js` — расчет основного продукта (премия/СС, резервы, бонусы, аннуитет)
- `src/core/riders.js` — расчет дополнительных покрытий (райдеров)
- `src/config/product.js` — все продуктовые параметры (расходы, ограничения, коэффициенты и т.д.)
- `src/config/mortality.js` — таблицы смертности
- `src/config/ciRates.js` — ставки критических заболеваний
- `src/composables/useInsuranceCalc.js` — готовая orchestration-логика для UI

Важно: для новой верстки/фреймворка ориентируйтесь в первую очередь на `core/` и `config/`.

---

## 2) Быстрый запуск текущей реализации

```bash
npm install
npm run dev
```

Сборка:

```bash
npm run build
npm run preview
```

---

## 3) Как интегрировать в другой UI (рекомендуемый путь)

### Вариант A (самый быстрый): оставить Vue-ядро как виджет

1. Собрать проект (`npm run build`).
2. Подключить собранный bundle на сайт как отдельный блок/микрофронт.
3. При необходимости переопределить стили внешним CSS.

Плюс: минимум риска поломать формулы.  
Минус: сложнее глубоко встроить в существующий UI-kit.

### Вариант B (рекомендуется для нового UI): headless-интеграция

1. Использовать только расчетные модули (`core/`, `config/`).
2. Сделать свой `quote-service` (адаптер) для UI.
3. Вызывать адаптер из React/Vue/Svelte/SSR или backend API.

---

## 4) Контракт входных данных

Ниже вход, который ожидает текущая логика (`useInsuranceCalc.calculate`):

```js
{
  dob: "YYYY-MM-DD",                   // обязательно
  gender: "male" | "female",           // обязательно
  term: number,                        // обязательно, 15..40
  frequency: "annual" | "semiannual" | "quarterly" | "monthly" | "single",
  deathBenefitType: "full_sum_assured" | "paid_premiums",
  mode: "sa_to_premium" | "premium_to_sa",

  // В зависимости от mode:
  sumAssured?: number,                 // если mode=sa_to_premium
  premium?: number,                    // если mode=premium_to_sa

  // Для отображения:
  usdRate?: number,                    // курс USD/KZT

  // Аннуитет:
  annuityFrequency?: "annual" | "semiannual" | "quarterly" | "monthly",
  annuityTerm?: number,                // 0 = отключен
  guaranteedPeriod?: number,

  // Корректировка тарифов таблиц:
  kMult?: number,                      // по умолчанию 1.0
  lAdd?: number,                       // по умолчанию 0.0

  // Доп. покрытия (для Gold в этой версии доступны только эти):
  riders?: {
    accidental_death?: { enabled: boolean, sum?: number },
    disability_accident_lumpsum?: { enabled: boolean, sum?: number },
    trauma?: { enabled: boolean, sum?: number, multiplier?: number },
    hospitalization?: { enabled: boolean, sum?: number }
  }
}
```

Бизнес-ограничения:
- Техническая проверка в коде: возраст `0..80` (см. `validateInputs`)
- `term`: `15..40`
- Возраст выхода: `age + term <= 70`
- Для `sa_to_premium` нужна `sumAssured > 0`
- Для `premium_to_sa` нужна `premium > 0`

Из этого следует фактический максимум возраста на входе:
- `age <= 70 - term`
- при `term >= 15` фактически `age <= 55`

Ограничение покрытий для текущего калькулятора Gold:
- Основное покрытие
- Смерть от НС
- Инвалидность I–II гр. в результате НС
- Телесные травмы от НС
- Госпитализация от НС

---

## 5) Контракт результата

Основные поля результата:

```js
{
  age, term, paymentTerm, gender, frequency, deathBenefitType,
  sumAssured, annualPremium, grossPremium, netPremium,
  BP_rate, BP_1, BP_2, NP_rate, interestRate, freqFactor,

  reserves: [...],   // массив по годам
  bonuses: [...],    // массив по годам
  annuity: {...},    // аннуитетные метрики
  annuityPayment,    // дублируется для удобства

  riders: {...},             // детали по каждому выбранному райдеру
  totalRiderPremium,         // сумма допов
  totalPremium,              // grossPremium + totalRiderPremium

  usdRate,
  grossPremiumUSD,
  totalPremiumUSD,
  sumAssuredUSD
}
```

---

## 6) Пример headless-адаптера (без привязки к UI)

```js
import { ActuarialEngine } from "./src/core/actuarial.js";
import { PolicyCalculator } from "./src/core/calculator.js";
import { RidersCalculator } from "./src/core/riders.js";
import { PRODUCT_CONFIG } from "./src/config/product.js";

const engine = new ActuarialEngine(PRODUCT_CONFIG);
const calculator = new PolicyCalculator(engine, PRODUCT_CONFIG);
const ridersCalc = new RidersCalculator(engine, PRODUCT_CONFIG);

export function calculateQuote(input) {
  const {
    dob, gender, term, frequency,
    deathBenefitType = "full_sum_assured",
    mode = "sa_to_premium",
    sumAssured, premium,
    annuityFrequency = "annual",
    annuityTerm = 0,
    guaranteedPeriod = 0,
    riders = {},
    kMult = 1.0,
    lAdd = 0.0
  } = input;

  let baseResult = calculator.fullCalculation({
    dob, gender, term, frequency,
    deathBenefitType, mode, sumAssured, premium,
    annuityFrequency, annuityTerm, guaranteedPeriod,
    kMult, lAdd
  });

  const x = PolicyCalculator.calculateAge(dob);
  const t = frequency === "single" ? 1 : term;

  const ridersResult = ridersCalc.calculateAllRiders({
    x, n: term, t, gender, frequency,
    sumAssured: baseResult.sumAssured,
    annualPremium: baseResult.annualPremium,
    ridersSelection: riders,
    kMult, lAdd
  });

  const totalRiderPremium = Object.values(ridersResult.riders)
    .reduce((sum, r) => sum + (r.riderPremium ?? 0), 0);

  return {
    ...baseResult,
    riders: ridersResult.riders,
    totalRiderPremium,
    totalPremium: baseResult.grossPremium + totalRiderPremium
  };
}
```

Примечание: создание `engine/calculator/ridersCalc` делайте singleton-ом, а не на каждый клик.

---

## 7) Что менять при смене продукта

Обычно меняются только конфиги:
- `src/config/product.js`:
  - `interestRate`
  - `frequencyAdjustment`
  - `expenses` (`G2..G8`, `H4`)
  - лимиты `minTerm/maxTerm/maxExitAge`
  - параметры райдеров в `riders`
- `src/config/mortality.js` — q(x) по полу (101 значение, возраст 0..100)
- `src/config/ciRates.js` — CI q(x) по полу (101 значение, возраст 0..100)

Ядро `core/` менять только если меняется методология расчета, а не тарифы.

---

## 8) Критичные технические детали

- Округление: используется `roundHalfUp` (как в Excel), это важно для совпадения с актуарными таблицами.
- Дата рождения: формат строго `YYYY-MM-DD`.
- `frequency = "single"`:
  - срок уплаты `t = 1`
  - отдельная логика расходов (`H4`)
- Режим `premium_to_sa` с райдерами использует отдельный solver (`calculateSumAssuredWithRiders`).
- Все суммы внутри ядра считаются в KZT, USD только display-пересчет.

---

## 9) Минимальный чеклист для команды перед продом

1. Сверить 10-20 эталонных кейсов с Excel/актуарной моделью (обязательно).
2. Проверить граничные случаи:
   - минимальный и максимальный срок
   - `single` vs регулярные взносы
   - оба `deathBenefitType`
   - `premium_to_sa` с включенными райдерами
3. Проверить, что `age + term <= maxExitAge` не обходится в UI/API.
4. Зафиксировать версию конфигов и даты актуарных таблиц.
5. Добавить smoke-тест API-адаптера (хотя бы на 3-5 кейсов).

---

## 10) Рекомендации по внедрению на сайт

- Если сайт публичный и формулы чувствительные, лучше вынести расчет на backend API и не отдавать полностью логику в браузер.
- Если расчет остается на клиенте:
  - ограничить частоту пересчета (debounce/throttle),
  - логировать только технические события, без персональных данных,
  - валидировать вход и в UI, и на API-слое (если есть).

---

## 11) Где точка входа текущего demo UI

- `src/components/InsuranceCalculator.vue` — текущая страница калькулятора
- `src/composables/useInsuranceCalc.js` — основной orchestration вызов

Это reference-реализация: можно заменить весь UI, оставив тот же входной контракт в адаптере.
