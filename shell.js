import { guides, modules } from "./guides.js";
import { productExportFileName, productWorkbookBlob } from "./product-export.js";
import {
  calculateCommercial,
  calculateCommunity,
  calculatePurchase,
  calculateRefinance,
  commercialDefaults,
  communityDefaults,
  purchaseDefaults,
  refinanceDefaults,
} from "./products.js";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const ratio = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nav = document.querySelector("#module-nav");
const landing = document.querySelector("#landing");
const view = document.querySelector("#module-view");
const buydown = document.querySelector("#buydown-module");
const menuButton = document.querySelector("#menu-toggle");
const shell = document.querySelector(".app-shell");

const calculators = {
  purchase: { defaults: purchaseDefaults, calculate: calculatePurchase, render: renderPurchase },
  refinance: { defaults: refinanceDefaults, calculate: calculateRefinance, render: renderRefinance },
  commercial: { defaults: commercialDefaults, calculate: calculateCommercial, render: renderCommercial },
  community: { defaults: communityDefaults, calculate: calculateCommunity, render: renderCommunity },
};

let activeId = "home";
let debounceId;

function fieldValue(form, name) {
  const control = form.elements[name];
  return control ? control.value : "";
}

function showErrors(container, errors) {
  container.hidden = errors.length === 0;
  container.replaceChildren();
  errors.forEach((message) => {
    const p = document.createElement("p");
    p.textContent = message;
    container.append(p);
  });
}

function stat(label, value, note, tone = "") {
  return `
    <article class="stat ${tone}">
      <p class="stat-label">${label}</p>
      <p class="stat-value">${value}</p>
      <p class="stat-note">${note}</p>
    </article>`;
}

function input(name, label, value, options = {}) {
  const hint = options.hint ? `<small>${options.hint}</small>` : "";
  const suffix = options.suffix ? `<span class="suffix">${options.suffix}</span>` : "";
  const affix = options.money ? `<span class="affix">$</span>` : "";
  return `
    <label class="${options.wide ? "wide" : ""}">
      ${label}
      ${affix}${suffix}
      <input name="${name}" type="number" inputmode="decimal" step="${options.step ?? "0.01"}" value="${value}" />
      ${hint}
    </label>`;
}

function monthInput(value) {
  return `
    <label>
      First payment month
      <input name="firstPayment" type="month" value="${value}" required />
    </label>`;
}

function renderScheduleTable(rows, extraColumn = "Extra") {
  if (!rows.length) {
    return `<p class="empty">The schedule will appear here once the inputs check out.</p>`;
  }
  const body = rows.slice(0, 360).map((row) => `
    <tr class="${row.balloon ? "recast" : ""} ${row.interestOnly ? "buydown" : ""} ${row.final ? "final" : ""}">
      <td>${row.month}</td>
      <td>${row.label}${row.balloon ? " · balloon" : ""}${row.interestOnly ? " · interest only" : ""}</td>
      <td>${money.format(row.payment)}</td>
      <td>${money.format(row.interest)}</td>
      <td>${money.format(row.principal)}</td>
      <td>${money.format(row.extra)}</td>
      <td>${money.format(row.ending)}</td>
    </tr>`).join("");
  const clipped = rows.length > 360 ? `<p class="empty">Showing the first 360 of ${rows.length} payments.</p>` : "";
  return `
    ${clipped}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Month</th><th>Payment</th><th>Interest</th><th>Principal</th><th>${extraColumn}</th><th>Balance</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderGuide(id) {
  const guide = guides[id];
  const steps = (section) => section.steps
    ? `<ol class="guide-steps">${section.steps.map((step) => `<li>${step}</li>`).join("")}</ol>`
    : "";
  const prose = (section) => (section.paragraphs || [])
    .map((paragraph) => `<p>${paragraph}</p>`).join("");
  const articles = guide.sections.map((section) => `
    <article>
      <h3>${section.heading}</h3>
      ${prose(section)}
      ${steps(section)}
    </article>`);
  const midpoint = Math.ceil(articles.length / 2);
  const photos = `
    <div class="guide-photos">
      ${guide.photos.map((photo) => `
        <figure>
          <img src="${photo.src}" alt="${photo.alt}" />
          <figcaption>${photo.caption}</figcaption>
        </figure>`).join("")}
    </div>`;
  return `
    <section class="guide" aria-labelledby="guide-title">
      <figure class="hero-photo">
        <img src="${guide.hero.src}" alt="${guide.hero.alt}" />
      </figure>
      <div class="guide-copy">
        <p class="eyebrow">How this loan works</p>
        <h2 id="guide-title">A plain-language guide</h2>
        <p class="lede">${guide.lead}</p>
        ${articles.slice(0, midpoint).join("")}
        ${photos}
        ${articles.slice(midpoint).join("")}
        <p class="guide-aside">${guide.aside}</p>
      </div>
    </section>`;
}

function renderPurchase(result) {
  const s = result.summary;
  return `
    <section class="summary" aria-live="polite">
      ${stat("Monthly housing", money.format(s.housing), "Principal, interest, tax, insurance, HOA, and mortgage insurance.", "featured")}
      ${stat("Principal & interest", money.format(s.pi), `On a ${money.format(s.loan)} loan.`)}
      ${stat("Down payment", pct.format(s.downPercent), s.pmi ? `${money.format(s.pmi)}/mo mortgage insurance until you reach 20% equity.` : "20% or more down, so this estimate includes no mortgage insurance.", s.pmi ? "" : "accent")}
      ${stat("Total interest", money.format(s.totalInterest), `If you pay as scheduled through ${s.payoffLabel}.`)}
      ${stat("Loan-to-value", pct.format(s.ltv), "The share of the price the lender is financing.")}
      ${stat("Payoff", `${s.payoffMonths} mo`, s.payoffLabel)}
    </section>`;
}

function renderRefinance(result) {
  const s = result.summary;
  const savingNote = s.monthlySaving > 0
    ? `${money.format(s.monthlySaving)} less than the payment you entered.`
    : s.monthlySaving < 0
      ? `${money.format(Math.abs(s.monthlySaving))} more than the payment you have now.`
      : "The same as the payment you have now.";
  const breakEven = s.breakEvenMonths == null
    ? "No monthly savings to recover the costs."
    : `About ${s.breakEvenMonths} months to earn back ${money.format(s.closingCosts)} in costs.`;
  const interestNote = s.interestDelta >= 0
    ? `${money.format(s.interestDelta)} less interest than keeping the current loan.`
    : `${money.format(Math.abs(s.interestDelta))} more interest than keeping the current loan.`;
  return `
    <section class="summary" aria-live="polite">
      ${stat("New payment", money.format(s.payment), savingNote, "featured")}
      ${stat("Payment today", money.format(s.oldPayment), "The amount you typed as the current payment.")}
      ${stat("New loan amount", money.format(s.newLoan), s.financedCosts ? `Includes ${money.format(s.financedCosts)} of financed costs.` : "Costs are paid at closing, not added to the loan.", "accent")}
      ${stat("Break-even", s.breakEvenMonths == null ? "—" : `${s.breakEvenMonths} mo`, breakEven)}
      ${stat("Interest, new loan", money.format(s.totalInterest), interestNote)}
      ${stat("Cash to you", money.format(s.cashOut), s.cashOut ? "Borrowed above the payoff. It increases the new balance." : "No cash out. This is a rate-and-term shape.")}
    </section>`;
}

function renderCommercial(result) {
  const s = result.summary;
  const dscrNote = s.dscr == null
    ? "Enter income and a payment to see coverage."
    : s.dscr >= 1.25
      ? "At or above the 1.25 coverage many lenders look for."
      : s.dscr >= 1
        ? "Income covers the payment, but with less cushion than 1.25."
        : "Income does not cover the amortizing payment.";
  const ioNote = s.ioMonths
    ? `${money.format(s.ioPayment)} for the first ${s.ioMonths} months, then the amortizing payment.`
    : "No interest-only period. Principal starts declining in month 1.";
  return `
    <section class="summary" aria-live="polite">
      ${stat("Amortizing payment", money.format(s.payment), ioNote, "featured")}
      ${stat("Debt coverage", s.dscr == null ? "—" : `${ratio.format(s.dscr)}x`, dscrNote, s.dscr >= 1.25 ? "accent" : "")}
      ${stat("Loan-to-value", pct.format(s.ltv), `${money.format(s.loan)} financed against the stated value.`)}
      ${stat("Balloon due", money.format(s.balloon), `Unpaid balance at ${s.payoffLabel}, when the term ends.`)}
      ${stat("Cash need / month", money.format(s.debtService), "Loan payment plus tax, insurance, and other costs you entered.")}
      ${stat("Interest during term", money.format(s.totalInterest), "Interest paid before the balloon. The balloon itself is principal.")}
    </section>`;
}

function renderCommunity(result) {
  const s = result.summary;
  const front = s.frontRatio == null ? "—" : pct.format(s.frontRatio);
  const back = s.backRatio == null ? "—" : pct.format(s.backRatio);
  return `
    <section class="summary" aria-live="polite">
      ${stat("Housing payment", money.format(s.housing), `${money.format(s.pi)} principal and interest, plus tax and insurance.`, "featured")}
      ${stat("First mortgage", money.format(s.loan), s.assistance ? `${money.format(s.assistance)} of the price is covered by assistance.` : "No assistance entered.")}
      ${stat("Your cash in", money.format(s.fundsToClose), "Borrower funds toward the price. Closing costs are extra.", "accent")}
      ${stat("Payment relief", money.format(s.paymentRelief), s.assistance ? `Versus the same loan with no assistance (${money.format(s.withoutHelp)}).` : "Add an assistance amount to see the difference.")}
      ${stat("Housing ratio", front, "Housing payment divided by gross monthly income.")}
      ${stat("Total-debt ratio", back, "Housing plus the other monthly debts you entered.")}
    </section>`;
}

function purchaseForm(d) {
  return `
    <div class="grid">
      ${input("price", "Purchase price", d.price, { money: true })}
      ${input("downPayment", "Down payment", d.downPayment, { money: true, hint: "Cash you bring toward the price." })}
      ${input("rate", "Interest rate", d.rate, { suffix: "% / year", step: "0.001" })}
      <fieldset class="term">
        <legend>Term</legend>
        ${input("termYears", "Years", d.termYears, { step: "1" })}
        ${input("termMonths", "Months", d.termMonths, { step: "1" })}
      </fieldset>
      ${input("tax", "Property tax / month", d.tax, { money: true })}
      ${input("insurance", "Home insurance / month", d.insurance, { money: true })}
      ${input("hoa", "HOA / month", d.hoa, { money: true })}
      ${input("pmiRate", "Mortgage insurance rate", d.pmiRate, { suffix: "% / year", step: "0.01", hint: "Used only when the down payment is under 20%." })}
      ${monthInput(d.firstPayment)}
    </div>`;
}

function refinanceForm(d) {
  return `
    <div class="grid">
      ${input("balance", "Current balance", d.balance, { money: true })}
      ${input("currentRate", "Current rate", d.currentRate, { suffix: "% / year", step: "0.001" })}
      ${input("currentPayment", "Current monthly payment", d.currentPayment, { money: true, hint: "Principal and interest only." })}
      <fieldset class="term">
        <legend>Remaining term</legend>
        ${input("remainingYears", "Years", d.remainingYears, { step: "1" })}
        ${input("remainingMonths", "Months", d.remainingMonths, { step: "1" })}
      </fieldset>
      ${input("newRate", "New rate", d.newRate, { suffix: "% / year", step: "0.001" })}
      <fieldset class="term">
        <legend>New term</legend>
        ${input("newYears", "Years", d.newYears, { step: "1" })}
        ${input("newMonths", "Months", d.newMonths, { step: "1" })}
      </fieldset>
      ${input("closingCosts", "Closing costs", d.closingCosts, { money: true })}
      ${input("cashOut", "Cash out", d.cashOut, { money: true, hint: "Leave at 0 for a rate-and-term refinance." })}
      <fieldset class="mode">
        <legend>Where do closing costs go?</legend>
        <label class="choice">
          <input type="radio" name="rollCosts" value="yes" checked />
          <span><strong>Roll them into the new loan</strong><small>You bring less cash. The balance is higher.</small></span>
        </label>
        <label class="choice">
          <input type="radio" name="rollCosts" value="no" />
          <span><strong>Pay them at closing</strong><small>The new loan stays closer to today's balance.</small></span>
        </label>
      </fieldset>
      ${monthInput(d.firstPayment)}
    </div>`;
}

function commercialForm(d) {
  return `
    <div class="grid">
      ${input("value", "Property value", d.value, { money: true })}
      ${input("loanAmount", "Loan amount", d.loanAmount, { money: true })}
      ${input("rate", "Interest rate", d.rate, { suffix: "% / year", step: "0.001" })}
      <fieldset class="term">
        <legend>Amortization</legend>
        ${input("amortYears", "Years", d.amortYears, { step: "1" })}
        ${input("amortMonths", "Months", d.amortMonths, { step: "1" })}
      </fieldset>
      ${input("termYears", "Loan term", d.termYears, { suffix: "years", step: "1", hint: "When the remaining balance is due." })}
      ${input("ioMonths", "Interest-only months", d.ioMonths, { step: "1", hint: "0 if principal starts declining immediately." })}
      ${input("noi", "Net operating income / year", d.noi, { money: true, hint: "Income left after operating expenses, before the mortgage." })}
      ${input("tax", "Property tax / month", d.tax, { money: true })}
      ${input("insurance", "Insurance / month", d.insurance, { money: true })}
      ${input("other", "Other costs / month", d.other, { money: true })}
      ${monthInput(d.firstPayment)}
    </div>`;
}

function communityForm(d) {
  return `
    <div class="grid">
      ${input("price", "Purchase price", d.price, { money: true })}
      ${input("assistance", "Down-payment assistance", d.assistance, { money: true, hint: "Grant or forgivable second. Not added to the first mortgage." })}
      ${input("borrowerDown", "Your own funds", d.borrowerDown, { money: true })}
      ${input("rate", "Interest rate", d.rate, { suffix: "% / year", step: "0.001" })}
      <fieldset class="term">
        <legend>Term</legend>
        ${input("termYears", "Years", d.termYears, { step: "1" })}
        ${input("termMonths", "Months", d.termMonths, { step: "1" })}
      </fieldset>
      ${input("income", "Gross monthly income", d.income, { money: true, hint: "Before taxes. Include a co-borrower if you will apply together." })}
      ${input("debts", "Other monthly debts", d.debts, { money: true })}
      ${input("tax", "Property tax / month", d.tax, { money: true })}
      ${input("insurance", "Insurance / month", d.insurance, { money: true })}
      ${monthInput(d.firstPayment)}
    </div>`;
}

const forms = {
  purchase: purchaseForm,
  refinance: refinanceForm,
  commercial: commercialForm,
  community: communityForm,
};

const formCopy = {
  purchase: ["The loan", "Start with the price and the cash you will bring."],
  refinance: ["The two loans", "Put today's loan next to the one you are considering."],
  commercial: ["The property loan", "Income, value, and the balloon date drive this estimate."],
  community: ["The assisted purchase", "Separate program help from the cash you still need to bring."],
};

function renderLanding() {
  landing.hidden = false;
  view.hidden = true;
  buydown.hidden = true;
  landing.innerHTML = `
    <header class="masthead landing-mast">
      <div>
        <p class="eyebrow">Four loan types · calculated in your browser</p>
        <h1>What kind of mortgage are you looking at?</h1>
        <p class="lede">Pick a path. Each one explains the loan in everyday language, then runs the monthly payment and the payoff schedule from numbers you type. Nothing is sent anywhere.</p>
      </div>
    </header>
    <div class="module-cards">
      ${modules.map((item) => `
        <button class="module-card" type="button" data-module="${item.id}">
          <img src="${guides[item.id].hero.src}" alt="" />
          <span>
            <small>${item.kicker}</small>
            <strong>${item.title}</strong>
            <em>${item.summary}</em>
          </span>
        </button>`).join("")}
    </div>
    <figure class="landing-strip">
      <img src="images/neighborhood.jpg" alt="Houses along a tree-lined residential street" />
      <img src="images/office-team.jpg" alt="Coworkers collaborating in an office" />
      <img src="images/friends.jpg" alt="Friends smiling together" />
    </figure>`;
  landing.querySelectorAll("[data-module]").forEach((button) => {
    button.addEventListener("click", () => selectModule(button.dataset.module));
  });
}

function renderModule(id) {
  const item = modules.find((entry) => entry.id === id);
  const calc = calculators[id];
  const defaults = calc.defaults();
  const [heading, note] = formCopy[id];
  landing.hidden = true;
  view.hidden = false;
  buydown.hidden = id !== "purchase";
  view.innerHTML = `
    <header class="masthead">
      <div>
        <p class="eyebrow">${item.kicker}</p>
        <h1>${item.title}</h1>
        <p class="lede">${item.summary}</p>
      </div>
    </header>
    ${renderGuide(id)}
    <div id="module-summary"></div>
    <div class="workspace">
      <form id="module-form" class="panel" novalidate>
        <div class="panel-head">
          <h2>${heading}</h2>
          <p>${note}</p>
        </div>
        <div id="module-errors" class="errors" hidden></div>
        ${forms[id](defaults)}
        <div class="form-actions">
          <button class="recalc" type="button">Recalculate</button>
        </div>
      </form>
      <section class="panel chart-panel">
        <div class="panel-head">
          <h2>Balance over time</h2>
          <p id="chart-note">The line falls as principal is paid. A balloon keeps a balance at the end of the term.</p>
        </div>
        <div class="chart-wrap">
          <canvas id="module-chart" aria-label="Loan balance chart" role="img"></canvas>
        </div>
      </section>
    </div>
    <section class="panel schedule-panel">
      <div class="schedule-head">
        <button id="module-schedule-toggle" class="schedule-toggle" type="button" aria-expanded="false" aria-controls="module-schedule">
          <span class="plus" aria-hidden="true">+</span>
          <span>
            <h2>Amortization schedule</h2>
            <p id="module-count">Every payment until the balance is zero, or until a commercial term ends.</p>
          </span>
        </button>
        <button id="module-export" class="ghost" type="button">Export to Sheet</button>
      </div>
      <div id="module-schedule" class="schedule-body" hidden>
        <div id="module-table"></div>
      </div>
    </section>`;

  const form = view.querySelector("#module-form");
  let lastResult = null;
  const run = () => {
    const raw = {};
    [...form.elements].forEach((control) => {
      if (!control.name) return;
      if (control.type === "radio" && !control.checked) return;
      raw[control.name] = control.value;
    });
    const result = calc.calculate(raw);
    const errors = view.querySelector("#module-errors");
    if (!result.ok) {
      showErrors(errors, result.errors);
      return;
    }
    showErrors(errors, []);
    lastResult = result;
    view.querySelector("#module-summary").innerHTML = calc.render(result);
    view.querySelector("#module-table").innerHTML = renderScheduleTable(result.rows);
    view.querySelector("#module-count").textContent =
      `${result.rows.length} payments through ${result.rows.at(-1)?.label ?? "the end"}.`;
    drawChart(result.rows);
  };
  form.addEventListener("input", () => {
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(run, 160);
  });
  view.querySelector("#module-export").addEventListener("click", (event) => {
    downloadProductSheet(event.currentTarget, {
      id,
      title: item.title,
      rows: lastResult?.rows || [],
      summary: lastResult?.summary || {},
    });
  });
  mountScheduleToggles();
  run();
  if (id === "purchase") document.dispatchEvent(new CustomEvent("buydown-show"));
}

let moduleChart;
function drawChart(rows) {
  const canvas = view.querySelector("#module-chart");
  if (!canvas || !window.Chart) return;
  const step = Math.max(1, Math.ceil(rows.length / 180));
  const sampled = rows.filter((row, index) => index % step === 0 || row.final || row.balloon);
  const data = {
    labels: sampled.map((row) => row.label),
    datasets: [{
      label: "Balance",
      data: sampled.map((row) => row.ending),
      borderColor: "#7dcebb",
      backgroundColor: "rgba(125, 206, 187, 0.16)",
      fill: true,
      tension: 0.18,
      pointRadius: 0,
      borderWidth: 2.5,
    }],
  };
  if (moduleChart) {
    moduleChart.destroy();
    moduleChart = null;
  }
  moduleChart = new window.Chart(canvas, {
    type: "line",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => money.format(item.parsed.y) } },
      },
      scales: {
        y: {
          ticks: { color: "#c9d4cc", callback: (value) => money.format(value) },
          grid: { color: "rgba(246, 241, 232, 0.08)" },
        },
        x: { ticks: { color: "#c9d4cc", maxTicksLimit: 6 }, grid: { display: false } },
      },
    },
  });
}

function selectModule(id) {
  activeId = id;
  [...nav.querySelectorAll("button")].forEach((button) => {
    button.setAttribute("aria-current", button.dataset.module === id ? "page" : "false");
  });
  shell.classList.remove("nav-open");
  if (id === "home") renderLanding();
  else renderModule(id);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function mountTheme() {
  const toggle = document.querySelector("#theme-toggle");
  const saved = window.localStorage.getItem("loan-desk-theme");
  const theme = saved === "day" || saved === "night" ? saved : "night";
  applyTheme(theme);
  toggle.addEventListener("click", () => {
    const next = document.body.dataset.theme === "night" ? "day" : "night";
    applyTheme(next);
    window.localStorage.setItem("loan-desk-theme", next);
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  const night = theme === "night";
  const toggle = document.querySelector("#theme-toggle");
  const label = night ? "Switch to day mode" : "Switch to night mode";
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
  toggle.setAttribute("aria-pressed", night ? "true" : "false");
  document.dispatchEvent(new CustomEvent("theme-change"));
}

async function downloadProductSheet(button, spec) {
  if (!spec.rows.length) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing sheet…";
  try {
    const preparedOn = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const blob = await productWorkbookBlob(spec, preparedOn);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = productExportFileName(spec);
    link.click();
    URL.revokeObjectURL(url);
    button.textContent = original;
  } catch (error) {
    button.textContent = "Sheet unavailable";
    window.setTimeout(() => {
      button.textContent = original;
    }, 1800);
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

function mountScheduleToggles() {
  document.querySelectorAll(".schedule-toggle").forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const panel = document.getElementById(button.getAttribute("aria-controls"));
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", open ? "true" : "false");
      if (panel) panel.hidden = !open;
      button.querySelector(".plus").textContent = open ? "–" : "+";
    });
  });
}

export function mountShell() {
  mountTheme();
  mountScheduleToggles();
  nav.innerHTML = `
    <button type="button" data-module="home" aria-current="page">
      <strong>Home</strong>
      <small>Choose a mortgage type</small>
    </button>
    ${modules.map((item) => `
      <button type="button" data-module="${item.id}" aria-current="false">
        <strong>${item.nav}</strong>
        <small>${item.blurb}</small>
      </button>`).join("")}`;
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) selectModule(button.dataset.module);
  });
  menuButton.addEventListener("click", () => {
    const open = shell.classList.toggle("nav-open");
    menuButton.setAttribute("aria-expanded", open ? "true" : "false");
    menuButton.textContent = open ? "Close" : "Menu";
  });
  renderLanding();
}
