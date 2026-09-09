/**
 * DSAA — Module 5 : CAPACITE FINANCIERE
 *
 * Calcule le fond mensuel theorique du menage a partir de familyData
 * et des scores individuels produits pour chaque activite.
 */

const FINANCE_CONFIG = {
  baseline_living_cost: 210000,
  equivalence_scale: 0.4,
  leisure_base: 25000,
  mean_score: 50,
  score_exponent: 0.2
};

function finitePositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function getScoredWorkerData(workers) {
  return workers.map((worker) => {
    const activities = Array.isArray(worker.activities)
      ? worker.activities
      : [];

    const scoredActivities = activities
      .map((activity) => ({
        salary: Number(activity.salary),
        score: Number(activity.scoreIndividuel)
      }))
      .filter((activity) =>
        finitePositive(activity.salary) &&
        Number.isFinite(activity.score) &&
        activity.score >= 0
      );

    const totalSalary = activities
      .map((activity) => Number(activity.salary))
      .filter((salary) => finitePositive(salary))
      .reduce((total, salary) => total + salary, 0);

    const scoredSalary = scoredActivities
      .reduce((total, activity) => total + activity.salary, 0);

    const activityScore = scoredSalary > 0
      ? scoredActivities.reduce(
          (total, activity) => total + activity.score * activity.salary,
          0
        ) / scoredSalary
      : null;

    return {
      role: worker.role,
      total_salary: totalSalary,
      scored_salary: scoredSalary,
      score: activityScore,
      scored_activity_count: scoredActivities.length
    };
  });
}

function calculateFamilyScore(workerData) {
  const eligibleWorkers = workerData.filter((worker) =>
    finitePositive(worker.total_salary) &&
    Number.isFinite(worker.score)
  );

  const salaryMax = eligibleWorkers.length > 0
    ? Math.max(...eligibleWorkers.map((worker) => worker.total_salary))
    : 0;

  const weightedWorkers = eligibleWorkers.map((worker) => {
    const weight = salaryMax > 0
      ? worker.total_salary / salaryMax
      : 0;

    return {
      role: worker.role,
      total_salary: worker.total_salary,
      score: Math.round(worker.score * 100) / 100,
      weight: Math.round(weight * 10000) / 10000
    };
  });

  const totalWeight = weightedWorkers.reduce(
    (total, worker) => total + worker.weight,
    0
  );

  const familyScore = totalWeight > 0
    ? weightedWorkers.reduce(
        (total, worker) => total + worker.score * worker.weight,
        0
      ) / totalWeight
    : null;

  return {
    workers: weightedWorkers,
    salary_max: salaryMax,
    family_score: familyScore === null
      ? null
      : Math.round(familyScore * 100) / 100,
    scored_worker_count: weightedWorkers.length
  };
}

function buildFinanceData(state) {
  const familyData = state.familyData;
  const family = state.family || {};
  const familySize = Number(familyData?.family_nbr ?? family.family_nbr);
  const workers = Array.isArray(family.workers) ? family.workers : [];

  if (!familyData || !Number.isFinite(familySize) || familySize <= 0) {
    return {
      error: "Profil familial incomplet",
      message: "Les donnees familiales sont necessaires au calcul du fond."
    };
  }

  const workerData = getScoredWorkerData(workers);
  const scoreData = calculateFamilyScore(workerData);
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
  const familyScore = scoreData.family_score;
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
    workers: scoreData.workers,
    salary_max: Math.round(scoreData.salary_max),
    living_cost: Math.round(livingCost),
    simultaneity: Math.round(simultaneity * 10000) / 10000,
    leisure_cost: leisureCost === null ? null : Math.round(leisureCost),
    fond: fond === null ? null : Math.round(fond),
    fond_positive: fond !== null && fond > 0,
    scored_worker_count: scoreData.scored_worker_count,
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
    buildFinanceData,
    calculateFamilyScore,
    getScoredWorkerData
  };
}
