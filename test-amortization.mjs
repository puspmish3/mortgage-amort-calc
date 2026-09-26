import assert from "node:assert/strict";
import {
  calculate,
  extraForMonth,
  paymentAmount,
} from "./amortization.js";

const base = {
  principal: 350000,
  noteRate: 6.5,
  buydownReduction: 1,
  buydownMonths: 12,
  termYears: 30,
  termMonths: 0,
  firstPayment: "2026-10",
  currentPayment: "",
  extras: [],
  mode: "keep",
  recastMonth: "2027-10",
};

function money(value) {
  return Math.round(value * 100) / 100;
}

const standard = calculate(base);
assert.equal(standard.ok, true, standard.errors.join("; "));
assert.equal(standard.summary.yearOnePayment, 1987.26);
assert.equal(standard.summary.afterPayment, 2207.11);
assert.equal(standard.rows[0].interest, 1604.17);
assert.equal(standard.rows.length, 360);
assert.equal(standard.rows.at(-1).ending, 0);
assert.equal(standard.rows.at(-1).final, true);
assert.ok(standard.rows.slice(0, 12).every((row) => row.buydown));
assert.ok(standard.rows.slice(12).every((row) => !row.buydown));
assert.ok(standard.rows.slice(12).every((row) => row.payment === 2207.11 || row.final));

assert.equal(paymentAmount(350000, 0.055, 360), 1987.26);
assert.equal(paymentAmount(350000, 0.065, 360), 2212.24);

const withExtra = calculate({
  ...base,
  extras: [
    { id: "e1", amount: 10000, frequency: "once", startMonth: 6, endMonth: "" },
  ],
});
assert.equal(withExtra.rows[5].extra, 10000);
assert.equal(withExtra.rows[0].payment, 1987.26);
assert.equal(withExtra.rows[12].payment, 2207.11);
assert.ok(withExtra.summary.payoffMonths < 360);
assert.ok(withExtra.summary.interestSaved > 0);

const recast = calculate({
  ...base,
  mode: "recast",
  recastMonth: "2027-10",
  extras: [
    { id: "e1", amount: 10000, frequency: "once", startMonth: 6, endMonth: "" },
  ],
});
assert.equal(recast.summary.recastAt, 13);
assert.equal(recast.rows[12].recast, true);
assert.equal(recast.rows[5].payment, 1987.26);
assert.notEqual(recast.rows[12].payment, 2207.11);
assert.ok(
  recast.rows.slice(12, -1).every((row) => row.payment === recast.rows[12].payment),
);
assert.equal(recast.rows.length, 360);
assert.equal(recast.rows.at(-1).ending, 0);

const overage = calculate({ ...base, currentPayment: 2500 });
assert.equal(overage.rows[0].extra, money(2500 - 1987.26));
assert.equal(overage.rows[11].extra, 512.74);
assert.equal(overage.rows[12].extra, money(2500 - 2207.11));
assert.equal(overage.rows[12].extra, 292.89);

const overageRecast = calculate({
  ...base,
  currentPayment: 2500,
  mode: "recast",
  recastMonth: "2027-04",
  extras: [
    { id: "e1", amount: 100, frequency: "monthly", startMonth: 1, endMonth: "" },
  ],
});
assert.equal(overageRecast.summary.recastAt, 7);
assert.equal(overageRecast.rows[5].extra, money(512.74 + 100));
assert.equal(overageRecast.rows[6].extra, 100);
assert.equal(overageRecast.rows[6].overage, 0);
assert.ok(overageRecast.rows.slice(6).every((row) => row.extra === 100 || row.final));

const payoff = calculate({
  ...base,
  extras: [
    { id: "e1", amount: 400000, frequency: "once", startMonth: 2, endMonth: "" },
  ],
});
assert.equal(payoff.rows.length, 2);
assert.equal(payoff.rows[1].ending, 0);
assert.ok(payoff.rows[1].extra > 0);
assert.ok(payoff.rows[1].extra < 400000);
assert.ok(payoff.rows.every((row) => row.ending >= 0));

assert.deepEqual(
  [3, 4, 5, 6, 7, 8, 9, 12].map((month) =>
    extraForMonth(
      [{ amount: 50, frequency: "quarterly", startMonth: 3, endMonth: 9 }],
      month,
    ),
  ),
  [50, 0, 0, 50, 0, 0, 50, 0],
);
assert.deepEqual(
  [12, 23, 24, 36, 48].map((month) =>
    extraForMonth(
      [{ amount: 75, frequency: "yearly", startMonth: 12, endMonth: 36 }],
      month,
    ),
  ),
  [75, 0, 75, 75, 0],
);

const zeroRate = calculate({
  ...base,
  noteRate: 0,
  buydownReduction: 0,
  buydownMonths: 0,
  principal: 1200,
  termYears: 0,
  termMonths: 10,
});
assert.equal(zeroRate.ok, true, zeroRate.errors.join("; "));
assert.equal(zeroRate.summary.yearOnePayment, 120);
assert.equal(zeroRate.rows[0].interest, 0);
assert.equal(zeroRate.rows.at(-1).ending, 0);

const invalid = calculate({
  ...base,
  buydownReduction: 6.5,
  termYears: 0,
  termMonths: 0,
  buydownMonths: 40,
});
assert.equal(invalid.ok, false);
assert.ok(invalid.errors.length >= 2);

const earlyRecast = calculate({
  ...base,
  mode: "recast",
  recastMonth: "2020-01",
});
assert.equal(earlyRecast.summary.recastAt, 1);
assert.equal(earlyRecast.rows[0].recast, true);

const missedRecast = calculate({
  ...base,
  mode: "recast",
  recastMonth: "2060-01",
  currentPayment: 2500,
});
assert.equal(missedRecast.summary.recastAt, null);
assert.equal(missedRecast.rows[20].extra, 292.89);

console.log("All amortization acceptance checks passed.");
