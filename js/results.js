/* DSAA — Module 9 : résultats, tableau et schéma électrique. */

const SVG_NS = "http://www.w3.org/2000/svg";

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatAr(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "Non disponible";
  }
  return `${Math.round(number(value)).toLocaleString("fr-FR")} Ar`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function describeDecision(status, dimensioning) {
  const decisions = {
    recommended_target: {
      title: "Installation recommandée",
      badge: "Besoin couvert",
      explanation: "Une configuration disponible respecte votre besoin énergétique idéal et reste dans le budget calculé.",
      meaning: "Le système a trouvé une installation techniquement compatible, financièrement accessible et assez puissante pour votre foyer.",
      action: "Consultez le matériel proposé et vérifiez les prix, la disponibilité et l'emplacement avant toute décision.",
      className: "is-success"
    },
    recommended_budget_limited: {
      title: "Installation possible, mais limitée par le budget",
      badge: "Besoin partiellement couvert",
      explanation: "Le budget ne permet pas d'atteindre le besoin idéal. La meilleure configuration accessible est affichée.",
      meaning: "Une installation est possible, mais elle produira moins que le niveau énergétique estimé comme idéal.",
      action: "Comparez cette configuration avec une augmentation du budget ou réduisez les équipements prioritaires du foyer.",
      className: "is-warning"
    },
    no_solution_budget: {
      title: "Budget insuffisant pour une configuration fiable",
      badge: "Budget à revoir",
      explanation: "Le catalogue contient des solutions techniques, mais aucune ne respecte à la fois votre budget et le minimum de production attendu.",
      meaning: "Le problème vient du financement, pas nécessairement de votre besoin: les équipements existent, mais ils coûtent plus que le budget mobilisable.",
      action: "Augmentez le budget, étudiez un financement progressif ou demandez un catalogue avec des équipements moins coûteux.",
      className: "is-warning"
    },
    no_catalog_solution: {
      title: "Aucune configuration fiable trouvée",
      badge: "Catalogue à compléter",
      explanation: dimensioning.missing_components?.length
        ? `Le catalogue ne contient pas encore tous les composants nécessaires : ${dimensioning.missing_components.join(", ")}.`
        : "Les composants disponibles ne permettent pas de construire une configuration techniquement compatible. Votre dossier reste calculé, mais aucune installation ne peut être recommandée.",
      meaning: dimensioning.missing_components?.length
        ? "Le moteur ne peut pas comparer les installations parce qu'il manque des informations de prix ou de caractéristiques techniques."
        : "Le moteur a trouvé des composants, mais leurs tensions, puissances ou capacités ne peuvent pas être assemblées de manière fiable.",
      action: "Complétez le catalogue des prix et des caractéristiques techniques, puis relancez le calcul.",
      className: "is-blocked"
    },
    blocked: {
      title: "Résultat incomplet",
      badge: "Vérification nécessaire",
      explanation: "Le calcul ne peut pas conclure. Vérifiez les informations financières, énergétiques ou de localisation du dossier.",
      meaning: "Une donnée indispensable manque ou n'est pas valide; le résultat ne doit pas être utilisé pour décider d'un achat.",
      action: "Retournez au dossier et vérifiez la localisation, le profil familial, les revenus et les activités déclarées.",
      className: "is-blocked"
    }
  };
  return decisions[status] || {
    title: "Résultat à vérifier",
    badge: "Statut inconnu",
    explanation: "Le dossier a été chargé, mais son état ne correspond pas à un résultat connu.",
    meaning: "Le résultat reçu n'est pas reconnu par cette version de l'application.",
    action: "Conservez le dossier et contactez la personne responsable de l'application avant de l'interpréter.",
    className: "is-warning"
  };
}

function renderDecision(status, dimensioning) {
  const decision = describeDecision(status, dimensioning);
  const card = document.getElementById("decision-card");
  if (card) {
    card.classList.remove("is-success", "is-warning", "is-blocked");
    card.classList.add(decision.className);
  }
  setText("decision-title", decision.title);
  setText("decision-badge", decision.badge);
  setText("decision-explanation", decision.explanation);
  setText("decision-meaning", decision.meaning);
  setText("decision-action", decision.action);
  setText("result-status", decision.badge);
}

function addSvgElement(svg, tag, attributes = {}, text = "") {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  if (text) element.textContent = text;
  svg.appendChild(element);
  return element;
}

function drawSchematic(recommendation) {
  const svg = document.getElementById("installation-svg");
  if (!svg || !recommendation) return;

  svg.innerHTML = "";
  svg.setAttribute("viewBox", "0 0 1200 680");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  addSvgElement(svg, "rect", { width: 1200, height: 680, fill: "#f6f3ec" });

  const panelCount = number(recommendation.panels?.quantity, 1);
  const panelPower = number(recommendation.panels?.power_kw) * 1000;
  const panelSeries = recommendation.panels?.series;
  const panelParallel = recommendation.panels?.parallel;
  const batteryCount = number(recommendation.batteries?.quantity, 1);
  const batterySeries = recommendation.batteries?.series;
  const batteryParallel = recommendation.batteries?.parallel;
  const inverterPower = number(recommendation.inverter?.power_kw) * 1000;
  const zones = [
    [30, "ZONE 1  GENERATION", "#2c6e63"],
    [260, "ZONE 2  BUS DC", "#a97815"],
    [430, "ZONE 3  STOCKAGE ET CONVERSION", "#a3431f"]
  ];
  zones.forEach(([y, label, color]) => {
    addSvgElement(svg, "text", { x: 34, y, fill: color, "font-size": 16, "font-weight": "700" }, label);
    addSvgElement(svg, "line", { x1: 34, x2: 1166, y1: y + 12, y2: y + 12, stroke: "#d7ddd9" });
  });

  const panelStartX = 80;
  const panelY = 72;
  const panelWidth = 54;
  const panelHeight = 112;
  const gap = 14;
  for (let index = 0; index < panelCount; index += 1) {
    const x = panelStartX + index * (panelWidth + gap);
    addSvgElement(svg, "rect", { x, y: panelY, width: panelWidth, height: panelHeight, rx: 3, fill: "#183d55", stroke: "#2c6e63", "stroke-width": 2 });
    for (let cell = 1; cell < 5; cell += 1) {
      addSvgElement(svg, "line", { x1: x + 4, x2: x + panelWidth - 4, y1: panelY + cell * 22, y2: panelY + cell * 22, stroke: "#6ea8a0", "stroke-width": 1 });
    }
    addSvgElement(svg, "text", { x: x + panelWidth / 2, y: panelY + 62, fill: "#fff", "font-size": 10, "text-anchor": "middle" }, `${Math.round(panelPower / panelCount)} W`);
  }
  addSvgElement(svg, "text", { x: 600, y: 220, fill: "#3d4c5c", "font-size": 13, "text-anchor": "middle" }, `${panelCount} panneau(x) | ${panelSeries ?? "?"} en série | ${panelParallel ?? "?"} branche(s) parallèle(s)`);

  addSvgElement(svg, "rect", { x: 220, y: 290, width: 760, height: 12, rx: 3, fill: "#d89f2b" });
  addSvgElement(svg, "text", { x: 600, y: 330, fill: "#a97815", "font-size": 15, "font-weight": 700, "text-anchor": "middle" }, "BUS DC");
  addSvgElement(svg, "path", { d: "M 600 190 L 600 290", stroke: "#2c6e63", "stroke-width": 4, fill: "none" });

  const batteryX = 340;
  const batteryY = 470;
  addSvgElement(svg, "rect", { x: batteryX, y: batteryY, width: 210, height: 86, rx: 5, fill: "#e8eee8", stroke: "#2c6e63", "stroke-width": 3 });
  addSvgElement(svg, "rect", { x: batteryX + 210, y: batteryY + 27, width: 10, height: 32, fill: "#2c6e63" });
  addSvgElement(svg, "text", { x: batteryX + 105, y: batteryY + 35, fill: "#16212c", "font-size": 15, "font-weight": 700, "text-anchor": "middle" }, `${batteryCount} batterie(s)`);
  addSvgElement(svg, "text", { x: batteryX + 105, y: batteryY + 60, fill: "#3d4c5c", "font-size": 12, "text-anchor": "middle" }, `${batterySeries ?? "?"} série | ${batteryParallel ?? "?"} parallèle`);

  const inverterX = 720;
  addSvgElement(svg, "rect", { x: inverterX, y: batteryY, width: 190, height: 86, rx: 5, fill: "#f2e5d6", stroke: "#a3431f", "stroke-width": 3 });
  addSvgElement(svg, "text", { x: inverterX + 95, y: batteryY + 35, fill: "#16212c", "font-size": 15, "font-weight": 700, "text-anchor": "middle" }, "ONDULEUR");
  addSvgElement(svg, "text", { x: inverterX + 95, y: batteryY + 60, fill: "#3d4c5c", "font-size": 12, "text-anchor": "middle" }, `${(inverterPower / 1000).toFixed(2)} kW`);

  addSvgElement(svg, "path", { d: "M 600 302 L 445 470", stroke: "#d89f2b", "stroke-width": 4, fill: "none" });
  addSvgElement(svg, "path", { d: "M 600 302 L 815 470", stroke: "#d89f2b", "stroke-width": 4, fill: "none" });
  addSvgElement(svg, "path", { d: "M 910 513 L 1080 513", stroke: "#a3431f", "stroke-width": 4, fill: "none" });
  addSvgElement(svg, "rect", { x: 1080, y: 480, width: 70, height: 66, rx: 4, fill: "#e3a72e", stroke: "#a97815", "stroke-width": 2 });
  addSvgElement(svg, "text", { x: 1115, y: 518, fill: "#16212c", "font-size": 12, "font-weight": 700, "text-anchor": "middle" }, "FOYER");
  addSvgElement(svg, "text", { x: 600, y: 625, fill: "#7a8792", "font-size": 12, "text-anchor": "middle" }, "Schéma fonctionnel : panneaux → bus DC → batteries / onduleur → foyer");
}

function renderTable(recommendation) {
  const body = document.getElementById("components-body");
  if (!body || !recommendation) return;
  const rows = [
    ["Panneaux", recommendation.panels?.modele, recommendation.panels],
    ["Batteries", recommendation.batteries?.modele, recommendation.batteries],
    ["Onduleur", recommendation.inverter?.modele, recommendation.inverter]
  ];
  body.innerHTML = rows.map(([category, specification, component]) => `
    <tr><td>${category}</td><td>${specification || "Non précisé"}</td><td>${component?.quantity ?? 1}</td><td>${formatAr(component?.unit_price)}</td><td>${formatAr(component?.total_price)}</td></tr>
  `).join("");
}

function renderResults(payload) {
  const dimensioning = payload.solarDimensioningData || {};
  const recommendation = dimensioning.recommendation;
  const finance = payload.financeData || {};
  const energy = payload.energyData || {};
  const location = payload.locationData || {};

  renderDecision(dimensioning.status, dimensioning);
  setText("result-name", payload.family?.name || "Dossier sans nom");
  setText("result-location", location.nearest_town?.name || "Localisation non disponible");
  setText("result-target", `${number(dimensioning.target_energy).toFixed(2)} kWh/jour`);
  setText("result-minimum", dimensioning.minimum_energy == null ? "Non calculable" : `${number(dimensioning.minimum_energy).toFixed(2)} kWh/jour`);
  setText("result-maximum", dimensioning.maximum_affordable_energy == null ? "Non calculable" : `${number(dimensioning.maximum_affordable_energy).toFixed(2)} kWh/jour`);
  setText("result-recommended", dimensioning.recommended_energy == null ? "Aucune" : `${number(dimensioning.recommended_energy).toFixed(2)} kWh/jour`);
  setText("result-fond", formatAr(finance.fond));
  setText("result-budget", formatAr(dimensioning.budget_available));
  setText("result-installation", formatAr(recommendation?.financial?.installation_cost));
  setText("result-remaining", formatAr(dimensioning.budget_remaining));
  setText("result-energy", `${number(energy.essential_energy_daily_kwh).toFixed(2)} kWh/jour`);
  setText("result-production", recommendation ? `${number(recommendation.energy.production_min_kwh_day).toFixed(2)} kWh/jour` : "Aucune");
  setText("result-autonomy", recommendation ? `${number(recommendation.batteries.autonomy_days).toFixed(2)} jour(s)` : "Aucune");
  const limitations = recommendation?.electrical_check?.limitations || [];
  setText(
    "result-electrical-limitations",
    limitations.length
      ? limitations.join(" ")
      : "Les vérifications disponibles dans le catalogue sont satisfaites."
  );

  const recommendationSection = document.getElementById("recommendation-section");
  if (recommendationSection) recommendationSection.hidden = !recommendation;
  const schematicSection = document.getElementById("schematic-section");
  if (schematicSection) schematicSection.hidden = !recommendation;
  renderTable(recommendation);
  drawSchematic(recommendation);
}

function loadResults() {
  const raw = sessionStorage.getItem("dsaaPayload");
  const payload = raw ? JSON.parse(raw) : null;
  if (!payload) {
    renderDecision("blocked", {});
    setText("decision-title", "Aucun dossier à afficher");
    setText("decision-explanation", "Cette page ne contient pas encore de résultat calculé.");
    setText("decision-meaning", "Vous êtes arrivé sur l'écran des résultats sans transmettre de dossier.");
    setText("decision-action", "Retournez au formulaire, complétez les quatre étapes, puis ouvrez les résultats.");
    return;
  }
  renderResults(payload);
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", loadResults);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { describeDecision };
}
