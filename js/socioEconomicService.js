/**
 * DSAA — Module 4 : SCORE SOCIO-ECONOMIQUE
 *
 * Agrege les scores individuels des activites au niveau travailleur,
 * puis calcule le family_score selon la formule documentaire.
 */

const SOCIO_ECONOMIC_CONFIG = {
  mean_score: 50,
  model_version: "4.0"
};

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
        Number.isFinite(activity.salary) &&
        activity.salary > 0 &&
        Number.isFinite(activity.score) &&
        activity.score >= 0 &&
        activity.score <= 100
      );
    const totalSalary = activities
      .map((activity) => Number(activity.salary))
      .filter((salary) => Number.isFinite(salary) && salary > 0)
      .reduce((total, salary) => total + salary, 0);
    const scoredSalary = scoredActivities
      .reduce((total, activity) => total + activity.salary, 0);
    const score = scoredSalary > 0
      ? scoredActivities.reduce(
          (total, activity) => total + activity.score * activity.salary,
          0
        ) / scoredSalary
      : null;

    return {
      role: worker.role,
      total_salary: totalSalary,
      scored_salary: scoredSalary,
      score,
      scored_activity_count: scoredActivities.length
    };
  });
}

function calculateFamilyScore(workerData) {
  const eligibleWorkers = workerData.filter((worker) =>
    Number.isFinite(worker.total_salary) &&
    worker.total_salary > 0 &&
    Number.isFinite(worker.score)
  );
  const salaryMax = eligibleWorkers.length > 0
    ? Math.max(...eligibleWorkers.map((worker) => worker.total_salary))
    : 0;
  const workers = eligibleWorkers.map((worker) => ({
    role: worker.role,
    total_salary: worker.total_salary,
    score: Math.round(worker.score * 100) / 100,
    weight: salaryMax > 0
      ? Math.round((worker.total_salary / salaryMax) * 10000) / 10000
      : 0
  }));
  const totalWeight = workers.reduce(
    (total, worker) => total + worker.weight,
    0
  );
  const familyScore = totalWeight > 0
    ? workers.reduce(
        (total, worker) => total + worker.score * worker.weight,
        0
      ) / totalWeight
    : null;

  return {
    workers,
    salary_max: salaryMax,
    family_score: familyScore === null
      ? null
      : Math.round(familyScore * 100) / 100,
    scored_worker_count: workers.length
  };
}

function buildSocioEconomicData(state) {
  const workers = Array.isArray(state?.family?.workers)
    ? state.family.workers
    : [];
  const workerData = getScoredWorkerData(workers);
  const scoreData = calculateFamilyScore(workerData);

  return {
    ...scoreData,
    mean_score_reference: SOCIO_ECONOMIC_CONFIG.mean_score,
    model_version: SOCIO_ECONOMIC_CONFIG.model_version,
    status: scoreData.family_score === null
      ? "scores_incomplets"
      : "completed",
    metadata: {
      module: "SocioEconomicService v1.0",
      aggregation: "scores activites -> travailleurs -> famille"
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SOCIO_ECONOMIC_CONFIG,
    buildSocioEconomicData,
    calculateFamilyScore,
    getScoredWorkerData
  };
}
