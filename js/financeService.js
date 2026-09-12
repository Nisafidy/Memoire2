/**
 * DSAA — Module 5 : CAPACITE FINANCIERE
 *
 * Calcule le fond mensuel theorique du menage a partir de familyData
 * et des scores individuels produits pour chaque activite.
 */

const FINANCE_CONFIG = DSAA_CONFIG.finance;

function buildFinanceData(state) {
  const familyData = state.familyData;
  const family = state.family || {};
  const familySize = Number(familyData?.family_nbr ?? family.family_nbr);
  const workers = Array.isArray(family.workers) ? family.workers : [];
  const socioEconomicData = state.socioEconomicData;

  if (!familyData || !Number.isFinite(familySize) || familySize <= 0) {
    return {
      error: "Profil familial incomplet",
      message: "Les donnees familiales sont necessaires au calcul du fond."
    };
  }

  if (!socioEconomicData || socioEconomicData.status !== "completed") {
    return {
      error: "Score socio-economique incomplet",
      message: "Le family_score du Module 4 est necessaire au calcul du fond.",
      status: "scores_incomplets"
    };
  }

  const workerData = socioEconomicData.workers;
  const totalIncome = workerData.reduce(
    (total, worker) => total + worker.total_salary,
    0
  );
  const workerCount = workers.length;
  const nonWorkerCount = Math.max(0, familySize - workerCount);
  const livingCost = FINANCE_CONFIG.baseline_living_cost * (
    workerCount + FINANCE_CONFIG.equivalence_scale * nonWorkerCount
  );
  const simultaneity = 0.35 + 0.65 / Math.sqrt(familySize);
  const familyScore = socioEconomicData.family_score;
  const scoreFactor = familyScore === null
    ? null
    : Math.pow(
        Math.max(0, familyScore) / FINANCE_CONFIG.mean_score,
        FINANCE_CONFIG.score_exponent
      );
  const leisureCost = scoreFactor === null
    ? null
    : familySize * FINANCE_CONFIG.leisure_base *
      (1 - simultaneity) * scoreFactor;
  const fond = leisureCost === null
    ? null
    : totalIncome - livingCost - leisureCost;

  return {
    total_income: Math.round(totalIncome),
    family_size: familySize,
    worker_count: workerCount,
    non_worker_count: nonWorkerCount,
    family_score: familyScore,
    mean_score_reference: FINANCE_CONFIG.mean_score,
    workers: workerData,
    salary_max: Math.round(socioEconomicData.salary_max),
    living_cost: Math.round(livingCost),
    simultaneity: Math.round(simultaneity * 10000) / 10000,
    leisure_cost: leisureCost === null ? null : Math.round(leisureCost),
    fond: fond === null ? null : Math.round(fond),
    fond_positive: fond !== null && fond > 0,
    scored_worker_count: socioEconomicData.scored_worker_count,
    status: familyScore === null ? "scores_incomplets" : "completed",
    metadata: {
      module: "FinanceService v1.0",
      baseline_living_cost: FINANCE_CONFIG.baseline_living_cost,
      equivalence_scale: FINANCE_CONFIG.equivalence_scale,
      leisure_base: FINANCE_CONFIG.leisure_base,
      score_exponent: FINANCE_CONFIG.score_exponent
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FINANCE_CONFIG,
    buildFinanceData
  };
}
