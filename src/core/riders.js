/**
 * Калькулятор дополнительных покрытий (райдеров) — Pro Life Platinum
 *
 * Покрытия (UI):
 *   Группа 1 (radio, SA-linked): accidental_death | traffic_death
 *   Группа 2 (radio, SA-linked): premium_waiver | disability_any_lumpsum | disability_accident_lumpsum
 *   Группа 3 (checkbox, fixed-sum): trauma | trauma_extra | temporary_disability | hospitalization | critical_illness
 *
 * Формула простых допов:
 *   gross_tariff   = ROUND((tariff × kMult + lAdd) × (1 + expenses) / (1 − acquisition), 4)
 *   annual_premium = gross_tariff × rider_sum
 *   rider_premium  = (frequency = 'single')
 *                    ? ROUND(annual_premium × term)
 *                    : ROUND(annual_premium × freqFactor)
 *
 * Для CI используется актуарная формула на базе double-decrement коммутаций
 * с расходами Platinum (G2..G7) по сроку договора.
 */

import { PRODUCT_CONFIG } from '../config/product.js';
import { roundHalfUp }    from './calculator.js';

// ─── RidersCalculator ─────────────────────────────────────────────────────────

export class RidersCalculator {

  constructor(engine, config = PRODUCT_CONFIG) {
    this.engine           = engine;
    this.config           = config;
    this.ridersConfig     = config.riders ?? {};
    this.freqAdj          = config.frequencyAdjustment;
    this.expenseTable     = config.expenseTable;
    this.surrenderPenalty = config.surrenderPenalty;
  }

  _freqFactor(frequency) {
    return frequency === 'single' ? 1.0 : (this.freqAdj[frequency] ?? 1.0);
  }

  _resolveTermKey(table, term) {
    const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
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
   * Расходные коэффициенты Platinum (G2..G9) по сроку n.
   * Используется в актуарном расчёте CI-райдера.
   */
  _getExpenses(n) {
    const key = this._resolveTermKey(this.expenseTable, n);
    const e = this.expenseTable[key];
    return {
      G2: e.G2 ?? 0.0,
      G3: e.G3 ?? 0.0,
      G4: e.G4 ?? 0.0,
      G5: e.G5 ?? 0.0,
      G6: e.G6 ?? 0.0,
      G7: e.G7 ?? 0.0,
    };
  }

  // ─── Простой доп (SA-linked или fixed-sum) ────────────────────────────────

  calculateSimpleRider(riderName, riderSum, term, frequency, kMult = 1.0, lAdd = 0.0) {
    const rc          = this.ridersConfig[riderName] ?? {};
    const baseTariff  = rc.tariff ?? 0.0;
    const expenseRate = rc.expenses ?? 0.0;
    const acquisition = rc.acquisition ?? 0.0;

    const grossTariff = roundHalfUp(
      (baseTariff * kMult + lAdd) * (1.0 + expenseRate) / (1.0 - acquisition),
      4,
    );

    const freqFactor    = this._freqFactor(frequency);
    const annualPremium = grossTariff * riderSum;

    const riderPremium = frequency === 'single'
      ? roundHalfUp(annualPremium * term)
      : roundHalfUp(annualPremium * freqFactor);

    return {
      riderName,
      baseTariff,
      grossTariff,
      riderSum,
      annualPremium: Math.round(annualPremium * 100) / 100,
      riderPremium,
      frequency,
    };
  }

  // ─── Освобождение от уплаты взносов (premium waiver) ───────────────────────

  /**
   * Премия за освобождение от уплаты взносов при инвалидности от НС.
   *
   *   J6 = ROUND(disability.tariff × (1+exp) / (1−acq), 4)
   *   P[k] = ROUND(BP_main × SA, 0)        для k = 0..n-1
   *   Q[k] = SUM(P[k+1] .. P[n-1])
   *   R[k] = ROUND(Q[k] × J6, 0)
   *   waiver_premium = ROUND( SUM(R) / (n-1) × freqFactor, 0 )
   *
   * При frequency='single' или t≤1 — премия 0.
   */
  calculateWaiverRider(x, n, t, gender, sumAssured, BPMain, frequency, kMult = 1.0, lAdd = 0.0) {
    if (frequency === 'single' || t <= 1 || n <= 1) {
      return { riderName: 'premium_waiver', riderPremium: 0, annualPremium: 0,
               grossTariffDis: 0, frequency };
    }

    const rcDis = this.ridersConfig.disability_accident_lumpsum ?? {};
    const j6 = roundHalfUp(
      (rcDis.tariff * kMult + lAdd) * (1.0 + (rcDis.expenses ?? 0)) / (1.0 - (rcDis.acquisition ?? 0)),
      4,
    );

    const annualPayment = roundHalfUp(BPMain * sumAssured);

    let rSum = 0.0;
    for (let k = 0; k < n - 1; k++) {
      const remaining = n - 1 - k;
      const qk = remaining * annualPayment;
      rSum += roundHalfUp(qk * j6);
    }

    const freqFactor   = this._freqFactor(frequency);
    const riderPremium = roundHalfUp((rSum / (n - 1)) * freqFactor);
    const annualPremium = Math.round((rSum / (n - 1)) * 100) / 100;

    return {
      riderName: 'premium_waiver',
      grossTariffDis: j6,
      annualPayment,
      riderPremium,
      annualPremium,
      frequency,
    };
  }

  // ─── Критические заболевания (CI, double-decrement) ───────────────────────

  /**
   * Премия по CI.
   *
   *   A_ci  = Σ_{k=0..n-1} D_ci(x+k)/D_ci(x) × q_ci(x+k)
   *   ax_n  = (N_ci(x) − N_ci(x+n)) / D_ci(x)
   *   ax_t  = (N_ci(x) − N_ci(x+t)) / D_ci(x)
   *   BP_ci = ROUND( (A_ci + G7·ax_n) /
   *                  (ax_t − (G2 + G3 + G4·D(x+1)/D(x) + G5·D(x+2)/D(x)
   *                          + G6·(N(x+3)−N(x+n))/D(x))), 4 )
   *
   * (Расходная база совпадает с основной формулой Platinum — лист «Расчет»!G7.)
   */
  calculateCIRider(x, n, t, gender, ciSum, frequency, kMult = 1.0, lAdd = 0.0) {
    const rate = this.engine.getInterestRate(frequency, n);
    const ciTable = this.engine.getCITable(gender, rate);
    const { G2, G3, G4, G5, G6, G7 } = this._getExpenses(n);

    const Dx_ci  = ciTable.Dx(x);
    if (Dx_ci === 0) {
      return { riderName: 'critical_illness', riderPremium: 0, annualPremium: 0,
               BP_ci: 0, ciSum, frequency };
    }

    const Nx_ci  = ciTable.Nx(x);
    const Nxn_ci = ciTable.Nx(x + n);
    const Nxt_ci = ciTable.Nx(x + t);
    const Dx1_ci = ciTable.Dx(x + 1);
    const Dx2_ci = ciTable.Dx(x + 2);
    const Nx3_ci = ciTable.Nx(x + 3);

    const ciRates = this.engine.getCIRatesPer1000(gender);
    let A_ci = 0.0;
    for (let k = 0; k < n; k++) {
      const ageK = x + k;
      const qCi = (ciRates[ageK] ?? 0.0) / 1000.0;
      A_ci += ciTable.Dx(ageK) / Dx_ci * qCi;
    }

    const ax_n = (Nx_ci - Nxn_ci) / Dx_ci;
    const ax_t = (Nx_ci - Nxt_ci) / Dx_ci;

    const numerator   = A_ci + G7 * ax_n;
    const denominator = ax_t - (
      G2
      + G3
      + G4 * (Dx1_ci / Dx_ci)
      + G5 * (Dx2_ci / Dx_ci)
      + G6 * ((Nx3_ci - Nxn_ci) / Dx_ci)
    );
    let BP_ci = denominator > 0 ? numerator / denominator : 0.0;
    BP_ci = roundHalfUp(BP_ci, 4);

    const freqFactor    = this._freqFactor(frequency);
    const annualPremium = BP_ci * ciSum;

    const riderPremium = frequency === 'single'
      ? roundHalfUp(annualPremium)
      : roundHalfUp(BP_ci * ciSum * freqFactor);

    return {
      riderName: 'critical_illness',
      BP_ci, A_ci, ax_n, ax_t,
      riderSum: ciSum,
      annualPremium: Math.round(annualPremium * 100) / 100,
      riderPremium,
      frequency,
    };
  }

  // ─── Расчёт всех выбранных допов ──────────────────────────────────────────

  /**
   * @param {Object} params
   * @param {number} params.x
   * @param {number} params.n        — срок договора
   * @param {number} params.t        — срок уплаты взносов
   * @param {string} params.gender
   * @param {string} params.frequency
   * @param {number} params.sumAssured
   * @param {number} params.BPMain   — брутто-ставка по основному покрытию (для waiver)
   * @param {Object} params.ridersSelection — { riderName: { enabled, sum } }
   */
  calculateAllRiders(params) {
    const {
      x, n, t, gender, frequency,
      sumAssured,
      BPMain = 0,
      ridersSelection = {},
      kMult = 1.0, lAdd = 0.0,
    } = params;

    const results = {};
    let totalRiderPremium = 0.0;

    // SA-linked простые допы (rider_sum = SA): группы 1 и 2 (кроме waiver/CI)
    const saLinkedRiders = [
      'accidental_death',
      'traffic_death',
      'disability_any_lumpsum',
      'disability_accident_lumpsum',
    ];
    for (const riderName of saLinkedRiders) {
      const sel = ridersSelection[riderName] ?? {};
      if (sel.enabled) {
        const riderSum = sel.sum ?? sumAssured;
        const r = this.calculateSimpleRider(riderName, riderSum, n, frequency, kMult, lAdd);
        results[riderName]  = r;
        totalRiderPremium  += r.riderPremium;
      }
    }

    // Fixed-sum простые допы (группа 3 кроме CI)
    const fixedRiders = [
      'trauma',
      'trauma_extra',
      'temporary_disability',
      'hospitalization',
    ];
    for (const riderName of fixedRiders) {
      const sel = ridersSelection[riderName] ?? {};
      if (sel.enabled) {
        const riderSum = sel.sum ?? 0;
        if (riderSum > 0) {
          const r = this.calculateSimpleRider(riderName, riderSum, n, frequency, kMult, lAdd);
          results[riderName] = r;
          totalRiderPremium += r.riderPremium;
        }
      }
    }

    // CI — актуарный расчёт
    const ciSel = ridersSelection.critical_illness ?? {};
    if (ciSel.enabled) {
      const ciSum = ciSel.sum ?? 0;
      if (ciSum > 0) {
        const r = this.calculateCIRider(x, n, t, gender, ciSum, frequency, kMult, lAdd);
        results.critical_illness = r;
        totalRiderPremium       += r.riderPremium;
      }
    }

    // Premium waiver — освобождение от уплаты взносов
    const pwSel = ridersSelection.premium_waiver ?? {};
    if (pwSel.enabled) {
      const r = this.calculateWaiverRider(x, n, t, gender, sumAssured, BPMain, frequency, kMult, lAdd);
      results.premium_waiver = r;
      totalRiderPremium     += r.riderPremium;
    }

    return { riders: results, totalRiderPremium };
  }
}
