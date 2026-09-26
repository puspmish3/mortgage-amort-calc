/**
 * Customer-facing Excel workbook for a buydown amortization.
 * Built with ExcelJS in the browser. Nothing is uploaded.
 */

const PINE = "1F6F5B";
const PINE_DEEP = "14493C";
const INK = "1C2430";
const MUTED = "5D6B7A";
const GOLD = "C9842A";
const GOLD_SOFT = "F8EBD6";
const CLAY = "9A4D32";
const PAPER = "FBF7F1";
const CARD = "FFFDF9";
const LINE = "E4DDD2";
const SKY = "E7F3EE";
const RECAST = "F3E2C4";
const EXTRA = "EFE7FF";
const MILESTONE = "F4C7A8";
const MILESTONE_INK = "8A3B12";
const WHITE = "FFFFFF";
const SAVED = "1F6F5B";
const BULK_EXTRA = 1000;

const thin = { style: "thin", color: { argb: `FF${LINE}` } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

function money(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function ruleHitsMonth(rule, monthNumber) {
  if (monthNumber < rule.startMonth) return false;
  if (rule.endMonth != null && monthNumber > rule.endMonth) return false;
  const offset = monthNumber - rule.startMonth;
  if (rule.frequency === "once") return offset === 0;
  if (rule.frequency === "monthly") return true;
  if (rule.frequency === "quarterly") return offset % 3 === 0;
  if (rule.frequency === "yearly") return offset % 12 === 0;
  return false;
}

/**
 * Split a month's extra principal into a one-time bulk amount and the
 * repeating monthly addition. Bulk is any one-time rule over $1,000.
 * The current-payment overage counts as the regular monthly addition.
 */
function extraMarks(input, row) {
  const rules = (input.extras || []).filter((rule) => ruleHitsMonth(rule, row.month));
  const onceRules = rules.filter((rule) => rule.frequency === "once");
  const monthlyRules = rules.filter((rule) => rule.frequency === "monthly");
  const bulk = money(onceRules.reduce((sum, rule) => sum + rule.amount, 0));
  const monthlyRule = money(monthlyRules.reduce((sum, rule) => sum + rule.amount, 0));
  const appliedBulk = money(Math.min(bulk, row.extra || 0));
  const appliedMonthly = money(Math.min(monthlyRule + (row.overage || 0), Math.max(0, (row.extra || 0) - appliedBulk)));
  return {
    bulk: appliedBulk > BULK_EXTRA,
    bulkAmount: appliedBulk,
    monthly: appliedMonthly > 0 && appliedBulk === 0 && (monthlyRule > 0 || (row.overage || 0) > 0),
    monthlyAmount: appliedMonthly,
  };
}

function rateLabel(rate) {
  return `${(rate * 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function fill(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${argb}` } };
}

function font(partial) {
  return { name: "Calibri", size: 11, color: { argb: `FF${INK}` }, ...partial };
}

function applyBorder(cell) {
  cell.border = border;
}

function setWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
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
  cell.alignment = {
    vertical: "middle",
    horizontal: align || "left",
    wrapText: !!wrap,
  };
  if (numFmt) cell.numFmt = numFmt;
  return cell;
}

function mergeTitle(sheet, range, value, size, bg, color) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(":")[0]);
  paint(cell, { value, bold: true, size, color: color || WHITE, bg: bg || PINE });
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  return cell;
}

function yearlyRows(rows, baselineRows) {
  const baselineByMonth = new Map(baselineRows.map((row) => [row.month, row]));
  const years = [];
  rows.forEach((row) => {
    const yearIndex = Math.floor((row.month - 1) / 12);
    if (!years[yearIndex]) {
      years[yearIndex] = {
        year: yearIndex + 1,
        start: row.label,
        end: row.label,
        payment: 0,
        interest: 0,
        principal: 0,
        extra: 0,
        baselineInterest: 0,
        ending: row.ending,
        buydown: false,
      };
    }
    const bucket = years[yearIndex];
    bucket.end = row.label;
    bucket.payment += row.payment;
    bucket.interest += row.interest;
    bucket.principal += row.principal;
    bucket.extra += row.extra;
    bucket.ending = row.ending;
    bucket.buydown = bucket.buydown || row.buydown;
    const base = baselineByMonth.get(row.month);
    if (base) bucket.baselineInterest += base.interest;
  });
  return years.filter(Boolean).map((year) => ({
    ...year,
    payment: money(year.payment),
    interest: money(year.interest),
    principal: money(year.principal),
    extra: money(year.extra),
    baselineInterest: money(year.baselineInterest),
    interestSaved: money(Math.max(0, year.baselineInterest - year.interest)),
  }));
}

function chartSample(rows, baselineRows, points = 36) {
  const span = Math.max(rows.length, baselineRows.length);
  if (span === 0) return [];
  const step = span <= points ? 1 : (span - 1) / (points - 1);
  const count = span <= points ? span : points;
  const actual = new Map(rows.map((row) => [row.month, row]));
  const baseline = new Map(baselineRows.map((row) => [row.month, row]));
  const sampled = [];
  for (let i = 0; i < count; i += 1) {
    const month = Math.round(i * step) + 1;
    const row = actual.get(month) || baseline.get(month);
    if (!row) continue;
    sampled.push({
      month,
      label: row.label,
      plan: actual.has(month) ? actual.get(month).ending : null,
      baseline: baseline.has(month) ? baseline.get(month).ending : null,
    });
  }
  return sampled;
}

function columnName(index) {
  let name = "";
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function chartXml({ title, type, grouping, cats, series, anchor }) {
  const seriesXml = series.map((item, index) => {
    const order = index;
    const seriesType = type === "line" ? "lineChart" : "barChart";
    const chartSeries = `
      <c:ser>
        <c:idx val="${order}"/>
        <c:order val="${order}"/>
        <c:tx><c:v>${escapeXml(item.name)}</c:v></c:tx>
        <c:spPr>
          <a:solidFill><a:srgbClr val="${item.color}"/></a:solidFill>
          <a:ln w="25400"><a:solidFill><a:srgbClr val="${item.color}"/></a:solidFill></a:ln>
        </c:spPr>
        <c:marker><c:symbol val="none"/></c:marker>
        <c:cat><c:strRef><c:f>${cats}</c:f></c:strRef></c:cat>
        <c:val><c:numRef><c:f>${item.values}</c:f></c:numRef></c:val>
        <c:smooth val="0"/>
      </c:ser>`;
    return { seriesType, chartSeries };
  });
  const chartKind = type === "line" ? "lineChart" : "barChart";
  const groupingXml = chartKind === "barChart"
    ? `<c:barDir val="col"/><c:grouping val="${grouping || "stacked"}"/><c:overlap val="100"/>`
    : `<c:grouping val="standard"/>`;
  const body = seriesXml.map((item) => item.chartSeries).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="1400" b="1" dirty="0"/><a:t>${escapeXml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
    <c:plotArea>
      <c:layout/>
      <c:${chartKind}>
        ${groupingXml}
        <c:varyColors val="0"/>
        ${body}
        <c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/></c:dLbls>
        <c:axId val="${anchor}"/><c:axId val="${anchor + 1}"/>
      </c:${chartKind}>
      <c:catAx>
        <c:axId val="${anchor}"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:majorTickMark val="out"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="low"/>
        <c:crossAx val="${anchor + 1}"/>
        <c:crosses val="autoZero"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="${anchor + 1}"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:numFmt formatCode="$#,##0" sourceLinked="0"/>
        <c:majorTickMark val="out"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="${anchor}"/>
        <c:crosses val="autoZero"/>
        <c:crossBetween val="${chartKind === "barChart" ? "between" : "midCat"}"/>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
  </c:chart>
  <c:spPr><a:solidFill><a:srgbClr val="FFFDF9"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="E4DDD2"/></a:solidFill></a:ln></c:spPr>
</c:chartSpace>`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chartDrawingXml(charts) {
  const anchors = charts.map((chart, index) => `
    <xdr:twoCellAnchor>
      <xdr:from><xdr:col>${chart.from.col}</xdr:col><xdr:colOff>80000</xdr:colOff><xdr:row>${chart.from.row}</xdr:row><xdr:rowOff>80000</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>${chart.to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
      <xdr:graphicFrame macro="">
        <xdr:nvGraphicFramePr>
          <xdr:cNvPr id="${index + 2}" name="Chart ${index + 1}"/>
          <xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr>
        </xdr:nvGraphicFramePr>
        <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
            <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${index + 1}"/>
          </a:graphicData>
        </a:graphic>
      </xdr:graphicFrame>
      <xdr:clientData/>
    </xdr:twoCellAnchor>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  ${anchors}
</xdr:wsDr>`;
}

function drawingRels(count) {
  const rels = Array.from({ length: count }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function xmlText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function commentsXml(comments) {
  const list = comments.map((comment, index) => {
    const ref = `${columnName(comment.col)}${comment.row}`;
    return `<comment ref="${ref}" authorId="0" shapeId="0"><text><r><rPr><b/><sz val="9"/><color rgb="FF8A3B12"/><rFont val="Calibri"/><family val="2"/></rPr><t xml:space="preserve">${xmlText(comment.text)}</t></r></text></comment>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><authors><author>Payment note</author></authors><commentList>${list}</commentList></comments>`;
}

function vmlCommentsXml(comments) {
  const shapes = comments.map((comment, index) =>
    `<v:shape id="_x0000_s${1025 + index}" type="#_x0000_t202" style="position:absolute;margin-left:80pt;margin-top:8pt;width:180pt;height:52pt;z-index:${index + 1};visibility:hidden" fillcolor="#fff8ee" o:insetmode="auto"><v:fill color2="#fff8ee"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>1, 15, 0, 2, 3, 31, 4, 16</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>${comment.row - 1}</x:Row><x:Column>${comment.col - 1}</x:Column></x:ClientData></v:shape>`).join("");
  return `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>${shapes}</xml>`;
}

function contentTypesWithCharts(xml, chartCount, commentCount) {
  const overrides = Array.from({ length: chartCount }, (_, index) =>
    `<Override PartName="/xl/charts/chart${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join("");
  const drawing = xml.includes("/xl/drawings/drawing1.xml")
    ? ""
    : `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
  const comments = commentCount
    ? `<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`
    : "";
  return xml.replace("</Types>", `${overrides}${drawing}${comments}</Types>`);
}

function sheetRelsWithDrawing(xml) {
  if (xml.includes("drawing1.xml")) return xml;
  const ids = [...xml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  const next = Math.max(0, ...ids) + 1;
  return xml.replace(
    "</Relationships>",
    `<Relationship Id="rId${next}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
  );
}

function addRelationship(xml, type, target) {
  if (xml.includes(`Target="${target}"`)) {
    return { xml, id: xml.match(new RegExp(`Id="(rId\\d+)"[^>]*Target="${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`))?.[1] };
  }
  const ids = [...xml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  const id = `rId${Math.max(0, ...ids) + 1}`;
  return {
    xml: xml.replace(
      "</Relationships>",
      `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`,
    ),
    id,
  };
}

async function embedCharts(buffer, charts, comments = []) {
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error("Workbook packager did not load.");
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = Object.keys(zip.files).find((name) => /xl\/worksheets\/sheet2\.xml$/.test(name));
  if (!sheetPath) throw new Error("Charts sheet was not written.");
  let sheetXml = await zip.file(sheetPath).async("string");
  if (!sheetXml.includes("<drawing ")) {
    sheetXml = sheetXml.replace("</worksheet>", `<drawing r:id="rIdChartDrawing"/></worksheet>`);
    if (!sheetXml.includes("xmlns:r=")) {
      sheetXml = sheetXml.replace(
        "<worksheet ",
        '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',
      );
    }
  }
  zip.file(sheetPath, sheetXml);

  const relPath = sheetPath
    .replace("xl/worksheets/", "xl/worksheets/_rels/")
    .replace(/\.xml$/, ".xml.rels");
  const existingRels = zip.file(relPath)
    ? await zip.file(relPath).async("string")
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const rels = sheetRelsWithDrawing(existingRels);
  const drawingId = rels.match(/Id="(rId\d+)"[^>]*Target="\.\.\/drawings\/drawing1\.xml"/)?.[1];
  if (!drawingId) throw new Error("Chart drawing relationship was not created.");
  zip.file(sheetPath, sheetXml.replace("rIdChartDrawing", drawingId));
  zip.file(relPath, rels);
  zip.file("xl/drawings/drawing1.xml", chartDrawingXml(charts));
  zip.file("xl/drawings/_rels/drawing1.xml.rels", drawingRels(charts.length));
  charts.forEach((chart, index) => {
    zip.file(`xl/charts/chart${index + 1}.xml`, chartXml(chart));
  });
  if (comments.length) {
    const schedulePath = Object.keys(zip.files).find((name) => /xl\/worksheets\/sheet4\.xml$/.test(name));
    if (!schedulePath) throw new Error("Schedule sheet was not written.");
    const scheduleRelsPath = schedulePath
      .replace("xl/worksheets/", "xl/worksheets/_rels/")
      .replace(/\.xml$/, ".xml.rels");
    const scheduleRels = zip.file(scheduleRelsPath)
      ? await zip.file(scheduleRelsPath).async("string")
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    const commentRel = addRelationship(
      scheduleRels,
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments",
      "../comments1.xml",
    );
    const vmlRel = addRelationship(
      commentRel.xml,
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing",
      "../drawings/vmlDrawing1.vml",
    );
    let scheduleXml = await zip.file(schedulePath).async("string");
    if (!scheduleXml.includes("<legacyDrawing ")) {
      scheduleXml = scheduleXml.replace("</worksheet>", `<legacyDrawing r:id="${vmlRel.id}"/></worksheet>`);
    }
    zip.file(schedulePath, scheduleXml);
    zip.file(scheduleRelsPath, vmlRel.xml);
    zip.file("xl/comments1.xml", commentsXml(comments));
    zip.file("xl/drawings/vmlDrawing1.vml", vmlCommentsXml(comments));
  }
  const content = await zip.file("[Content_Types].xml").async("string");
  zip.file("[Content_Types].xml", contentTypesWithCharts(content, charts.length, comments.length));
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

function disclaimer(sheet, row, cols) {
  sheet.mergeCells(row, 1, row, cols);
  paint(sheet.getCell(row, 1), {
    value:
      "Prepared for discussion only. Figures are principal and interest on the outstanding balance you entered. They do not include taxes, insurance, mortgage insurance, fees, or escrow. Confirm the note, buydown agreement, and payoff quote before relying on this schedule.",
    size: 9,
    color: MUTED,
    italic: true,
    wrap: true,
  });
  sheet.getRow(row).height = 32;
}

function buildCover(workbook, result, preparedOn) {
  const sheet = workbook.addWorksheet("Overview", {
    properties: { tabColor: { argb: `FF${PINE}` }, showGridLines: false },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      paperSize: 1,
    },
    headerFooter: {
      oddFooter: "&LBuydown amortization&RPrepared for customer discussion",
    },
    views: [{ showGridLines: false }],
  });
  setWidths(sheet, [28, 22, 22, 22, 24, 24, 18]);
  sheet.pageSetup.horizontalCentered = true;

  for (let row = 1; row <= 42; row += 1) {
    for (let col = 1; col <= 7; col += 1) {
      sheet.getCell(row, col).fill = fill(PAPER);
    }
  }

  mergeTitle(sheet, "A1:G1", "BUYDOWN AMORTIZATION", 11, PINE_DEEP);
  sheet.getRow(1).height = 18;
  mergeTitle(sheet, "A2:G2", "Customer payment summary", 22, PINE);
  sheet.getRow(2).height = 34;
  sheet.mergeCells("A3:G3");
  paint(sheet.getCell("A3"), {
    value: `Prepared ${preparedOn}  ·  Outstanding balance, not original loan amount  ·  Nothing in this file was sent to a server`,
    size: 10,
    color: WHITE,
    bg: PINE,
    italic: true,
  });
  sheet.getCell("A3").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 10;

  const { summary, rows } = result;
  const input = result.input;
  const mode =
    summary.recastAt
      ? `Recast once at month ${summary.recastAt} (${rows.find((row) => row.recast)?.label || "selected month"})`
      : "Keep the contractual payment and pay off early if extras apply";

  const facts = [
    ["Current outstanding principal", input.principal, '"$"#,##0.00'],
    ["Note interest rate", input.noteRate, "0.000%"],
    ["Buydown reduction", input.buydownReduction, "0.000%"],
    ["Rate during buydown", summary.yearOneRate, "0.000%"],
    ["Buydown months remaining", summary.buydownMonths, "0"],
    ["Remaining term", `${input.totalMonths} months`, null],
    ["First payment", rows[0]?.label || "—", null],
    ["Payoff month", summary.payoffLabel, null],
    ["Plan", mode, null],
  ];

  paint(sheet.getCell("A5"), {
    value: "Loan snapshot",
    bold: true,
    size: 14,
    color: PINE_DEEP,
    bg: PAPER,
  });
  sheet.getRow(5).height = 22;

  facts.forEach((fact, index) => {
    const row = 6 + index;
    paint(sheet.getCell(row, 1), {
      value: fact[0],
      bold: true,
      color: MUTED,
      bg: index % 2 ? SKY : CARD,
      size: 11,
    });
    sheet.mergeCells(row, 2, row, 4);
    const valueCell = paint(sheet.getCell(row, 2), {
      value: fact[1],
      bold: true,
      bg: index % 2 ? SKY : CARD,
      align: typeof fact[1] === "number" ? "left" : "left",
      numFmt: fact[2] || undefined,
    });
    applyBorder(sheet.getCell(row, 1));
    applyBorder(valueCell);
    sheet.getCell(row, 3).fill = fill(index % 2 ? SKY : CARD);
    sheet.getCell(row, 4).fill = fill(index % 2 ? SKY : CARD);
    sheet.getCell(row, 3).border = border;
    sheet.getCell(row, 4).border = border;
    sheet.getRow(row).height = 20;
  });

  const cards = [
    ["B16", "Year-1 payment", summary.yearOnePayment, `${rateLabel(summary.yearOneRate)} borrower rate`],
    ["D16", "After buydown", summary.afterPayment, `${rateLabel(summary.noteRate)} note rate`],
    ["F16", "Interest saved", summary.interestSaved, summary.monthsSooner ? `${summary.monthsSooner} months sooner` : "Same term as baseline"],
  ];
  cards.forEach(([anchor, label, amount, note]) => {
    const start = sheet.getCell(anchor);
    const col = start.col;
    sheet.mergeCells(16, col, 16, col + 1);
    sheet.mergeCells(17, col, 17, col + 1);
    sheet.mergeCells(18, col, 18, col + 1);
    paint(sheet.getCell(16, col), { value: label.toUpperCase(), bold: true, size: 9, color: WHITE, bg: PINE, align: "center" });
    paint(sheet.getCell(17, col), {
      value: amount,
      bold: true,
      size: 18,
      color: PINE_DEEP,
      bg: CARD,
      align: "center",
      numFmt: '"$"#,##0.00',
    });
    paint(sheet.getCell(18, col), { value: note, size: 9, color: MUTED, bg: GOLD_SOFT, align: "center" });
    [16, 17, 18].forEach((row) => {
      applyBorder(sheet.getCell(row, col));
      applyBorder(sheet.getCell(row, col + 1));
      sheet.getCell(row, col + 1).fill = sheet.getCell(row, col).fill;
    });
  });
  sheet.getRow(16).height = 18;
  sheet.getRow(17).height = 28;
  sheet.getRow(18).height = 18;

  paint(sheet.getCell("A20"), { value: "What this means", bold: true, size: 14, color: PINE_DEEP, bg: PAPER });
  const notes = [
    ["Payment during the buydown", "The borrower pays the lower amortizing payment. The difference versus a full note-rate payment is the monthly buydown benefit."],
    ["Payment after the buydown", "The post-buydown payment is fixed from the projected balance at the end of the buydown. Extra principal does not raise or lower that contractual payment."],
    ["Extra principal", summary.extraPaid > 0
      ? `${money(summary.extraPaid).toLocaleString("en-US", { style: "currency", currency: "USD" })} goes directly to principal and is what creates the interest savings.`
      : "No extra principal is included. Interest matches the no-extras baseline."],
    ["Baseline", "The dashed comparison is the same balance, rate, and term with no extra principal, no payment overage, and no recast."],
    ["How to read the color", "Green rows are buydown months. Gold marks the one-time recast. Lilac marks a regular extra. Coral marks a one-time extra over $1,000. Hover the extra-principal cell for who made it."],
  ];
  notes.forEach((note, index) => {
    const row = 21 + index;
    paint(sheet.getCell(row, 1), { value: note[0], bold: true, bg: CARD, wrap: true });
    sheet.mergeCells(row, 2, row, 7);
    paint(sheet.getCell(row, 2), { value: note[1], bg: CARD, wrap: true, color: MUTED });
    for (let col = 1; col <= 7; col += 1) applyBorder(sheet.getCell(row, col));
    sheet.getRow(row).height = 28;
  });

  paint(sheet.getCell("A27"), { value: "Side-by-side totals", bold: true, size: 14, color: PINE_DEEP, bg: PAPER });
  const headers = ["", "This plan", "No-extras baseline", "Difference"];
  headers.forEach((header, index) => {
    paint(sheet.getCell(28, index + 1), {
      value: header,
      bold: true,
      color: WHITE,
      bg: PINE_DEEP,
      align: index === 0 ? "left" : "right",
    });
    applyBorder(sheet.getCell(28, index + 1));
  });
  const comparisons = [
    ["Payoff", `${summary.payoffMonths} months`, `${summary.baselineMonths} months`, summary.monthsSooner ? `${summary.monthsSooner} months sooner` : "Same length"],
    ["Total interest", summary.totalInterest, summary.baselineInterest, -summary.interestSaved],
    ["Extra principal paid", summary.extraPaid, 0, summary.extraPaid],
    ["Ending balance", 0, 0, 0],
  ];
  comparisons.forEach((line, index) => {
    const row = 29 + index;
    const bg = index % 2 ? SKY : CARD;
    line.forEach((value, col) => {
      const numeric = typeof value === "number";
      paint(sheet.getCell(row, col + 1), {
        value,
        bold: col === 0 || col === 3,
        bg,
        align: col === 0 ? "left" : "right",
        numFmt: numeric ? '"$"#,##0.00' : undefined,
        color: col === 3 && numeric && value < 0 ? SAVED : INK,
      });
      applyBorder(sheet.getCell(row, col + 1));
    });
    sheet.getRow(row).height = 20;
  });

  sheet.mergeCells("A34:G34");
  paint(sheet.getCell("A34"), {
    value: "Charts on the next sheet show the balance falling over time and how each year splits between interest and principal. The full month-by-month schedule is on Schedule.",
    italic: true,
    color: MUTED,
    bg: PAPER,
    wrap: true,
  });
  disclaimer(sheet, 36, 7);
  sheet.headerFooter.oddHeader = "&L&8Customer copy&R&8Page &P of &N";
  sheet.pageSetup.printTitlesRow = "1:3";
  sheet.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.25, footer: 0.25 };
  return sheet;
}

function buildCharts(workbook, result) {
  const sheet = workbook.addWorksheet("Charts", {
    properties: { tabColor: { argb: `FF${GOLD}` }, showGridLines: false },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 1 },
    views: [{ showGridLines: false }],
  });
  setWidths(sheet, [16, 18, 20, 16, 18, 18, 18, 14]);
  mergeTitle(sheet, "A1:H1", "PICTURES OF THE LOAN", 11, PINE_DEEP);
  mergeTitle(sheet, "A2:H2", "Balance, interest, and principal", 20, PINE);
  sheet.getRow(1).height = 18;
  sheet.getRow(2).height = 30;
  sheet.mergeCells("A3:H3");
  paint(sheet.getCell("A3"), {
    value: "Green is this plan. Gold is the same loan with no extras and no recast. Open this sheet in Excel or Google Sheets to see the charts.",
    size: 10,
    color: WHITE,
    bg: PINE,
    italic: true,
  });
  sheet.getCell("A3").alignment = { vertical: "middle", indent: 1 };

  const years = yearlyRows(result.rows, result.baselineRows);
  const samples = chartSample(result.rows, result.baselineRows);

  paint(sheet.getCell("A5"), { value: "Yearly totals", bold: true, size: 13, color: PINE_DEEP });
  ["Year", "Period", "Interest", "Principal", "Extra principal", "Interest saved"].forEach((header, index) => {
    paint(sheet.getCell(6, index + 1), {
      value: header,
      bold: true,
      color: WHITE,
      bg: PINE,
      align: index < 2 ? "left" : "right",
    });
    applyBorder(sheet.getCell(6, index + 1));
  });
  years.forEach((year, index) => {
    const row = 7 + index;
    const bg = year.buydown ? SKY : index % 2 ? "F7F4EE" : WHITE;
    const values = [
      `Year ${year.year}`,
      `${year.start} – ${year.end}`,
      year.interest,
      year.principal,
      year.extra,
      year.interestSaved,
    ];
    values.forEach((value, col) => {
      paint(sheet.getCell(row, col + 1), {
        value,
        bg,
        align: col < 2 ? "left" : "right",
        numFmt: col >= 2 ? '"$"#,##0' : undefined,
        color: col === 5 && value > 0 ? SAVED : INK,
        bold: col === 5 && value > 0,
      });
      applyBorder(sheet.getCell(row, col + 1));
    });
  });

  const sampleHeader = 7;
  ["Month", "Balance · this plan", "Balance · baseline"].forEach((header, index) => {
    paint(sheet.getCell(sampleHeader - 1, 8 + index), {
      value: header,
      bold: true,
      color: WHITE,
      bg: GOLD,
      align: index === 0 ? "left" : "right",
    });
  });
  samples.forEach((point, index) => {
    const row = sampleHeader + index;
    paint(sheet.getCell(row, 8), { value: point.label, size: 9 });
    paint(sheet.getCell(row, 9), { value: point.plan, numFmt: '"$"#,##0', align: "right", size: 9 });
    paint(sheet.getCell(row, 10), { value: point.baseline, numFmt: '"$"#,##0', align: "right", size: 9 });
  });
  sheet.getColumn(8).hidden = false;
  sheet.getColumn(8).width = 14;
  sheet.getColumn(9).width = 20;
  sheet.getColumn(10).width = 20;

  const yearEnd = 6 + years.length;
  const sampleEnd = 6 + samples.length;
  sheet._customerCharts = [
    {
      title: "Balance over time",
      type: "line",
      anchor: 100,
      cats: `Charts!$H$${sampleHeader}:$H$${sampleEnd}`,
      from: { col: 0, row: yearEnd + 1 },
      to: { col: 6, row: yearEnd + 18 },
      series: [
        { name: "This plan", values: `Charts!$I$${sampleHeader}:$I$${sampleEnd}`, color: PINE },
        { name: "No extras", values: `Charts!$J$${sampleHeader}:$J$${sampleEnd}`, color: GOLD },
      ],
    },
    {
      title: "Interest and principal by year",
      type: "col",
      grouping: "stacked",
      anchor: 200,
      cats: `Charts!$A$7:$A$${yearEnd}`,
      from: { col: 0, row: yearEnd + 19 },
      to: { col: 6, row: yearEnd + 36 },
      series: [
        { name: "Interest", values: `Charts!$C$7:$C$${yearEnd}`, color: CLAY },
        { name: "Principal", values: `Charts!$D$7:$D$${yearEnd}`, color: PINE },
        { name: "Extra principal", values: `Charts!$E$7:$E$${yearEnd}`, color: "7C5CBF" },
      ],
    },
  ];

  disclaimer(sheet, Math.max(yearEnd + 38, sampleEnd + 2), 7);
  return sheet;
}

function buildSchedule(workbook, result) {
  const sheet = workbook.addWorksheet("Schedule", {
    properties: { tabColor: { argb: `FF${PINE}` } },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 1,
    },
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    autoFilter: { from: "A5", to: "L5" },
  });
  setWidths(sheet, [10, 16, 12, 14, 16, 14, 14, 16, 16, 18, 16, 28]);
  sheet.autoFilter = { from: "A5", to: "L5" };
  sheet.pageSetup.printTitlesRow = "1:5";
  sheet.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.55, bottom: 0.55, header: 0.2, footer: 0.25 };
  sheet.headerFooter = {
    oddHeader: "&LCustomer amortization schedule&R&D",
    oddFooter: "&LGreen = buydown   Gold = recast   Lilac = monthly extra   Coral = extra over $1,000&RPage &P of &N",
  };
  sheet.pageSetup.horizontalCentered = true;

  mergeTitle(sheet, "A1:L1", "MONTH-BY-MONTH SCHEDULE", 11, PINE_DEEP);
  mergeTitle(sheet, "A2:L2", "Every payment until the balance is zero", 18, PINE);
  sheet.getRow(1).height = 18;
  sheet.getRow(2).height = 26;
  sheet.mergeCells("A3:L3");
  paint(sheet.getCell("A3"), {
    value: "Rate is the annual borrower rate for that month. Payment is principal and interest only. Coral rows are a one-time extra over $1,000. Hover the extra-principal cell to see who made it.",
    size: 10,
    color: WHITE,
    bg: PINE,
    italic: true,
    wrap: true,
  });
  sheet.getCell("A3").alignment = { vertical: "middle", indent: 1, wrapText: true };
  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 8;

  const headers = [
    "Payment #",
    "Month",
    "Rate",
    "Phase",
    "Payment",
    "Interest",
    "Principal",
    "Extra principal",
    "Total to principal",
    "Ending balance",
    "Baseline balance",
    "Note",
  ];
  headers.forEach((header, index) => {
    paint(sheet.getCell(5, index + 1), {
      value: header,
      bold: true,
      size: 10,
      color: WHITE,
      bg: PINE_DEEP,
      align: index >= 4 && index <= 10 ? "right" : "left",
      wrap: true,
    });
    applyBorder(sheet.getCell(5, index + 1));
  });
  sheet.getRow(5).height = 30;

  const baseline = new Map(result.baselineRows.map((row) => [row.month, row]));
  const comments = [];
  result.rows.forEach((row, index) => {
    const excelRow = 6 + index;
    const base = baseline.get(row.month);
    const marks = extraMarks(result.input, row);
    let bg = index % 2 ? "F7F4EE" : WHITE;
    let phase = "Note rate";
    let note = "";
    if (row.buydown) {
      bg = SKY;
      phase = "Buydown";
    }
    if (row.extra > 0) {
      bg = EXTRA;
      note = "Extra principal applied";
    }
    if (marks.bulk) {
      bg = MILESTONE;
      note = `Milestone — one-time extra of ${money(marks.bulkAmount).toLocaleString("en-US", { style: "currency", currency: "USD" })}`;
      comments.push({ row: excelRow, col: 8, text: "extra payment made by -" });
    } else if (marks.monthly) {
      comments.push({ row: excelRow, col: 8, text: "Monthly additional monthly payment made by -" });
    }
    if (row.recast) {
      phase = "Recast";
      note = note ? `${note}; payment recast this month` : "Payment recast this month";
    }
    if (row.final) {
      if (!marks.bulk) bg = "DCEFE6";
      note = note ? `${note}; payoff` : "Payoff — balance is zero";
    }
    const values = [
      row.month,
      new Date(row.year, row.monthIndex, 1),
      row.annualRate,
      phase,
      row.payment,
      row.interest,
      row.principal,
      row.extra,
      money(row.principal + row.extra),
      row.ending,
      base ? base.ending : null,
      note,
    ];
    values.forEach((value, col) => {
      const cell = paint(sheet.getCell(excelRow, col + 1), {
        value,
        bg,
        size: 10,
        align: col >= 4 && col <= 10 ? "right" : "left",
        bold: row.final || col === 9,
      });
      if (col === 1) cell.numFmt = "mmm yyyy";
      if (col === 2) cell.numFmt = "0.000%";
      if (col >= 4 && col <= 10) cell.numFmt = '"$"#,##0.00';
      if (col === 7 && marks.bulk) {
        cell.font = font({ bold: true, size: 10, color: { argb: `FF${MILESTONE_INK}` } });
      } else if (col === 7 && row.extra > 0) {
        cell.font = font({ bold: true, size: 10, color: { argb: "FF5B3F8C" } });
      }
      applyBorder(cell);
    });
    sheet.getRow(excelRow).height = 18;
  });
  sheet._extraComments = comments;

  const last = 5 + result.rows.length;
  const totalRow = last + 1;
  paint(sheet.getCell(totalRow, 1), { value: "Totals", bold: true, color: WHITE, bg: INK });
  sheet.mergeCells(totalRow, 1, totalRow, 4);
  for (let col = 1; col <= 4; col += 1) {
    sheet.getCell(totalRow, col).fill = fill(INK);
    sheet.getCell(totalRow, col).font = font({ bold: true, color: { argb: `FF${WHITE}` } });
    applyBorder(sheet.getCell(totalRow, col));
  }
  [5, 6, 7, 8, 9].forEach((col) => {
    const cell = sheet.getCell(totalRow, col);
    cell.value = { formula: `SUM(${sheet.getColumn(col).letter}${6}:${sheet.getColumn(col).letter}${last})` };
    paint(cell, { bold: true, color: WHITE, bg: INK, align: "right", numFmt: '"$"#,##0.00' });
    applyBorder(cell);
  });
  paint(sheet.getCell(totalRow, 10), { value: 0, bold: true, color: WHITE, bg: INK, align: "right", numFmt: '"$"#,##0.00' });
  applyBorder(sheet.getCell(totalRow, 10));
  paint(sheet.getCell(totalRow, 11), { value: "—", bold: true, color: WHITE, bg: INK, align: "right" });
  applyBorder(sheet.getCell(totalRow, 11));
  paint(sheet.getCell(totalRow, 12), { value: "Sums of this plan", bold: true, color: WHITE, bg: INK });
  applyBorder(sheet.getCell(totalRow, 12));
  sheet.getRow(totalRow).height = 22;

  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: last, column: 12 } };
  disclaimer(sheet, totalRow + 2, 12);
  return sheet;
}

function buildYearly(workbook, result) {
  const sheet = workbook.addWorksheet("Yearly summary", {
    properties: { tabColor: { argb: `FF${GOLD}` }, showGridLines: false },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 1 },
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
  });
  setWidths(sheet, [12, 28, 18, 18, 18, 18, 20, 20]);
  mergeTitle(sheet, "A1:H1", "YEARLY SUMMARY", 11, PINE_DEEP);
  mergeTitle(sheet, "A2:H2", "A shorter view for the conversation", 18, PINE);
  sheet.getRow(1).height = 18;
  sheet.getRow(2).height = 26;
  sheet.mergeCells("A3:H3");
  paint(sheet.getCell("A3"), {
    value: "Each row is twelve payments, or fewer in the final year. Interest saved is versus the no-extras baseline for those same months.",
    size: 10,
    color: WHITE,
    bg: PINE,
    italic: true,
  });
  sheet.getCell("A3").alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(4).height = 8;

  const headers = ["Year", "Period", "Payments", "Interest", "Scheduled principal", "Extra principal", "Interest saved", "Balance at year end"];
  headers.forEach((header, index) => {
    paint(sheet.getCell(5, index + 1), {
      value: header,
      bold: true,
      color: WHITE,
      bg: PINE_DEEP,
      align: index < 2 ? "left" : "right",
      wrap: true,
    });
    applyBorder(sheet.getCell(5, index + 1));
  });
  sheet.getRow(5).height = 30;

  const years = yearlyRows(result.rows, result.baselineRows);
  years.forEach((year, index) => {
    const row = 6 + index;
    const bg = year.buydown ? SKY : index % 2 ? "F7F4EE" : WHITE;
    const values = [year.year, `${year.start} – ${year.end}`, year.payment, year.interest, year.principal, year.extra, year.interestSaved, year.ending];
    values.forEach((value, col) => {
      paint(sheet.getCell(row, col + 1), {
        value,
        bg,
        align: col < 2 ? "left" : "right",
        bold: col === 0 || col === 6,
        numFmt: col >= 2 ? '"$"#,##0.00' : col === 0 ? "0" : undefined,
        color: col === 6 && value > 0 ? SAVED : INK,
      });
      applyBorder(sheet.getCell(row, col + 1));
    });
  });
  const last = 5 + years.length;
  const total = last + 1;
  paint(sheet.getCell(total, 1), { value: "", bold: true, color: WHITE, bg: INK });
  paint(sheet.getCell(total, 2), { value: "Full loan", bold: true, color: WHITE, bg: INK });
  [3, 4, 5, 6, 7].forEach((col) => {
    const cell = sheet.getCell(total, col);
    cell.value = { formula: `SUM(${sheet.getColumn(col).letter}6:${sheet.getColumn(col).letter}${last})` };
    paint(cell, { bold: true, color: WHITE, bg: INK, align: "right", numFmt: '"$"#,##0.00' });
    applyBorder(cell);
  });
  paint(sheet.getCell(total, 8), { value: 0, bold: true, color: WHITE, bg: INK, align: "right", numFmt: '"$"#,##0.00' });
  applyBorder(sheet.getCell(total, 1));
  applyBorder(sheet.getCell(total, 2));
  applyBorder(sheet.getCell(total, 8));
  disclaimer(sheet, total + 2, 8);
  return sheet;
}

export async function workbookBlob(result, preparedOn) {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) throw new Error("Excel library did not load.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Buydown amortization";
  workbook.created = new Date();
  workbook.title = "Buydown amortization — customer summary";
  workbook.subject = "Principal and interest schedule from the current outstanding balance";
  buildCover(workbook, result, preparedOn);
  const chartsSheet = buildCharts(workbook, result);
  buildYearly(workbook, result);
  const scheduleSheet = buildSchedule(workbook, result);
  workbook.views = [{ activeTab: 0 }];
  const buffer = await workbook.xlsx.writeBuffer();
  const withCharts = await embedCharts(
    buffer,
    chartsSheet._customerCharts || [],
    scheduleSheet._extraComments || [],
  );
  return new Blob([withCharts], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function exportFileName(result) {
  const when = (result.rows[0]?.label || "schedule").replace(/\s+/g, "-");
  return `buydown-amortization-${when}.xlsx`;
}
