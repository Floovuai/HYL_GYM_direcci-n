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

// Misma paleta de la plataforma (src/client/styles.css) para que el PDF se
// vea como una extension de la app y no como un documento aparte.
const palette = {
  ink: "#14171a",
  muted: "#5f6870",
  header: "#0b6349",
  line: "#e4e7ec",
  stripe: "#f8fafc",
  teal: "#0d7a58",
  blue: "#3467a7",
  red: "#bc3f28",
  green: "#0b6349",
  amber: "#c47b22",
  purple: "#6f55a3",
  pink: "#4f7f8f",
  brown: "#8a5a34"
};

const seriesColors = [palette.teal, palette.blue, palette.amber, palette.red, palette.purple, palette.pink, palette.brown, palette.green];

export async function createManagerPdf(report: AnyRow, options: PdfReportOptions) {
  const doc = new PDFDocument({
    size: [PAGE.width, PAGE.height],
    margin: PAGE.margin,
    bufferPages: true,
    info: {
      Title: `Informe sedes y asesores - Enero a ${options.monthName} ${options.year}`,
      Author: "DashCom Dashboard Comercial"
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
  if (has("summary") || has("monthly") || has("charts")) drawMonthlyInsightsPage(doc, report);
  if (has("churn") || has("monthly") || has("charts")) drawMemberEvolutionPage(doc, report);
  if (has("branches") || has("charts")) drawBranchesPage(doc, report, options, months);
  if (has("branches") || has("charts")) drawBranchGoalsPage(doc, report);
  if (has("advisors") || has("charts")) drawAdvisorsPages(doc, report, options);
  if (has("advisors") || has("charts")) drawAdvisorLevelsPage(doc, report);
  if (has("daily")) drawDailyPage(doc, report, options);
  if (has("daily") || has("charts")) drawDailyOpportunityPage(doc, report);
  if (has("plans")) drawPlanTablePages(doc, report, options);
  if (has("plans") || has("charts")) drawPlanChartsPage(doc, report, options);
  if (has("plans") || has("charts")) drawPlanMixPage(doc, report);
  if (has("monthly")) drawMonthlyDetailPage(doc, report, options, months);
  if (has("annual") || has("scores")) drawScorePage(doc, report, options);
  if (has("quality") || has("recommendations")) drawQualityAndActionsPage(doc, report, options);
  if (options.includeGroq) drawGroqPage(doc, options);

  drawFooters(doc);
  doc.end();
  return done;
}

function drawMonthlyInsightsPage(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  pageTitle(doc, "Pulso Mensual y Proyeccion", 36, "Estado del mes en curso: ritmo de venta, proyeccion de cierre y avance de cada sede contra su Meta 1.");
  const projection = report.monthlyInsights?.monthProjection ?? {};
  drawKpiCards(doc, [
    ["Venta actual", money(projection.sales || 0), `${percent(projection.progress || 0)} de Meta 1`],
    ["Proyeccion recomendada", money(projection.projectedClose || 0), `${projection.confidence?.label || "Media"} · ${percent(projection.projectedProgress || 0)}`],
    ["Rango probable", `${compactMoney(projection.conservativeProjectedClose || 0)} - ${compactMoney(projection.optimisticProjectedClose || 0)}`, projection.history?.method === "historico_ajustado" ? "Historico ajustado" : "Ritmo lineal"],
    ["Brecha actual", money(projection.currentGap || 0), `${money(projection.requiredDaily || 0)} diario requerido`]
  ], 74, 100, 644);
  const tableBottom = drawTable(
    doc,
    ["Indicador", "Valor", "Lectura"],
    [
      ["Dias con venta", `${int(projection.elapsedDays || 0)} de ${int(projection.daysInMonth || 0)}`, "Base de proyeccion"],
      ["Dias restantes", int(projection.remainingDays || 0), "Ventana para cierre"],
      ["Promedio diario", money(projection.dailyAverage || 0), "Ritmo actual"],
      ["Proyeccion lineal", money(projection.linearProjectedClose || 0), "Ritmo simple actual"],
      ["Proyeccion historica", money(projection.historicalProjectedClose || 0), "Ajustada por meses cerrados"],
      ["Brecha proyectada", money(projection.projectedGap || 0), Number(projection.projectedGap || 0) <= 0 ? "Cierre sobre meta" : "Riesgo de cierre"]
    ],
    164,
    206,
    464,
    [0.34, 0.22, 0.44]
  );
  const branchGoals = report.monthlyInsights?.branchGoalRows ?? [];
  drawHorizontalBarChart(doc, {
    title: "Avance a Meta 1 por sede",
    subtitle: "Porcentaje de la meta del mes ya alcanzado, de mayor a menor avance.",
    x: 96,
    y: tableBottom + 34,
    width: 594,
    height: 184,
    data: branchGoals.slice().sort((a: AnyRow, b: AnyRow) => Number(b.progress || 0) - Number(a.progress || 0)).map((row: AnyRow) => ({
      label: branchLabel(row.name),
      value: Number(row.progress || 0)
    })),
    color: palette.teal,
    valueFormatter: percent
  });
}

function drawBranchGoalsPage(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  pageTitle(doc, "Metas Mensuales por Sede", 36, "Venta del mes vs Meta 1 de cada sede, con la brecha pendiente y la proyeccion de cierre.");
  const rows = report.monthlyInsights?.branchGoalRows ?? [];
  const tableBottom = drawTable(
    doc,
    ["Sede", "Venta mes", "Meta 1", "Avance", "Brecha", "Proy. cierre"],
    rows.map((row: AnyRow) => [
      branchLabel(row.name),
      money(row.sales),
      money(row.target),
      percent(row.progress),
      money(row.gap),
      money(row.projectedClose)
    ]),
    72,
    98,
    650,
    [0.2, 0.18, 0.18, 0.12, 0.16, 0.16],
    16
  );
  drawHorizontalBarChart(doc, {
    title: "Brecha para Meta 1",
    subtitle: "Dinero que le falta a cada sede para llegar a su Meta 1, de mayor a menor brecha.",
    x: 96,
    y: Math.max(tableBottom + 34, 308),
    width: 594,
    height: 196,
    data: rows.slice().sort((a: AnyRow, b: AnyRow) => Number(b.gap || 0) - Number(a.gap || 0)).map((row: AnyRow) => ({
      label: branchLabel(row.name),
      value: Number(row.gap || 0)
    })),
    color: palette.red,
    valueFormatter: compactMoney
  });
}

function drawMemberEvolutionPage(doc: PDFKit.PDFDocument, report: AnyRow) {
  const evolution = report.monthlyInsights?.memberEvolution;
  if (!evolution?.available) return;
  newPage(doc);
  pageTitle(doc, "Churn y Evolucion de Miembros", 36, "Miembros activos, churn directo y salida bruta del mes, por sede y en el tiempo.");
  const summary = evolution.summary ?? {};
  drawKpiCards(doc, [
    ["Activos inicio", int(summary.activeStart || 0), "Base del mes"],
    ["Churn directo", percent(summary.directChurn || 0), "Bajas + no renovados"],
    ["Salida bruta", percent(summary.grossChurn || 0), "Incluye vencidos y suspendidos"],
    ["Activos fin", int(summary.activeEnd || 0), `${Number(summary.netEvolution || 0) >= 0 ? "+" : ""}${int(summary.netEvolution || 0)} neto`]
  ], 74, 94, 644);
  const rows = evolution.byBranch ?? [];
  const tableBottom = drawTable(
    doc,
    ["Sede", "Activos inicio", "Churn directo", "Salida bruta", "Activos fin", "Evolucion"],
    rows.map((row: AnyRow) => [
      branchLabel(row.branchName),
      int(row.activeStart),
      percent(row.directChurn),
      percent(row.grossChurn),
      int(row.activeEnd),
      `${Number(row.netEvolution || 0) >= 0 ? "+" : ""}${int(row.netEvolution)}`
    ]),
    72,
    198,
    650,
    [0.22, 0.16, 0.16, 0.16, 0.16, 0.14],
    10
  );
  const chartsY = Math.max(tableBottom + 42, 404);
  drawHorizontalBarChart(doc, {
    title: "Sedes con mayor salida bruta",
    subtitle: "Porcentaje de activos que salieron en el mes, de mayor a menor.",
    x: 84,
    y: chartsY,
    width: 292,
    height: 120,
    data: rows.slice().sort((a: AnyRow, b: AnyRow) => Number(b.grossChurn || 0) - Number(a.grossChurn || 0)).map((row: AnyRow) => ({
      label: branchLabel(row.branchName),
      value: Number(row.grossChurn || 0)
    })),
    color: palette.red,
    valueFormatter: percent
  });
  drawLineChart(doc, {
    title: "Activos fin por mes",
    subtitle: "Evolucion mes a mes del total de miembros activos.",
    x: 430,
    y: chartsY,
    width: 292,
    height: 142,
    series: [{ name: "Activos", color: palette.teal, points: (evolution.monthlyTrend || []).map((row: AnyRow) => ({ label: row.label, value: row.activeEnd })) }],
    yFormatter: int
  });
}

function drawAdvisorLevelsPage(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  pageTitle(doc, "Distribucion de Asesores por Nivel", 36, "Cuantos asesores hay en cada escalon de comision y cuanto venden entre todos.");
  const rows = report.monthlyInsights?.advisorLevelDistribution ?? [];
  drawHorizontalBarChart(doc, {
    title: "Cantidad de asesores por escalon",
    subtitle: "Numero de asesores ubicados en cada nivel de comision.",
    x: 82,
    y: 108,
    width: 320,
    height: 222,
    data: rows.map((row: AnyRow) => ({ label: row.level, value: Number(row.advisors || 0) })),
    color: palette.blue,
    valueFormatter: int
  });
  drawHorizontalBarChart(doc, {
    title: "Venta mensual por escalon",
    subtitle: "Suma de ventas del mes de los asesores en cada nivel.",
    x: 448,
    y: 108,
    width: 292,
    height: 222,
    data: rows.map((row: AnyRow) => ({ label: row.level, value: Number(row.sales || 0) })),
    color: palette.teal,
    valueFormatter: compactMoney
  });
  drawTable(
    doc,
    ["Nivel", "Asesores", "Venta", "Comisiones"],
    rows.map((row: AnyRow) => [row.level, int(row.advisors), money(row.sales), money(row.commissions)]),
    156,
    376,
    480,
    [0.28, 0.18, 0.27, 0.27],
    12
  );
}

function drawDailyOpportunityPage(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  pageTitle(doc, "Dias Fuertes y Debiles", 36, "Los dias del mes con menor facturacion y el promedio de venta segun el dia de la semana.");
  drawHorizontalBarChart(doc, {
    title: "Dias con menor facturacion",
    subtitle: "Los dias del mes con menos ingreso, de menor a mayor.",
    x: 82,
    y: 112,
    width: 300,
    height: 202,
    data: (report.weakDays || []).map((row: AnyRow) => ({ label: row.label, value: row.sales })),
    color: palette.amber,
    valueFormatter: compactMoney
  });
  drawHorizontalBarChart(doc, {
    title: "Promedio por dia de semana",
    subtitle: "Venta promedio segun el dia de la semana en todo el periodo.",
    x: 448,
    y: 112,
    width: 292,
    height: 202,
    data: (report.monthlyInsights?.weekdayPerformance || []).map((row: AnyRow) => ({ label: row.weekday, value: row.avgSales })),
    color: palette.purple,
    valueFormatter: compactMoney
  });
  drawTable(
    doc,
    ["Dia semana", "Promedio venta", "Transacciones prom.", "Dias activos"],
    (report.monthlyInsights?.weekdayPerformance || []).map((row: AnyRow) => [
      row.weekday,
      money(row.avgSales),
      int(row.avgRows),
      int(row.activeDays)
    ]),
    140,
    366,
    520,
    [0.28, 0.28, 0.24, 0.2],
    10
  );
}

function drawPlanMixPage(doc: PDFKit.PDFDocument, report: AnyRow) {
  newPage(doc);
  pageTitle(doc, "Mix de Planes y Producto por Sede", 36, "Que familias de plan y medios de pago mueven la venta, y el plan estrella de cada sede.");
  const mix = report.monthlyInsights?.planFamilyMix ?? [];
  const topByBranch = report.monthlyInsights?.topPlansByBranch ?? [];
  drawHorizontalBarChart(doc, {
    title: "Mix mensual por familia de plan",
    subtitle: "Ingreso agrupado por familia de plan (mensual, duo, corporativo, etc.).",
    x: 82,
    y: 104,
    width: 300,
    height: 212,
    data: mix.map((row: AnyRow) => ({ label: row.family, value: row.sales })),
    color: palette.teal,
    valueFormatter: compactMoney
  });
  drawHorizontalBarChart(doc, {
    title: "Metodos de pago",
    subtitle: "Ingreso segun el medio de pago usado en la transaccion.",
    x: 448,
    y: 104,
    width: 292,
    height: 212,
    data: (report.monthlyInsights?.paymentMethods || []).map((row: AnyRow) => ({ label: row.name || "Sin metodo", value: row.sales })),
    color: palette.blue,
    valueFormatter: compactMoney
  });
  drawTable(
    doc,
    ["Sede", "Plan mayor ingreso", "Ingreso", "Plan mas vendido", "Ventas"],
    topByBranch.map((row: AnyRow) => [
      branchLabel(row.branchName),
      String(row.topRevenuePlan || "-").slice(0, 26),
      money(row.topRevenueSales),
      String(row.topVolumePlan || "-").slice(0, 26),
      int(row.topVolumeRows)
    ]),
    64,
    358,
    664,
    [0.16, 0.31, 0.15, 0.31, 0.07],
    10
  );
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
  const tableBottom = drawTable(doc, ["Mes", "Dinero ingresado", "% periodo", "Promedio diario", "Transacciones"], tableRows, 188, 150, 410, [0.2, 0.27, 0.15, 0.21, 0.17]);

  drawLineChart(doc, {
    title: `Rendimiento acumulado - dinero ingresado por mes`,
    subtitle: "Suma acumulada de ingresos desde enero hasta el mes seleccionado.",
    x: 74,
    y: tableBottom + 42,
    width: 650,
    height: 176,
    series: [{ name: "Total", color: palette.blue, points: months.map((row) => ({ label: row.label, value: row.sales })) }],
    yFormatter: compactMoney
  });
}

function drawBranchesPage(doc: PDFKit.PDFDocument, report: AnyRow, options: PdfReportOptions, months: AnyRow[]) {
  newPage(doc);
  pageTitle(doc, "Sedes", 38, "Ingreso acumulado del periodo por sede y su evolucion mes a mes.");
  const branches = report.annualByBranch.filter((row: AnyRow) => row.sales > 0).slice(0, 8);
  const total = sum(branches, "sales");
  const tableBottom = drawTable(
    doc,
    ["Sede", "Dinero ingresado", "% periodo", "Transacciones", "Ticket promedio"],
    branches.map((row: AnyRow) => [branchLabel(row.name), money(row.sales), percent(total ? row.sales / total : 0), int(row.rows), money(row.sales / Math.max(row.rows, 1))]),
    190,
    94,
    404,
    [0.23, 0.24, 0.16, 0.18, 0.19]
  );

  const chartsY = tableBottom + 40;
  drawHorizontalBarChart(doc, {
    title: "Ventas acumuladas por sede",
    subtitle: "Ingreso total del periodo, de mayor a menor sede.",
    x: 74,
    y: chartsY,
    width: 320,
    height: 200,
    data: branches.map((row: AnyRow) => ({ label: branchLabel(row.name), value: row.sales })),
    color: palette.teal,
    valueFormatter: compactMoney
  });

  drawMultiLineChart(doc, {
    title: "Rendimiento por sede",
    subtitle: "Ingreso mensual de cada sede, enero a " + options.monthName.toLowerCase() + ".",
    x: 438,
    y: chartsY,
    width: 286,
    height: 205,
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
    subtitle: "Ranking de asesores por ingreso acumulado del periodo, de mayor a menor.",
    x: 82,
    y: 128,
    width: 660,
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
  pageTitle(doc, "Rendimiento Diario Mensual", 36, "Como se movio la venta dia a dia y cuales fueron los dias de mejor facturacion.");
  const daily = report.dailyTrend || [];
  drawLineChart(doc, {
    title: `Rendimiento diario - ${options.monthName}`,
    subtitle: "Ingreso de cada dia del mes en curso.",
    x: 78,
    y: 126,
    width: 300,
    height: 202,
    series: [{ name: options.monthName, color: palette.blue, points: daily.map((row: AnyRow) => ({ label: String(row.day ?? row.label), value: row.sales })) }],
    yFormatter: compactMoney
  });
  drawHorizontalBarChart(doc, {
    title: "Dias de mayor facturacion",
    subtitle: "Los dias con mas ingreso del mes, de mayor a menor.",
    x: 430,
    y: 126,
    width: 290,
    height: 202,
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
  pageTitle(doc, "Rendimiento del Periodo de Planes", 36, "Ingreso, transacciones y ticket promedio de cada plan vendido en el periodo.");
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
  pageTitle(doc, "Graficos de Planes", 36, "Los planes que mas ingreso y mas transacciones generaron en el periodo.");
  drawHorizontalBarChart(doc, {
    title: "Top planes por dinero ingresado",
    subtitle: "Los 12 planes con mayor ingreso acumulado del periodo.",
    x: 92,
    y: 112,
    width: 300,
    height: 244,
    data: plans.slice(0, 12).map((row: AnyRow) => ({ label: row.name, value: row.sales })),
    color: palette.teal,
    valueFormatter: compactMoney
  });
  drawHorizontalBarChart(doc, {
    title: "Top planes por transacciones",
    subtitle: "Los 12 planes con mas ventas registradas del periodo.",
    x: 468,
    y: 112,
    width: 280,
    height: 244,
    data: plans.slice().sort((a: AnyRow, b: AnyRow) => Number(b.rows || 0) - Number(a.rows || 0)).slice(0, 12).map((row: AnyRow) => ({ label: row.name, value: row.rows })),
    color: palette.blue,
    valueFormatter: int
  });
}

function drawMonthlyDetailPage(doc: PDFKit.PDFDocument, report: AnyRow, options: PdfReportOptions, months: AnyRow[]) {
  newPage(doc);
  pageTitle(doc, "Detalle Mensual", 36, "Ventas frente a meta, mes a mes, desde enero hasta el mes seleccionado.");
  const tableBottom = drawTable(
    doc,
    ["Mes", "Ventas", "Meta", "Avance", "Ticket", "Transacciones"],
    months.map((row) => [row.label, money(row.sales), money(row.target), percent(row.progress), money(row.avgTicket), int(row.rows)]),
    120,
    104,
    552,
    [0.16, 0.2, 0.2, 0.14, 0.16, 0.14]
  );
  drawLineChart(doc, {
    title: `Ventas vs meta - Enero a ${options.monthName}`,
    subtitle: "Comparativo mensual entre lo vendido y la meta asignada.",
    x: 92,
    y: tableBottom + 42,
    width: 610,
    height: 214,
    series: [
      { name: "Ventas", color: palette.teal, points: months.map((row) => ({ label: row.label, value: row.sales })) },
      { name: "Meta", color: palette.red, points: months.map((row) => ({ label: row.label, value: row.target })) }
    ],
    yFormatter: compactMoney
  });
}

function drawScorePage(doc: PDFKit.PDFDocument, report: AnyRow, _options: PdfReportOptions) {
  newPage(doc);
  pageTitle(doc, "Scores Comerciales", 36, "Score comercial de cada sede y de los asesores con mejor desempeno del periodo.");
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(palette.ink).text("Score por sede", 80, 92);
  const branchTableBottom = drawTable(
    doc,
    ["Sede", "Venta mes", "Venta periodo", "Avance anual", "Score"],
    report.annualByBranch.slice(0, 12).map((row: AnyRow) => [branchLabel(row.name), money(row.monthlySales), money(row.sales), percent(row.annualProgress), scoreLabel(row.score)]),
    80,
    108,
    632,
    [0.22, 0.2, 0.2, 0.17, 0.21]
  );
  const advisorTableY = branchTableBottom + 30;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(palette.ink).text("Score por asesor", 66, advisorTableY - 16);
  drawTable(
    doc,
    ["Asesor", "Sede", "Venta mes", "Venta periodo", "Score"],
    report.annualByAdvisor.filter((row: AnyRow) => row.sales > 0).slice(0, 12).map((row: AnyRow) => [titleCase(row.name), branchLabel(row.branchName), money(row.monthlySales), money(row.sales), scoreLabel(row.score)]),
    66,
    advisorTableY,
    660,
    [0.28, 0.18, 0.18, 0.18, 0.18],
    12
  );
}

function drawQualityAndActionsPage(doc: PDFKit.PDFDocument, report: AnyRow, _options: PdfReportOptions) {
  newPage(doc);
  pageTitle(doc, "Calidad de Datos y Acciones", 36, "Estado de los datos cargados y las acciones que la plataforma prioriza para el equipo.");
  const quality = report.state.quality;
  const tableBottom = drawTable(
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
    100,
    610,
    [0.32, 0.18, 0.5]
  );
  doc.font("Helvetica-Bold").fontSize(14).fillColor(palette.ink).text("Acciones sugeridas por la plataforma", 92, tableBottom + 36);
  let y = tableBottom + 68;
  const itemWidth = 580;
  // Margen de seguridad generoso: preferible que un item pase a la pagina
  // siguiente un poco antes de lo estrictamente necesario a que quede
  // cortado entre el titulo (que cabia) y la descripcion (que ya no).
  const bottomLimit = PAGE.height - PAGE.margin - 70;
  for (const item of report.state.recommendations.slice(0, 6)) {
    const descText = `${item.metric}. ${item.detail}`;
    const descHeight = doc.font("Helvetica").fontSize(8).heightOfString(descText, { width: itemWidth, lineGap: 1 });
    // Se mide el alto real del texto (que puede envolver 1, 2 o 3 lineas)
    // antes de dibujar, así el bloque nunca queda cortado entre paginas ni
    // separa el titulo de su descripcion.
    const blockHeight = 15 + descHeight + 14;
    if (y + blockHeight > bottomLimit) {
      newPage(doc);
      y = PAGE.margin + 30;
    }
    doc.font("Helvetica-Bold").fontSize(9).fillColor(palette.ink).text(`${item.priority} - ${item.title}`, 104, y, { width: itemWidth });
    y += 15;
    doc.font("Helvetica").fontSize(8).fillColor(palette.muted).text(descText, 104, y, { width: itemWidth, lineGap: 1 });
    y += descHeight + 14;
  }
}

function drawGroqPage(doc: PDFKit.PDFDocument, options: PdfReportOptions) {
  newPage(doc);
  pageTitle(doc, "Sugerencias de Accion Guiadas por IA", 36, "Analisis generado por IA sobre el estado comercial del periodo y proximos pasos sugeridos.");
  const text = options.groqInsights?.trim() || "Groq no devolvio sugerencias para esta exportacion. Verifica que la clave este configurada y vuelve a generar el PDF con la opcion de IA activa.";
  paragraph(doc, cleanMarkdown(text), 80, 100, 10, 640);
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

function pageTitle(doc: PDFKit.PDFDocument, title: string, y: number, subtitle?: string) {
  doc.font("Helvetica-Bold").fontSize(18).fillColor(palette.ink).text(title, PAGE.margin, y, {
    width: contentWidth(doc),
    align: "center"
  });
  if (subtitle) {
    doc.font("Helvetica").fontSize(9).fillColor(palette.muted).text(subtitle, PAGE.margin, y + 24, {
      width: contentWidth(doc),
      align: "center"
    });
  }
}

// Etiqueta breve debajo del titulo de un grafico o tabla, para que quede claro
// que se esta analizando sin depender solo del titulo. Se dibuja dentro del
// mismo bloque reservado para el titulo (no agrega alto extra al layout).
function chartSubtitle(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number) {
  doc.font("Helvetica").fontSize(6.6);
  doc.fillColor(palette.muted).text(truncateToWidth(doc, text, width), x, y, {
    width,
    align: "center",
    lineBreak: false
  });
}

// Trunca manualmente a "…" segun el ancho real (con la fuente/tamano ya
// seteados en doc) en vez de depender de lineBreak+ellipsis de pdfkit, que en
// esta version puede seguir envolviendo el texto a 2-3 lineas en vez de
// truncar a una sola (causaba que las etiquetas de leyenda quedaran una
// encima de otra).
function truncateToWidth(doc: PDFKit.PDFDocument, text: string, maxWidth: number) {
  if (doc.widthOfString(text) <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, mid)}…`;
    if (doc.widthOfString(candidate) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low > 0 ? `${text.slice(0, low)}…` : "…";
}

function paragraph(doc: PDFKit.PDFDocument, text: string, x: number, y: number, size = 8.5, width = contentWidth(doc)) {
  doc.font("Helvetica").fontSize(size).fillColor("#111111").text(text, x, y, {
    width,
    lineGap: 1.5
  });
}

function drawKpiCards(doc: PDFKit.PDFDocument, cards: string[][], x: number, y: number, width: number) {
  const gap = 10;
  const cardWidth = (width - gap * (cards.length - 1)) / Math.max(cards.length, 1);
  cards.forEach((card, index) => {
    const px = x + index * (cardWidth + gap);
    doc.roundedRect(px, y, cardWidth, 74, 6).fillAndStroke("#f7f9fb", palette.line);
    doc.font("Helvetica").fontSize(7.2).fillColor(palette.muted).text(card[0] ?? "", px + 10, y + 11, {
      width: cardWidth - 20
    });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(palette.ink).text(card[1] ?? "", px + 10, y + 31, {
      width: cardWidth - 20
    });
    doc.font("Helvetica").fontSize(7).fillColor(palette.muted).text(card[2] ?? "", px + 10, y + 54, {
      width: cardWidth - 20
    });
  });
}

// Devuelve el Y donde termina la tabla (header + filas dibujadas) para que el
// elemento siguiente (grafico, texto) se pueda posicionar de forma dinamica
// en vez de un offset fijo que asume una cantidad de filas que puede no
// coincidir con los datos reales del mes.
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
  const drawnRows = rows.slice(0, maxRows);
  drawnRows.forEach((row, index) => {
    drawTableRow(doc, row, x, y + heights.header + index * heights.row, colWidths, heights.row, false, index % 2 === 1);
  });
  return y + heights.header + drawnRows.length * heights.row;
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
  config: { title: string; subtitle?: string; x: number; y: number; width: number; height: number; data: Array<{ label: string; value: number }>; color: string; valueFormatter: (value: number) => string }
) {
  const data = config.data.filter((item) => Number(item.value || 0) > 0);
  if (!data.length) return;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text(config.title, config.x, config.y - (config.subtitle ? 24 : 16), {
    width: config.width,
    align: "center"
  });
  if (config.subtitle) chartSubtitle(doc, config.subtitle, config.x, config.y - 11, config.width);
  const labelWidth = Math.min(150, config.width * 0.38);
  const chartX = config.x + labelWidth;
  const chartWidth = config.width - labelWidth - 8;
  const rowGap = 6;
  const rowHeight = Math.max(11, Math.min(15, (config.height - rowGap * (data.length - 1) - 8) / data.length));
  // Con pocas categorias (p.ej. un solo nivel de comision), un marco del alto
  // completo dejaba una caja casi vacia debajo de la unica barra. El alto
  // efectivo se ajusta al contenido real sin superar el espacio asignado.
  const contentHeight = data.length * rowHeight + Math.max(0, data.length - 1) * rowGap + 8;
  const chartHeight = Math.min(config.height, Math.max(28, contentHeight));
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  doc.rect(chartX, config.y, chartWidth, chartHeight).strokeColor("#222222").lineWidth(0.7).stroke();
  for (let i = 0; i <= 4; i += 1) {
    const gx = chartX + (chartWidth / 4) * i;
    doc.moveTo(gx, config.y).lineTo(gx, config.y + chartHeight).strokeColor("#e5e7eb").lineWidth(0.4).stroke();
  }
  data.forEach((item, index) => {
    const rowY = config.y + index * (rowHeight + rowGap) + 4;
    const label = String(item.label || "").slice(0, 28);
    const value = Number(item.value || 0);
    doc.font("Helvetica").fontSize(6.2).fillColor("#111111").text(label, config.x, rowY - 1, {
      width: labelWidth - 6,
      align: "right",
      height: rowHeight + 2,
      lineBreak: false
    });
    doc.rect(chartX, rowY, Math.max(1, (value / max) * (chartWidth - 8)), rowHeight).fill(config.color);
  });
  doc.font("Helvetica").fontSize(6.5).fillColor("#111111").text(config.valueFormatter(max), chartX + chartWidth - 52, config.y + chartHeight + 5, { width: 52, align: "right" });
}

function drawLineChart(
  doc: PDFKit.PDFDocument,
  config: { title: string; subtitle?: string; x: number; y: number; width: number; height: number; series: Array<{ name: string; color: string; points: Array<{ label: string; value: number }> }>; yFormatter: (value: number) => string }
) {
  const labels = config.series[0]?.points.map((point) => point.label) || [];
  const values = config.series.flatMap((serie) => serie.points.map((point) => Number(point.value || 0)));
  const max = Math.max(...values, 1);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(config.title, config.x, config.y - (config.subtitle ? 32 : 22), {
    width: config.width,
    align: "center"
  });
  if (config.subtitle) chartSubtitle(doc, config.subtitle, config.x, config.y - 17, config.width);
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
  // Con una sola serie el titulo ya dice que se mide; con 2+ series (p.ej.
  // "Ventas" vs "Meta") hace falta la leyenda para saber que linea es cual.
  if (config.series.length > 1) {
    let lx = config.x + config.width - 8;
    const entries = config.series.map((serie) => ({
      serie,
      width: doc.font("Helvetica").fontSize(7).widthOfString(serie.name) + 14
    }));
    lx -= sum(entries.map((entry) => entry.width));
    entries.forEach(({ serie, width }) => {
      doc.rect(lx, config.y + 7, 7, 7).fill(serie.color);
      doc.font("Helvetica").fontSize(7).fillColor("#111111").text(serie.name, lx + 11, config.y + 6.5, { width: width - 14, lineBreak: false });
      lx += width;
    });
  }
}

function drawMultiLineChart(
  doc: PDFKit.PDFDocument,
  config: { title: string; subtitle?: string; x: number; y: number; width: number; height: number; labels: string[]; series: Array<{ name: string; color: string; values: number[] }>; yFormatter: (value: number) => string }
) {
  const values = config.series.flatMap((serie) => serie.values.map((value) => Number(value || 0)));
  const max = Math.max(...values, 1);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text(config.title, config.x, config.y - (config.subtitle ? 24 : 16), {
    width: config.width,
    align: "center"
  });
  if (config.subtitle) chartSubtitle(doc, config.subtitle, config.x, config.y - 11, config.width);
  drawChartFrame(doc, config.x, config.y, config.width, config.height);
  const legendWidth = 58;
  const plot = chartPlot(config.x, config.y, config.width - legendWidth, config.height);
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
  // Una linea por serie, sin wrap: con wrap habilitado un nombre largo (p.ej.
  // "PRADO VERANIEGO") ocupaba 2-3 lineas pero el siguiente item avanzaba un
  // paso fijo, así que las etiquetas de la leyenda quedaban unas sobre otras.
  let ly = config.y + 10;
  const legendRowHeight = 12;
  const maxLegendRows = Math.max(1, Math.floor((config.height - 14) / legendRowHeight));
  doc.font("Helvetica").fontSize(5.8);
  config.series.slice(0, maxLegendRows).forEach((serie) => {
    doc.rect(config.x + config.width - legendWidth + 4, ly, 6, 6).fill(serie.color);
    doc.fillColor("#111111").text(truncateToWidth(doc, serie.name, legendWidth - 15), config.x + config.width - legendWidth + 13, ly - 1, {
      width: legendWidth - 15,
      lineBreak: false
    });
    ly += legendRowHeight;
  });
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

const MONTH_ABBREVIATIONS: Record<string, string> = {
  Enero: "Ene",
  Febrero: "Feb",
  Marzo: "Mar",
  Abril: "Abr",
  Mayo: "May",
  Junio: "Jun",
  Julio: "Jul",
  Agosto: "Ago",
  Septiembre: "Sep",
  Octubre: "Oct",
  Noviembre: "Nov",
  Diciembre: "Dic"
};

function drawXAxisLabels(doc: PDFKit.PDFDocument, labels: string[], x: number, y: number, width: number) {
  labels.forEach((label, index) => {
    const px = x + (index * width) / Math.max(labels.length - 1, 1);
    const text = MONTH_ABBREVIATIONS[String(label)] ?? String(label).slice(0, 5);
    doc.font("Helvetica").fontSize(6.4).fillColor("#111111").text(text, px - 16, y, {
      width: 32,
      align: "center"
    });
  });
}

function drawFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(7.5).fillColor(palette.muted).text(`Pagina ${i + 1}`, PAGE.width - 78, PAGE.height - PAGE.margin - 10, {
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

function precisePercent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}
