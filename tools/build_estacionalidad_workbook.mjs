import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/chval/OneDrive/Escritorio/PLATAFORMA GESTION/outputs/estacionalidad_consolidado";
const inputPath = `${outputDir}/estacionalidad_data.json`;
const outputPath = `${outputDir}/Historico Estacionalidad HYL.xlsx`;

const data = JSON.parse(await fs.readFile(inputPath, "utf8"));

const workbook = Workbook.create();

function aoaFromObjects(rows, columns) {
  return [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => {
      const value = row[column.key];
      return value === undefined ? null : value;
    })),
  ];
}

function colLetter(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function writeTable(sheet, startCell, name, rows, columns) {
  const values = aoaFromObjects(rows, columns);
  const rowCount = Math.max(values.length, 2);
  const colCount = columns.length;
  const range = sheet.getRangeByIndexes(0, 0, rowCount, colCount);
  range.values = values.length === 1 ? [...values, columns.map(() => null)] : values;
  const tableRange = `A1:${colLetter(colCount - 1)}${rowCount}`;
  const table = sheet.tables.add(tableRange, true, name);
  table.style = "TableStyleMedium2";
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
  sheet.getRange(`A1:${colLetter(colCount - 1)}1`).format = {
    fill: "#1F4E79",
    font: { bold: true, color: "#FFFFFF" },
  };
  sheet.getRange(tableRange).format.autofitColumns();
  sheet.getRange(tableRange).format.autofitRows();
  return table;
}

function applyNumberFormats(sheet, columns, rowCount) {
  if (rowCount < 2) return;
  columns.forEach((column, index) => {
    if (!column.format) return;
    const letter = colLetter(index);
    sheet.getRange(`${letter}2:${letter}${rowCount}`).format.numberFormat = column.format;
  });
}

function summarizeByPeriod(rows, entityKey, valueKey) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.periodo}|${row[entityKey] || ""}`;
    if (!map.has(key)) {
      map.set(key, {
        periodo: row.periodo,
        anio: row.anio,
        mes_num: row.mes_num,
        entidad: row[entityKey] || "",
        ejecutado_total: 0,
        registros: 0,
      });
    }
    const item = map.get(key);
    item.ejecutado_total += Number(row[valueKey] || 0);
    item.registros += 1;
  }
  return Array.from(map.values()).sort((a, b) => `${a.periodo}${a.entidad}`.localeCompare(`${b.periodo}${b.entidad}`));
}

const summary = workbook.worksheets.add("Resumen");
summary.showGridLines = false;
summary.getRange("A1:H1").merge();
summary.getRange("A1").values = [["Historico de estacionalidad H&L GYM"]];
summary.getRange("A1").format = {
  fill: "#17365D",
  font: { bold: true, color: "#FFFFFF", size: 16 },
};
summary.getRange("A3:B8").values = [
  ["Metrica", "Valor"],
  ...data.resumen.map((item) => [item.metrica, item.valor]),
];
summary.getRange("A3:B3").format = {
  fill: "#1F4E79",
  font: { bold: true, color: "#FFFFFF" },
};
summary.getRange("A3:B8").format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };
summary.getRange("D3:H10").values = [
  ["Uso recomendado", null, null, null, null],
  ["Historico gerencial agregado: metas, ejecutado, ranking y usuarios activos.", null, null, null, null],
  ["No reemplaza un historico transaccional de ventas por cliente/factura.", null, null, null, null],
  ["Los nombres fueron normalizados, pero se conserva el valor original y archivo fuente.", null, null, null, null],
  ["Los temporales de Excel ~$ fueron ignorados.", null, null, null, null],
  ["En usuarios activos se estima la fecha usando el mes del archivo cuando la etiqueta del dia no es confiable.", null, null, null, null],
  [null, null, null, null, null],
  ["Hojas incluidas: Cobertura, Ranking Sedes, Ranking Asesores, Usuarios Activos, Sedes Mes.", null, null, null, null],
];
summary.getRange("D3:H3").merge();
summary.getRange("D4:H10").merge(true);
summary.getRange("D3:H10").format = {
  fill: "#F2F6FA",
  font: { color: "#1F2937" },
  wrapText: true,
};
summary.getRange("A3:B8").format.autofitColumns();
summary.getRange("D3:H10").format.rowHeight = 30;

const coberturaCols = [
  { key: "periodo", label: "Periodo" },
  { key: "anio", label: "Anio" },
  { key: "mes_num", label: "Mes Num" },
  { key: "mes", label: "Mes" },
  { key: "archivo", label: "Archivo" },
  { key: "hojas", label: "Hojas" },
  { key: "tiene_dia_a_dia", label: "Tiene Dia a Dia" },
  { key: "tiene_ranking_sede", label: "Tiene Ranking Sede" },
  { key: "registros_ranking_sede", label: "Reg Ranking Sede" },
  { key: "tiene_ranking_asesores", label: "Tiene Ranking Asesores" },
  { key: "registros_ranking_asesores", label: "Reg Ranking Asesores" },
  { key: "tiene_usuarios_activos", label: "Tiene Usuarios Activos" },
  { key: "registros_usuarios_activos", label: "Reg Usuarios Activos" },
  { key: "fuente_archivo", label: "Fuente Archivo" },
];
const cobertura = workbook.worksheets.add("Cobertura");
writeTable(cobertura, "A1", "tblCobertura", data.cobertura, coberturaCols);

const rankCols = [
  { key: "periodo", label: "Periodo" },
  { key: "anio", label: "Anio" },
  { key: "mes_num", label: "Mes Num" },
  { key: "mes", label: "Mes" },
  { key: "entidad_normalizada", label: "Entidad Normalizada" },
  { key: "entidad_original", label: "Entidad Original" },
  { key: "puesto", label: "Puesto" },
  { key: "ejecutado_total", label: "Ejecutado Total", format: "#,##0" },
  { key: "presupuesto", label: "Presupuesto", format: "#,##0" },
  { key: "meta_1", label: "Meta 1", format: "#,##0" },
  { key: "meta_1_5", label: "Meta 1.5", format: "#,##0" },
  { key: "meta_2", label: "Meta 2", format: "#,##0" },
  { key: "meta_2_5", label: "Meta 2.5", format: "#,##0" },
  { key: "meta_3", label: "Meta 3", format: "#,##0" },
  { key: "meta_4", label: "Meta 4", format: "#,##0" },
  { key: "porcentaje_cumplimiento", label: "% Cumplimiento", format: "0.0%" },
  { key: "porcentaje_a_hoy", label: "% A Hoy", format: "0.0%" },
  { key: "diferencia_porcentaje", label: "Diferencia %", format: "0.0%" },
  { key: "valor_a_hoy", label: "$ A Hoy", format: "#,##0" },
  { key: "hoja", label: "Hoja" },
  { key: "fila_origen", label: "Fila Origen" },
  { key: "formula_ejecutado", label: "Formula Ejecutado" },
  { key: "fuente_archivo", label: "Fuente Archivo" },
];

const rankSedes = workbook.worksheets.add("Ranking Sedes");
writeTable(rankSedes, "A1", "tblRankingSedes", data.ranking_sedes, rankCols);
applyNumberFormats(rankSedes, rankCols, data.ranking_sedes.length + 1);

const rankAsesores = workbook.worksheets.add("Ranking Asesores");
writeTable(rankAsesores, "A1", "tblRankingAsesores", data.ranking_asesores, rankCols);
applyNumberFormats(rankAsesores, rankCols, data.ranking_asesores.length + 1);

const activosCols = [
  { key: "periodo", label: "Periodo" },
  { key: "anio", label: "Anio" },
  { key: "mes_num", label: "Mes Num" },
  { key: "mes", label: "Mes" },
  { key: "fecha_estimada", label: "Fecha Estimada" },
  { key: "dia", label: "Dia" },
  { key: "fecha_original", label: "Fecha Original" },
  { key: "sede_normalizada", label: "Sede Normalizada" },
  { key: "sede_original", label: "Sede Original" },
  { key: "usuarios_activos", label: "Usuarios Activos", format: "#,##0" },
  { key: "hoja", label: "Hoja" },
  { key: "fila_origen", label: "Fila Origen" },
  { key: "formula_valor", label: "Formula Valor" },
  { key: "fuente_archivo", label: "Fuente Archivo" },
];
const activos = workbook.worksheets.add("Usuarios Activos");
writeTable(activos, "A1", "tblUsuariosActivos", data.usuarios_activos, activosCols);
applyNumberFormats(activos, activosCols, data.usuarios_activos.length + 1);

const sedesMesRows = summarizeByPeriod(data.ranking_sedes, "entidad_normalizada", "ejecutado_total");
const sedesMesCols = [
  { key: "periodo", label: "Periodo" },
  { key: "anio", label: "Anio" },
  { key: "mes_num", label: "Mes Num" },
  { key: "entidad", label: "Sede" },
  { key: "ejecutado_total", label: "Ejecutado Total", format: "#,##0" },
  { key: "registros", label: "Registros" },
];
const sedesMes = workbook.worksheets.add("Sedes Mes");
writeTable(sedesMes, "A1", "tblSedesMes", sedesMesRows, sedesMesCols);
applyNumberFormats(sedesMes, sedesMesCols, sedesMesRows.length + 1);

for (const sheet of [cobertura, rankSedes, rankAsesores, activos, sedesMes]) {
  const used = sheet.getUsedRange();
  used.format.wrapText = false;
}

await fs.mkdir(outputDir, { recursive: true });

const preview = await workbook.render({
  sheetName: "Resumen",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${outputDir}/preview_resumen.png`, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);

console.log(`OK ${outputPath}`);
console.log(`Cobertura: ${data.cobertura.length}`);
console.log(`Ranking sedes: ${data.ranking_sedes.length}`);
console.log(`Ranking asesores: ${data.ranking_asesores.length}`);
console.log(`Usuarios activos: ${data.usuarios_activos.length}`);
