/**
 * DSAA — Module 8 : DIMENSIONNEMENT PHOTOVOLTAIQUE
 *
 * Recherche exhaustive de configurations admissibles selon le budget,
 * le besoin energetique, la production solaire et l'autonomie.
 */

const SOLAR_DIMENSIONING_CONFIG = {
  system_efficiency: 0.75,
  autonomy_min_days: 1,
  minimum_energy_kwh_month: 10,
  days_per_month: 30,
  depth_of_discharge: {
    lithium: 0.8,
    gel: 0.5,
    agm: 0.5,
    default: 0.5
  },
  max_panels: 20,
  max_batteries: 12
};

function parsePrice(row) {
  const price = Number(
    String(row.prix_ariary || "")
      .replace(/\s/g, "")
      .replace(",", ".")
  );
  return Number.isFinite(price) && price > 0 ? price : null;
}

function parseNumber(value, pattern) {
  const match = String(value || "").match(pattern);
  if (!match) return null;
  const number = Number(match[1].replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parsePowerKw(value) {
  const number = parseNumber(value, /(\d+(?:[.,]\d+)?)\s*kW/i);
  if (number !== null) return number;
  const watts = parseNumber(value, /(\d+(?:[.,]\d+)?)\s*W/i);
  return watts === null ? null : watts / 1000;
}

function parseCapacityKwh(value) {
  return parseNumber(value, /(\d+(?:[.,]\d+)?)\s*kWh/i);
}

function parseVoltage(value) {
  return parseNumber(value, /(\d+(?:[.,]\d+)?)\s*V/i);
}

function parseYears(value) {
  const match = String(value || "").match(
    /(\d+(?:[.,]\d+)?)\s*(?:-|a|ans|years?)/i
  );
  if (match) {
    const first = Number(match[1].replace(",", "."));
    const range = String(value).match(
      /(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)/
    );
    if (range) {
      return (
        Number(range[1].replace(",", ".")) +
        Number(range[2].replace(",", "."))
      ) / 2;
    }
    return Number.isFinite(first) ? first : null;
  }
  return null;
}

function normalizedCategory(row) {
  return String(row.categorie || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function prepareComponents(rows) {
  const panels = rows
    .filter((row) => normalizedCategory(row).startsWith("panneau"))
    .map((row) => ({
      row,
      price: parsePrice(row),
      powerKw: parsePowerKw(row.puissance),
      voltage: parseVoltage(row.tension),
      lifetimeYears: parseYears(row.duree_vie_estimee)
    }))
    .filter((component) => component.price !== null && component.powerKw !== null);
  const batteries = rows
    .filter((row) => normalizedCategory(row).startsWith("batterie"))
    .map((row) => ({
      row,
      price: parsePrice(row),
      capacityKwh: parseCapacityKwh(row.capacite_autonomie),
      voltage: parseVoltage(row.tension),
      lifetimeYears: parseYears(row.duree_vie_estimee),
      technology: normalizedCategory(row).includes("lithium") ||
        normalizedCategory(row).includes("lifepo4")
        ? "lithium"
        : normalizedCategory(row).includes("agm")
          ? "agm"
          : normalizedCategory(row).includes("gel")
            ? "gel"
            : "default"
    }))
    .filter((component) =>
      component.price !== null &&
      component.capacityKwh !== null &&
      component.voltage !== null
    );
  const inverters = rows
    .filter((row) => normalizedCategory(row).startsWith("onduleur"))
    .map((row) => ({
      row,
      price: parsePrice(row),
      powerKw: parsePowerKw(row.puissance),
      voltage: parseVoltage(row.tension),
      lifetimeYears: parseYears(row.duree_vie_estimee),
      maxChargeCurrent: parseNumber(row.courant_max, /(\d+(?:[.,]\d+)?)/)
    }))
    .filter((component) =>
      component.price !== null && component.powerKw !== null
    );

  return { panels, batteries, inverters };
}

function batterySeriesCount(battery, inverter) {
  if (!inverter.voltage) return null;
  if (battery.voltage === 48 && inverter.voltage === 48) return 1;
  if (battery.voltage === 51.2 && inverter.voltage === 48) return 1;
  if (battery.voltage === 12 && inverter.voltage === 48) return 4;
  return null;
}

function checkElectricalCompatibility(panel, panelCount, battery, batteryCount, inverter, loadPowerKw) {
  const limitations = [];
  const batterySeries = batterySeriesCount(battery, inverter);
  const panelPower = panelCount * panel.powerKw;

  if (!batterySeries || batteryCount % batterySeries !== 0) {
    return {
      valid: false,
      reason: "La tension batterie/onduleur ou le montage série des batteries est incompatible.",
      limitations
    };
  }

  if (inverter.powerKw < Math.max(panelPower, loadPowerKw || 0)) {
    return {
      valid: false,
      reason: "La puissance de l'onduleur est insuffisante.",
      limitations
    };
  }

  if (!panel.voltage) {
    limitations.push("Tension PV absente : nombre de panneaux en série non vérifiable.");
  }
  if (!inverter.maxPvVoltage) {
    limitations.push("Tension PV maximale de l'onduleur absente du catalogue.");
  }
  if (!inverter.maxChargeCurrent) {
    limitations.push("Courant maximal du régulateur/onduleur absent du catalogue.");
  }

  return {
    valid: true,
      voltage_rule: battery.voltage === 51.2
        ? "Batterie LiFePO4 51.2 V nominale avec onduleur 48 V nominal"
        : "Tensions nominales identiques",
    battery_series: batterySeries,
    battery_parallel: batteryCount / batterySeries,
    panel_series: panel.voltage ? panelCount : null,
    panel_parallel: panel.voltage ? 1 : null,
    checked_load_power_kw: loadPowerKw || null,
    limitations
  };
}

function componentOutput(component, quantity) {
  return {
    marque: component.row.marque || null,
    modele: component.row.modele || null,
    quantity,
    unit_price: component.price,
    total_price: component.price * quantity,
    power_kw: component.powerKw ?? null,
    capacity_kwh: component.capacityKwh ?? null,
    source: component.row.source || null
  };
}

function buildConfiguration(panel, panelCount, battery, batteryCount, inverter, priceCoeff, transportCost, dailyNeed, irradiation, loadPowerKw = 0) {
  const electricalCheck = checkElectricalCompatibility(
    panel,
    panelCount,
    battery,
    batteryCount,
    inverter,
    loadPowerKw
  );
  if (!electricalCheck.valid) return null;

  const series = electricalCheck.battery_series;

  const batteryBranches = batteryCount / series;
  const batteryDod = SOLAR_DIMENSIONING_CONFIG.depth_of_discharge[battery.technology]
    || SOLAR_DIMENSIONING_CONFIG.depth_of_discharge.default;
  const usableCapacity = batteryCount * battery.capacityKwh * batteryDod;
  const autonomyDays = usableCapacity / dailyNeed;
  const panelPower = panelCount * panel.powerKw;
  const monthlyIrradiation = irradiation.length ? irradiation : [4];
  const productionByMonth = monthlyIrradiation.map((value) =>
    panelPower * Number(value) * SOLAR_DIMENSIONING_CONFIG.system_efficiency
  );
  const productionMin = Math.min(...productionByMonth);
  const productionAverage = productionByMonth.reduce((sum, value) => sum + value, 0) /
    productionByMonth.length;
  const materialCost = (
    panel.price * panelCount +
    battery.price * batteryCount +
    inverter.price
  ) * priceCoeff;
  const installationCost = materialCost + transportCost;
  const lifetimeValues = [
    panel.lifetimeYears,
    battery.lifetimeYears,
    inverter.lifetimeYears
  ].filter((value) => Number.isFinite(value));
  const lifetimeYears = lifetimeValues.length
    ? Math.min(...lifetimeValues)
    : null;

  return {
    panels: {
      ...componentOutput(panel, panelCount),
      series: electricalCheck.panel_series,
      parallel: electricalCheck.panel_parallel
    },
    batteries: {
      ...componentOutput(battery, batteryCount),
      series,
      parallel: batteryBranches,
      usable_capacity_kwh: Math.round(usableCapacity * 100) / 100,
      depth_of_discharge: batteryDod,
      autonomy_days: Math.round(autonomyDays * 100) / 100
    },
    inverter: componentOutput(inverter, 1),
    energy: {
      daily_need_kwh: dailyNeed,
      production_monthly_kwh_day: productionByMonth.map((value) =>
        Math.round(value * 100) / 100
      ),
      production_min_kwh_day: Math.round(productionMin * 100) / 100,
      production_average_kwh_day: Math.round(productionAverage * 100) / 100
    },
    financial: {
      material_cost: Math.round(materialCost),
      transport_cost: Math.round(transportCost),
      installation_cost: Math.round(installationCost)
    },
    constraints: {
      autonomy_sufficient: autonomyDays >= SOLAR_DIMENSIONING_CONFIG.autonomy_min_days,
      inverter_power_sufficient: inverter.powerKw >= Math.max(panelPower, loadPowerKw),
      electrical_compatibility: electricalCheck.valid
    },
    electrical_check: electricalCheck,
    metadata: {
      lifetime_years: lifetimeYears,
      availability: [
        panel.row.statut_disponibilite,
        battery.row.statut_disponibilite,
        inverter.row.statut_disponibilite
      ],
      pricing_types: [
        panel.row.type_prix,
        battery.row.type_prix,
        inverter.row.type_prix
      ]
    }
  };
}

function searchConfigurations(components, priceCoeff, transportCost, dailyNeed, irradiation, loadPowerKw = 0) {
  const solutions = [];

  for (const panel of components.panels) {
    for (let panelCount = 1; panelCount <= SOLAR_DIMENSIONING_CONFIG.max_panels; panelCount++) {
      for (const battery of components.batteries) {
        for (let batteryCount = 1; batteryCount <= SOLAR_DIMENSIONING_CONFIG.max_batteries; batteryCount++) {
          for (const inverter of components.inverters) {
            const configuration = buildConfiguration(
              panel,
              panelCount,
              battery,
              batteryCount,
              inverter,
              priceCoeff,
              transportCost,
              dailyNeed,
              irradiation,
              loadPowerKw
            );
            if (!configuration) continue;

            const admissible = configuration.constraints.autonomy_sufficient &&
              configuration.constraints.inverter_power_sufficient &&
              configuration.constraints.electrical_compatibility;
            if (admissible) solutions.push(configuration);
          }
        }
      }
    }
  }

  return solutions;
}

function buildSolarDimensioningData(financeData, dimensioningData, energyData, locationData, priceRows) {
  if (!financeData || financeData.status !== "completed" ||
      !energyData || energyData.status !== "completed" ||
      !dimensioningData || dimensioningData.status !== "completed") {
    return {
      status: "blocked",
      reason: "Les modules financiers, de faisabilite et energetiques doivent etre completes.",
      target_energy: Number.isFinite(Number(energyData?.essential_energy_daily_kwh))
        ? Number(energyData.essential_energy_daily_kwh)
        : null,
      minimum_energy: null,
      maximum_affordable_energy: null,
      budget_available: Number.isFinite(Number(dimensioningData?.budget_available))
        ? Math.round(Number(dimensioningData.budget_available))
        : null,
      recommended_energy: null,
      recommendation: null
    };
  }

  const budgetAvailable = Number(dimensioningData?.budget_available);
  const dailyNeed = Number(energyData.essential_energy_daily_kwh);
  const loadPowerKw = Number(
    energyData.max_load_power_kw ??
    dimensioningData?.max_load_power_kw ??
    0
  );
  const priceCoeff = Number(locationData?.nearest_town?.priceCoeff) || 1;
  const transportCost = Number(locationData?.transport?.total_transport_cost);
  const irradiation = locationData?.irradiation?.monthly || [];
  const components = prepareComponents(Array.isArray(priceRows) ? priceRows : []);
  const missing = [];
  if (!components.panels.length) missing.push("panneau tarifé avec puissance");
  if (!components.batteries.length) missing.push("batterie tarifée avec capacité et tension");
  if (!components.inverters.length) missing.push("onduleur tarifé avec puissance");

  if (!Number.isFinite(transportCost) || transportCost < 0 || !Number.isFinite(dailyNeed) || dailyNeed <= 0) {
    return {
      status: "blocked",
      reason: "Le transport ou le besoin energetique est invalide.",
      recommendation: null
    };
  }
  if (missing.length) {
    return {
      status: "no_catalog_solution",
      reason: "Le catalogue ne contient pas tous les composants tarifés necessaires.",
      target_energy: dailyNeed,
      minimum_energy: null,
      maximum_affordable_energy: null,
      budget_available: Number.isFinite(budgetAvailable)
        ? Math.round(budgetAvailable)
        : null,
      recommended_energy: null,
      missing_components: missing,
      candidates: {
        panels: components.panels.length,
        batteries: components.batteries.length,
        inverters: components.inverters.length
      },
      recommendation: null
    };
  }

  const solutions = searchConfigurations(
    components,
    priceCoeff,
    transportCost,
    dailyNeed,
    irradiation,
    Number.isFinite(loadPowerKw) ? loadPowerKw : 0
  );
  if (!solutions.length) {
    return {
      status: "no_catalog_solution",
      reason: "Aucune configuration techniquement valide ne peut etre construite avec le catalogue.",
      target_energy: dailyNeed,
      minimum_energy: null,
      maximum_affordable_energy: null,
      budget_available: Number.isFinite(budgetAvailable)
        ? Math.round(budgetAvailable)
        : null,
      recommended_energy: null,
      candidates: {
        panels: components.panels.length,
        batteries: components.batteries.length,
        inverters: components.inverters.length
      },
      recommendation: null
    };
  }

  const minimumTechnicalEnergy = Math.min(...solutions.map((solution) =>
    solution.energy.production_min_kwh_day
  ));
  const minimumEnergy = Math.max(
    minimumTechnicalEnergy,
    SOLAR_DIMENSIONING_CONFIG.minimum_energy_kwh_month /
      SOLAR_DIMENSIONING_CONFIG.days_per_month
  );
  const affordableSolutions = Number.isFinite(budgetAvailable) && budgetAvailable > 0
    ? solutions.filter((solution) =>
        solution.financial.installation_cost <= budgetAvailable
      )
    : [];
  const affordableMaximumEnergy = affordableSolutions.length
    ? Math.max(...affordableSolutions.map((solution) =>
        solution.energy.production_min_kwh_day
      ))
    : 0;
  const targetEnergy = dailyNeed;
  const targetSolutions = affordableSolutions.filter((solution) =>
    solution.energy.production_min_kwh_day >= targetEnergy
  );

  if (!affordableSolutions.length || affordableMaximumEnergy < minimumEnergy) {
    return {
      status: "no_solution_budget",
      reason: "Le budget ne permet pas d'atteindre la production minimale d'une configuration techniquement valide.",
      target_energy: targetEnergy,
      minimum_energy: minimumEnergy,
      maximum_affordable_energy: affordableMaximumEnergy,
      budget_available: Number.isFinite(budgetAvailable) ? Math.round(budgetAvailable) : null,
      recommended_energy: null,
      recommendation: null,
      technical_solution_count: solutions.length,
      affordable_solution_count: affordableSolutions.length
    };
  }

  const targetRanking = (left, right) =>
    left.financial.installation_cost - right.financial.installation_cost ||
    (right.metadata?.lifetime_years || 0) - (left.metadata?.lifetime_years || 0) ||
    left.energy.production_min_kwh_day - targetEnergy -
      (right.energy.production_min_kwh_day - targetEnergy) ||
    right.batteries.autonomy_days - left.batteries.autonomy_days;
  const budgetRanking = (left, right) =>
    right.energy.production_min_kwh_day - left.energy.production_min_kwh_day ||
    left.financial.installation_cost - right.financial.installation_cost ||
    right.batteries.autonomy_days - left.batteries.autonomy_days;
  const recommendation = (targetSolutions.length
    ? targetSolutions
    : affordableSolutions
  ).sort(targetSolutions.length ? targetRanking : budgetRanking)[0];
  const coversTarget = targetSolutions.length > 0;

  return {
    status: coversTarget ? "recommended_target" : "recommended_budget_limited",
    reason: coversTarget
      ? "Une configuration accessible couvre le besoin energetique ideal."
      : "Le budget ne permet pas de couvrir le besoin ideal, mais la meilleure configuration accessible atteint le minimum techniquement faisable.",
    target_energy: targetEnergy,
    minimum_energy: minimumEnergy,
    maximum_affordable_energy: affordableMaximumEnergy,
    recommended_energy: recommendation.energy.production_min_kwh_day,
    recommendation,
    solution_count: solutions.length,
    technical_solution_count: solutions.length,
    affordable_solution_count: affordableSolutions.length,
    budget_available: Math.round(budgetAvailable),
    budget_remaining: Math.round(budgetAvailable - recommendation.financial.installation_cost),
    metadata: {
      module: "SolarDimensioningService v1.0",
      method: "recherche exhaustive contrainte",
      evaluated_solution_count: solutions.length,
      system_efficiency: SOLAR_DIMENSIONING_CONFIG.system_efficiency,
      autonomy_min_days: SOLAR_DIMENSIONING_CONFIG.autonomy_min_days
    }
  };
}

async function loadSolarDimensioningData(financeData, dimensioningData, energyData, locationData) {
  const priceRows = await loadCSV("dynamiques/data/prix.csv", ";");
  return buildSolarDimensioningData(
    financeData,
    dimensioningData,
    energyData,
    locationData,
    priceRows
  );
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SOLAR_DIMENSIONING_CONFIG,
    buildSolarDimensioningData,
    searchConfigurations,
    prepareComponents
  };
}
