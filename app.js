import {
  addMonths,
  calculate,
  defaultInputs,
  parseMonthValue,
  toMonthValue,
} from "./amortization.js";
import { exportFileName, workbookBlob } from "./excel-export.js";
import { mountShell } from "./shell.js";

const form = document.querySelector("#loan-form");
const extraList = document.querySelector("#extra-list");
const extraEmpty = document.querySelector("#extra-empty");
const errorsEl = document.querySelector("#form-errors");
const scheduleBody = document.querySelector("#schedule-body");
const recastField = document.querySelector("#recast-field");
const recastInput = document.querySelector("#recastMonth");
const recastHint = document.querySelector("#recast-hint");

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const rateFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

let extras = [];
let chart;
let debounceId;
let recastTouched = false;
let lastResult = null;

function field(id) {
  return document.querySelector(`#${id}`);
}

function readForm() {
  return {
    principal: field("principal").value,
    noteRate: field("noteRate").value,
    buydownReduction: field("buydownReduction").value,
    buydownMonths: Number(field("buydownMonths").value),
    termYears: Number(field("termYears").value),
    termMonths: Number(field("termMonths").value),
    firstPayment: field("firstPayment").value,
    currentPayment: field("currentPayment").value,
    extras,
    mode: form.mode.value,
    recastMonth: recastInput.value,
  };
}

function suggestedRecast(raw) {
  const first = parseMonthValue(raw.firstPayment);
  const months = Number(raw.buydownMonths);
  if (!first || !Number.isInteger(months)) return "";
  const next = addMonths(first.year, first.monthIndex, Math.max(0, months));
  return toMonthValue(next.year, next.monthIndex);
}

function fillDefaults() {
  const defaults = defaultInputs();
  field("principal").value = defaults.principal;
  field("noteRate").value = defaults.noteRate;
  field("buydownReduction").value = defaults.buydownReduction;
  field("buydownMonths").value = defaults.buydownMonths;
  field("termYears").value = defaults.termYears;
  field("termMonths").value = defaults.termMonths;
  field("firstPayment").value = defaults.firstPayment;
  recastInput.value = defaults.recastMonth;
  form.mode.value = "keep";
}

function renderExtras() {
  extraList.replaceChildren();
  extraEmpty.hidden = extras.length > 0;
  extras.forEach((rule) => {
    const row = document.createElement("div");
    row.className = "extra-rule";
    row.innerHTML = `
      <label>Amount
        <input data-key="amount" type="number" min="0" step="0.01" value="${rule.amount}" />
      </label>
      <label>Frequency
        <select data-key="frequency">
          <option value="once">One-time</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </label>
      <label>Start month
        <input data-key="startMonth" type="number" min="1" step="1" value="${rule.startMonth}" />
      </label>
      <label>End month
        <input data-key="endMonth" type="number" min="1" step="1" value="${rule.endMonth}" ${rule.frequency === "once" ? "disabled" : ""} />
      </label>
      <button class="remove" type="button">Remove</button>
    `;
    row.querySelector("select").value = rule.frequency;
    row.querySelector('[data-key="endMonth"]').placeholder = "Until payoff";
    row.addEventListener("input", (event) => {
      const key = event.target.dataset.key;
      if (!key) return;
      rule[key] = event.target.value;
      if (key === "frequency") {
        const end = row.querySelector('[data-key="endMonth"]');
        end.disabled = rule.frequency === "once";
        if (rule.frequency === "once") rule.endMonth = "";
      }
      queueCalculate();
    });
    row.querySelector(".remove").addEventListener("click", () => {
      extras = extras.filter((item) => item.id !== rule.id);
      renderExtras();
      queueCalculate();
    });
    extraList.append(row);
  });
}

function animateValue(element, next) {
  if (element.textContent === next) return;
  element.textContent = next;
  element.animate(
    [
      { opacity: 0.35, transform: "translateY(4px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 280, easing: "ease-out" },
  );
}

function showErrors(errors) {
  errorsEl.hidden = errors.length === 0;
  errorsEl.replaceChildren();
  errors.forEach((message) => {
    const p = document.createElement("p");
    p.textContent = message;
    errorsEl.append(p);
  });
}

function renderSummary(summary) {
  field("year-one-payment").closest(".stat").querySelector(".stat-label").textContent =
    summary.buydownMonths > 0 ? "Payment · Year 1" : "Payment · Now";
  animateValue(field("year-one-payment"), money.format(summary.yearOnePayment));
  const rate = `${rateFormat.format(summary.yearOneRate * 100)}%`;
  const saving = summary.monthlySaving
    ? `${money.format(summary.monthlySaving)}/mo below a ${rateFormat.format(summary.noteRate * 100)}% note payment.`
    : `At the note rate of ${rateFormat.format(summary.noteRate * 100)}%.`;
  const overage = summary.currentPayment
    ? ` ${money.format(summary.monthOneToPrincipal)} of month 1 goes to principal.`
    : "";
  field("year-one-note").textContent = `${rate} during the buydown. ${saving}${overage}`;

  animateValue(field("after-payment"), money.format(summary.afterPayment));
  field("after-note").textContent = summary.recastAt
    ? `Contractual note payment. Recast changes it once at month ${summary.recastAt}.`
    : `Fixed at ${rateFormat.format(summary.noteRate * 100)}% after the buydown.`;

  animateValue(field("payoff"), `${summary.payoffMonths} mo`);
  field("payoff-note").textContent = summary.monthsSooner
    ? `${summary.payoffLabel} · ${summary.monthsSooner} months sooner than baseline.`
    : `${summary.payoffLabel} · same length as the baseline.`;

  animateValue(field("interest"), money.format(summary.totalInterest));
  field("interest-note").textContent = `Baseline ${money.format(summary.baselineInterest)}.`;
  animateValue(field("saved"), money.format(summary.interestSaved));
  field("saved-note").textContent = summary.interestSaved
    ? "From extra principal and an earlier payoff."
    : "No interest saved versus the baseline.";
  animateValue(field("extra-paid"), money.format(summary.extraPaid));
}

function sampleSeries(rows, points = 180) {
  if (rows.length <= points) return rows;
  const step = (rows.length - 1) / (points - 1);
  const sampled = [];
  for (let i = 0; i < points; i += 1) {
    sampled.push(rows[Math.round(i * step)]);
  }
  return sampled;
}

function renderChart(rows, baselineRows) {
  const canvas = field("balance-chart");
  if (!canvas) return;
  if (!window.Chart) {
    canvas.replaceWith(Object.assign(document.createElement("p"), {
      id: "balance-chart",
      textContent: "Chart library did not load. The schedule below is still complete.",
    }));
    return;
  }
  const span = baselineRows.length >= rows.length ? baselineRows : rows;
  const sampled = sampleSeries(span);
  const actualMap = new Map(rows.map((row) => [row.month, row.ending]));
  const baselineMap = new Map(baselineRows.map((row) => [row.month, row.ending]));
  const data = {
    labels: sampled.map((row) => row.label),
    datasets: [
      {
        label: "This plan",
        data: sampled.map((row) => actualMap.get(row.month) ?? null),
        borderColor: "#7dcebb",
        backgroundColor: "rgba(125, 206, 187, 0.16)",
        fill: true,
        tension: 0.15,
        pointRadius: 0,
        borderWidth: 2.5,
        spanGaps: false,
      },
      {
        label: "No extras",
        data: sampled.map((row) => baselineMap.get(row.month) ?? null),
        borderColor: "#c9842a",
        borderDash: [5, 5],
        tension: 0.15,
        pointRadius: 0,
        borderWidth: 2,
        spanGaps: false,
      },
    ],
  };
  if (chart) {
    chart.data = data;
    chart.update();
    return;
  }
  chart = new window.Chart(canvas, {
    type: "line",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#f3eee6", usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${money.format(item.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          ticks: { color: "#c9d4cc", callback: (value) => money.format(value) },
          grid: { color: "rgba(246, 241, 232, 0.08)" },
        },
        x: { ticks: { color: "#c9d4cc", maxTicksLimit: 8 }, grid: { display: false } },
      },
    },
  });
}

function renderSchedule(rows) {
  const fragment = document.createDocumentFragment();
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = [
      row.buydown ? "buydown" : "",
      row.recast ? "recast" : "",
      row.extra > 0 ? "extra" : "",
      row.final ? "final" : "",
    ].filter(Boolean).join(" ");
    tr.innerHTML = `
      <td>${row.month}</td>
      <td>${row.label}${row.recast ? " · recast" : ""}</td>
      <td>${rateFormat.format(row.annualRate * 100)}%</td>
      <td>${money.format(row.payment)}</td>
      <td>${money.format(row.interest)}</td>
      <td>${money.format(row.principal)}</td>
      <td>${money.format(row.extra)}</td>
      <td>${money.format(row.ending)}</td>
    `;
    fragment.append(tr);
  });
  scheduleBody.replaceChildren(fragment);
  field("schedule-count").textContent = `${rows.length} payments through ${rows.at(-1)?.label ?? "payoff"}.`;
}

function calculateNow() {
  const raw = readForm();
  if (!recastTouched) {
    const suggested = suggestedRecast(raw);
    if (suggested && recastInput.value !== suggested) recastInput.value = suggested;
    raw.recastMonth = recastInput.value;
  }
  recastField.hidden = raw.mode !== "recast";
  recastInput.disabled = raw.mode !== "recast";
  recastHint.textContent = raw.mode === "recast"
    ? "Payment changes once in this month and stays fixed. A date outside the term is ignored."
    : "Available when recast mode is selected.";

  const result = calculate(raw);
  if (!result.ok) {
    showErrors(result.errors);
    return;
  }
  showErrors([]);
  renderSummary(result.summary);
  renderSchedule(result.rows);
  renderChart(result.rows, result.baselineRows);
  lastResult = result;
}

function queueCalculate() {
  window.clearTimeout(debounceId);
  debounceId = window.setTimeout(calculateNow, 160);
}

document.querySelector("#add-extra").addEventListener("click", () => {
  extras.push({
    id: crypto.randomUUID(),
    amount: 1000,
    frequency: "once",
    startMonth: 1,
    endMonth: "",
  });
  renderExtras();
  queueCalculate();
});

form.addEventListener("input", (event) => {
  if (event.target === recastInput) recastTouched = true;
  queueCalculate();
});
document.querySelector("#recalculate").addEventListener("click", calculateNow);
document.querySelector("#export-sheet").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  if (!lastResult) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing sheet…";
  try {
    const preparedOn = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const blob = await workbookBlob(lastResult, preparedOn);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName(lastResult);
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    button.textContent = "Sheet unavailable";
    window.setTimeout(() => {
      button.textContent = original;
    }, 1800);
    console.error(error);
    return;
  } finally {
    button.disabled = false;
  }
  button.textContent = original;
});

fillDefaults();
renderExtras();
calculateNow();
mountShell();
