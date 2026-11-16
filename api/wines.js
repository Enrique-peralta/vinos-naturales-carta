// Vercel serverless function: fetches the live Google Sheet, parses it server-side
// (so the client never deals with CORS or raw CSV), and returns clean wine records.

// Which data this deployment serves (set as an environment variable in Vercel):
//   WINES_SOURCE=demo  -> a small fixed sample from data/demo-wines.json; the sheet is never read
//   (unset)            -> the live Google Sheet below
// SHEET_CSV_URL can also be set as an environment variable to point a deployment at another
// client's sheet (any "Anyone with the link: Viewer" sheet exported as CSV with the same columns).
const DEFAULT_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/15H9vKeD_YPwJf2-ATEKqiF5n2beeo1qAp6iJwdk5jpc/export?format=csv";
const SHEET_CSV_URL = process.env.SHEET_CSV_URL || DEFAULT_SHEET_CSV_URL;

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ""));
}

function cleanPrice(s) {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/€/g, "").replace(",", ".").trim());
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function splitTags(s) {
  if (!s) return [];
  return String(s).split(",").map(t => t.trim()).filter(Boolean);
}

function parseStock(s) {
  const str = (s || "").trim();
  if (str === "") return { kind: "unknown", value: null, label: "Sin dato" };
  const n = parseFloat(str);
  if (!isNaN(n) && /^-?\d+(\.\d+)?$/.test(str)) {
    const v = Math.trunc(n);
    return { kind: "number", value: v, label: String(v) };
  }
  const low = str.toLowerCase();
  if (low.includes("no vender")) return { kind: "no_vender", value: null, label: "No vender" };
  if (low.includes("consultar") || low.includes("cosultar")) return { kind: "consultar", value: null, label: "Consultar" };
  return { kind: "text", value: null, label: str };
}

function boolCell(s) {
  return (s || "").trim().toUpperCase() === "TRUE";
}

module.exports = async (req, res) => {
  try {
    if (process.env.WINES_SOURCE === "demo") {
      res.setHeader("X-Wines-Source", "demo");
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
      res.status(200).json(require("../data/demo-wines.json"));
      return;
    }
    const r = await fetch(SHEET_CSV_URL);
    if (!r.ok) throw new Error("No se pudo leer la hoja (HTTP " + r.status + ")");
    const text = await r.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error("La hoja está vacía");

    const header = rows[0];
    const idx = (name) => header.indexOf(name);
    const col = {
      nombre: idx("Nombre"),
      pais: idx("País"),
      categoria: idx("Categoría"),
      anio: idx("Año"),
      regionNorm: idx("Región (normalizada)"),
      productora: idx("Productora"),
      uva: idx("Uva"),
      uvasTags: idx("Uvas (tags)"),
      uvasRevisar: idx("Uvas: revisar manualmente"),
      notas: idx("Notas"),
      etiquetasCata: idx("Etiquetas de cata"),
      notasSinDatos: idx("Notas: sin datos para etiquetar"),
      tamano: idx("Tamaño"),
      coste: idx("Coste"),
      precio: idx("Precio"),
      stock: idx("Stock"),
    };

    const wines = rows.slice(1)
      .filter((r) => r[col.nombre] && r[col.nombre].trim())
      .map((r, i) => ({
        id: i + 1,
        nombre: (r[col.nombre] || "").trim(),
        pais: (r[col.pais] || "").trim(),
        categoria: (r[col.categoria] || "").trim(),
        anio: (r[col.anio] || "").trim(),
        regionNorm: (r[col.regionNorm] || "").trim(),
        productora: (r[col.productora] || "").trim(),
        uva: (r[col.uva] || "").trim(),
        uvasTags: splitTags(r[col.uvasTags]),
        uvasRevisar: boolCell(r[col.uvasRevisar]),
        notas: (r[col.notas] || "").trim(),
        etiquetasCata: splitTags(r[col.etiquetasCata]),
        notasSinDatos: boolCell(r[col.notasSinDatos]),
        tamano: (r[col.tamano] || "").trim(),
        coste: cleanPrice(r[col.coste]),
        precio: cleanPrice(r[col.precio]),
        stock: parseStock(r[col.stock]),
      }));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
    res.status(200).json(wines);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
