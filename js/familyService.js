/**
 * DSAA — Module 3 : SERVICE DE PROFIL FAMILIAL
 * 
 * Responsabilités :
 * - Valider et structurer les données de profil familial
 * - Transformer la structure de collecte en structure d'export
 * - Calculer les statistiques du ménage
 * - Préparer les données pour Module 4 (score socio-économique)
 * 
 * Entrée : state.family (données brutes de l'interface)
 * Sortie : familyData { name, age, family_nbr, workers[], metadata, statistics }
 */

// ---------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------

const FAMILY_CONFIG = {
  min_family_size: 1,
  max_family_size: 30,
  min_age: 1,
  max_age: 110,
  
  // Rôles possibles par groupe d'âge
  roles_by_age: {
    youth: {      // 0-21 ans
      min: 0,
      max: 21,
      roles: ["père", "mère", "frère / sœur"]
    },
    adult: {      // 21-35 ans
      min: 21,
      max: 35,
      roles: ["vous", "époux / épouse", "père", "mère", "frère / sœur"]
    },
    mature: {     // 35-40 ans
      min: 35,
      max: 40,
      roles: ["vous", "époux / épouse", "père", "mère"]
    },
    senior: {     // 40+ ans
      min: 40,
      max: 150,
      roles: ["vous", "époux / épouse", "père", "mère", "enfant"]
    }
  }
};

// ---------------------------------------------------------------
// 1. VALIDATION
// ---------------------------------------------------------------

/**
 * Valide la structure de profil familial
 * @param {object} family - Données familiales brutes
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateFamily(family) {
  const errors = [];

  // Validation nom
  if (!family.name || family.name.trim().length === 0) {
    errors.push("Nom complet manquant");
  } else if (family.name.trim().length < 2) {
    errors.push("Nom trop court (min 2 caractères)");
  }

  // Validation âge
  if (!Number.isFinite(family.age)) {
    errors.push("Âge non valide");
  } else if (family.age < FAMILY_CONFIG.min_age || family.age > FAMILY_CONFIG.max_age) {
    errors.push(`Âge doit être entre ${FAMILY_CONFIG.min_age} et ${FAMILY_CONFIG.max_age} ans`);
  }

  // Validation nombre de personnes
  if (!Number.isFinite(family.family_nbr)) {
    errors.push("Nombre de personnes non valide");
  } else if (family.family_nbr < FAMILY_CONFIG.min_family_size || 
             family.family_nbr > FAMILY_CONFIG.max_family_size) {
    errors.push(`Nombre de personnes doit être entre ${FAMILY_CONFIG.min_family_size} et ${FAMILY_CONFIG.max_family_size}`);
  }

  // Validation travailleurs
  if (!Array.isArray(family.workers) || family.workers.length === 0) {
    errors.push("Au moins un travailleur doit être ajouté");
  } else {
    family.workers.forEach((w, idx) => {
      if (!w.role || w.role.length === 0) {
        errors.push(`Travailleur ${idx + 1} : rôle manquant`);
      }
      if (!Array.isArray(w.activities) || w.activities.length === 0) {
        errors.push(`Travailleur ${idx + 1} : au moins une activité doit être renseignée`);
      } else {
        w.activities.forEach((act, actIdx) => {
          if (!act.work || act.work.trim().length === 0) {
            errors.push(`Travailleur ${idx + 1}, activité ${actIdx + 1} : métier manquant`);
          }
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ---------------------------------------------------------------
// 2. TRANSFORMATION DES TRAVAILLEURS
// ---------------------------------------------------------------

/**
 * Transforme un travailleur de la structure d'interface 
 * vers la structure d'export
 * 
 * @param {object} workerRaw - { id, role, activities: [{ work, salary, source }] }
 * @returns {object} Travailleur transformé
 */
function transformWorker(workerRaw) {
  // Extraire work[], salary[], salary_source[] des activities
  const work = workerRaw.activities.map(a => a.work.trim());
  const salary = workerRaw.activities.map(a => a.salary);
  const salary_source = workerRaw.activities.map(a => a.source);

  // Revenu total du travailleur
  const total_salary = salary.reduce((sum, s) => sum + (s || 0), 0);

  return {
    role: workerRaw.role,
    work: work,
    salary: salary,
    salary_source: salary_source,
    total_salary: total_salary,
    activity_count: work.length
  };
}

// ---------------------------------------------------------------
// 3. CALCUL DES STATISTIQUES
// ---------------------------------------------------------------

/**
 * Calcule les statistiques du ménage
 * @param {object} familyData - Données familiales transformées
 * @returns {object} Statistiques
 */
function calculateFamilyStatistics(familyData) {
  const workers = familyData.workers;
  
  // Revenus
  const individual_salaries = workers.flatMap(w => w.salary.filter(s => s !== null));
  const total_income = individual_salaries.reduce((sum, s) => sum + s, 0);
  const max_salary = individual_salaries.length > 0 ? Math.max(...individual_salaries) : 0;
  const min_salary = individual_salaries.length > 0 ? Math.min(...individual_salaries) : 0;
  const avg_salary = individual_salaries.length > 0 ? total_income / individual_salaries.length : 0;

  // Nombre de travailleurs déclarés vs estimés
  const declared_count = workers.flatMap(w => w.salary_source).filter(s => s === "declared").length;
  const estimated_count = workers.flatMap(w => w.salary_source).filter(s => s === "estimated").length;

  // Couverture du revenu
  const has_declared_salary = declared_count > 0;
  const has_estimated_salary = estimated_count > 0;
  const salary_coverage = individual_salaries.length > 0 ? 
    (individual_salaries.length / (workers.length * 1)) * 100 : 0;

  // Non-travailleurs
  const non_workers = familyData.family_nbr - workers.length;

  return {
    total_income: Math.round(total_income),
    worker_count: workers.length,
    non_worker_count: non_workers,
    family_size: familyData.family_nbr,
    income_per_worker: workers.length > 0 ? Math.round(total_income / workers.length) : 0,
    income_per_person: familyData.family_nbr > 0 ? Math.round(total_income / familyData.family_nbr) : 0,
    
    max_salary: Math.round(max_salary),
    min_salary: Math.round(min_salary),
    avg_salary: Math.round(avg_salary),
    
    declared_salary_count: declared_count,
    estimated_salary_count: estimated_count,
    total_activities: workers.reduce((sum, w) => sum + w.activity_count, 0),
    
    has_declared_income: has_declared_salary,
    has_estimated_income: has_estimated_salary,
    salary_coverage_percent: Math.round(salary_coverage)
  };
}

// ---------------------------------------------------------------
// 4. DÉTERMINATION DU GROUPE D'ÂGE
// ---------------------------------------------------------------

/**
 * Retourne le groupe d'âge de l'utilisateur
 * @param {number} age - Âge en années
 * @returns {string} Groupe ("youth", "adult", "mature", "senior")
 */
function getAgeGroup(age) {
  for (const [key, config] of Object.entries(FAMILY_CONFIG.roles_by_age)) {
    if (age >= config.min && age < config.max) {
      return key;
    }
  }
  return "senior";
}

// ---------------------------------------------------------------
// 5. CONSTRUCTION DE LA STRUCTURE familyData
// ---------------------------------------------------------------

/**
 * Fonction principale du service Module 3
 * Valide, transforme et structure les données familiales
 * 
 * @param {object} state - État avec family données
 * @returns {object} familyData complet et structuré
 */
async function buildFamilyData(state) {
  // 1. Validation initiale
  const validation = validateFamily(state.family);
  if (!validation.valid) {
    return {
      error: "Validation échouée",
      message: validation.errors.join(" | "),
      details: validation.errors
    };
  }

  // 2. Transformer les travailleurs
  const transformedWorkers = state.family.workers.map(transformWorker);

  // 3. Créer la structure de sortie
  const familyData = {
    name: state.family.name.trim(),
    age: state.family.age,
    family_nbr: state.family.family_nbr,
    age_group: getAgeGroup(state.family.age),
    
    workers: transformedWorkers,
    
    statistics: calculateFamilyStatistics({
      ...state.family,
      workers: transformedWorkers
    }),
    
    metadata: {
      timestamp: new Date().toISOString(),
      module: "FamilyService v2.0",
      status: "completed",
      worker_count: transformedWorkers.length,
      total_activities: transformedWorkers.reduce((sum, w) => sum + w.activity_count, 0)
    }
  };

  return familyData;
}

// ---------------------------------------------------------------
// FONCTION AUXILIAIRE : Résumé lisible
// ---------------------------------------------------------------

/**
 * Génère un résumé texte du profil familial
 * @param {object} familyData - Données familiales
 * @returns {string} Résumé
 */
function getFamilySummary(familyData) {
  if (familyData.error) return `Erreur : ${familyData.message}`;

  const stats = familyData.statistics;
  const lines = [
    `📋 Profil familial : ${familyData.name} (${familyData.age} ans)`,
    `👥 Composition : ${familyData.family_nbr} personnes (${stats.worker_count} travailleurs, ${stats.non_worker_count} non-travailleurs)`,
    `💰 Revenu total : ${stats.total_income.toLocaleString()} Ar/mois`,
    `📊 Revenu par travailleur : ${stats.income_per_worker.toLocaleString()} Ar`,
    `📈 Revenu par personne : ${stats.income_per_person.toLocaleString()} Ar`,
    `🎯 Groupe d'âge : ${familyData.age_group}`,
    `📌 Activités : ${stats.total_activities} au total`,
    `✓ Salaires déclarés : ${stats.declared_salary_count}`,
    `≈ Salaires estimés : ${stats.estimated_salary_count}`
  ];

  return lines.join("\n");
}

// ---------------------------------------------------------------
// EXPORT (pour Node.js / modules ES6)
// ---------------------------------------------------------------

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildFamilyData,
    validateFamily,
    transformWorker,
    calculateFamilyStatistics,
    getAgeGroup,
    getFamilySummary,
    FAMILY_CONFIG
  };
}
