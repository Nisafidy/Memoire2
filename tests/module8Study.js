const fs = require("fs");
const path = require("path");
const { buildSolarDimensioningData } = require("../js/solarDimensioningService.js");

const OUTPUT_DIR = path.join(__dirname, "..", "reports", "module8-study");
const SEED = 20260912;
const SAMPLE_SIZE = 12000;
const DAYS_PER_MONTH = 30;
const MINIMUM_Y = 10 / DAYS_PER_MONTH;

function random(seedState) {
  seedState.value = (1664525 * seedState.value + 1013904223) >>> 0;
  return seedState.value / 4294967296;
}

function pick(seedState, min, max) {
  return min + random(seedState) * (max - min);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function row(categorie, modele, puissance, tension, capacity, price, lifetime) {
  return {
    categorie,
    modele,
    puissance,
    tension,
    capacite_autonomie: capacity,
    prix_ariary: String(price),
    duree_vie_estimee: lifetime,
    statut_disponibilite: "prix catalogue",
    type_prix: "etude parametrique",
    source: "module8-study"
  };
}

function createCatalog(seedState, variant = "standard") {
  const panelBasePrice = pick(seedState, 550000, 1300000);
  const batteryBasePrice = pick(seedState, 2200000, 8500000);
  const inverterBasePrice = pick(seedState, 900000, 5000000);
  const panelPower = pick(seedState, 0.35, 0.7);
  const batteryCapacity = pick(seedState, 2, 10);
  const inverterPower = pick(seedState, 2, 8);
  const panels = [
    row("Panneau photovoltaïque", "P1", `${Math.round(panelPower * 1000)} W`, "", "", Math.round(panelBasePrice), "20-25 ans"),
    row("Panneau photovoltaïque", "P2", `${Math.round(panelPower * 1.5 * 1000)} W`, "", "", Math.round(panelBasePrice * 1.65), "25-30 ans")
  ];
  const batteries = [
    row("Batterie LiFePO4", "B1", "", "48 V", `${round(batteryCapacity, 2)} kWh`, Math.round(batteryBasePrice), "10-15 ans"),
    row("Batterie LiFePO4", "B2", "", "48 V", `${round(batteryCapacity * 1.8, 2)} kWh`, Math.round(batteryBasePrice * 1.8), "10-15 ans")
  ];
  const inverters = [
    row("Onduleur hybride", "I1", `${round(inverterPower, 2)} kW`, "48 V", "", Math.round(inverterBasePrice), "10-15 ans"),
    row("Onduleur hybride", "I2", `${round(inverterPower * 1.5, 2)} kW`, "48 V", "", Math.round(inverterBasePrice * 1.65), "10-15 ans")
  ];
  if (variant === "incompatible") {
    batteries[0].tension = "24 V";
    batteries[1].tension = "24 V";
  }
  if (variant === "missing-inverter") {
    return [...panels, ...batteries];
  }
  return [...panels, ...batteries, ...inverters];
}

function scenarioResult(seedState, variant) {
  const budget = Math.round(pick(seedState, 1000000, 30000000));
  const target = pick(seedState, 0.25, 8);
  const irradiationMin = pick(seedState, 2.2, 5.4);
  const irradiation = [irradiationMin, irradiationMin + pick(seedState, 0, 0.8), irradiationMin + pick(seedState, 0, 1.2)];
  const priceCoeff = pick(seedState, 0.85, 1.35);
  const transport = pick(seedState, 0, 250000);
  const catalog = createCatalog(seedState, variant);
  const result = buildSolarDimensioningData(
    { status: "completed" },
    { status: "completed", budget_available: budget },
    { status: "completed", essential_energy_daily_kwh: target },
    {
      nearest_town: { priceCoeff },
      transport: { total_transport_cost: transport },
      irradiation: { monthly: irradiation }
    },
    catalog
  );
  return {
    budget,
    target_energy: round(target),
    irradiation_min: round(irradiationMin),
    price_coeff: round(priceCoeff),
    transport_cost: Math.round(transport),
    status: result.status,
    minimum_energy: result.minimum_energy == null ? null : round(result.minimum_energy),
    maximum_affordable_energy: result.maximum_affordable_energy == null ? null : round(result.maximum_affordable_energy),
    recommended_energy: result.recommended_energy == null ? null : round(result.recommended_energy),
    installation_cost: result.recommendation?.financial?.installation_cost ?? null,
    selected_panel: result.recommendation?.panels?.modele ?? null,
    selected_battery: result.recommendation?.batteries?.modele ?? null,
    selected_inverter: result.recommendation?.inverter?.modele ?? null
  };
}

function aggregate(rows) {
  const counts = {};
  rows.forEach((row) => { counts[row.status] = (counts[row.status] || 0) + 1; });
  const total = rows.length;
  const probability = {};
  Object.entries(counts).forEach(([status, count]) => { probability[status] = round(count / total, 6); });
  return { total, counts, probability };
}

function binStudy(rows, budgetBins, targetBins) {
  return budgetBins.map((budgetMax, budgetIndex) => targetBins.map((targetMax, targetIndex) => {
    const budgetMin = budgetIndex === 0 ? 0 : budgetBins[budgetIndex - 1];
    const targetMin = targetIndex === 0 ? 0 : targetBins[targetIndex - 1];
    const selected = rows.filter((row) =>
      row.budget > budgetMin && row.budget <= budgetMax &&
      row.target_energy > targetMin && row.target_energy <= targetMax
    );
    const total = selected.length || 1;
    return {
      budget_min: budgetMin,
      budget_max: budgetMax,
      target_min: targetMin,
      target_max: targetMax,
      sample_count: selected.length,
      probability_target: round(selected.filter((row) => row.status === "recommended_target").length / total, 4),
      probability_budget_limited: round(selected.filter((row) => row.status === "recommended_budget_limited").length / total, 4),
      probability_y_or_better: round(selected.filter((row) => ["recommended_target", "recommended_budget_limited"].includes(row.status)).length / total, 4)
    };
  }));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function chart(title, cells, valueKey, color) {
  const width = 760;
  const height = 330;
  const cellWidth = width / 5;
  const cellHeight = 220 / 5;
  const rects = cells.flat().map((cell, index) => {
    const x = (index % 5) * cellWidth;
    const y = Math.floor(index / 5) * cellHeight + 50;
    const value = cell[valueKey];
    const opacity = 0.12 + value * 0.88;
    return `<rect x="${x}" y="${y}" width="${cellWidth - 2}" height="${cellHeight - 2}" fill="${color}" fill-opacity="${opacity.toFixed(3)}"><title>${value}</title></rect><text x="${x + cellWidth / 2}" y="${y + cellHeight / 2 + 5}" text-anchor="middle" font-size="12">${(value * 100).toFixed(0)}%</text>`;
  }).join("");
  return `<h3>${escapeHtml(title)}</h3><svg viewBox="0 0 ${width} ${height}" class="chart"><text x="8" y="25" font-size="12">Budget ↑ / besoin X →</text>${rects}</svg>`;
}

function createReport(report) {
  const tableRows = report.summary.scenarios.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.total}</td><td>${(row.probability.recommended_target * 100).toFixed(2)}%</td><td>${(row.probability.recommended_budget_limited * 100).toFixed(2)}%</td><td>${((row.probability.no_solution_budget || 0) * 100).toFixed(2)}%</td><td>${((row.probability.no_catalog_solution || 0) * 100).toFixed(2)}%</td></tr>`).join("");
  const charts = report.bins.standard;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Étude Module 8</title><style>body{font-family:Arial,sans-serif;max-width:1100px;margin:30px auto;color:#17212b}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd5d0;padding:8px;text-align:right}th:first-child,td:first-child{text-align:left}.chart{width:100%;max-width:760px;background:#f4f1e8;border:1px solid #ccd5d0;margin-bottom:25px}.note{background:#f4f1e8;padding:12px;border-left:4px solid #c28b22}</style></head><body><h1>Étude probabiliste du Module 8</h1><p class="note">Graine ${report.seed}, ${report.sample_size} scénarios par famille. Les probabilités sont descriptives pour cet espace de scénarios, pas des probabilités démographiques réelles.</p><h2>Synthèse</h2><table><thead><tr><th>Scénario</th><th>N</th><th>X atteint</th><th>Y atteint seulement</th><th>Budget insuffisant</th><th>Catalogue invalide</th></tr></thead><tbody>${tableRows}</tbody></table>${chart("Probabilité d'atteindre X", charts, "probability_target", "#2c6e63")}${chart("Probabilité d'atteindre au moins Y", charts, "probability_y_or_better", "#c28b22")}<h2>Limites</h2><p>Le catalogue réel actuel peut produire une probabilité de catalogue invalide très élevée si les composants tarifés ne permettent pas un kit techniquement cohérent. Les résultats détaillés sont dans <code>study-results.json</code> et <code>study-results.csv</code>.</p></body></html>`;
}

function csv(rows) {
  const headers = Object.keys(rows[0]);
  return [headers.join(";"), ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(";"))].join("\n");
}

function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const seedState = { value: SEED };
  const groups = [
    ["standard", "Catalogue standard"],
    ["incompatible", "Tensions incompatibles"],
    ["missing-inverter", "Catalogue incomplet"]
  ];
  const allRows = [];
  const summaryScenarios = [];
  const bins = {};
  const budgetBins = [5000000, 10000000, 15000000, 22000000, 30000000];
  const targetBins = [1, 2, 3.5, 5, 8];
  groups.forEach(([variant, name]) => {
    const rows = Array.from({ length: SAMPLE_SIZE }, () => scenarioResult(seedState, variant));
    rows.forEach((row) => { row.scenario = name; allRows.push(row); });
    const stats = aggregate(rows);
    summaryScenarios.push({ name, total: stats.total, counts: stats.counts, probability: stats.probability });
    bins[variant] = binStudy(rows, budgetBins, targetBins);
  });
  const report = {
    seed: SEED,
    sample_size: SAMPLE_SIZE,
    minimum_y_kwh_day: MINIMUM_Y,
    summary: { scenarios: summaryScenarios },
    bins
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "study-results.json"), JSON.stringify({ report, rows: allRows }, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, "study-results.csv"), csv(allRows));
  fs.writeFileSync(path.join(OUTPUT_DIR, "study-report.html"), createReport(report));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Rapport: ${path.join(OUTPUT_DIR, "study-report.html")}`);
}

run();
