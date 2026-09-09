/**
 * DSAA — Module 6 : FAISABILITE FINANCIERE
 *
 * Evalue le financement d'un kit minimal tarifable a partir du fond
 * mensuel du Module 5 et du cout de transport du Module 2.
 */

const DIMENSIONING_CONFIG = {
  max_saving_months: 12,
  required_categories: [
    "Panneau",
    "Batterie",
    "Onduleur"
  ]
};

function positivePrice(row) {
  const price = Number(
    String(row.prix_ariary || "")
      .replace(/\s/g, "")
      .replace(",", ".")
  );

  return Number.isFinite(price) && price > 0 ? price : null;
}

function categoryMatches(category, expected) {
  const normalizedCategory = category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const normalizedExpected = expected
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizedExpected === "onduleur") {
    return normalizedCategory === "onduleur" ||
      normalizedCategory.startsWith("onduleur ");
  }

  return normalizedCategory.startsWith(normalizedExpected);
}

function selectCheapestPricedComponent(rows, category) {
  const candidates = rows
    .map((row) => ({ row, price: positivePrice(row) }))
    .filter(({ row, price }) =>
      price !== null && categoryMatches(row.categorie || "", category)
    )
    .sort((a, b) => a.price - b.price);

  if (!candidates.length) {
    return null;
  }

  const selected = candidates[0];

  return {
    categorie: selected.row.categorie,
    marque: selected.row.marque || null,
    modele: selected.row.modele || null,
    unit_price: selected.price,
    quantity: 1,
    total_price: selected.price,
    source: selected.row.source || null,
    notes: selected.row.notes || null
  };
}

function selectMinimumKit(rows) {
  const components = DIMENSIONING_CONFIG.required_categories.map(
    (category) => selectCheapestPricedComponent(rows, category)
  );
  const missingCategories = DIMENSIONING_CONFIG.required_categories.filter(
    (_, index) => !components[index]
  );
  const materialCost = components
    .filter(Boolean)
    .reduce((total, component) => total + component.total_price, 0);

  return {
    components: components.filter(Boolean),
    missing_categories: missingCategories,
    material_cost: materialCost,
    complete: missingCategories.length === 0
  };
}

function findSavingHorizon(fond, installationCost) {
  if (!Number.isFinite(fond) || fond <= 0) {
    return null;
  }

  for (let monthIndex = 0;
       monthIndex < DIMENSIONING_CONFIG.max_saving_months;
       monthIndex++) {
    const months = monthIndex + 1;
    const budget = fond * months;

    if (budget >= installationCost) {
      return {
        months,
        zero_based_months: monthIndex,
        budget
      };
    }
  }

  return null;
}

function buildDimensioningData(financeData, locationData, priceRows) {
  const fond = Number(financeData?.fond);
  const priceCoeff = Number(locationData?.nearest_town?.priceCoeff) || 1;
  const transportCost = Number(
    locationData?.transport?.total_transport_cost
  );
  const kit = selectMinimumKit(Array.isArray(priceRows) ? priceRows : []);

  if (!financeData || financeData.status !== "completed") {
    return {
      status: "blocked",
      reason: "Le fond ne peut pas etre evalue sans scores familiaux complets.",
      financial_feasible: false
    };
  }

  if (!Number.isFinite(fond) || fond <= 0) {
    return {
      status: "blocked",
      reason: "Le fond mensuel est nul ou negatif : installation non recommandee.",
      fond: Number.isFinite(fond) ? Math.round(fond) : null,
      financial_feasible: false
    };
  }

  if (!kit.complete) {
    return {
      status: "incomplete_prices",
      reason: "Le prix minimum ne peut pas etre determine pour toutes les categories requises.",
      missing_categories: kit.missing_categories,
      financial_feasible: false
    };
  }

  if (!Number.isFinite(transportCost) || transportCost < 0) {
    return {
      status: "missing_transport",
      reason: "Le cout de transport est necessaire au calcul du cout d'installation.",
      financial_feasible: false
    };
  }

  const adjustedMaterialCost = kit.material_cost * priceCoeff;
  const installationCost = adjustedMaterialCost + transportCost;
  const annualCapacity = fond * 12;
  const savingHorizon = findSavingHorizon(fond, installationCost);
  const transportAffordable = fond >= transportCost;
  const annualCapacitySufficient = annualCapacity >= installationCost;
  const financialFeasible = fond > 0 &&
    transportAffordable &&
    annualCapacitySufficient;
  const budgetAvailable = savingHorizon
    ? savingHorizon.budget
    : annualCapacity;

  return {
    status: "completed",
    financial_feasible: financialFeasible,
    fond: Math.round(fond),
    price_coeff: priceCoeff,
    material_cost: Math.round(adjustedMaterialCost),
    material_cost_before_coefficient: Math.round(kit.material_cost),
    transport_cost: Math.round(transportCost),
    installation_cost: Math.round(installationCost),
    annual_capacity: Math.round(annualCapacity),
    budget_available: Math.round(budgetAvailable),
    budget_remaining: Math.round(budgetAvailable - installationCost),
    transport_affordable: transportAffordable,
    annual_capacity_sufficient: annualCapacitySufficient,
    saving_horizon: savingHorizon
      ? {
          months: savingHorizon.months,
          zero_based_months: savingHorizon.zero_based_months,
          budget: Math.round(savingHorizon.budget)
        }
      : null,
    minimum_kit: {
      components: kit.components,
      material_cost: Math.round(kit.material_cost),
      pricing_basis: "minimum tarifed panel + batterie + onduleur",
      indicative: true
    },
    metadata: {
      module: "DimensioningService v1.0",
      max_saving_months: DIMENSIONING_CONFIG.max_saving_months,
      transport_included_in_installation_cost: true
    }
  };
}

async function loadDimensioningData(financeData, locationData) {
  const priceRows = await loadCSV("dynamiques/data/prix.csv", ";");
  return buildDimensioningData(financeData, locationData, priceRows);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DIMENSIONING_CONFIG,
    buildDimensioningData,
    findSavingHorizon,
    selectMinimumKit
  };
}
