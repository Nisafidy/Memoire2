/**
 * DSAA — Module 7 : ESTIMATION DU BESOIN ENERGETIQUE
 *
 * Adapte un besoin essentiel de reference au family_score du menage.
 * Les parametres sont centralises afin d'etre calibres experimentalement.
 */

const ENERGY_CONFIG = {
  base_energy_need_kwh_day: 2,
  mean_score: 50,
  score_exponent: 0.2,
  days_per_month: 30,
  months_per_year: 12
};

function buildEnergyData(financeData) {
  const familyScore = Number(financeData?.family_score);

  if (!financeData || financeData.status !== "completed") {
    return {
      status: "blocked",
      reason: "Le besoin energetique depend d'un family_score complet.",
      essential_energy: null
    };
  }

  if (!Number.isFinite(familyScore) || familyScore < 0) {
    return {
      status: "blocked",
      reason: "Le family_score est absent ou invalide.",
      essential_energy: null
    };
  }

  const adaptationFactor = Math.pow(
    familyScore / ENERGY_CONFIG.mean_score,
    ENERGY_CONFIG.score_exponent
  );
  const dailyEnergy =
    ENERGY_CONFIG.base_energy_need_kwh_day * adaptationFactor;
  const monthlyEnergy = dailyEnergy * ENERGY_CONFIG.days_per_month;
  const annualEnergy = monthlyEnergy * ENERGY_CONFIG.months_per_year;

  return {
    status: "completed",
    family_score: familyScore,
    mean_score_reference: ENERGY_CONFIG.mean_score,
    adaptation_factor: Math.round(adaptationFactor * 10000) / 10000,
    essential_energy: Math.round(dailyEnergy * 100) / 100,
    essential_energy_daily_kwh: Math.round(dailyEnergy * 100) / 100,
    essential_energy_monthly_kwh: Math.round(monthlyEnergy * 100) / 100,
    essential_energy_annual_kwh: Math.round(annualEnergy * 100) / 100,
    unit: "kWh",
    period: {
      daily: "kWh/jour",
      monthly: "kWh/mois",
      annual: "kWh/an"
    },
    metadata: {
      module: "EnergyService v1.0",
      base_energy_need_kwh_day: ENERGY_CONFIG.base_energy_need_kwh_day,
      score_exponent: ENERGY_CONFIG.score_exponent,
      days_per_month: ENERGY_CONFIG.days_per_month,
      months_per_year: ENERGY_CONFIG.months_per_year
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ENERGY_CONFIG,
    buildEnergyData
  };
}
