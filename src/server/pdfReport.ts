import PDFDocument from "pdfkit";

type AnyRow = Record<string, any>;

export type PdfReportOptions = {
  year: number;
  month: number;
  monthName: string;
  sections: Set<string>;
  includeGroq: boolean;
  groqInsights?: string;
};

const palette = {
  ink: "#202421",
  muted: "#66706a",
  line: "#d9ded8",
  soft: "#f4f6f3",
  green: "#18715c",
  blue: "#3467a7",
  amber: "#c47b22",
  red: "#c84d36",
  brown: "#8a5a44"
};

const chartColors = [palette.green, palette.blue, palette.amber, palette.red, palette.brown];

export async function createManagerPdf(report: AnyRow, options: PdfReportOptions) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    bufferPages: true,
    info: {
      Title: `Informe gerencial HYL Gym ${options.monthName} ${options.year}`,
      Author: "HYL Gym Direccion Comercial"
    }
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const has = (section: string) => options.sections.has(section);

  drawCover(doc, report, options);
  if (has("summary")) drawSummary(doc, report, options);
  if (has("charts")) drawCharts(doc, report, options);
  if (has("daily")) drawDailySection(doc, report);
  if (has("monthly")) drawMonthlySection(doc, report);
  if (has("annual")) drawAnnualSection(doc, report);
  if (has("branches")) drawBranchSection(doc, report);
  if (has("advisors")) drawAdvisorSection(doc, report);
  if (has("plans")) drawPlanSection(doc, report);
  if (has("scores")) drawScoreSection(doc, report);
  if (has("quality")) drawQualitySection(doc, report);
  if (has("recommendations")) drawRecommendations(doc, report, "Acciones sugeridas por la plataforma");
  if (options.includeGroq) drawGroqSection(doc, options.groqInsights);

  drawFooters(doc);
  doc.end();
  return done;
}

function drawCover(doc: PDFKit.PDFDocument, report: AnyRow, options: PdfReportOptions) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");
  doc.fillColor(palette.green).rect(0, 0, doc.page.width, 112).fill();
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(26).text("HYL Gym", 42, 36);
  doc.font("Helvetica").fontSize(13).text("Informe gerencial comercial", 42, 72);

  doc.fillColor(palette.ink).font("Helvetica-Bold").fontSize(24).text(`${options.monthName} ${options.year}`, 42, 150);
  doc.font("Helvetica").fontSize(10).fillColor(palette.muted).text(`Generado: ${new Date().toLocaleString("es-CO")}`, 42, 181);

  const kpis = [
    ["Ventas mes", money(report.state.kpis.totalSales)],
    ["Ventas ano", money(report.annual.totalSales)],
    ["Progreso meta", percent(report.state.kpis.targetProgress)],
    ["Score sedes", String(Math.round(report.state.kpis.averageBranchScore || 0))]
  ];
  drawKpiGrid(doc, kpis, 42, 230);
  doc.y = 310;

  doc.moveDown(2);
  sectionTitle(doc, "Lectura ejecutiva");
  paragraph(
    doc,
    `Este documento consolida el rendimiento diario, mensual y anual por sedes, asesores y planes. Incluye scores comerciales, comisiones, calidad de datos y acciones sugeridas para direccionar el cierre comercial con datos reales de la plataforma.`
  );
}

function drawSummary(doc: PDFKit.PDFDocument, report: AnyRow, options: PdfReportOptions) {
  newPage(doc);
  sectionTitle(doc, "Resumen ejecutivo");
  drawKpiGrid(
    doc,
    [
      ["Ventas del mes", money(report.state.kpis.totalSales)],
      ["Registros", int(report.state.kpis.salesRows)],
      ["Ticket promedio", money(report.state.kpis.avgTicket)],
      ["Meta mensual", money(report.state.kpis.totalTarget)],
      ["Ventas anuales", money(report.annual.totalSales)],
      ["Score asesores", int(Math.round(report.state.kpis.averageAdvisorScore || 0))],
      ["Score sedes", int(Math.round(report.state.kpis.averageBranchScore || 0))],
      ["Duplicados", int(report.state.quality.duplicateGroups.length + report.state.quality.naturalDuplicateGroups.length)]
    ],
    doc.x,
    doc.y + 8
  );
  doc.y += 116;
  sectionSubtitle(doc, "Hallazgos clave");
  bullet(doc, `El mes filtrado es ${options.monthName} ${options.year}, con ${int(report.state.kpis.salesRows)} ventas y ${money(report.state.kpis.totalSales)} en ingresos.`);
  bullet(doc, `El acumulado anual disponible suma ${money(report.annual.totalSales)} y ${int(report.annual.salesRows)} registros.`);
  bullet(doc, `La calidad de datos esta en estado ${report.state.quality.status}, con ${int(report.state.quality.orphanSales.missingAdvisor)} ventas sin asesor asignado.`);
  bullet(doc, `El avance contra Meta 1 mensual es ${percent(report.state.kpis.targetProgress)}.`);
}

function drawCharts(doc: PDFKit.PDFDocument, report: AnyRow, _options: PdfReportOptions) {
  newPage(doc);
  sectionTitle(doc, "Graficos gerenciales");
  drawBarChart(doc, "Ventas mensuales por sede", report.state.branches.slice(0, 8), "name", "sales", money);
  drawBarChart(doc, "Top asesores del mes", report.state.advisors.slice(0, 10), "name", "sales", money);
  drawLineChart(doc, "Tendencia mensual del ano", report.monthlyTrend, "label", "sales", money);
  drawBarChart(doc, "Planes con mayor venta mensual", report.state.plans.slice(0, 10), "name", "sales", money);
}

function drawDailySection(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  sectionTitle(doc, "Informe diario");
  drawLineChart(doc, "Ventas por dia del mes", report.dailyTrend, "label", "sales", money);
  drawTable(doc, "Detalle diario", ["Dia", "Ventas", "Registros"], report.dailyTrend.map((row: AnyRow) => [
    row.label,
    money(row.sales),
    int(row.rows)
  ]));
  drawTable(doc, "Dias de mayor facturacion", ["Dia", "Ventas", "Registros"], report.topDays.map((row: AnyRow) => [
    row.label,
    money(row.sales),
    int(row.rows)
  ]));
}

function drawMonthlySection(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  sectionTitle(doc, "Informe mensual del ano");
  drawLineChart(doc, "Ventas mes a mes", report.monthlyTrend, "label", "sales", money);
  drawTable(doc, "Tendencia mensual", ["Mes", "Ventas", "Meta", "Avance", "Ticket"], report.monthlyTrend.map((row: AnyRow) => [
    row.label,
    money(row.sales),
    money(row.target),
    percent(row.progress),
    money(row.avgTicket)
  ]));
}

function drawAnnualSection(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  sectionTitle(doc, "Informe anual");
  drawKpiGrid(
    doc,
    [
      ["Ventas ano", money(report.annual.totalSales)],
      ["Registros ano", int(report.annual.salesRows)],
      ["Sedes activas", int(report.annual.activeBranches)],
      ["Asesores activos", int(report.annual.activeAdvisors)]
    ],
    doc.x,
    doc.y + 8
  );
  doc.y += 112;
  drawBarChart(doc, "Acumulado anual por sede", report.annualByBranch.slice(0, 8), "name", "sales", money);
  drawBarChart(doc, "Acumulado anual por plan", report.annualByPlan.slice(0, 10), "name", "sales", money);
}

function drawBranchSection(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  sectionTitle(doc, "Rendimiento por sedes");
  drawTable(doc, "Sedes - mes y ano", ["Sede", "Mes", "Ano", "Meta ano", "Avance", "Score"], report.annualByBranch.map((row: AnyRow) => [
    row.name,
    money(row.monthlySales),
    money(row.sales),
    money(row.annualTarget),
    percent(row.annualProgress),
    scoreLabel(row.score)
  ]));
}

function drawAdvisorSection(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  sectionTitle(doc, "Rendimiento por asesores");
  drawTable(doc, "Asesores - mes y ano", ["Asesor", "Sede", "Mes", "Ano", "Score", "Comision"], report.annualByAdvisor.slice(0, 24).map((row: AnyRow) => [
    row.name,
    row.branchName,
    money(row.monthlySales),
    money(row.sales),
    scoreLabel(row.score),
    row.commission ? money(row.commission.finalCommission) : "-"
  ]));
}

function drawPlanSection(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  sectionTitle(doc, "Rendimiento por planes");
  drawTable(doc, "Planes - mes y ano", ["Plan", "Categoria", "Mes", "Ano", "Registros", "Score"], report.annualByPlan.slice(0, 24).map((row: AnyRow) => [
    row.name,
    row.category || "-",
    money(row.monthlySales),
    money(row.sales),
    int(row.rows),
    scoreLabel(row.score)
  ]));
}

function drawScoreSection(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  sectionTitle(doc, "Scores comerciales");
  drawTable(doc, "Score por sede", ["Sede", "Ventas mes", "Score", "Estado"], report.state.branches.map((row: AnyRow) => [
    row.name,
    money(row.sales),
    nullableScore(row.score),
    row.score.status
  ]));
  drawTable(doc, "Score por asesor", ["Asesor", "Sede", "Ventas mes", "Score", "Estado"], report.state.advisors.slice(0, 24).map((row: AnyRow) => [
    row.name,
    row.branchName,
    money(row.sales),
    nullableScore(row.score),
    row.score.status
  ]));
  drawTable(doc, "Score por plan", ["Plan", "Ventas mes", "Registros", "Score", "Estado"], report.state.plans.slice(0, 18).map((row: AnyRow) => [
    row.name,
    money(row.sales),
    int(row.rows),
    nullableScore(row.score),
    row.score.status
  ]));
}

function drawQualitySection(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  sectionTitle(doc, "Calidad de datos");
  const quality = report.state.quality;
  drawKpiGrid(
    doc,
    [
      ["Estado", quality.status],
      ["Ventas", int(quality.totalRows)],
      ["Llaves unicas", int(quality.uniqueSaleKeys)],
      ["Duplicados", int(quality.duplicateGroups.length + quality.naturalDuplicateGroups.length)],
      ["Sin asesor", int(quality.orphanSales.missingAdvisor)],
      ["Sin sede", int(quality.orphanSales.missingBranch)],
      ["Sin plan", int(quality.orphanSales.missingPlan)],
      ["Valor cero", int(quality.orphanSales.zeroValue)]
    ],
    doc.x,
    doc.y + 8
  );
  doc.y += 118;
  paragraph(doc, "Este bloque permite validar si la exportacion se puede usar en junta sin limpieza previa. Las ventas sin asesor asignado deben revisarse para completar accountability comercial.");
}

function drawRecommendations(doc: PDFKit.PDFDocument, report: AnyRow, title: string) {
  newPage(doc);
  sectionTitle(doc, title);
  for (const item of report.state.recommendations.slice(0, 10)) {
    ensureSpace(doc, 56);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(palette.ink).text(`${item.priority} - ${item.title}`);
    doc.font("Helvetica").fontSize(9).fillColor(palette.muted).text(item.metric);
    paragraph(doc, item.detail, 9);
    doc.moveDown(0.4);
  }
}

function drawGroqSection(doc: PDFKit.PDFDocument, groqInsights?: string) {
  newPage(doc);
  sectionTitle(doc, "Sugerencias de accion guiadas por Groq");
  if (!groqInsights) {
    paragraph(doc, "Groq no devolvio sugerencias para esta exportacion. Verifica que la clave este configurada y vuelve a generar el PDF con la opcion de IA activa.");
    return;
  }
  for (const block of cleanMarkdown(groqInsights).split(/\n{2,}/)) {
    paragraph(doc, block.trim());
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.x = doc.page.margins.left;
  ensureSpace(doc, 48);
  doc.font("Helvetica-Bold").fontSize(17).fillColor(palette.ink).text(title);
  doc.moveTo(doc.x, doc.y + 6).lineTo(doc.page.width - doc.page.margins.right, doc.y + 6).strokeColor(palette.line).stroke();
  doc.moveDown(1);
}

function sectionSubtitle(doc: PDFKit.PDFDocument, title: string) {
  doc.x = doc.page.margins.left;
  ensureSpace(doc, 26);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(palette.ink).text(title);
  doc.moveDown(0.5);
}

function paragraph(doc: PDFKit.PDFDocument, text: string, size = 10) {
  if (!text) return;
  doc.x = doc.page.margins.left;
  ensureSpace(doc, 36);
  doc.font("Helvetica").fontSize(size).fillColor(palette.ink).text(text, {
    width: contentWidth(doc),
    lineGap: 2
  });
  doc.moveDown(0.5);
}

function bullet(doc: PDFKit.PDFDocument, text: string) {
  doc.x = doc.page.margins.left;
  ensureSpace(doc, 28);
  const left = doc.x;
  doc.fillColor(palette.green).circle(left + 4, doc.y + 6, 2.2).fill();
  doc.fillColor(palette.ink).font("Helvetica").fontSize(10).text(text, left + 14, doc.y, {
    width: contentWidth(doc) - 14,
    lineGap: 2
  });
  doc.x = left;
  doc.moveDown(0.5);
}

function drawKpiGrid(doc: PDFKit.PDFDocument, items: string[][], x: number, y: number) {
  const gap = 10;
  const cols = 4;
  const width = (contentWidth(doc) - gap * (cols - 1)) / cols;
  const height = 48;
  items.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const px = x + col * (width + gap);
    const py = y + row * (height + gap);
    doc.roundedRect(px, py, width, height, 6).fillAndStroke("#ffffff", palette.line);
    doc.font("Helvetica").fontSize(8).fillColor(palette.muted).text(item[0], px + 9, py + 9, { width: width - 18 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(palette.ink).text(item[1], px + 9, py + 25, { width: width - 18 });
  });
  doc.x = doc.page.margins.left;
}

function drawBarChart(
  doc: PDFKit.PDFDocument,
  title: string,
  data: AnyRow[],
  labelKey: string,
  valueKey: string,
  formatter: (value: number) => string
) {
  if (!data.length) return;
  doc.x = doc.page.margins.left;
  ensureSpace(doc, 210);
  sectionSubtitle(doc, title);
  const x = doc.x;
  const y = doc.y;
  const width = contentWidth(doc);
  const height = 150;
  const max = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);
  const barHeight = Math.min(16, (height - 8) / data.length - 4);
  data.forEach((item, index) => {
    const rowY = y + index * (barHeight + 6);
    const label = String(item[labelKey] ?? "").slice(0, 28);
    const value = Number(item[valueKey] || 0);
    const barWidth = Math.max(1, (width - 190) * (value / max));
    doc.font("Helvetica").fontSize(7.5).fillColor(palette.muted).text(label, x, rowY, { width: 112, height: barHeight + 3 });
    doc.rect(x + 118, rowY, width - 190, barHeight).fill("#edf2ef");
    doc.rect(x + 118, rowY, barWidth, barHeight).fill(chartColors[index % chartColors.length]);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(palette.ink).text(formatter(value), x + width - 66, rowY - 1, { width: 66, align: "right" });
  });
  doc.y = y + height + 16;
  doc.x = doc.page.margins.left;
}

function drawLineChart(
  doc: PDFKit.PDFDocument,
  title: string,
  data: AnyRow[],
  labelKey: string,
  valueKey: string,
  formatter: (value: number) => string
) {
  if (!data.length) return;
  doc.x = doc.page.margins.left;
  ensureSpace(doc, 210);
  sectionSubtitle(doc, title);
  const x = doc.x;
  const y = doc.y + 4;
  const width = contentWidth(doc);
  const height = 136;
  const max = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);
  doc.rect(x, y, width, height).fillAndStroke("#ffffff", palette.line);
  for (let i = 0; i <= 4; i++) {
    const gy = y + (height / 4) * i;
    doc.moveTo(x, gy).lineTo(x + width, gy).strokeColor("#eef1ee").stroke();
  }
  const points = data.map((item, index) => {
    const px = x + 22 + (index * (width - 44)) / Math.max(data.length - 1, 1);
    const py = y + height - 18 - (Number(item[valueKey] || 0) / max) * (height - 34);
    return { x: px, y: py, label: String(item[labelKey] ?? ""), value: Number(item[valueKey] || 0) };
  });
  doc.strokeColor(palette.green).lineWidth(2);
  points.forEach((point, index) => {
    if (index === 0) doc.moveTo(point.x, point.y);
    else doc.lineTo(point.x, point.y);
  });
  doc.stroke();
  points.forEach((point, index) => {
    doc.circle(point.x, point.y, 2.6).fill(chartColors[index % chartColors.length]);
    if (data.length <= 12 || index % 3 === 0) {
      doc.font("Helvetica").fontSize(6.5).fillColor(palette.muted).text(point.label.slice(0, 5), point.x - 14, y + height + 3, { width: 28, align: "center" });
    }
  });
  doc.font("Helvetica-Bold").fontSize(8).fillColor(palette.ink).text(formatter(max), x + width - 90, y + 6, { width: 82, align: "right" });
  doc.y = y + height + 24;
  doc.x = doc.page.margins.left;
}

function drawTable(doc: PDFKit.PDFDocument, title: string, headers: string[], rows: string[][]) {
  if (!rows.length) return;
  doc.x = doc.page.margins.left;
  ensureSpace(doc, 90);
  sectionSubtitle(doc, title);
  const width = contentWidth(doc);
  const colWidth = width / headers.length;
  drawTableRow(doc, headers, colWidth, true);
  for (const row of rows) {
    ensureSpace(doc, 24);
    drawTableRow(doc, row, colWidth, false);
  }
  doc.moveDown(0.8);
  doc.x = doc.page.margins.left;
}

function drawTableRow(doc: PDFKit.PDFDocument, cells: string[], colWidth: number, header: boolean) {
  const x = doc.x;
  const y = doc.y;
  const height = header ? 22 : 25;
  doc.rect(x, y, colWidth * cells.length, height).fill(header ? palette.green : "#ffffff");
  cells.forEach((cell, index) => {
    const px = x + index * colWidth;
    doc.rect(px, y, colWidth, height).strokeColor(header ? palette.green : palette.line).stroke();
    doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(header ? 8 : 7.4).fillColor(header ? "#ffffff" : palette.ink).text(String(cell ?? "-"), px + 5, y + 6, {
      width: colWidth - 10,
      height: height - 7
    });
  });
  doc.y = y + height;
  doc.x = doc.page.margins.left;
}

function drawFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor(palette.muted);
    doc.text(`HYL Gym Direccion Comercial - Pagina ${i + 1} de ${range.count}`, doc.page.margins.left, doc.page.height - 28, {
      width: contentWidth(doc),
      align: "center"
    });
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom - 24) {
    newPage(doc);
  }
}

function newPage(doc: PDFKit.PDFDocument) {
  doc.addPage();
  doc.y = doc.page.margins.top;
}

function contentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function int(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function percent(value: number) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function nullableScore(score: AnyRow) {
  return score?.score === null || score?.score === undefined ? "Pendiente" : int(Math.round(score.score));
}

function scoreLabel(score: AnyRow) {
  return `${nullableScore(score)} / ${score?.status ?? "Pendiente"}`;
}

function cleanMarkdown(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/\r/g, "")
    .trim();
}
