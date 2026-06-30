import { loadLocalEnv, resolveFromRoot } from "./env";
import { migrate } from "./schema";
import { resetDbFile } from "./db";
import { dbSnapshotCounts, seedFromWorkbooks } from "./importers";

loadLocalEnv();

async function main() {
  if (process.argv.includes("--reset")) {
    await resetDbFile();
  }
  await migrate();
  await seedFromWorkbooks({
    salesXlsx: resolveFromRoot(process.env.SEED_SALES_XLSX, "C:/Users/chval/OneDrive/Escritorio/VENTAS/VENTAS JUNIO/VENTAS GENERALES.xlsx"),
    commissionsXlsx: resolveFromRoot(
      process.env.SEED_COMMISSIONS_XLSX,
      "C:/Users/chval/OneDrive/Escritorio/VENTAS/VENTAS JUNIO/INFORMES/Control_Comisiones_Anual_2026_FINAL.xlsx"
    ),
    pricingXlsx: resolveFromRoot(
      process.env.SEED_PRICING_XLSX,
      "C:/Users/chval/OneDrive/Escritorio/VENTAS/VENTAS JUNIO/Metas/METAS, PRECIOS, ESTRATEGIAS, TARIFAS BOLD HYL.xlsx"
    )
  });
  const snapshot = await dbSnapshotCounts();
  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
