// Evolucion mensual de clientes por sede, exportada de EVO (enero-agosto 2026).
// Columnas de cada fila: sede, activo inicio, nuevos, renovados, reinscripciones, regresos de suspension,
// total de entradas, bajas, vencidos, no renovados, suspendidos, total de salidas, activos fin.
export type EvolutionSeedRow = [string, number, number, number, number, number, number, number, number, number, number, number, number];
export const EVOLUTION_SEED: Array<{ year: number; month: number; file: string; rows: EvolutionSeedRow[] }> = [
  {
    year: 2026,
    month: 1,
    file: "EVOLUCION ENERO 26.xlsx",
    rows: [
      ["1 - HYL PRADO VERANIEGO",27,95,0,0,0,95,0,0,24,0,24,98],
      ["2 - HYL VILLAVICENCIO",181,126,0,0,0,126,0,0,0,0,0,307],
      ["3 - HYL BUENOS AIRES",854,590,0,0,0,590,0,0,216,0,216,1228],
      ["4 - HYL MODELIA",1319,997,0,2,0,999,0,0,288,0,288,2030],
      ["6 - HYL COLORS 162",416,392,0,0,0,392,0,0,112,2,114,694],
      ["7 - HYL SANTA MATILDE",416,383,0,0,0,383,0,0,110,0,110,689],
      ["8 - HYL VILLA MAYOR",0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },
  {
    year: 2026,
    month: 2,
    file: "EVOLUCION FEBRERO 26.xlsx",
    rows: [
      ["1 - HYL PRADO VERANIEGO",98,974,0,1,0,975,0,10,77,0,87,986],
      ["2 - HYL VILLAVICENCIO",307,586,1,1,0,588,0,0,0,0,0,895],
      ["3 - HYL BUENOS AIRES",1228,412,0,0,0,412,0,0,288,0,288,1352],
      ["4 - HYL MODELIA",2030,919,0,0,0,919,0,0,414,0,414,2535],
      ["6 - HYL COLORS 162",694,423,0,2,2,427,0,0,204,0,204,917],
      ["7 - HYL SANTA MATILDE",689,369,0,0,0,369,0,0,171,0,171,887],
      ["8 - HYL VILLA MAYOR",0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },
  {
    year: 2026,
    month: 3,
    file: "EVOLUCION MARZO 26.xlsx",
    rows: [
      ["1 - HYL PRADO VERANIEGO",986,275,10,13,0,298,0,10,87,19,116,1168],
      ["2 - HYL VILLAVICENCIO",895,692,0,0,0,692,0,39,215,3,257,1330],
      ["3 - HYL BUENOS AIRES",1352,468,0,12,0,480,0,33,338,9,380,1452],
      ["4 - HYL MODELIA",2535,907,0,52,0,959,0,0,599,27,626,2868],
      ["6 - HYL COLORS 162",917,427,0,35,0,462,0,0,268,14,282,1097],
      ["7 - HYL SANTA MATILDE",887,415,0,24,0,439,0,34,218,17,269,1057],
      ["8 - HYL VILLA MAYOR",0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },
  {
    year: 2026,
    month: 4,
    file: "EVOLUCION ABRIL 26.xlsx",
    rows: [
      ["1 - HYL PRADO VERANIEGO",1168,224,14,20,18,276,0,22,111,10,143,1301],
      ["2 - HYL VILLAVICENCIO",1330,352,41,7,3,403,5,40,365,4,414,1319],
      ["3 - HYL BUENOS AIRES",1452,82,40,90,13,225,3,30,297,12,342,1335],
      ["4 - HYL MODELIA",2868,179,0,287,37,503,5,0,572,18,595,2776],
      ["6 - HYL COLORS 162",1097,82,0,149,22,253,1,0,249,7,257,1093],
      ["7 - HYL SANTA MATILDE",1057,107,36,80,26,249,0,22,196,11,229,1077],
      ["8 - HYL VILLA MAYOR",0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },
  {
    year: 2026,
    month: 5,
    file: "EVOLUCION MAYO 26.xlsx",
    rows: [
      ["1 - HYL PRADO VERANIEGO",1301,219,29,24,8,280,3,30,441,10,484,1097],
      ["2 - HYL VILLAVICENCIO",1319,223,39,31,4,297,1,56,353,6,416,1200],
      ["3 - HYL BUENOS AIRES",1335,61,33,90,12,196,2,32,177,14,225,1306],
      ["4 - HYL MODELIA",2776,196,0,263,15,474,8,0,492,31,531,2719],
      ["6 - HYL COLORS 162",1093,123,0,114,10,247,2,0,240,14,256,1084],
      ["7 - HYL SANTA MATILDE",1077,86,25,71,13,195,2,28,171,8,209,1063],
      ["8 - HYL VILLA MAYOR",0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },
  {
    year: 2026,
    month: 6,
    file: "EVOLUCION JUNIO 26.xlsx",
    rows: [
      ["1 - HYL PRADO VERANIEGO",1097,207,40,51,13,311,5,34,166,24,229,1179],
      ["2 - HYL VILLAVICENCIO",1200,230,58,52,6,346,0,55,293,8,356,1190],
      ["3 - HYL BUENOS AIRES",1306,66,35,131,14,246,4,32,152,29,217,1335],
      ["4 - HYL MODELIA",2719,155,0,297,31,483,10,0,396,67,473,2729],
      ["6 - HYL COLORS 162",1084,78,0,151,13,242,4,0,210,26,240,1086],
      ["7 - HYL SANTA MATILDE",1063,84,29,89,8,210,4,33,169,23,229,1044],
      ["8 - HYL VILLA MAYOR",0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },
  {
    year: 2026,
    month: 7,
    file: "EVOLUCION JULIO 26.xlsx",
    rows: [
      ["1 - HYL PRADO VERANIEGO",1179,204,33,56,24,317,4,22,259,8,293,1203],
      ["2 - HYL VILLAVICENCIO",1190,222,49,78,6,355,2,44,409,10,465,1080],
      ["3 - HYL BUENOS AIRES",1335,74,35,146,28,283,6,40,299,15,360,1258],
      ["4 - HYL MODELIA",2729,210,0,334,60,604,19,0,716,30,765,2568],
      ["6 - HYL COLORS 162",1086,137,0,156,21,314,3,0,277,11,291,1109],
      ["7 - HYL SANTA MATILDE",1044,96,39,122,17,274,1,30,279,6,316,1002],
      ["8 - HYL VILLA MAYOR",0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },
  {
    year: 2026,
    month: 8,
    file: "EVOLUCION AGOSTO 26.xlsx",
    rows: [
      ["1 - HYL PRADO VERANIEGO",1203,189,22,59,10,280,0,113,192,8,313,1170],
      ["2 - HYL VILLAVICENCIO",1080,241,42,105,11,399,3,182,192,3,380,1099],
      ["3 - HYL BUENOS AIRES",1258,62,41,117,15,235,1,122,131,15,269,1224],
      ["4 - HYL MODELIA",2568,175,0,333,33,541,1,0,515,17,533,2576],
      ["6 - HYL COLORS 162",1109,83,0,151,12,246,1,0,309,17,327,1028],
      ["7 - HYL SANTA MATILDE",1002,85,34,111,4,234,0,122,156,10,288,948],
      ["8 - HYL VILLA MAYOR",0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  }
];
