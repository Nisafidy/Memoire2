const assert = require("assert");
const {
  buildSolarDimensioningData
} = require("../js/solarDimensioningService.js");

const location = {
  nearest_town: { priceCoeff: 1 },
  transport: { total_transport_cost: 0 },
  irradiation: { monthly: [1] }
};

function panel(model, power, price, life = "25-30 ans") {
  return {
    categorie: "Panneau photovoltaïque",
    modele: model,
    puissance: power,
    prix_ariary: String(price),
    duree_vie_estimee: life,
    statut_disponibilite: "En stock",
    type_prix: "prix local affiche"
  };
}

function battery(model, voltage, capacity, price, life = "10-15 ans") {
  return {
    categorie: "Batterie LiFePO4",
    modele: model,
    tension: voltage,
    capacite_autonomie: capacity,
    prix_ariary: String(price),
    duree_vie_estimee: life,
    statut_disponibilite: "En stock",
    type_prix: "prix local affiche"
  };
}

function inverter(model, power, voltage, price, life = "10-15 ans") {
  return {
    categorie: "Onduleur hybride",
    modele: model,
    puissance: power,
    tension: voltage,
    prix_ariary: String(price),
    duree_vie_estimee: life,
    statut_disponibilite: "En stock",
    type_prix: "prix local affiche"
  };
}

function run(rows, budget, target) {
  return buildSolarDimensioningData(
    { status: "completed" },
    { status: "completed", budget_available: budget },
    { status: "completed", essential_energy_daily_kwh: target },
    location,
    rows
  );
}

function printResult(name, result) {
  const selected = result.recommendation;
  console.log(JSON.stringify({
    test: name,
    X: result.target_energy,
    Y: result.minimum_energy,
    Z: result.maximum_affordable_energy,
    B: result.budget_available,
    recommended_energy: result.recommended_energy,
    status: result.status,
    total_cost: selected?.financial?.installation_cost ?? null,
    configuration: selected
      ? {
          panel: selected.panels.modele,
          battery: selected.batteries.modele,
          inverter: selected.inverter.modele
        }
      : null
  }));
}

const baseRows = [
  panel("P1", "1 kW", 100),
  panel("P2", "2 kW", 200),
  battery("B1", "48 V", "2 kWh", 50),
  inverter("I1", "10 kW", "48 V", 50)
];

const target = run(baseRows, 200, 0.75);
assert.equal(target.status, "recommended_target");
printResult("1-target-accessible", target);

const limited = run(baseRows, 200, 1.5);
assert.equal(limited.status, "recommended_budget_limited");
assert.equal(limited.recommended_energy, limited.maximum_affordable_energy);
printResult("2-budget-limited", limited);

const insufficient = run(baseRows, 150, 0.75);
assert.equal(insufficient.status, "no_solution_budget");
assert(insufficient.maximum_affordable_energy < insufficient.minimum_energy);
printResult("3-budget-under-Y", insufficient);

const noCatalog = run([
  panel("P1", "1 kW", 100)
], 1000, 0.75);
assert.equal(noCatalog.status, "no_catalog_solution");
printResult("4-no-technical-kit", noCatalog);

const multipleTarget = run(baseRows, 400, 0.75);
assert.equal(multipleTarget.status, "recommended_target");
assert.equal(multipleTarget.recommendation.panels.modele, "P1");
printResult("5-multiple-target-configurations", multipleTarget);

const sameCost = run([
  panel("P-short-life", "1 kW", 100, "5-6 ans"),
  panel("P-long-life", "1 kW", 100, "25-30 ans"),
  battery("B1", "48 V", "2 kWh", 50),
  inverter("I1", "10 kW", "48 V", 50)
], 200, 0.75);
assert.equal(sameCost.status, "recommended_target");
assert.equal(sameCost.recommendation.panels.modele, "P-long-life");
printResult("6-same-cost-lifetime-tiebreak", sameCost);

const incompatible = run([
  panel("P1", "1 kW", 100),
  battery("B24", "24 V", "2 kWh", 50),
  inverter("I48", "10 kW", "48 V", 50)
], 1000, 0.75);
assert.equal(incompatible.status, "no_catalog_solution");
printResult("7-electrically-incompatible", incompatible);

const floorRows = [
  panel("P-small", "100 W", 100),
  battery("B1", "48 V", "2 kWh", 50),
  inverter("I1", "1 kW", "48 V", 50)
];
const floor = run(floorRows, 200, 0.1);
assert.equal(floor.status, "no_solution_budget");
assert.equal(floor.minimum_energy, 10 / 30);
printResult("8-minimum-energy-floor", floor);
