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

const PAGE = {
  width: 792,
  height: 612,
  margin: 32
};

const palette = {
  ink: "#111827",
  muted: "#4b5563",
  header: "#111827",
  line: "#cfd6df",
  stripe: "#f7f9fb",
  teal: "#147d72",
  blue: "#2563eb",
  red: "#dc2626",
  green: "#16a34a",
  amber: "#d97706",
  purple: "#7c3aed",
  pink: "#db2777",
  brown: "#8b5e4a"
};

const seriesColors = [palette.blue, palette.amber, palette.green, palette.red, palette.purple, palette.brown, palette.pink, palette.teal];

export async function createManagerPdf(report: AnyRow, options: PdfReportOptions) {
  const doc = new PDFDocument({
    size: [PAGE.width, PAGE.height],
    margin: PAGE.margin,
    bufferPages: true,
    info: {
      Title: `Informe sedes y asesores - Enero a ${options.monthName} ${options.year}`,
      Author: "HYL Gym Direccion Comercial"
    }
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const has = (section: string) => options.sections.has(section);
  const months = monthRows(report, options.month);

  if (has("summary")) drawSummaryPage(doc, report, options, months);
  if (has("branches") || has("charts")) drawBranchesPage(doc, report, options, months);
  if (has("advisors") || has("charts")) drawAdvisorsPages(doc, report, options);
  if (has("daily")) drawDailyPage(doc, report, options);
  if (has("plans")) drawPlanTablePages(doc, report, options);
  if (has("plans") || has("charts")) drawPlanChartsPage(doc, report, options);
  if (has("monthly")) drawMonthlyDetailPage(doc, report, options, months);
  if (has("annual") || has("scores")) drawScorePage(doc, report, options);
  if (has("quality") || has("recommendations")) drawQualityAndActionsPage(doc, report, options);
  if (options.includeGroq) drawGroqPage(doc, options);

  drawFooters(doc);
  doc.end();
  return done;
}

function drawSummaryPage(doc: PDFKit.PDFDocument, report: AnyRow, options: PdfReportOptions, months: AnyRow[]) {
  const total = sum(months, "sales");
  const rows = sum(months, "rows");
  const avgMonthly = months.length ? total / months.length : 0;
  const best = months.slice().sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))[0];
  pageTitle(doc, `Informe sedes y asesores - Enero a ${options.monthName} ${options.year}`, 36);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(palette.ink).text(
    `Dinero ingresado: ${money(total)} | Promedio mensual: ${money(avgMonthly)} | Mejor mes: ${best?.label ?? options.monthName} (${money(best?.sales ?? 0)})`,
    PAGE.margin,
    86,
    { width: contentWidth(doc) }
  );
  paragraph(
    doc,
    `Incluye ventas positivas disponibles de enero a ${options.monthName.toLowerCase()} ${options.year}. La informacion se actualiza con los datos cargados en la plataforma; los registros en cero no se consideran en los totales gerenciales.`,
    PAGE.margin,
    118,
    8.5
  );

  const tableRows = months.map((row) => [
    row.label,
    money(row.sales),
    percent(total ? row.sales / total : 0),
    money(row.sales / Math.max(daysInMonth(options.year, row.month), 1)),
    int(row.rows)
  ]);
  drawTable(doc, ["Mes", "Dinero ingresado", "% periodo", "Promedio diario", "Transacciones"], tableRows, 188, 150, 410, [0.2, 0.27, 0.15, 0.21, 0.17]);

  drawLineChart(doc, {
    title: `Rendimiento acumulado - dinero ingresado por mes`,
    x: 74,
    y: 328,
    width: 650,
    height: 184,
    series: [{ name: "Total", color: palette.blue, points: months.map((row) => ({ label: row.label, value: row.sales })) }],
    yFormatter: compactMoney
  });
}

function drawBranchesPage(doc: PDFKit.PDFDocument, report: AnyRow, options: PdfReportOptions, months: AnyRow[]) {
  newPage(doc);
  pageTitle(doc, "Sedes", 38);
  const branches = report.annualByBranch.filter((row: AnyRow) => row.sales > 0).slice(0, 8);
  const total = sum(branches, "sales");
  drawTable(
    doc,
    ["Sede", "Dinero ingresado", "% periodo", "Transacciones", "Ticket promedio"],
    branches.map((row: AnyRow) => [branchLabel(row.name), money(row.sales), percent(total ? row.sales / total : 0), int(row.rows), money(row.sales / Math.max(row.rows, 1))]),
    190,
    86,
    404,
    [0.23, 0.24, 0.16, 0.18, 0.19]
  );

  drawHorizontalBarChart(doc, {
    title: "Ventas acumuladas por sede",
    x: 74,
    y: 258,
    width: 320,
    height: 215,
    data: branches.map((row: AnyRow) => ({ label: branchLabel(row.name), value: row.sales })),
    color: palette.teal,
    valueFormatter: compactMoney
  });

  drawMultiLineChart(doc, {
    title: "Rendimiento por sede",
    x: 438,
    y: 254,
    width: 286,
    height: 220,
    labels: months.map((row) => row.label),
    series: branches.slice(0, 7).map((branch: AnyRow, index: number) => ({
      name: branchLabel(branch.name),
      color: seriesColors[index % seriesColors.length],
      values: months.map((month) => Number(report.branchMonthly?.[branch.id]?.[month.month] || 0))
    })),
    yFormatter: compactMoney
  });
}

function drawAdvisorsPages(doc: PDFKit.PDFDocument, report: AnyRow, _options: PdfReportOptions) {
  newPage(doc);
  const advisors = report.annualByAdvisor.filter((row: AnyRow) => row.sales > 0);
  const top = advisors.slice(0, 18);
  pageTitle(doc, "Asesores", 36);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(palette.ink).text(
    `Asesores con ventas positivas: ${int(advisors.length)} | Venta sin asesor asignado: ${money(report.unassignedSales || 0)} | Venta SUPORTEEVO positiva: ${money(report.supportEvoSales || 0)}`,
    PAGE.margin,
    82,
    { width: contentWidth(doc) }
  );
  drawHorizontalBarChart(doc, {
    title: "Top asesores por venta acumulada",
    x: 286,
    y: 128,
    width: 450,
    height: 250,
    data: top.map((row: AnyRow) => ({ label: advisorChartName(row.name), value: row.sales })),
    color: palette.teal,
    valueFormatter: compactMoney
  });
  drawAdvisorTable(doc, advisors.slice(0, 5), 124, 412);

  for (let start = 5; start < advisors.length; start += 19) {
    newPage(doc);
    drawAdvisorTable(doc, advisors.slice(start, start + 19), 110, 56, start + 1);
  }
}

function drawDailyPage(doc: PDFKit.PDFDocument, report: AnyRow, options: PdfReportOptions) {
  newPage(doc);
  pageTitle(doc, "Rendimiento Diario Mensual", 36);
  const daily = report.dailyTrend || [];
  drawLineChart(doc, {
    title: `Rendimiento diario - ${options.monthName}`,
    x: 78,
    y: 118,
    width: 300,
    height: 210,
    series: [{ name: options.monthName, color: palette.blue, points: daily.map((row: AnyRow) => ({ label: String(row.day ?? row.label), value: row.sales })) }],
    yFormatter: compactMoney
  });
  drawHorizontalBarChart(doc, {
    title: "Dias de mayor facturacion",
    x: 430,
    y: 118,
    width: 290,
    height: 210,
    data: (report.topDays || []).map((row: AnyRow) => ({ label: row.label, value: row.sales })),
    color: palette.teal,
    valueFormatter: compactMoney
  });
  drawTable(
    doc,
    ["Dia", "Dinero ingresado", "Transacciones", "Ticket prom."],
    daily.map((row: AnyRow) => [row.label, money(row.sales), int(row.rows), money(row.sales / Math.max(row.rows, 1))]),
    182,
    374,
    430,
    [0.16, 0.34, 0.22, 0.28],
    10
  );
}

function drawPlanTablePages(doc: PDFKit.PDFDocument, report: AnyRow, _options: PdfReportOptions) {
  newPage(doc);
  const plans = report.annualByPlan.filter((row: AnyRow) => row.sales > 0);
  const total = sum(plans, "sales");
  pageTitle(doc, "Rendimiento del Periodo de Planes", 36);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(palette.ink).text(
    `Ingreso por planes: ${money(total)} | Planes con ventas: ${int(plans.length)} | Transacciones de planes: ${int(sum(plans, "rows"))}`,
    PAGE.margin,
    82,
    { width: contentWidth(doc) }
  );
  drawPlansTable(doc, plans.slice(0, 25), total, 122);

  for (let start = 25; start < plans.length; start += 27) {
    newPage(doc);
    drawPlansTable(doc, plans.slice(start, start + 27), total, 52);
  }
}

function drawPlanChartsPage(doc: PDFKit.PDFDocument, report: AnyRow, _options: PdfReportOptions) {
  newPage(doc);
  const plans = report.annualByPlan.filter((row: AnyRow) => row.sales > 0);
  pageTitle(doc, "Graficos de Planes", 36);
  drawHorizontalBarChart(doc, {
    title: "Top planes por dinero ingresado",
    x: 92,
    y: 104,
    width: 300,
    height: 252,
    data: plans.slice(0, 16).map((row: AnyRow) => ({ label: row.name, value: row.sales })),
    color: palette.teal,
    valueFormatter: compactMoney
  });
  drawHorizontalBarChart(doc, {
    title: "Top planes por transacciones",
    x: 468,
    y: 104,
    width: 280,
    height: 252,
    data: plans.slice().sort((a: AnyRow, b: AnyRow) => Number(b.rows || 0) - Number(a.rows || 0)).slice(0, 16).map((row: AnyRow) => ({ label: row.name, value: row.rows })),
    color: palette.blue,
    valueFormatter: int
  });
}

function drawMonthlyDetailPage(doc: PDFKit.PDFDocument, report: AnyRow, options: PdfReportOptions, months: AnyRow[]) {
  newPage(doc);
  pageTitle(doc, "Detalle Mensual", 36);
  drawTable(
    doc,
    ["Mes", "Ventas", "Meta", "Avance", "Ticket", "Transacciones"],
    months.map((row) => [row.label, money(row.sales), money(row.target), percent(row.progress), money(row.avgTicket), int(row.rows)]),
    120,
    96,
    552,
    [0.16, 0.2, 0.2, 0.14, 0.16, 0.14]
  );
  drawLineChart(doc, {
    title: `Ventas vs meta - Enero a ${options.monthName}`,
    x: 92,
    y: 260,
    width: 610,
    height: 230,
    series: [
      { name: "Ventas", color: palette.blue, points: months.map((row) => ({ label: row.label, value: row.sales })) },
      { name: "Meta", color: palette.red, points: months.map((row) => ({ label: row.label, value: row.target })) }
    ],
    yFormatter: compactMoney
  });
}

function drawScorePage(doc: PDFKit.PDFDocument, report: AnyRow, _options: PdfReportOptions) {
  newPage(doc);
  pageTitle(doc, "Scores Comerciales", 36);
  drawTable(
    doc,
    ["Sede", "Venta mes", "Venta periodo", "Avance anual", "Score"],
    report.annualByBranch.slice(0, 12).map((row: AnyRow) => [branchLabel(row.name), money(row.monthlySales), money(row.sales), percent(row.annualProgress), scoreLabel(row.score)]),
    80,
    90,
    632,
    [0.22, 0.2, 0.2, 0.17, 0.21]
  );
  drawTable(
    doc,
    ["Asesor", "Sede", "Venta mes", "Venta periodo", "Score"],
    report.annualByAdvisor.filter((row: AnyRow) => row.sales > 0).slice(0, 12).map((row: AnyRow) => [titleCase(row.name), branchLabel(row.branchName), money(row.monthlySales), money(row.sales), scoreLabel(row.score)]),
    66,
    322,
    660,
    [0.28, 0.18, 0.18, 0.18, 0.18],
    12
  );
}

function drawQualityAndActionsPage(doc: PDFKit.PDFDocument, report: AnyRow, _options: PdfReportOptions) {
  newPage(doc);
  pageTitle(doc, "Calidad de Datos y Acciones", 36);
  const quality = report.state.quality;
  drawTable(
    doc,
    ["Indicador", "Valor", "Lectura"],
    [
      ["Estado calidad", quality.status, quality.status === "OK" ? "Listo para gerencia" : "Requiere revision"],
      ["Ventas", int(quality.totalRows), "Registros cargados"],
      ["Duplicados", int(quality.duplicateGroups.length + quality.naturalDuplicateGroups.length), "Posibles ventas repetidas"],
      ["Sin asesor", int(quality.orphanSales.missingAdvisor), "Asignacion comercial pendiente"],
      ["Sin sede", int(quality.orphanSales.missingBranch), "Asignacion operativa pendiente"],
      ["Valor cero", int(quality.orphanSales.zeroValue), "No entra a ingreso gerencial"]
    ],
    92,
    92,
    610,
    [0.32, 0.18, 0.5]
  );
  doc.font("Helvetica-Bold").fontSize(14).fillColor(palette.ink).text("Acciones sugeridas por la plataforma", 92, 288);
  let y = 320;
  for (const item of report.state.recommendations.slice(0, 6)) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(palette.ink).text(`${item.priority} - ${item.title}`, 104, y, { width: 580 });
    y += 15;
    doc.font("Helvetica").fontSize(8).fillColor(palette.muted).text(`${item.metric}. ${item.detail}`, 104, y, { width: 580, lineGap: 1 });
    y += 34;
  }
}

function drawGroqPage(doc: PDFKit.PDFDocument, options: PdfReportOptions) {
  newPage(doc);
  pageTitle(doc, "Sugerencias de Accion Guiadas por IA", 36);
  const text = options.groqInsights?.trim() || "Groq no devolvio sugerencias para esta exportacion. Verifica que la clave este configurada y vuelve a generar el PDF con la opcion de IA activa.";
  paragraph(doc, cleanMarkdown(text), 80, 92, 10, 640);
}

function drawAdvisorTable(doc: PDFKit.PDFDocument, rows: AnyRow[], x: number, y: number, startIndex = 1) {
  drawTable(
    doc,
    ["#", "Asesor", "Sede", "Dinero ingresado", "Transacciones", "Ticket prom."],
    rows.map((row, index) => [
      String(startIndex + index),
      titleCase(row.name).toUpperCase(),
      branchLabel(row.branchName),
      money(row.sales),
      int(row.rows),
      money(row.sales / Math.max(row.rows, 1))
    ]),
    x,
    y,
    536,
    [0.05, 0.36, 0.16, 0.18, 0.13, 0.12],
    19
  );
}

function drawPlansTable(doc: PDFKit.PDFDocument, rows: AnyRow[], total: number, y: number) {
  drawTable(
    doc,
    ["Plan", "Dinero ingresado", "% planes", "Transacciones", "Ticket prom.", "Sedes"],
    rows.map((row: AnyRow) => [
      row.name,
      money(row.sales),
      percent(total ? row.sales / total : 0),
      int(row.rows),
      money(row.sales / Math.max(row.rows, 1)),
      int(row.branchCount || row.branches || 0)
    ]),
    122,
    y,
    562,
    [0.4, 0.17, 0.1, 0.13, 0.14, 0.06],
    27
  );
}

function pageTitle(doc: PDFKit.PDFDocument, title: string, y: number) {
  doc.font("Helvetica-Bold").fontSize(18).fillColor(palette.ink).text(title, PAGE.margin, y, {
    width: contentWidth(doc),
    align: "center"
  });
}

function paragraph(doc: PDFKit.PDFDocument, text: string, x: number, y: number, size = 8.5, width = contentWidth(doc)) {
  doc.font("Helvetica").fontSize(size).fillColor("#111111").text(text, x, y, {
    width,
    lineGap: 1.5
  });
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  x: number,
  y: number,
  width: number,
  proportions: number[],
  maxRows = 999
) {
  const heights = { header: 18, row: 18 };
  const colWidths = proportions.map((value) => width * value);
  drawTableRow(doc, headers, x, y, colWidths, heights.header, true);
  rows.slice(0, maxRows).forEach((row, index) => {
    drawTableRow(doc, row, x, y + heights.header + index * heights.row, colWidths, heights.row, false, index % 2 === 1);
  });
}

function drawTableRow(doc: PDFKit.PDFDocument, cells: string[], x: number, y: number, colWidths: number[], height: number, header: boolean, stripe = false) {
  let px = x;
  const fill = header ? palette.header : stripe ? palette.stripe : "#ffffff";
  doc.rect(x, y, sum(colWidths), height).fill(fill);
  cells.forEach((cell, index) => {
    const colWidth = colWidths[index] || 60;
    doc.rect(px, y, colWidth, height).strokeColor(palette.line).lineWidth(0.5).stroke();
    const align = index === 0 || (header && index <= 1) ? "left" : index >= 2 ? "right" : "left";
    doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(header ? 7.2 : 6.8).fillColor(header ? "#ffffff" : "#111111").text(String(cell ?? "-"), px + 5, y + 5, {
      width: colWidth - 10,
      height: height - 5,
      align
    });
    px += colWidth;
  });
}

function drawHorizontalBarChart(
  doc: PDFKit.PDFDocument,
  config: { title: string; x: number; y: number; width: number; height: number; data: Array<{ label: string; value: number }>; color: string; valueFormatter: (value: number) => string }
) {
  const data = config.data.filter((item) => Number(item.value || 0) > 0);
  if (!data.length) return;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text(config.title, config.x, config.y - 16, {
    width: config.width,
    align: "center"
  });
  const labelWidth = Math.min(150, config.width * 0.38);
  const chartX = config.x + labelWidth;
  const chartWidth = config.width - labelWidth - 8;
  const rowGap = 4;
  const rowHeight = Math.max(7, Math.min(14, (config.height - rowGap * (data.length - 1)) / data.length));
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  doc.rect(chartX, config.y, chartWidth, config.height).strokeColor("#222222").lineWidth(0.7).stroke();
  for (let i = 0; i <= 4; i += 1) {
    const gx = chartX + (chartWidth / 4) * i;
    doc.moveTo(gx, config.y).lineTo(gx, config.y + config.height).strokeColor("#e5e7eb").lineWidth(0.4).stroke();
  }
  data.forEach((item, index) => {
    const rowY = config.y + index * (rowHeight + rowGap) + 4;
    const label = String(item.label || "").slice(0, 34);
    const value = Number(item.value || 0);
    doc.font("Helvetica").fontSize(6.5).fillColor("#111111").text(label, config.x, rowY - 1, {
      width: labelWidth - 6,
      align: "right",
      height: rowHeight + 4
    });
    doc.rect(chartX, rowY, Math.max(1, (value / max) * (chartWidth - 8)), rowHeight).fill(config.color);
  });
  doc.font("Helvetica").fontSize(6.5).fillColor("#111111").text(config.valueFormatter(max), chartX + chartWidth - 52, config.y + config.height + 5, { width: 52, align: "right" });
}

function drawLineChart(
  doc: PDFKit.PDFDocument,
  config: { title: string; x: number; y: number; width: number; height: number; series: Array<{ name: string; color: string; points: Array<{ label: string; value: number }> }>; yFormatter: (value: number) => string }
) {
  const labels = config.series[0]?.points.map((point) => point.label) || [];
  const values = config.series.flatMap((serie) => serie.points.map((point) => Number(point.value || 0)));
  const max = Math.max(...values, 1);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(config.title, config.x, config.y - 22, {
    width: config.width,
    align: "center"
  });
  drawChartFrame(doc, config.x, config.y, config.width, config.height);
  const plot = chartPlot(config.x, config.y, config.width, config.height);
  config.series.forEach((serie) => {
    doc.strokeColor(serie.color).lineWidth(1.5);
    serie.points.forEach((point, index) => {
      const px = plot.x + (index * plot.width) / Math.max(labels.length - 1, 1);
      const py = plot.y + plot.height - (Number(point.value || 0) / max) * plot.height;
      if (index === 0) doc.moveTo(px, py);
      else doc.lineTo(px, py);
    });
    doc.stroke();
    serie.points.forEach((point, index) => {
      const px = plot.x + (index * plot.width) / Math.max(labels.length - 1, 1);
      const py = plot.y + plot.height - (Number(point.value || 0) / max) * plot.height;
      doc.circle(px, py, 2.4).fill(serie.color);
    });
  });
  drawXAxisLabels(doc, labels, plot.x, config.y + config.height + 6, plot.width);
  doc.font("Helvetica").fontSize(7).fillColor("#111111").text(config.yFormatter(max), config.x + 6, config.y + 6, { width: 64 });
}

function drawMultiLineChart(
  doc: PDFKit.PDFDocument,
  config: { title: string; x: number; y: number; width: number; height: number; labels: string[]; series: Array<{ name: string; color: string; values: number[] }>; yFormatter: (value: number) => string }
) {
  const values = config.series.flatMap((serie) => serie.values.map((value) => Number(value || 0)));
  const max = Math.max(...values, 1);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text(config.title, config.x, config.y - 16, {
    width: config.width,
    align: "center"
  });
  drawChartFrame(doc, config.x, config.y, config.width, config.height);
  const plot = chartPlot(config.x, config.y, config.width - 42, config.height);
  config.series.forEach((serie) => {
    doc.strokeColor(serie.color).lineWidth(1.2);
    serie.values.forEach((value, index) => {
      const px = plot.x + (index * plot.width) / Math.max(config.labels.length - 1, 1);
      const py = plot.y + plot.height - (Number(value || 0) / max) * plot.height;
      if (index === 0) doc.moveTo(px, py);
      else doc.lineTo(px, py);
    });
    doc.stroke();
    serie.values.forEach((value, index) => {
      const px = plot.x + (index * plot.width) / Math.max(config.labels.length - 1, 1);
      const py = plot.y + plot.height - (Number(value || 0) / max) * plot.height;
      doc.circle(px, py, 1.8).fill(serie.color);
    });
  });
  drawXAxisLabels(doc, config.labels, plot.x, config.y + config.height + 5, plot.width);
  doc.font("Helvetica").fontSize(6).fillColor("#111111").text(config.yFormatter(max), config.x + 5, config.y + 6, { width: 52 });
  let ly = config.y + 12;
  for (const serie of config.series) {
    doc.rect(config.x + config.width - 34, ly, 6, 6).fill(serie.color);
    doc.font("Helvetica").fontSize(5.4).fillColor("#111111").text(serie.name.slice(0, 12), config.x + config.width - 26, ly - 1, { width: 34 });
    ly += 10;
  }
}

function drawChartFrame(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
  doc.rect(x, y, width, height).strokeColor("#222222").lineWidth(0.7).stroke();
  for (let i = 1; i < 5; i += 1) {
    const gy = y + (height / 5) * i;
    doc.moveTo(x, gy).lineTo(x + width, gy).strokeColor("#e5e7eb").lineWidth(0.4).stroke();
  }
}

function chartPlot(x: number, y: number, width: number, height: number) {
  return { x: x + 28, y: y + 18, width: width - 48, height: height - 44 };
}

function drawXAxisLabels(doc: PDFKit.PDFDocument, labels: string[], x: number, y: number, width: number) {
  labels.forEach((label, index) => {
    const px = x + (index * width) / Math.max(labels.length - 1, 1);
    doc.font("Helvetica").fontSize(6.4).fillColor("#111111").text(String(label).slice(0, 5), px - 16, y, {
      width: 32,
      align: "center"
    });
  });
}

function drawFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(7.5).fillColor(palette.muted).text(`Pagina ${i + 1}`, PAGE.width - 78, PAGE.height - 28, {
      width: 52,
      align: "right"
    });
  }
}

function newPage(doc: PDFKit.PDFDocument) {
  doc.addPage({ size: [PAGE.width, PAGE.height], margin: PAGE.margin });
}

function monthRows(report: AnyRow, selectedMonth: number) {
  return (report.monthlyTrend || []).filter((row: AnyRow) => Number(row.month) <= selectedMonth);
}

function branchLabel(value: string) {
  const text = String(value || "").toUpperCase();
  if (text === "CALLE 109") return "109";
  if (text === "COLORS 162") return "162";
  if (text === "VILLAVICENCIO") return "VILLAVO";
  return text;
}

function titleCase(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function advisorChartName(value: string) {
  const parts = titleCase(value).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  if (parts.length === 3) return `${parts[0]} ${parts[2]}`;
  return `${parts[0]} ${parts[2]} ${parts[3]}`.trim();
}

function scoreLabel(score: AnyRow) {
  if (!score || score.score === null || score.score === undefined) return "Pendiente";
  return `${int(Math.round(score.score))} / ${score.status ?? "Pendiente"}`;
}

function cleanMarkdown(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/\r/g, "")
    .trim();
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function contentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function sum(rows: AnyRow[] | number[], key?: string) {
  return rows.reduce((total: number, row: AnyRow | number) => total + Number(key ? (row as AnyRow)[key] || 0 : row || 0), 0);
}

function money(value: number) {
  return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
}

function compactMoney(value: number) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1000000) return `$${Math.round(number / 1000000)}M`;
  if (Math.abs(number) >= 1000) return `$${Math.round(number / 1000)}K`;
  return money(number);
}

function int(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function percent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}
