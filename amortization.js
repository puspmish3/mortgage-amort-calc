/**
 * Client-side 1-year (or partial) buydown mortgage amortization.
 * All money is rounded to the cent at each cash-flow step so the schedule
 * can reach an exact $0.00 balance.
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

export function monthKey(year, monthIndex) {
  return year * 12 + monthIndex;
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

function defaultFirstPayment() {
  const now = new Date();
  const next = addMonths(now.getFullYear(), now.getMonth(), 1);
  return next;
}

export function defaultInputs() {
  const first = defaultFirstPayment();
  const recast = addMonths(first.year, first.monthIndex, 12);
  return {
    principal: 350000,
    noteRate: 6.5,
    buydownReduction: 1,
    buydownMonths: 12,
    termYears: 30,
    termMonths: 0,
    firstPayment: toMonthValue(first.year, first.monthIndex),
    currentPayment: "",
    extras: [],
    mode: "keep",
    recastMonth: toMonthValue(recast.year, recast.monthIndex),
  };
}

export function validateInputs(raw) {
  const errors = [];
  const principal = Number(raw.principal);
  const noteRate = Number(raw.noteRate);
  const buydownReduction = Number(raw.buydownReduction);
  const buydownMonths = Number(raw.buydownMonths);
  const termYears = Number(raw.termYears);
  const termMonths = Number(raw.termMonths);
  const currentPayment =
    raw.currentPayment === "" || raw.currentPayment == null
      ? 0
      : Number(raw.currentPayment);

  if (!Number.isFinite(principal) || principal <= 0) {
    errors.push("Current outstanding principal must be greater than $0.");
  }
  if (!Number.isFinite(noteRate) || noteRate < 0 || noteRate > 30) {
    errors.push("Note interest rate must be between 0% and 30%.");
  }
  if (!Number.isFinite(buydownReduction) || buydownReduction < 0) {
    errors.push("Buydown reduction cannot be negative.");
  }
  if (
    Number.isFinite(noteRate) &&
    Number.isFinite(buydownReduction) &&
    buydownReduction >= noteRate &&
    !(noteRate === 0 && buydownReduction === 0)
  ) {
    errors.push("Buydown reduction must be less than the note rate.");
  }
  if (!Number.isInteger(buydownMonths) || buydownMonths < 0 || buydownMonths > 24) {
    errors.push("Buydown months left must be a whole number from 0 to 24.");
  }
  if (!Number.isInteger(termYears) || termYears < 0 || termYears > 50) {
    errors.push("Remaining years must be a whole number from 0 to 50.");
  }
  if (!Number.isInteger(termMonths) || termMonths < 0 || termMonths > 11) {
    errors.push("Additional months must be a whole number from 0 to 11.");
  }

  const totalMonths = (Number.isInteger(termYears) ? termYears : 0) * 12 +
    (Number.isInteger(termMonths) ? termMonths : 0);
  if (totalMonths < 1) {
    errors.push("Remaining term must be at least 1 month.");
  }
  if (
    Number.isInteger(buydownMonths) &&
    totalMonths >= 1 &&
    buydownMonths > totalMonths
  ) {
    errors.push("Buydown months left cannot exceed the remaining term.");
  }

  const firstPayment = parseMonthValue(raw.firstPayment);
  if (!firstPayment) {
    errors.push("Choose a valid first payment month.");
  }

  if (!Number.isFinite(currentPayment) || currentPayment < 0) {
    errors.push("Current monthly payment must be blank or $0 or more.");
  }

  const extras = Array.isArray(raw.extras) ? raw.extras : [];
  extras.forEach((rule, index) => {
    const amount = Number(rule.amount);
    const start = Number(rule.startMonth);
    const end =
      rule.endMonth === "" || rule.endMonth == null ? null : Number(rule.endMonth);
    const label = `Extra payment ${index + 1}`;
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`${label} needs an amount greater than $0.`);
    }
    if (!["once", "monthly", "quarterly", "yearly"].includes(rule.frequency)) {
      errors.push(`${label} has an unrecognized frequency.`);
    }
    if (!Number.isInteger(start) || start < 1) {
      errors.push(`${label} start month must be payment 1 or later.`);
    }
    if (end != null && (!Number.isInteger(end) || end < start)) {
      errors.push(`${label} end month must be on or after its start month.`);
    }
  });

  if (raw.mode !== "keep" && raw.mode !== "recast") {
    errors.push("Choose a payoff mode.");
  }

  return {
    ok: errors.length === 0,
    errors,
    value: errors.length
      ? null
      : {
          principal,
          noteRate: noteRate / 100,
          buydownReduction: buydownReduction / 100,
          buydownMonths,
          totalMonths,
          firstPayment,
          currentPayment,
          extras: extras.map((rule) => ({
            id: rule.id,
            amount: Number(rule.amount),
            frequency: rule.frequency,
            startMonth: Number(rule.startMonth),
            endMonth:
              rule.endMonth === "" || rule.endMonth == null
                ? null
                : Number(rule.endMonth),
          })),
          mode: raw.mode,
          recastMonth: parseMonthValue(raw.recastMonth),
        },
  };
}

export function extraForMonth(rules, monthNumber) {
  return rules.reduce((sum, rule) => {
    if (monthNumber < rule.startMonth) return sum;
    if (rule.endMonth != null && monthNumber > rule.endMonth) return sum;
    const offset = monthNumber - rule.startMonth;
    const hits =
      rule.frequency === "once"
        ? offset === 0
        : rule.frequency === "monthly"
          ? true
          : rule.frequency === "quarterly"
            ? offset % 3 === 0
            : rule.frequency === "yearly"
              ? offset % 12 === 0
              : false;
    return hits ? sum + rule.amount : sum;
  }, 0);
}

function scheduledPayment(balance, annualRate, monthsLeft) {
  return paymentAmount(balance, annualRate, monthsLeft);
}

/**
 * Project the contractual post-buydown payment. Extra payments and the
 * current-payment overage are ignored so the note payment stays fixed.
 */
export function contractualPayments(input) {
  const reducedRate = Math.max(0, input.noteRate - input.buydownReduction);
  const yearOne = scheduledPayment(
    input.principal,
    input.buydownMonths > 0 ? reducedRate : input.noteRate,
    input.totalMonths,
  );

  let projected = input.principal;
  const buydownRate = input.buydownMonths > 0 ? reducedRate : input.noteRate;
  for (let month = 1; month <= input.buydownMonths; month++) {
    const interest = roundMoney(projected * (buydownRate / 12));
    const principalPart = roundMoney(Math.min(projected, Math.max(0, yearOne - interest)));
    projected = roundMoney(projected - principalPart);
  }

  const monthsAfter = input.totalMonths - input.buydownMonths;
  const after =
    monthsAfter > 0
      ? scheduledPayment(projected, input.noteRate, monthsAfter)
      : 0;

  return {
    reducedRate,
    yearOnePayment: input.buydownMonths > 0 ? yearOne : after,
    afterPayment: input.buydownMonths > 0 ? after : yearOne,
    projectedBalance: projected,
    noteOnlyPayment: scheduledPayment(input.principal, input.noteRate, input.totalMonths),
  };
}

function recastIndex(input) {
  if (input.mode !== "recast" || !input.recastMonth || !input.firstPayment) return null;
  const start = monthKey(input.firstPayment.year, input.firstPayment.monthIndex);
  const target = monthKey(input.recastMonth.year, input.recastMonth.monthIndex);
  const index = target - start + 1;
  if (index < 1) return 1;
  if (index > input.totalMonths) return null;
  return index;
}

function buildSchedule(input, options) {
  const { applyExtras, applyOverage, applyRecast } = options;
  const contract = contractualPayments(input);
  const recastAt = applyRecast ? recastIndex(input) : null;
  const rows = [];
  let balance = roundMoney(input.principal);
  let payment = contract.yearOnePayment;
  let recastPayment = null;

  const safetyCap = input.totalMonths + 720;
  for (let month = 1; balance > 0 && month <= safetyCap; month++) {
    const inBuydown = month <= input.buydownMonths;
    const annualRate = inBuydown ? contract.reducedRate : input.noteRate;
    const isRecastMonth = recastAt != null && month === recastAt;

    if (isRecastMonth) {
      const monthsLeft = Math.max(1, input.totalMonths - month + 1);
      payment = scheduledPayment(balance, annualRate, monthsLeft);
      recastPayment = payment;
    } else if (recastAt == null && month === input.buydownMonths + 1) {
      payment = contract.afterPayment;
    } else if (month === 1 && input.buydownMonths === 0) {
      payment = contract.afterPayment;
    }

    const interest = roundMoney(balance * (annualRate / 12));
    let scheduledPrincipal = roundMoney(Math.max(0, payment - interest));
    if (scheduledPrincipal > balance) scheduledPrincipal = balance;

    const ruleExtra = applyExtras ? extraForMonth(input.extras, month) : 0;
    const overageApplies = applyOverage && (recastAt == null || month < recastAt);
    const overage =
      overageApplies && input.currentPayment > payment
        ? roundMoney(input.currentPayment - payment)
        : 0;
    const requestedExtra = roundMoney(ruleExtra + overage);
    const room = roundMoney(balance - scheduledPrincipal);
    const extra = roundMoney(Math.min(requestedExtra, Math.max(0, room)));
    const ending = roundMoney(balance - scheduledPrincipal - extra);
    const calendar = addMonths(
      input.firstPayment.year,
      input.firstPayment.monthIndex,
      month - 1,
    );

    rows.push({
      month,
      year: calendar.year,
      monthIndex: calendar.monthIndex,
      label: formatMonth(calendar.year, calendar.monthIndex),
      annualRate,
      payment: roundMoney(scheduledPrincipal + interest),
      interest,
      principal: scheduledPrincipal,
      extra,
      overage: roundMoney(Math.min(overage, extra)),
      ending,
      buydown: inBuydown,
      recast: isRecastMonth,
      final: ending === 0,
    });

    balance = ending;
    if (ending === 0) break;
    if (month > input.totalMonths + 600) break;
  }

  return { rows, contract, recastAt, recastPayment };
}

export function calculate(raw) {
  const validated = validateInputs(raw);
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const input = validated.value;
  const actual = buildSchedule(input, {
    applyExtras: true,
    applyOverage: true,
    applyRecast: true,
  });
  const baseline = buildSchedule(input, {
    applyExtras: false,
    applyOverage: false,
    applyRecast: false,
  });

  const interest = (rows) =>
    roundMoney(rows.reduce((sum, row) => sum + row.interest, 0));
  const extraPaid = roundMoney(
    actual.rows.reduce((sum, row) => sum + row.extra, 0),
  );
  const actualInterest = interest(actual.rows);
  const baselineInterest = interest(baseline.rows);
  const last = actual.rows[actual.rows.length - 1];
  const baseLast = baseline.rows[baseline.rows.length - 1];

  const displayedYearOne =
    input.buydownMonths > 0
      ? actual.contract.yearOnePayment
      : actual.contract.afterPayment;
  const notePayment = actual.contract.noteOnlyPayment;
  const monthlySaving = roundMoney(Math.max(0, notePayment - displayedYearOne));
  const entered = input.currentPayment;
  const yearOneOverage =
    entered > displayedYearOne ? roundMoney(entered - displayedYearOne) : 0;
  const firstRow = actual.rows[0];

  return {
    ok: true,
    errors: [],
    input,
    summary: {
      yearOnePayment: displayedYearOne,
      buydownMonths: input.buydownMonths,
      yearOneRate: input.buydownMonths > 0 ? actual.contract.reducedRate : input.noteRate,
      monthlySaving,
      yearOneOverage,
      monthOneToPrincipal: firstRow
        ? roundMoney(firstRow.principal + firstRow.extra)
        : 0,
      currentPayment: entered,
      afterPayment: actual.contract.afterPayment,
      noteRate: input.noteRate,
      payoffMonths: last ? last.month : 0,
      payoffLabel: last ? last.label : "—",
      baselineMonths: baseLast ? baseLast.month : 0,
      monthsSooner: baseLast && last ? Math.max(0, baseLast.month - last.month) : 0,
      totalInterest: actualInterest,
      baselineInterest,
      interestSaved: roundMoney(Math.max(0, baselineInterest - actualInterest)),
      extraPaid,
      recastAt: actual.recastAt,
      recastPayment: actual.recastPayment,
      reducedRate: actual.contract.reducedRate,
    },
    rows: actual.rows,
    baselineRows: baseline.rows,
  };
}

export function scheduleToCsv(rows) {
  const header = [
    "Month #",
    "Month",
    "Rate",
    "Payment",
    "Interest",
    "Principal",
    "Extra Payment",
    "Ending Balance",
  ];
  const lines = [header.join(",")];
  rows.forEach((row) => {
    lines.push(
      [
        row.month,
        row.label,
        `${(row.annualRate * 100).toFixed(3)}%`,
        row.payment.toFixed(2),
        row.interest.toFixed(2),
        row.principal.toFixed(2),
        row.extra.toFixed(2),
        row.ending.toFixed(2),
      ].join(","),
    );
  });
  return lines.join("\n");
}
