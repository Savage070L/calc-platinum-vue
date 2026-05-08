/**
 * Актуарное ядро — Pro Life Platinum
 *
 * Строит коммутационные таблицы:
 *   l(x)  — число живущих в возрасте x
 *   D(x)  = l(x) × v^x
 *   N(x)  = Σ D(x)..D(ω)   (сумма «хвоста»)
 *   S(x)  = Σ N(x)..N(ω)
 *   C(x)  = (l(x) − l(x+1)) × v^(x+1)  [death_timing=2, конец года]
 *   M(x)  = Σ C(x)..C(ω)
 *   R(x)  = Σ M(x)..M(ω)
 *
 * Также содержит CI (double-decrement) таблицу для дополнительного покрытия КЗ.
 */

import { MORTALITY } from '../config/mortality.js';
import { CI_RATES }   from '../config/ciRates.js';
import { PRODUCT_CONFIG } from '../config/product.js';

// ─── Вспомогательные функции ──────────────────────────────────────────────────

/**
 * Строит «хвостовую» кумулятивную сумму массива (справа налево).
 * result[i] = arr[i] + arr[i+1] + ... + arr[n-1]
 */
function tailCumsum(arr) {
  const n = arr.length;
  const result = new Array(n).fill(0);
  result[n - 1] = arr[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    result[i] = result[i + 1] + arr[i];
  }
  return result;
}

// ─── CommutationTable ─────────────────────────────────────────────────────────

export class CommutationTable {
  /**
   * @param {number[]} qxPer1000  — q(x) на 1000 живущих, массив [0..maxAge]
   * @param {number}   interestRate
   * @param {number}   deathTiming  — 1 (середина года) | 2 (конец года)
   * @param {number}   l0           — начальное число живущих
   * @param {number}   maxAge
   * @param {number}   kMult        — мультипликатор для корректировки таблицы
   * @param {number}   lAdd         — аддитивная поправка
   */
  constructor(
    qxPer1000,
    interestRate,
    deathTiming = 2,
    l0 = 1_000_000,
    maxAge = 100,
    kMult = 1.0,
    lAdd = 0.0,
  ) {
    this.interestRate = interestRate;
    this.v = 1.0 / (1.0 + interestRate);
    this.maxAge = maxAge;
    const n = maxAge + 1;

    // Скорректированные вероятности смерти
    const adjQx = new Array(n);
    for (let x = 0; x < n; x++) {
      adjQx[x] = (qxPer1000[x] * kMult + lAdd) / 1000.0;
    }
    adjQx[maxAge] = 1.0; // 100% смертность в конечном возрасте

    // Функция дожития l(x)
    const lx = new Array(n).fill(0);
    lx[0] = l0;
    for (let x = 1; x < n; x++) {
      lx[x] = lx[x - 1] * (1.0 - adjQx[x - 1]);
    }

    // D(x) = l(x) × v^x
    const Dx = lx.map((l, x) => l * Math.pow(this.v, x));

    // N(x) = хвостовая сумма D(x)
    const Nx = tailCumsum(Dx);

    // S(x) = хвостовая сумма N(x)
    const Sx = tailCumsum(Nx);

    // C(x): дисконтированные смерти
    const Cx = new Array(n).fill(0);
    for (let x = 0; x < n - 1; x++) {
      const deaths = lx[x] - lx[x + 1];
      if (deathTiming === 2) {
        Cx[x] = deaths * Math.pow(this.v, x + 1);
      } else {
        Cx[x] = deaths * Math.pow(this.v, x + 1) * Math.sqrt(1.0 + interestRate);
      }
    }
    Cx[n - 1] = lx[n - 1] >= 1.0 ? 1.0 : 0.0;

    // M(x) = хвостовая сумма C(x)
    const Mx = tailCumsum(Cx);

    // R(x) = хвостовая сумма M(x)
    const Rx = tailCumsum(Mx);

    this._Dx = Dx;
    this._Nx = Nx;
    this._Sx = Sx;
    this._Cx = Cx;
    this._Mx = Mx;
    this._Rx = Rx;
  }

  _get(arr, age) {
    if (age < 0 || age > this.maxAge) return 0.0;
    return arr[age];
  }

  Dx(age) { return this._get(this._Dx, age); }
  Nx(age) { return this._get(this._Nx, age); }
  Sx(age) { return this._get(this._Sx, age); }
  Cx(age) { return this._get(this._Cx, age); }
  Mx(age) { return this._get(this._Mx, age); }
  Rx(age) { return this._get(this._Rx, age); }
}

// ─── CICommutationTable (double-decrement) ────────────────────────────────────

export class CICommutationTable {
  /**
   * Таблица с двойным декрементом: смерть И критическое заболевание.
   * l(x) убывает от обоих рисков одновременно.
   *
   * @param {number[]} qxDeathPer1000  — смертность на 1000
   * @param {number[]} qxCIPer1000     — ставки КЗ на 1000
   */
  constructor(
    qxDeathPer1000,
    qxCIPer1000,
    interestRate,
    deathTiming = 2,
    l0 = 1_000_000,
    maxAge = 100,
  ) {
    this.interestRate = interestRate;
    this.v = 1.0 / (1.0 + interestRate);
    this.maxAge = maxAge;
    const n = maxAge + 1;

    let qd = qxDeathPer1000.map(q => q / 1000.0);
    let qc = qxCIPer1000.map(q => q / 1000.0);

    // Нормализация: если sum > 1.0, пропорционально уменьшаем
    for (let x = 0; x < n; x++) {
      const total = qd[x] + qc[x];
      if (total > 1.0) {
        const safe = total > 0 ? total : 1.0;
        qd[x] = (qd[x] / safe);
        qc[x] = (qc[x] / safe);
      }
    }

    // l(x) с двойным декрементом
    const lx = new Array(n).fill(0);
    lx[0] = l0;
    for (let x = 1; x < n; x++) {
      lx[x] = Math.max(lx[x - 1] * (1.0 - qd[x - 1] - qc[x - 1]), 0.0);
    }

    // D(x) = l(x) × v^x
    const Dx = lx.map((l, x) => l * Math.pow(this.v, x));

    // N(x) = хвостовая сумма D(x)
    const Nx = tailCumsum(Dx);

    // S(x) = хвостовая сумма N(x)
    const Sx = tailCumsum(Nx);

    // C(x): суммарный поток выбытий (смерть + КЗ)
    const Cx = new Array(n).fill(0);
    for (let x = 0; x < n - 1; x++) {
      const exits = lx[x] - lx[x + 1];
      if (deathTiming === 2) {
        Cx[x] = exits * Math.pow(this.v, x + 1);
      } else {
        Cx[x] = exits * Math.pow(this.v, x + 1) * Math.sqrt(1.0 + interestRate);
      }
    }

    // M(x) = хвостовая сумма C(x)
    const Mx = tailCumsum(Cx);

    // R(x) = хвостовая сумма M(x)
    const Rx = tailCumsum(Mx);

    // AGx = D(x) × q_ci(x): специфичный CI вклад (для возможного расширения)
    const AGx = Dx.map((d, x) => d * qc[x]);
    const NxQ = tailCumsum(AGx); // Nx_q (AIx)

    this._Dx  = Dx;
    this._Nx  = Nx;
    this._Sx  = Sx;
    this._Cx  = Cx;
    this._Mx  = Mx;
    this._Rx  = Rx;
    this._AGx = AGx;
    this._NxQ = NxQ;
  }

  _get(arr, age) {
    if (age < 0 || age > this.maxAge) return 0.0;
    return arr[age];
  }

  Dx(age)  { return this._get(this._Dx,  age); }
  Nx(age)  { return this._get(this._Nx,  age); }
  Sx(age)  { return this._get(this._Sx,  age); }
  Cx(age)  { return this._get(this._Cx,  age); }
  Mx(age)  { return this._get(this._Mx,  age); }
  Rx(age)  { return this._get(this._Rx,  age); }
  NxQ(age) { return this._get(this._NxQ, age); }
}

// ─── ActuarialEngine ─────────────────────────────────────────────────────────

export class ActuarialEngine {
  /**
   * Актуарный движок: создаёт и кэширует коммутационные таблицы.
   * Таблицы строятся один раз и переиспользуются.
   *
   * Pro Life Platinum: ставка доходности зависит от срока договора n.
   */
  constructor(config = PRODUCT_CONFIG) {
    this.interestRateByTerm = config.interestRateByTerm;
    this.deathTiming        = config.deathTiming;
    this.maxAge             = config.maxAge;
    this.l0                 = config.l0;

    this._commTables = new Map();
    this._ciTables   = new Map();
  }

  /**
   * Возвращает ключ срока в interestRateByTerm с тем же поведением, что и
   * Python-аналог: для term ≤ min — берём min; для term ≥ k — последний
   * подходящий ключ; иначе ближайший меньший.
   */
  _resolveTermKey(term) {
    const keys = Object.keys(this.interestRateByTerm).map(Number).sort((a, b) => a - b);
    if (!keys.length) return null;
    const t = Math.round(term);
    if (t <= keys[0]) return keys[0];
    let chosen = keys[0];
    for (const k of keys) {
      if (t >= k) chosen = k;
    }
    return chosen;
  }

  /**
   * Выбор технической ставки доходности.
   * Platinum: ставка из interestRateByTerm[n].
   *
   * Сигнатура совместима с Saqtau-стилем: первый аргумент — frequency
   * (игнорируется), второй — срок договора.
   */
  getInterestRate(frequency = null, term = null) {
    const key = this._resolveTermKey(term ?? 1);
    return this.interestRateByTerm[key];
  }

  /**
   * Получить (или построить) коммутационную таблицу для заданного пола и ставки.
   * @param {'male'|'female'} gender
   * @param {number} kMult — мультипликатор (по умолчанию 1.0)
   * @param {number} lAdd  — аддитивная поправка (по умолчанию 0.0)
   * @param {number} rate  — ставка доходности
   */
  getCommutationTable(gender, kMult = 1.0, lAdd = 0.0, rate) {
    if (rate === undefined) {
      rate = this.getInterestRate(null, 1);
    }
    const key = `${gender}_${rate}_${kMult}_${lAdd}`;
    if (!this._commTables.has(key)) {
      const qx = gender === 'male' ? MORTALITY.male : MORTALITY.female;
      this._commTables.set(key, new CommutationTable(
        qx,
        rate,
        this.deathTiming,
        this.l0,
        this.maxAge,
        kMult,
        lAdd,
      ));
    }
    return this._commTables.get(key);
  }

  /**
   * Получить (или построить) CI double-decrement таблицу.
   * @param {'male'|'female'} gender
   * @param {number} rate — ставка доходности
   */
  getCITable(gender, rate) {
    if (rate === undefined) {
      rate = this.getInterestRate(null, 1);
    }
    const key = `${gender}_${rate}`;
    if (!this._ciTables.has(key)) {
      const qxDeath = gender === 'male' ? MORTALITY.male : MORTALITY.female;
      const qxCI    = gender === 'male' ? CI_RATES.male  : CI_RATES.female;
      this._ciTables.set(key, new CICommutationTable(
        qxDeath,
        qxCI,
        rate,
        this.deathTiming,
        this.l0,
        this.maxAge,
      ));
    }
    return this._ciTables.get(key);
  }

  /**
   * Вернуть массив q_ci(x) на 1000 живущих для заданного пола.
   * @param {'male'|'female'} gender
   */
  getCIRatesPer1000(gender) {
    return gender === 'male' ? CI_RATES.male : CI_RATES.female;
  }
}
