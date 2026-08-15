/**
 * DSAA — Parseur CSV minimal
 * Gère les délimiteurs ',' ou ';' et les champs entre guillemets.
 * Retourne un tableau d'objets { colonne: valeur, ... }.
 */
function parseCSV(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      pushField();
    } else if (c === "\r") {
      // ignore, le \n suivant gère la fin de ligne
    } else if (c === "\n") {
      pushRow();
    } else {
      field += c;
    }
  }
  // dernière ligne si le fichier ne termine pas par \n
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  const clean = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
  if (clean.length === 0) return [];

  const headers = clean[0].map((h) => h.trim());
  return clean.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return obj;
  });
}

async function loadCSV(path, delimiter = ",") {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Impossible de charger ${path} (${res.status})`);
  const text = await res.text();
  return parseCSV(text, delimiter);
}