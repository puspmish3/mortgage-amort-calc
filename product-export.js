/**
 * Excel workbook for a purchase, refinance, commercial, or community schedule.
 * Built in the browser with ExcelJS. Nothing is uploaded.
 */

const PINE = "1F6F5B";
const INK = "1C2430";
const MUTED = "5D6B7A";
const GOLD = "C9842A";
const PAPER = "FBF7F1";
const LINE = "E4DDD2";
const SKY = "E7F3EE";
const WHITE = "FFFFFF";

const thin = { style: "thin", color: { argb: `FF${LINE}` } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const moneyFmt = '"$"#,##0.00';

function fill(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${argb}` } };
}

function font(partial) {
  return { name: "Calibri", size: 11, color: { argb: `FF${INK}` }, ...partial };
}

function paint(cell, { value, bold, size, color, bg, align, numFmt, italic, wrap }) {
  if (value !== undefined) cell.value = value;
  cell.font = font({
    bold: !!bold,
    size: size || 11,
    color: { argb: `FF${color || INK}` },
    italic: !!italic,
  });
  if (bg) cell.fill = fill(bg);
  cell.alignment = { vertical: "middle", horizontal: align || "left", wrapText: !!wrap };
  if (numFmt) cell.numFmt = numFmt;
  cell.border = border;
  return cell;
}

function rateLabel(rate) {
  if (!Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function factsFor(id, summary) {
  const money = (value) => Number.isFinite(value) ? value : "—";
  const percent = (value) => Number.isFinite(value) ? value : "—";
  if (id === "purchase") {
    return [
      ["Loan amount", money(summary.loan), moneyFmt],
      ["Principal & interest", money(summary.pi), moneyFmt],
      ["Monthly housing", money(summary.housing), moneyFmt],
      ["Down payment", percent(summary.downPercent), "0.0%"],
      ["Loan-to-value", percent(summary.ltv), "0.0%"],
      ["Mortgage insurance / month", money(summary.pmi), moneyFmt],
    ];
  }
  if (id === "refinance") {
    return [
      ["New loan amount", money(summary.newLoan), moneyFmt],
      ["New payment", money(summary.payment), moneyFmt],
      ["Payment today", money(summary.oldPayment), moneyFmt],
      ["Monthly change", money(summary.monthlySaving), moneyFmt],
      ["Closing costs", money(summary.closingCosts), moneyFmt],
      ["Cash to you", money(summary.cashOut), moneyFmt],
    ];
  }
  if (id === "commercial") {
    return [
      ["Loan amount", money(summary.loan), moneyFmt],
      ["Amortizing payment", money(summary.payment), moneyFmt],
      ["Interest-only payment", money(summary.ioPayment), moneyFmt],
      ["Balloon due", money(summary.balloon), moneyFmt],
      ["Debt coverage", Number.isFinite(summary.dscr) ? summary.dscr : "—", "0.00"],
      ["Loan-to-value", percent(summary.ltv), "0.0%"],
    ];
  }
  return [
    ["First mortgage", money(summary.loan), moneyFmt],
    ["Housing payment", money(summary.housing), moneyFmt],
    ["Assistance", money(summary.assistance), moneyFmt],
    ["Your cash in", money(summary.fundsToClose), moneyFmt],
    ["Housing ratio", percent(summary.frontRatio), "0.0%"],
    ["Total-debt ratio", percent(summary.backRatio), "0.0%"],
  ];
}

function buildCover(workbook, spec, preparedOn) {
  const sheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  sheet.properties.tabColor = { argb: `FF${PINE}` };
  sheet.getRow(1).height = 34;
  sheet.mergeCells("A1:C1");
  paint(sheet.getCell("A1"), {
    value: spec.title,
    bold: true,
    size: 20,
    color: WHITE,
    bg: PINE,
  });
  sheet.getRow(2).height = 22;
  sheet.mergeCells("A2:C2");
  paint(sheet.getCell("A2"), {
    value: `Prepared ${preparedOn}. An estimate from the numbers on the page. Not a Loan Estimate.`,
    italic: true,
    color: MUTED,
    bg: PAPER,
  });
  const facts = [
    ["Payments", spec.rows.length, "0"],
    ["Through", spec.rows.at(-1)?.label || "—", undefined],
    ["Total interest", spec.rows.reduce((sum, row) => sum + row.interest, 0), moneyFmt],
    ...factsFor(spec.id, spec.summary),
  ];
  paint(sheet.getCell("A4"), { value: "Figure", bold: true, color: WHITE, bg: INK });
  paint(sheet.getCell("B4"), { value: "Amount", bold: true, color: WHITE, bg: INK, align: "right" });
  paint(sheet.getCell("C4"), { value: "", bold: true, color: WHITE, bg: INK });
  facts.forEach((fact, index) => {
    const row = 5 + index;
    paint(sheet.getCell(row, 1), { value: fact[0], bg: index % 2 ? PAPER : WHITE });
    paint(sheet.getCell(row, 2), {
      value: fact[1],
      align: "right",
      numFmt: fact[2],
      bold: true,
      bg: index % 2 ? PAPER : WHITE,
    });
    paint(sheet.getCell(row, 3), { value: "", bg: index % 2 ? PAPER : WHITE });
  });
  sheet.getColumn(1).width = 32;
  sheet.getColumn(2).width = 22;
  sheet.getColumn(3).width = 18;
  return sheet;
}

function buildSchedule(workbook, spec) {
  const sheet = workbook.addWorksheet("Amortization", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  sheet.properties.tabColor = { argb: `FF${GOLD}` };
  sheet.getRow(1).height = 28;
  sheet.mergeCells("A1:G1");
  paint(sheet.getCell("A1"), {
    value: `${spec.title} · amortization schedule`,
    bold: true,
    size: 16,
    color: WHITE,
    bg: PINE,
  });
  sheet.mergeCells("A2:G2");
  paint(sheet.getCell("A2"), {
    value: "Payment is principal and interest. Extra is additional principal. A balloon is the balance still due when the term ends.",
    italic: true,
    color: MUTED,
    bg: PAPER,
    wrap: true,
  });
  sheet.getRow(2).height = 28;
  const headers = ["#", "Month", "Payment", "Interest", "Principal", "Extra", "Balance"];
  headers.forEach((header, index) => {
    paint(sheet.getCell(4, index + 1), {
      value: header,
      bold: true,
      color: WHITE,
      bg: INK,
      align: index < 2 ? "left" : "right",
    });
  });
  spec.rows.forEach((row, index) => {
    const excelRow = 5 + index;
    const note = row.balloon ? "Balloon" : row.interestOnly ? "Interest only" : row.final ? "Payoff" : "";
    const bg = row.balloon ? "F3E2C4" : row.interestOnly ? SKY : row.final ? SKY : index % 2 ? PAPER : WHITE;
    const values = [row.month, note ? `${row.label} · ${note}` : row.label, row.payment, row.interest, row.principal, row.extra || 0, row.ending];
    values.forEach((value, col) => {
      paint(sheet.getCell(excelRow, col + 1), {
        value,
        bg,
        bold: col === 0 || row.final || row.balloon,
        align: col < 2 ? "left" : "right",
        numFmt: col >= 2 ? moneyFmt : col === 0 ? "0" : undefined,
      });
    });
    sheet.getRow(excelRow).height = 18;
  });
  const widths = [8, 28, 16, 16, 16, 14, 18];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.autoFilter = { from: "A4", to: "G4" };
  return sheet;
}

export async function productWorkbookBlob(spec, preparedOn) {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) throw new Error("Excel library did not load.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Loan desk";
  workbook.created = new Date();
  workbook.title = spec.title;
  buildCover(workbook, spec, preparedOn);
  buildSchedule(workbook, spec);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function productExportFileName(spec) {
  const when = (spec.rows[0]?.label || "schedule").replace(/\s+/g, "-");
  return `${spec.id}-amortization-${when}.xlsx`;
}
