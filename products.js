/**
 * Monthly payment and amortization for purchase, refinance, commercial,
 * and community lending. Money is rounded to the cent at each cash-flow
 * step so a schedule can reach an exact $0.00 balance.
 */

export function roundMoney(value) {
  if (!Number.isFinite(value)) return NaN;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function paymentAmount(principal, annualRate, months) {
  if (months <= 0) return 0;
  const balance = Math.max(0, principal);
  if (balance === 0) return 0;
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) return roundMoney(balance / months);
  const factor = (1 + monthlyRate) ** months;
  return roundMoney((balance * monthlyRate * factor) / (factor - 1));
}

export function addMonths(year, monthIndex, count) {
  const date = new Date(year, monthIndex + count, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function formatMonth(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function parseMonthValue(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || month < 1 || month > 12) return null;
  return { year, monthIndex: month - 1 };
}

export function toMonthValue(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function nextMonthValue() {
  const now = new Date();
  const next = addMonths(now.getFullYear(), now.getMonth(), 1);
  return toMonthValue(next.year, next.monthIndex);
}

function numberOrBlank(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function requirePositive(errors, value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    errors.push(`${label} must be greater than $0.`);
    return false;
  }
  return true;
}

function requireRate(errors, value, label, max = 30) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    errors.push(`${label} must be between 0% and ${max}%.`);
    return false;
  }
  return true;
}

function requireTerm(errors, years, months) {
  if (!Number.isInteger(years) || years < 0 || years > 40) {
    errors.push("Term years must be a whole number from 0 to 40.");
  }
  if (!Number.isInteger(months) || months < 0 || months > 11) {
    errors.push("Additional months must be a whole number from 0 to 11.");
  }
  const total = (Number.isInteger(years) ? years : 0) * 12 +
    (Number.isInteger(months) ? months : 0);
  if (total < 1) errors.push("Term must be at least 1 month.");
  if (total > 480) errors.push("Term cannot be longer than 40 years.");
  return total;
}

function buildSchedule({ principal, annualRate, months, payment, firstPayment, extraMonthly = 0 }) {
  const rows = [];
  let balance = roundMoney(principal);
  // Stop at the contractual term. A leftover cent from payment rounding is
  // absorbed into the last payment instead of creating an extra month.
  for (let month = 1; balance > 0 && month <= months; month += 1) {
    const interest = roundMoney(balance * (annualRate / 12));
    let scheduledPrincipal = roundMoney(Math.max(0, payment - interest));
    if (month === months || scheduledPrincipal > balance) scheduledPrincipal = balance;
    const room = roundMoney(balance - scheduledPrincipal);
    const extra = roundMoney(Math.min(Math.max(0, extraMonthly), Math.max(0, room)));
    const ending = roundMoney(balance - scheduledPrincipal - extra);
    const calendar = addMonths(firstPayment.year, firstPayment.monthIndex, month - 1);
    rows.push({
      month,
      label: formatMonth(calendar.year, calendar.monthIndex),
      annualRate,
      payment: roundMoney(scheduledPrincipal + interest),
      interest,
      principal: scheduledPrincipal,
      extra,
      ending,
      final: ending === 0,
    });
    balance = ending;
    if (ending === 0) break;
  }
  return rows;
}

function summarize(rows, payment, extras = 0) {
  const interest = roundMoney(rows.reduce((sum, row) => sum + row.interest, 0));
  const last = rows.at(-1);
  return {
    payment,
    totalInterest: interest,
    payoffMonths: last ? last.month : 0,
    payoffLabel: last ? last.label : "—",
    extraPaid: roundMoney(rows.reduce((sum, row) => sum + row.extra, 0) + extras),
  };
}

export function purchaseDefaults() {
  return {
    price: 450000,
    downPayment: 45000,
    rate: 6.5,
    termYears: 30,
    termMonths: 0,
    tax: 450,
    insurance: 140,
    hoa: 0,
    pmiRate: 0.55,
    firstPayment: nextMonthValue(),
  };
}

export function calculatePurchase(raw) {
  const errors = [];
  const price = Number(raw.price);
  const downPayment = Number(raw.downPayment);
  const rate = Number(raw.rate);
  const years = Number(raw.termYears);
  const months = Number(raw.termMonths);
  const tax = numberOrBlank(raw.tax) ?? 0;
  const insurance = numberOrBlank(raw.insurance) ?? 0;
  const hoa = numberOrBlank(raw.hoa) ?? 0;
  const pmiRate = numberOrBlank(raw.pmiRate) ?? 0;
  const firstPayment = parseMonthValue(raw.firstPayment);

  requirePositive(errors, price, "Purchase price");
  if (!Number.isFinite(downPayment) || downPayment < 0) {
    errors.push("Down payment cannot be negative.");
  }
  if (Number.isFinite(price) && Number.isFinite(downPayment) && downPayment >= price) {
    errors.push("Down payment must be less than the purchase price.");
  }
  requireRate(errors, rate, "Interest rate");
  const totalMonths = requireTerm(errors, years, months);
  [tax, insurance, hoa].forEach((value, index) => {
    const label = ["Property tax", "Home insurance", "HOA"][index];
    if (!Number.isFinite(value) || value < 0) errors.push(`${label} must be $0 or more.`);
  });
  if (!Number.isFinite(pmiRate) || pmiRate < 0 || pmiRate > 5) {
    errors.push("Mortgage insurance rate must be between 0% and 5%.");
  }
  if (!firstPayment) errors.push("Choose a valid first payment month.");
  if (errors.length) return { ok: false, errors };

  const loan = roundMoney(price - downPayment);
  const downPercent = price === 0 ? 0 : downPayment / price;
  const annualRate = rate / 100;
  const pi = paymentAmount(loan, annualRate, totalMonths);
  const pmi = downPercent < 0.2 ? roundMoney((loan * (pmiRate / 100)) / 12) : 0;
  const housing = roundMoney(pi + tax + insurance + hoa + pmi);
  const rows = buildSchedule({
    principal: loan,
    annualRate,
    months: totalMonths,
    payment: pi,
    firstPayment,
  });
  const summary = summarize(rows, pi);
  const noteOnly = paymentAmount(loan, annualRate, totalMonths);
  return {
    ok: true,
    errors: [],
    rows,
    summary: {
      ...summary,
      loan,
      downPercent,
      pi,
      pmi,
      tax,
      insurance,
      hoa,
      housing,
      noteOnly,
      ltv: 1 - downPercent,
    },
  };
}

export function refinanceDefaults() {
  return {
    balance: 310000,
    currentRate: 7.125,
    currentPayment: 2080,
    remainingYears: 27,
    remainingMonths: 0,
    newRate: 6.125,
    newYears: 30,
    newMonths: 0,
    closingCosts: 6500,
    cashOut: 0,
    rollCosts: "yes",
    firstPayment: nextMonthValue(),
  };
}

export function calculateRefinance(raw) {
  const errors = [];
  const balance = Number(raw.balance);
  const currentRate = Number(raw.currentRate);
  const currentPayment = Number(raw.currentPayment);
  const remainingYears = Number(raw.remainingYears);
  const remainingMonths = Number(raw.remainingMonths);
  const newRate = Number(raw.newRate);
  const newYears = Number(raw.newYears);
  const newMonths = Number(raw.newMonths);
  const closingCosts = numberOrBlank(raw.closingCosts) ?? 0;
  const cashOut = numberOrBlank(raw.cashOut) ?? 0;
  const firstPayment = parseMonthValue(raw.firstPayment);

  requirePositive(errors, balance, "Current balance");
  requireRate(errors, currentRate, "Current rate");
  requireRate(errors, newRate, "New rate");
  if (!Number.isFinite(currentPayment) || currentPayment <= 0) {
    errors.push("Current monthly payment must be greater than $0.");
  }
  const oldTerm = requireTerm(errors, remainingYears, remainingMonths);
  const newTerm = requireTerm(errors, newYears, newMonths);
  if (!Number.isFinite(closingCosts) || closingCosts < 0) {
    errors.push("Closing costs must be $0 or more.");
  }
  if (!Number.isFinite(cashOut) || cashOut < 0) {
    errors.push("Cash-out amount must be $0 or more.");
  }
  if (!firstPayment) errors.push("Choose a valid first payment month.");
  if (errors.length) return { ok: false, errors };

  const roll = raw.rollCosts === "yes";
  const financedCosts = roll ? closingCosts : 0;
  const newLoan = roundMoney(balance + financedCosts + cashOut);
  const oldRate = currentRate / 100;
  const nextRate = newRate / 100;
  const oldPi = paymentAmount(balance, oldRate, oldTerm);
  const contractualOld = Number.isFinite(currentPayment) && currentPayment > 0
    ? roundMoney(currentPayment)
    : oldPi;
  const newPi = paymentAmount(newLoan, nextRate, newTerm);
  const monthlySaving = roundMoney(contractualOld - newPi);
  const breakEvenMonths = monthlySaving > 0
    ? Math.ceil(closingCosts / monthlySaving)
    : null;

  const oldRows = buildSchedule({
    principal: balance,
    annualRate: oldRate,
    months: oldTerm,
    payment: contractualOld,
    firstPayment,
  });
  const newRows = buildSchedule({
    principal: newLoan,
    annualRate: nextRate,
    months: newTerm,
    payment: newPi,
    firstPayment,
  });
  const oldInterest = roundMoney(oldRows.reduce((sum, row) => sum + row.interest, 0));
  const newInterest = roundMoney(newRows.reduce((sum, row) => sum + row.interest, 0));
  const interestDelta = roundMoney(oldInterest - newInterest);
  const netBenefit = roundMoney(interestDelta - closingCosts - Math.max(0, newLoan - balance));

  return {
    ok: true,
    errors: [],
    rows: newRows,
    oldRows,
    summary: {
      payment: newPi,
      oldPayment: contractualOld,
      scheduledOld: oldPi,
      monthlySaving,
      newLoan,
      financedCosts,
      cashOut,
      closingCosts,
      breakEvenMonths,
      totalInterest: newInterest,
      oldInterest,
      interestDelta,
      netBenefit,
      payoffMonths: newRows.length,
      payoffLabel: newRows.at(-1)?.label ?? "—",
      oldPayoffMonths: oldRows.length,
      extraPaid: cashOut,
    },
  };
}

export function commercialDefaults() {
  return {
    value: 1800000,
    loanAmount: 1260000,
    rate: 7.25,
    amortYears: 25,
    amortMonths: 0,
    termYears: 10,
    ioMonths: 0,
    tax: 2200,
    insurance: 650,
    other: 0,
    noi: 145000,
    firstPayment: nextMonthValue(),
  };
}

export function calculateCommercial(raw) {
  const errors = [];
  const value = Number(raw.value);
  const loanAmount = Number(raw.loanAmount);
  const rate = Number(raw.rate);
  const amortYears = Number(raw.amortYears);
  const amortMonths = Number(raw.amortMonths);
  const termYears = Number(raw.termYears);
  const ioMonths = Number(raw.ioMonths);
  const tax = numberOrBlank(raw.tax) ?? 0;
  const insurance = numberOrBlank(raw.insurance) ?? 0;
  const other = numberOrBlank(raw.other) ?? 0;
  const noi = Number(raw.noi);
  const firstPayment = parseMonthValue(raw.firstPayment);

  requirePositive(errors, value, "Property value");
  requirePositive(errors, loanAmount, "Loan amount");
  if (Number.isFinite(value) && Number.isFinite(loanAmount) && loanAmount > value) {
    errors.push("Loan amount cannot be higher than the property value.");
  }
  requireRate(errors, rate, "Interest rate", 20);
  const amortTerm = requireTerm(errors, amortYears, amortMonths);
  if (!Number.isInteger(termYears) || termYears < 1 || termYears > 30) {
    errors.push("Loan term must be a whole number of years from 1 to 30.");
  }
  if (!Number.isInteger(ioMonths) || ioMonths < 0 || ioMonths > 60) {
    errors.push("Interest-only months must be a whole number from 0 to 60.");
  }
  const termMonths = Number.isInteger(termYears) ? termYears * 12 : 0;
  if (termMonths > amortTerm) {
    errors.push("The loan term cannot be longer than the amortization period.");
  }
  if (Number.isInteger(ioMonths) && ioMonths > termMonths) {
    errors.push("Interest-only months cannot exceed the loan term.");
  }
  [tax, insurance, other].forEach((amount, index) => {
    const label = ["Property tax", "Insurance", "Other monthly costs"][index];
    if (!Number.isFinite(amount) || amount < 0) errors.push(`${label} must be $0 or more.`);
  });
  if (!Number.isFinite(noi)) errors.push("Annual net operating income must be a number.");
  if (!firstPayment) errors.push("Choose a valid first payment month.");
  if (errors.length) return { ok: false, errors };

  const annualRate = rate / 100;
  const amortizingPayment = paymentAmount(loanAmount, annualRate, amortTerm);
  const ioPayment = roundMoney(loanAmount * (annualRate / 12));
  const rows = [];
  let balance = roundMoney(loanAmount);
  for (let month = 1; month <= termMonths && balance > 0; month += 1) {
    const interestOnly = month <= ioMonths;
    const payment = interestOnly ? ioPayment : amortizingPayment;
    const interest = roundMoney(balance * (annualRate / 12));
    let principalPart = interestOnly ? 0 : roundMoney(Math.max(0, payment - interest));
    if (principalPart > balance) principalPart = balance;
    const ending = roundMoney(balance - principalPart);
    const calendar = addMonths(firstPayment.year, firstPayment.monthIndex, month - 1);
    rows.push({
      month,
      label: formatMonth(calendar.year, calendar.monthIndex),
      annualRate,
      payment: roundMoney(principalPart + interest),
      interest,
      principal: principalPart,
      extra: 0,
      ending,
      interestOnly,
      balloon: month === termMonths && ending > 0,
      final: ending === 0,
    });
    balance = ending;
  }

  const annualDebt = roundMoney((ioMonths > 0 ? ioPayment : amortizingPayment) * 12);
  const dscr = annualDebt > 0 ? noi / annualDebt : null;
  const ltv = value > 0 ? loanAmount / value : null;
  const balloon = rows.at(-1)?.ending ?? 0;
  const debtService = roundMoney(amortizingPayment + tax + insurance + other);
  return {
    ok: true,
    errors: [],
    rows,
    summary: {
      payment: amortizingPayment,
      ioPayment,
      ioMonths,
      debtService,
      tax,
      insurance,
      other,
      dscr,
      ltv,
      balloon,
      annualDebt,
      noi,
      totalInterest: roundMoney(rows.reduce((sum, row) => sum + row.interest, 0)),
      payoffMonths: rows.length,
      payoffLabel: rows.at(-1)?.label ?? "—",
      extraPaid: 0,
      loan: loanAmount,
    },
  };
}

export function communityDefaults() {
  return {
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
    firstPayment: nextMonthValue(),
  };
}

export function calculateCommunity(raw) {
  const errors = [];
  const price = Number(raw.price);
  const assistance = numberOrBlank(raw.assistance) ?? 0;
  const borrowerDown = numberOrBlank(raw.borrowerDown) ?? 0;
  const rate = Number(raw.rate);
  const years = Number(raw.termYears);
  const months = Number(raw.termMonths);
  const tax = numberOrBlank(raw.tax) ?? 0;
  const insurance = numberOrBlank(raw.insurance) ?? 0;
  const income = Number(raw.income);
  const debts = numberOrBlank(raw.debts) ?? 0;
  const firstPayment = parseMonthValue(raw.firstPayment);

  requirePositive(errors, price, "Purchase price");
  requireRate(errors, rate, "Interest rate");
  const totalMonths = requireTerm(errors, years, months);
  if (!Number.isFinite(assistance) || assistance < 0) {
    errors.push("Down-payment assistance must be $0 or more.");
  }
  if (!Number.isFinite(borrowerDown) || borrowerDown < 0) {
    errors.push("Borrower funds must be $0 or more.");
  }
  if (
    Number.isFinite(price) &&
    Number.isFinite(assistance) &&
    Number.isFinite(borrowerDown) &&
    assistance + borrowerDown >= price
  ) {
    errors.push("Assistance plus borrower funds must be less than the price.");
  }
  [tax, insurance, debts].forEach((amount, index) => {
    const label = ["Property tax", "Insurance", "Other monthly debts"][index];
    if (!Number.isFinite(amount) || amount < 0) errors.push(`${label} must be $0 or more.`);
  });
  if (!Number.isFinite(income) || income <= 0) {
    errors.push("Gross monthly income must be greater than $0.");
  }
  if (!firstPayment) errors.push("Choose a valid first payment month.");
  if (errors.length) return { ok: false, errors };

  const loan = roundMoney(price - assistance - borrowerDown);
  const fundsToClose = roundMoney(borrowerDown);
  const annualRate = rate / 100;
  const pi = paymentAmount(loan, annualRate, totalMonths);
  const housing = roundMoney(pi + tax + insurance);
  const frontRatio = income > 0 ? housing / income : null;
  const backRatio = income > 0 ? (housing + debts) / income : null;
  const withoutHelp = paymentAmount(roundMoney(price - borrowerDown), annualRate, totalMonths);
  const paymentRelief = roundMoney(Math.max(0, withoutHelp - pi));
  const rows = buildSchedule({
    principal: loan,
    annualRate,
    months: totalMonths,
    payment: pi,
    firstPayment,
  });
  return {
    ok: true,
    errors: [],
    rows,
    summary: {
      ...summarize(rows, pi),
      loan,
      assistance,
      borrowerDown,
      fundsToClose,
      pi,
      housing,
      tax,
      insurance,
      frontRatio,
      backRatio,
      paymentRelief,
      withoutHelp,
    },
  };
}
