import { describe, expect, it } from "vitest";
import {
  asNumber,
  classifyPlace,
  detectPriceChanges,
  extractJson,
  findAllByName,
  findBrand,
  findByName,
  haversineMeters,
  htmlToText,
  isAllowedMapsUrl,
  isColombiaCoordinate,
  isPublicHttpUrl,
  monthlyEquivalent,
  normalizeName,
  parseMapsUrl
} from "../src/shared/competition";

describe("ubicacion", () => {
  it("lee las coordenadas del lugar en un enlace largo de Google Maps", () => {
    const url = "https://www.google.com/maps/place/Health+%26+Life+Gym+Modelia/@4.6646438,-74.121338,17z/data=!3m1!4b1!4m6!3m5!1s0x8e3f:0x34ed!8m2!3d4.6646438!4d-74.1187631!16s%2Fg%2F11bbr9j0fk";
    const parsed = parseMapsUrl(url);
    expect(parsed?.lat).toBeCloseTo(4.6646438, 6);
    expect(parsed?.lng).toBeCloseTo(-74.1187631, 6);
    expect(parsed?.name).toContain("Modelia");
  });

  it("acepta el formato @lat,lng y q=lat,lng y rechaza coordenadas fuera de Colombia", () => {
    expect(parseMapsUrl("https://www.google.com/maps/@4.71,-74.07,15z")).toMatchObject({ lat: 4.71, lng: -74.07 });
    expect(parseMapsUrl("https://www.google.com/maps?q=4.11,-73.6")).toMatchObject({ lat: 4.11, lng: -73.6 });
    expect(parseMapsUrl("https://www.google.com/maps/@40.4,-3.7,15z")).toBeNull();
    expect(isColombiaCoordinate(4.6, -74.1)).toBe(true);
    expect(isColombiaCoordinate(-74.1, 4.6)).toBe(false);
  });

  it("solo permite enlaces de Google Maps", () => {
    expect(isAllowedMapsUrl("https://maps.app.goo.gl/abc")).toBe(true);
    expect(isAllowedMapsUrl("https://www.google.com/maps/place/x")).toBe(true);
    expect(isAllowedMapsUrl("https://www.google.com/search?q=x")).toBe(false);
    expect(isAllowedMapsUrl("http://localhost:4310/maps")).toBe(false);
    expect(isAllowedMapsUrl("https://evil.example.com/maps")).toBe(false);
  });

  it("calcula la distancia entre dos sedes", () => {
    const modelia = { lat: 4.6646438, lng: -74.1187631 };
    const santaMatilde = { lat: 4.6021895, lng: -74.1106567 };
    const meters = haversineMeters(modelia, santaMatilde);
    expect(meters).toBeGreaterThan(6800);
    expect(meters).toBeLessThan(7200);
    expect(haversineMeters(modelia, modelia)).toBe(0);
  });
});

describe("clasificacion y coincidencias", () => {
  it("clasifica gimnasios, indirectos y descarta colegios", () => {
    expect(classifyPlace("Bodytech").kind).toBe("directo");
    expect(classifyPlace("Crossfit Team Ellite").segment).toBe("Funcional / CrossFit");
    expect(classifyPlace("Pilates & Workout").kind).toBe("indirecto");
    expect(classifyPlace("Academia de Tae Kwon-Do Yoo-sin").kind).toBe("indirecto");
    expect(classifyPlace("Gimnasio Nuevo Modelia").kind).toBe("descartar");
    expect(classifyPlace("").kind).toBe("descartar");
  });

  it("encuentra competidores existentes por nombre sin importar tildes ni mayusculas", () => {
    const records = [{ id: 1, name: "Bodytech Modelia" }, { id: 2, name: "Smart Fit Suba" }];
    expect(findByName("BODYTECH", records)?.id).toBe(1);
    expect(findByName("smartfit suba", records)).toBeNull();
    expect(findByName("Smart Fit Suba", records)?.id).toBe(2);
    expect(findByName("Curves", records)).toBeNull();
    expect(normalizeName("  Áreas Fítness! ")).toBe("areas fitness");
  });

  it("asocia un lugar con el perfil de su cadena por alias", () => {
    const brands = [{ name: "Smart Fit", aliases: ["smartfit"] }, { name: "Bodytech", aliases: [] }];
    expect(findBrand("SmartFit Calle 80", brands)?.name).toBe("Smart Fit");
    expect(findBrand("Bodytech", brands)?.name).toBe("Bodytech");
    expect(findBrand("Gimnasio Central", brands)).toBeNull();
  });
});

describe("precios", () => {
  it("convierte precios por periodo a valor mensual", () => {
    expect(monthlyEquivalent(460000, "semestre")).toBe(76667);
    expect(monthlyEquivalent(650000, "año", 13)).toBe(50000);
    expect(monthlyEquivalent(99000, "mes")).toBe(99000);
    expect(monthlyEquivalent(0, "mes")).toBeNull();
    expect(monthlyEquivalent(500, "periodo raro")).toBeNull();
    expect(monthlyEquivalent(69900, "ano", 12)).toBeNull();
  });

  it("agrupa las sedes de una misma cadena con el mismo nombre", () => {
    const records = [{ id: 1, name: "Bodytech" }, { id: 2, name: "Bodytech" }, { id: 3, name: "Bodytech Suba" }, { id: 4, name: "Curves" }];
    expect(findAllByName("Bodytech", records).map((r) => r.id)).toEqual([1, 2]);
    expect(findAllByName("Bodytech Modelia", records).map((r) => r.id)).toEqual([1, 2]);
    expect(findAllByName("Otro", records)).toEqual([]);
  });

  it("interpreta numeros en formato colombiano", () => {
    expect(asNumber("$99.000")).toBe(99000);
    expect(asNumber("1.250.000")).toBe(1250000);
    expect(asNumber(69900)).toBe(69900);
    expect(asNumber("sin dato")).toBeNull();
  });

  it("detecta cambios de precio, promocion, planes nuevos y retirados", () => {
    const before = [
      { planName: "Black", monthlyPrice: 119900, promo: "" },
      { planName: "Fit", monthlyPrice: 69900, promo: "Primer mes gratis" },
      { planName: "Smart", monthlyPrice: 89900, promo: "" }
    ];
    const after = [
      { planName: "black", monthlyPrice: 109900, promo: "" },
      { planName: "Fit", monthlyPrice: 69900, promo: "50% primer mes" },
      { planName: "Premium", monthlyPrice: 150000, promo: "" }
    ];
    const kinds = detectPriceChanges(before, after).map((change) => `${change.kind}:${change.planName}`);
    expect(kinds).toEqual(["precio:black", "promocion:Fit", "plan_nuevo:Premium", "plan_retirado:Smart"]);
    expect(detectPriceChanges(before, before)).toEqual([]);
  });
});

describe("lectura de paginas y respuestas de IA", () => {
  it("convierte HTML en texto sin scripts ni estilos", () => {
    const text = htmlToText("<html><style>a{}</style><script>var x=1</script><h1>Planes</h1><p>Mensual &amp; anual</p><li>$99.000</li></html>");
    expect(text).toContain("Planes");
    expect(text).toContain("Mensual & anual");
    expect(text).toContain("$99.000");
    expect(text).not.toContain("var x");
  });

  it("extrae JSON aunque venga con texto y bloque de codigo", () => {
    expect(extractJson('Aqui va:\n```json\n{"a":[1,2],"b":"}"}\n```\nlisto')).toEqual({ a: [1, 2], b: "}" });
    expect(extractJson("[1,2,3] extra")).toEqual([1, 2, 3]);
    expect(extractJson("sin json")).toBeNull();
    expect(extractJson('{"roto": ')).toBeNull();
  });

  it("solo permite leer paginas publicas", () => {
    expect(isPublicHttpUrl("https://www.smartfit.com.co/planes")).toBe(true);
    expect(isPublicHttpUrl("http://localhost:4310/api/state")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.10/admin")).toBe(false);
    expect(isPublicHttpUrl("http://127.0.0.1:4310")).toBe(false);
    expect(isPublicHttpUrl("file:///c:/secreto")).toBe(false);
    expect(isPublicHttpUrl("http://intranet/")).toBe(false);
  });
});
