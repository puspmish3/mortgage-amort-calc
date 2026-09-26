import assert from "node:assert/strict";
import {
  calculateCommercial,
  calculateCommunity,
  calculatePurchase,
  calculateRefinance,
  paymentAmount,
} from "./products.js";

const purchase = calculatePurchase({
  price: 450000,
  downPayment: 45000,
  rate: 6.5,
  termYears: 30,
  termMonths: 0,
  tax: 450,
  insurance: 140,
  hoa: 0,
  pmiRate: 0.55,
  firstPayment: "2026-10",
});
assert.equal(purchase.ok, true, purchase.errors?.join("; "));
assert.equal(purchase.summary.loan, 405000);
assert.equal(purchase.summary.pi, paymentAmount(405000, 0.065, 360));
assert.ok(purchase.summary.pmi > 0);
assert.equal(purchase.summary.housing, purchase.summary.pi + 450 + 140 + purchase.summary.pmi);
assert.equal(purchase.rows.length, 360);
assert.equal(purchase.rows.at(-1).ending, 0);

const noPmi = calculatePurchase({
  ...{
    price: 400000,
    downPayment: 80000,
    rate: 6,
    termYears: 30,
    termMonths: 0,
    tax: 0,
    insurance: 0,
    hoa: 0,
    pmiRate: 0.5,
    firstPayment: "2026-10",
  },
});
assert.equal(noPmi.summary.pmi, 0);
assert.equal(calculatePurchase({ ...noPmi, price: 0 }).ok, false);

const refinance = calculateRefinance({
  balance: 300000,
  currentRate: 7,
  currentPayment: 2000,
  remainingYears: 28,
  remainingMonths: 0,
  newRate: 6,
  newYears: 30,
  newMonths: 0,
  closingCosts: 6000,
  cashOut: 0,
  rollCosts: "yes",
  firstPayment: "2026-10",
});
assert.equal(refinance.ok, true, refinance.errors?.join("; "));
assert.equal(refinance.summary.newLoan, 306000);
assert.equal(refinance.summary.payment, paymentAmount(306000, 0.06, 360));
assert.ok(refinance.summary.monthlySaving > 0);
assert.equal(
  refinance.summary.breakEvenMonths,
  Math.ceil(6000 / refinance.summary.monthlySaving),
);
assert.equal(refinance.rows.at(-1).ending, 0);

const cash = calculateRefinance({
  balance: 300000,
  currentRate: 7,
  currentPayment: 2000,
  remainingYears: 28,
  remainingMonths: 0,
  newRate: 6,
  newYears: 30,
  newMonths: 0,
  closingCosts: 0,
  cashOut: 25000,
  rollCosts: "no",
  firstPayment: "2026-10",
});
assert.equal(cash.summary.newLoan, 325000);

const commercial = calculateCommercial({
  value: 1000000,
  loanAmount: 700000,
  rate: 7,
  amortYears: 25,
  amortMonths: 0,
  termYears: 10,
  ioMonths: 12,
  tax: 0,
  insurance: 0,
  other: 0,
  noi: 70000,
  firstPayment: "2026-10",
});
assert.equal(commercial.ok, true, commercial.errors?.join("; "));
assert.equal(commercial.rows.length, 120);
assert.ok(commercial.rows.slice(0, 12).every((row) => row.principal === 0));
assert.ok(commercial.rows[12].principal > 0);
assert.ok(commercial.summary.balloon > 0);
assert.equal(commercial.rows.at(-1).balloon, true);
assert.ok(commercial.summary.dscr > 1);
assert.equal(commercial.summary.ltv, 0.7);

const badTerm = calculateCommercial({
  value: 1000000,
  loanAmount: 700000,
  rate: 7,
  amortYears: 10,
  amortMonths: 0,
  termYears: 15,
  ioMonths: 0,
  tax: 0,
  insurance: 0,
  other: 0,
  noi: 70000,
  firstPayment: "2026-10",
});
assert.equal(badTerm.ok, false);

const community = calculateCommunity({
  price: 275000,
  assistance: 15000,
  borrowerDown: 5500,
  rate: 5.75,
  termYears: 30,
  termMonths: 0,
  tax: 220,
  insurance: 95,
  income: 6200,
  debts: 280,
  firstPayment: "2026-10",
});
assert.equal(community.ok, true, community.errors?.join("; "));
assert.equal(community.summary.loan, 254500);
assert.equal(community.summary.pi, paymentAmount(254500, 0.0575, 360));
assert.ok(community.summary.paymentRelief > 0);
assert.ok(community.summary.frontRatio > 0 && community.summary.frontRatio < 1);
assert.ok(community.summary.backRatio > community.summary.frontRatio);
assert.equal(community.rows.length, 360);
assert.equal(community.rows.at(-1).ending, 0);
assert.equal(community.rows.at(-1).label, "Sep 2056");

const tooMuchHelp = calculateCommunity({
  price: 200000,
  assistance: 150000,
  borrowerDown: 60000,
  rate: 5,
  termYears: 30,
  termMonths: 0,
  tax: 0,
  insurance: 0,
  income: 5000,
  debts: 0,
  firstPayment: "2026-10",
});
assert.equal(tooMuchHelp.ok, false);

console.log("product calculators ok");
