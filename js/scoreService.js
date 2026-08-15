/**
 * MODULE 4 — MODÈLE SOCIO-ÉCONOMIQUE
 * 
 * Calcul du score socio-économique des travailleurs
 * et agrégation en family_score
 * 
 * Version: 2.0
 * Date: 2026-08-15
 * 
 * Formule family_score:
 *   family_score = Σ(score_i × poids_i) / Σ(poids_i)
 *   où poids_i = salaire_i / salaire_max
 */

// ============================================================================
// CONFIGURATION — PROFESSION SCORES
// ============================================================================

/**
 * Table de référence: Métier → Score socio-économique de base
 * 
 * Le score reflète le niveau socio-économique moyen d'une profession,
 * basé sur:
 * - Niveau de qualification
 * - Secteur d'activité
 * - Stabilité de l'emploi
 * - Perspectives de revenu
 * 
 * Score: 0-100
 */
const PROFESSION_SCORES = {
  // AGRICULTURE
  "agriculteur": { base: 35, sector: "Agriculture", level: "primaire" },
  "Ouvrier agricole": { base: 33, sector: "Agriculture", level: "primaire" },
  "Chef de culture": { base: 48, sector: "Agriculture", level: "secondaire" },
  "Responsable d'exploitation agricole": { base: 62, sector: "Agriculture", level: "tertiaire" },
  "Fermier": { base: 40, sector: "Agriculture", level: "primaire" },
  
  // INDUSTRIE
  "Ouvrier non qualifié": { base: 38, sector: "Industrie", level: "primaire" },
  "Ouvrier qualifié": { base: 52, sector: "Industrie", level: "secondaire" },
  "Superviseur d'atelier": { base: 60, sector: "Industrie", level: "secondaire" },
  "Technicien de maintenance": { base: 58, sector: "Industrie", level: "secondaire" },
  "Ingénieur production": { base: 75, sector: "Industrie", level: "tertiaire" },
  "Ingénieur": { base: 78, sector: "Industrie", level: "tertiaire" },
  "Technicien": { base: 55, sector: "Industrie", level: "secondaire" },
  
  // BTP (Bâtiment & Travaux Publics)
  "Maine d'oeuvre": { base: 35, sector: "BTP", level: "primaire" },
  "Maçon": { base: 42, sector: "BTP", level: "primaire" },
  "Électricien bâtiment": { base: 52, sector: "BTP", level: "secondaire" },
  "Plombier": { base: 52, sector: "BTP", level: "secondaire" },
  "Chef de chantier": { base: 62, sector: "BTP", level: "secondaire" },
  "Conducteur de travaux": { base: 70, sector: "BTP", level: "tertiaire" },
  "Électricien": { base: 50, sector: "BTP", level: "secondaire" },
  
  // TRANSPORT & LOGISTIQUE
  "Chauffeur": { base: 45, sector: "Transport", level: "primaire" },
  "Livreur": { base: 40, sector: "Transport", level: "primaire" },
  "Chauffeur routier": { base: 48, sector: "Transport", level: "primaire" },
  "Logisticien": { base: 60, sector: "Transport", level: "secondaire" },
  
  // COMMERCE & SERVICES
  "Commerçant": { base: 48, sector: "Commerce", level: "secondaire" },
  "commerce": { base: 48, sector: "Commerce", level: "secondaire" },
  "Vendeur": { base: 42, sector: "Commerce", level: "primaire" },
  "Responsable magasin": { base: 55, sector: "Commerce", level: "secondaire" },
  "Restaurateur": { base: 52, sector: "Restauration", level: "secondaire" },
  "Cuisinier": { base: 45, sector: "Restauration", level: "primaire" },
  "Serveur": { base: 38, sector: "Restauration", level: "primaire" },
  
  // SANTÉ
  "Docteur": { base: 85, sector: "Santé", level: "tertiaire" },
  "Médecin": { base: 85, sector: "Santé", level: "tertiaire" },
  "Infirmier": { base: 65, sector: "Santé", level: "secondaire" },
  "Aide-soignant": { base: 48, sector: "Santé", level: "primaire" },
  
  // ÉDUCATION
  "Enseignant": { base: 72, sector: "Éducation", level: "tertiaire" },
  "Professeur": { base: 75, sector: "Éducation", level: "tertiaire" },
  "Directeur d'école": { base: 78, sector: "Éducation", level: "tertiaire" },
  "Formateur": { base: 70, sector: "Éducation", level: "tertiaire" },
  
  // ADMINISTRATION & GESTION
  "Comptable": { base: 70, sector: "Admin", level: "secondaire" },
  "Administrateur": { base: 72, sector: "Admin", level: "tertiaire" },
  "Directeur": { base: 80, sector: "Admin", level: "tertiaire" },
  "Responsable RH": { base: 75, sector: "Admin", level: "tertiaire" },
  "Secrétaire": { base: 52, sector: "Admin", level: "secondaire" },
  
  // IT & TECHNOLOGIES
  "Développeur": { base: 78, sector: "IT", level: "tertiaire" },
  "Informaticien": { base: 75, sector: "IT", level: "tertiaire" },
  "Administrateur réseau": { base: 72, sector: "IT", level: "tertiaire" },
  "Support informatique": { base: 62, sector: "IT", level: "secondaire" },
  
  // AUTRES
  "Ouvrier": { base: 38, sector: "Industrie", level: "primaire" },
  "Travailleur": { base: 42, sector: "Divers", level: "primaire" },
  "Employé": { base: 48, sector: "Services", level: "primaire" },
  "Responsable": { base: 65, sector: "Gestion", level: "secondaire" },
  "Retraité": { base: 55, sector: "Retraite", level: "N/A" },
  "Chômeur": { base: 25, sector: "Sans emploi", level: "N/A" },
  "Sans emploi": { base: 25, sector: "Sans emploi", level: "N/A" },
  "Étudiant": { base: 35, sector: "Éducation", level: "primaire" }
};

const SCORE_CONFIG = {
  min_score: 0,
  max_score: 100,
  default_score: 45,  // Score par défaut si métier non trouvé
  salary_adjustment_range: 15,  // ±15 points en fonction du salaire
  mean_score: 50,  // Score de référence pour normalisation
};

// ============================================================================
// CALCUL DES SCORES INDIVIDUELS
// ============================================================================

/**
 * Récupère le score de base pour une profession
 * 
 * @param {string} profession - Nom de la profession/métier
 * @returns {object} { base: number, sector: string, level: string }
 */
function getProfessionScoreBase(profession) {
  if (!profession) {
    return PROFESSION_SCORES["Travailleur"];
  }

  const prof = profession.trim().toLowerCase();

  // Recherche exacte
  for (const [key, value] of Object.entries(PROFESSION_SCORES)) {
    if (key.toLowerCase() === prof) {
      return value;
    }
  }

  // Recherche partielle (contient)
  for (const [key, value] of Object.entries(PROFESSION_SCORES)) {
    if (prof.includes(key.toLowerCase()) || key.toLowerCase().includes(prof)) {
      return value;
    }
  }

  // Retour par défaut
  return {
    base: SCORE_CONFIG.default_score,
    sector: "Divers",
    level: "primaire"
  };
}

/**
 * Ajuste le score en fonction du salaire
 * 
 * Logique:
 * - Si salaire > salaire_moyen du métier: score augmente
 * - Si salaire < salaire_moyen du métier: score diminue
 * 
 * @param {number} baseScore - Score de base (0-100)
 * @param {number} salary - Salaire mensuel (Ar)
 * @param {number} medianSalary - Salaire médian du métier (Ar)
 * @returns {number} Score ajusté (0-100)
 */
function adjustScoreBySalary(baseScore, salary, medianSalary) {
  if (!salary || !medianSalary) {
    return baseScore;
  }

  const salaryRatio = salary / medianSalary;
  
  // Ajustement: si salaire 50% plus élevé, +15 points; 50% moins élevé, -15 points
  let adjustment = 0;
  
  if (salaryRatio > 1) {
    // Salaire plus élevé: ajustement positif (plafond: +15 points)
    adjustment = Math.min(
      SCORE_CONFIG.salary_adjustment_range,
      (salaryRatio - 1) * 15
    );
  } else if (salaryRatio < 1) {
    // Salaire plus bas: ajustement négatif (plancher: -15 points)
    adjustment = Math.max(
      -SCORE_CONFIG.salary_adjustment_range,
      (salaryRatio - 1) * 15
    );
  }

  const adjustedScore = baseScore + adjustment;
  
  // Clamp entre min et max
  return Math.max(
    SCORE_CONFIG.min_score,
    Math.min(SCORE_CONFIG.max_score, adjustedScore)
  );
}

/**
 * Calcule le score individuel pour un travailleur
 * 
 * score_i = base_score + salary_adjustment
 * 
 * @param {object} worker - Travailleur transformé (voir familyService.js)
 *   { role, work[], salary[], salary_source[], total_salary, activity_count }
 * @param {object} metiers - Données de métiers chargées (pour salaires de référence)
 * @returns {object} { score_i, base_score, salary_adjustment, role, details }
 */
function calculateIndividualScore(worker, metiers) {
  if (!worker || !worker.work || worker.work.length === 0) {
    return {
      score_i: SCORE_CONFIG.default_score,
      base_score: SCORE_CONFIG.default_score,
      salary_adjustment: 0,
      role: worker?.role || "unknown",
      details: "Aucune activité déclarée"
    };
  }

  // Prendre la première activité (métier principal)
  const mainProfession = worker.work[0];
  const mainSalary = worker.salary[0] || 0;
  
  // Obtenir le score de base
  const professionData = getProfessionScoreBase(mainProfession);
  let baseScore = professionData.base;
  
  // Trouver le salaire de référence du métier
  let referenceSalary = null;
  if (metiers && metiers.length > 0) {
    const metierData = metiers.find(m => 
      m.metier?.toLowerCase() === mainProfession?.toLowerCase() ||
      m.metier?.toLowerCase().includes(mainProfession?.toLowerCase())
    );
    if (metierData) {
      referenceSalary = metierData.salaire_moyen_ariary || mainSalary;
    }
  }
  
  // Ajuster le score en fonction du salaire
  const salaryAdjustment = mainSalary && referenceSalary
    ? adjustScoreBySalary(baseScore, mainSalary, referenceSalary) - baseScore
    : 0;
  
  const finalScore = baseScore + salaryAdjustment;
  
  return {
    score_i: Math.round(finalScore * 100) / 100,
    base_score: baseScore,
    salary_adjustment: Math.round(salaryAdjustment * 100) / 100,
    role: worker.role,
    profession: mainProfession,
    salary: mainSalary,
    sector: professionData.sector,
    level: professionData.level,
    additional_activities: worker.activity_count - 1,
    details: `${mainProfession} (${professionData.sector})`
  };
}

// ============================================================================
// CALCUL DU SCORE FAMILIAL
// ============================================================================

/**
 * Calcule le poids d'un travailleur (pondération par salaire)
 * 
 * poids_i = salaire_i / salaire_max
 * 
 * @param {number} salary - Salaire du travailleur
 * @param {number} maxSalary - Salaire maximum dans le ménage
 * @returns {number} Poids (0-1)
 */
function calculateWorkerWeight(salary, maxSalary) {
  if (!maxSalary || maxSalary === 0) {
    return 0;
  }
  return salary / maxSalary;
}

/**
 * Calcule le score familial par agrégation pondérée
 * 
 * family_score = Σ(score_i × poids_i) / Σ(poids_i)
 * 
 * @param {array} individualScores - Array de { score_i, role, ... }
 * @returns {object} { family_score, weighted_scores, weights_sum, contribution }
 */
function calculateFamilyScore(individualScores) {
  if (!individualScores || individualScores.length === 0) {
    return {
      family_score: SCORE_CONFIG.default_score,
      weighted_scores: [],
      weights_sum: 0,
      contributions: [],
      details: "Aucun travailleur"
    };
  }

  // Trouver le salaire maximum pour pondération
  const maxSalary = Math.max(
    ...individualScores.map(s => s.salary || 0)
  );

  // Calculer les poids et scores pondérés
  const weightedData = individualScores.map(scoreData => {
    const weight = calculateWorkerWeight(scoreData.salary || 0, maxSalary);
    const weightedScore = scoreData.score_i * weight;
    
    return {
      role: scoreData.role,
      score_i: scoreData.score_i,
      weight: Math.round(weight * 10000) / 10000,
      weighted_score: Math.round(weightedScore * 100) / 100
    };
  });

  // Calculer la somme des poids
  const weightsSum = weightedData.reduce((sum, w) => sum + w.weight, 0);
  
  // Calculer le score familial
  const weightedScoresSum = weightedData.reduce((sum, w) => sum + w.weighted_score, 0);
  const familyScore = weightsSum > 0
    ? (weightedScoresSum / weightsSum)
    : SCORE_CONFIG.default_score;

  return {
    family_score: Math.round(familyScore * 100) / 100,
    weighted_scores: weightedData,
    weights_sum: Math.round(weightsSum * 10000) / 10000,
    worker_count: individualScores.length,
    max_salary: maxSalary,
    details: `Agrégation de ${individualScores.length} travailleur(s)`
  };
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

/**
 * Construit les données de score socio-économique
 * 
 * Flux:
 *   1. Valider l'input (familyData du Module 3)
 *   2. Calculer score individuel pour chaque travailleur
 *   3. Agréger en family_score
 *   4. Retourner la structure complète
 * 
 * @param {object} familyData - Output du Module 3 (familyService.js)
 * @param {array} metiers - Données de métiers chargées (pour salaires de référence)
 * @returns {object} scoreData complet
 */
async function buildScoreData(familyData, metiers) {
  if (!familyData) {
    return {
      error: "Données familiales manquantes",
      message: "Module 3 doit être exécuté avant Module 4"
    };
  }

  if (!familyData.workers || familyData.workers.length === 0) {
    return {
      error: "Aucun travailleur",
      message: "Au moins un travailleur est requis"
    };
  }

  try {
    // Calculer les scores individuels
    const individualScores = familyData.workers.map(worker =>
      calculateIndividualScore(worker, metiers)
    );

    // Calculer le score familial
    const familyScoreData = calculateFamilyScore(individualScores);

    // Structurer l'output complet
    const scoreData = {
      individual_scores: individualScores,
      family_score: familyScoreData.family_score,
      family_score_category: categorizeScore(familyScoreData.family_score),
      aggregation: {
        method: "Pondération par salaire",
        formula: "Σ(score_i × poids_i) / Σ(poids_i)",
        worker_count: familyScoreData.worker_count,
        weights_sum: familyScoreData.weights_sum,
        weighted_components: familyScoreData.weighted_scores
      },
      statistics: {
        avg_individual_score: Math.round(
          individualScores.reduce((sum, s) => sum + s.score_i, 0) / individualScores.length * 100
        ) / 100,
        max_individual_score: Math.max(...individualScores.map(s => s.score_i)),
        min_individual_score: Math.min(...individualScores.map(s => s.score_i)),
        score_variance: calculateVariance(individualScores.map(s => s.score_i)),
        score_std_dev: calculateStdDev(individualScores.map(s => s.score_i))
      },
      metadata: {
        timestamp: new Date().toISOString(),
        module: "ScoreService v2.0",
        status: "completed",
        mean_reference_score: SCORE_CONFIG.mean_score
      }
    };

    return scoreData;
  } catch (error) {
    return {
      error: "Erreur calcul score",
      message: error.message,
      details: error.stack
    };
  }
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Catégorise un score en niveau socio-économique
 * 
 * @param {number} score - Score 0-100
 * @returns {string} Catégorie
 */
function categorizeScore(score) {
  if (score < 20) return "Très faible";
  if (score < 35) return "Faible";
  if (score < 50) return "Moyen-bas";
  if (score < 65) return "Moyen";
  if (score < 80) return "Moyen-haut";
  return "Élevé";
}

/**
 * Calcule la variance d'un array de nombres
 * 
 * @param {array} values - Array de nombres
 * @returns {number} Variance
 */
function calculateVariance(values) {
  if (!values || values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.round(variance * 100) / 100;
}

/**
 * Calcule l'écart-type d'un array de nombres
 * 
 * @param {array} values - Array de nombres
 * @returns {number} Écart-type
 */
function calculateStdDev(values) {
  const variance = calculateVariance(values);
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

/**
 * Génère un résumé lisible des scores
 * 
 * @param {object} scoreData - Output de buildScoreData()
 * @returns {string} Texte de résumé
 */
function getScoreSummary(scoreData) {
  if (scoreData.error) {
    return `Erreur: ${scoreData.message}`;
  }

  const lines = [
    `Score familial : ${scoreData.family_score}/100 (${scoreData.family_score_category})`,
    `Nombre de travailleurs : ${scoreData.aggregation.worker_count}`,
    `Score moyen individuel : ${scoreData.statistics.avg_individual_score}`,
    `Écart-type : ${scoreData.statistics.score_std_dev}`
  ];

  if (scoreData.individual_scores && scoreData.individual_scores.length > 0) {
    lines.push("\nDétails individuels:");
    scoreData.individual_scores.forEach((score, i) => {
      lines.push(`  ${i + 1}. ${score.role} (${score.profession}): ${score.score_i}/100`);
    });
  }

  return lines.join("\n");
}

// ============================================================================
// EXPORT
// ============================================================================

// Pour utilisation en tant que module
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildScoreData,
    calculateIndividualScore,
    calculateFamilyScore,
    getScoreSummary,
    SCORE_CONFIG,
    PROFESSION_SCORES
  };
}
