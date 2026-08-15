/**
 * DSAA — Module 2 : SERVICE DE LOCALISATION
 * 
 * Responsabilités :
 * - Déterminer la ville de référence (nearest_town)
 * - Calculer les distances routières (approximation haversine)
 * - Récupérer les données d'irradiation (NASA POWER)
 * - Construire la structure locationData complète
 * 
 * Entrée : state.objectif, state.habitat, villes[], configuration
 * Sortie : locationData { objectif, nearest_town, transport, irradiation, ... }
 */

// ---------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------

const LOCATION_CONFIG = {
  baseline_living_cost: 210000,              // Ar/mois
  equivalence_scale: 0.4,
  leisure_base: 25000,                       // Ar/personne/mois
  mean_score: 50,                            // score moyen de référence
  
  // Coûts de transport selon direction géographique
  road_price: {
    est: 54,
    sud: 66,
    ouest: 125,
    nord: 125
  },
  
  // Frais de séjour (à ajouter au coût transport aller-retour)
  stay_fees: 50000,                          // Ar
  
  // Paramètres système
  earth_radius: 6371,                        // km
  autonomy_min: 1,                           // jours minimum
  mean_irradiation: 1075,                    // kWh/m²/an (référence Madagascar)
};

// ---------------------------------------------------------------
// 1. CALCUL DE DISTANCES
// ---------------------------------------------------------------

/**
 * Calcule la distance à vol d'oiseau (haversine)
 * @param {number} lat1, lon1, lat2, lon2 - Coordonnées en degrés
 * @returns {number} Distance en km
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = LOCATION_CONFIG.earth_radius;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Estime la distance routière à partir de la distance à vol d'oiseau
 * Facteur d'approximation : 1.3 (route typiquement 30% plus longue)
 * @param {number} straightDistance - Distance haversine en km
 * @returns {number} Distance routière estimée en km
 */
function estimateRoadDistance(straightDistance) {
  return straightDistance * 1.3;
}

/**
 * Détermine la direction géographique entre deux points
 * @param {number} lat1, lon1, lat2, lon2 - Coordonnées
 * @returns {string} "nord", "sud", "est", "ouest" ou "centre"
 */
function getDirection(lat1, lon1, lat2, lon2) {
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);
  
  if (angle >= -45 && angle < 45) return "nord";
  if (angle >= 45 && angle < 135) return "est";
  if (angle >= 135 || angle < -135) return "sud";
  return "ouest";
}

// ---------------------------------------------------------------
// 2. RECHERCHE DE LA VILLE DE RÉFÉRENCE
// ---------------------------------------------------------------

/**
 * Recherche la ville la plus proche de l'objectif
 * @param {object} objectif - { lat, long }
 * @param {array} villes - Tableau des villes disponibles
 * @returns {object} nearest_town avec toutes les infos
 */
function findNearestTown(objectif, villes) {
  if (!villes || villes.length === 0) {
    console.warn("Aucune ville disponible");
    return null;
  }

  let nearest = null;
  let bestDistance = Infinity;

  villes.forEach((v) => {
    const dist = haversineDistance(
      objectif.lat,
      objectif.long,
      Number(v.lat),
      Number(v.lng)
    );
    if (dist < bestDistance) {
      bestDistance = dist;
      nearest = v;
    }
  });

  // Ajouter les données calculées
  const nearestWithCalculations = {
    name: nearest.name,
    lat: Number(nearest.lat),
    long: Number(nearest.lng),
    population: Number(nearest.population) || 0,
    level: Number(nearest.level) || 3,
    priceCoeff: Number(nearest.priceCoeff) || 1.0,
    region: nearest.region || "",
    
    // Distance calculée
    straight_distance: bestDistance,
    road_distance: estimateRoadDistance(bestDistance),
    direction: getDirection(objectif.lat, objectif.long, Number(nearest.lat), Number(nearest.lng))
  };

  return nearestWithCalculations;
}

// ---------------------------------------------------------------
// 3. CALCUL DU COÛT DE TRANSPORT
// ---------------------------------------------------------------

/**
 * Calcule le coût de transport aller-retour
 * @param {number} roadDistance - Distance routière en km
 * @param {string} direction - Direction (nord, sud, est, ouest)
 * @param {number} stayFees - Frais de séjour en Ar
 * @returns {object} { one_way, round_trip, stay_fees, total }
 */
function calculateTransportCost(roadDistance, direction, stayFees = LOCATION_CONFIG.stay_fees) {
  const roadPrice = LOCATION_CONFIG.road_price[direction] || LOCATION_CONFIG.road_price.nord;
  const oneWay = roadDistance * roadPrice;
  const roundTrip = oneWay * 2;
  const total = roundTrip + stayFees;

  return {
    road_distance: roadDistance,
    road_price_per_km: roadPrice,
    direction: direction,
    one_way_cost: oneWay,
    round_trip_cost: roundTrip,
    stay_fees: stayFees,
    total_transport_cost: total
  };
}

// ---------------------------------------------------------------
// 4. RÉCUPÉRATION DE L'IRRADIATION (NASA POWER)
// ---------------------------------------------------------------

/**
 * Récupère l'irradiation solaire depuis NASA POWER
 * API : https://power.larc.nasa.gov/api/v1/
 * 
 * @param {number} lat, lon - Coordonnées
 * @returns {Promise} { monthly: [jan, fev, ...], annual, status }
 */
async function fetchSolarIrradiation(lat, lon) {
  // Pour Madagascar, utiliser des valeurs de référence par défaut
  // TODO: Implémenter l'appel NASA POWER API en production
  
  console.log(`[Irradiation] Récupération pour ${lat.toFixed(2)}, ${lon.toFixed(2)}`);

  // Valeurs par défaut (données moyennes Madagascar, kWh/m²/jour)
  const defaultIrradiation = {
    january: 4.5,
    february: 4.3,
    march: 4.2,
    april: 4.0,
    may: 3.8,
    june: 3.6,
    july: 3.7,
    august: 4.1,
    september: 4.5,
    october: 4.8,
    november: 4.9,
    december: 4.7
  };

  // Ajustement selon la latitude (estimation simple)
  // Madagascar est entre -12°S et -25°S
  const latFactor = 1 + (Math.abs(lat) - 18) * 0.01;

  const monthly = Object.entries(defaultIrradiation).map(([month, value]) => 
    Math.round(value * latFactor * 100) / 100
  );

  const annual = monthly.reduce((a, b) => a + b, 0) * 30; // Approximation : 30 jours par mois

  return {
    monthly: monthly,
    annual: Math.round(annual * 100) / 100,
    unit: "kWh/m²",
    source: "estimation reference Madagascar",
    note: "Ces données sont des estimations. Pour la production réelle, utiliser NASA POWER API."
  };
}

/**
 * Tentative d'appel à l'API NASA POWER (pour utilisation future)
 */
async function fetchNASAPOWER_API(lat, lon) {
  try {
    const url = `https://power.larc.nasa.gov/api/v1/geometry/point?parameters=ALLSKY_KT,CLRSKY_KT&longitude=${lon}&latitude=${lat}&start=20210101&end=20211231&format=JSON`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`NASA API error: ${response.status}`);
    return await response.json();
  } catch (e) {
    console.warn("NASA POWER API non disponible, utilisant estimations :", e.message);
    return null;
  }
}

// ---------------------------------------------------------------
// 5. CALCUL DE LA DISTANCE HABITAT → OBJECTIF
// ---------------------------------------------------------------

/**
 * Calcule la distance entre habitat et objectif (distance de déplacement)
 * @param {object} habitat - { lat, long }
 * @param {object} objectif - { lat, long }
 * @returns {number} Distance estimée en km
 */
function calculateDisplacementDistance(habitat, objectif) {
  const straight = haversineDistance(
    habitat.lat,
    habitat.long,
    objectif.lat,
    objectif.long
  );
  return estimateRoadDistance(straight);
}

// ---------------------------------------------------------------
// 6. CONSTRUCTION DE LA STRUCTURE locationData
// ---------------------------------------------------------------

/**
 * Fonction principale du service Module 2
 * Construit l'objet locationData complet
 * 
 * @param {object} state - État avec objectif, habitat, family
 * @param {array} villes - Liste des villes
 * @returns {Promise<object>} locationData complet
 */
async function buildLocationData(state, villes) {
  if (!state.objectif || !state.habitat) {
    return {
      error: "Localisation incomplète",
      message: "Objectif et habitat doivent être définis"
    };
  }

  // 1. Trouver la ville de référence
  const nearestTown = findNearestTown(state.objectif, villes);

  // 2. Calculer le transport
  const transportData = calculateTransportCost(
    nearestTown.road_distance,
    nearestTown.direction
  );

  // 3. Récupérer l'irradiation
  const irradiationData = await fetchSolarIrradiation(
    state.objectif.lat,
    state.objectif.long
  );

  // 4. Calculer distance habitat → objectif
  const displacementDistance = calculateDisplacementDistance(
    state.habitat,
    state.objectif
  );

  // 5. Construire la structure complète
  const locationData = {
    objectif: {
      lat: state.objectif.lat,
      long: state.objectif.long
    },

    habitat: {
      lat: state.habitat.lat,
      long: state.habitat.long
    },

    nearest_town: {
      name: nearestTown.name,
      lat: nearestTown.lat,
      long: nearestTown.long,
      population: nearestTown.population,
      level: nearestTown.level,
      priceCoeff: nearestTown.priceCoeff,
      region: nearestTown.region,
      road_distance: nearestTown.road_distance,
      direction: nearestTown.direction
    },

    transport: {
      road_distance: transportData.road_distance,
      road_price_per_km: transportData.road_price_per_km,
      direction: transportData.direction,
      one_way_cost: transportData.one_way_cost,
      round_trip_cost: transportData.round_trip_cost,
      stay_fees: transportData.stay_fees,
      total_transport_cost: transportData.total_transport_cost
    },

    displacement: {
      distance: displacementDistance,
      description: "Distance habitat → objectif (installation)"
    },

    irradiation: {
      monthly: irradiationData.monthly,
      annual: irradiationData.annual,
      unit: irradiationData.unit,
      source: irradiationData.source
    },

    metadata: {
      timestamp: new Date().toISOString(),
      module: "LocationService v2.0",
      status: "completed"
    }
  };

  return locationData;
}

// ---------------------------------------------------------------
// EXPORT (pour Node.js / modules ES6)
// ---------------------------------------------------------------

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildLocationData,
    findNearestTown,
    calculateTransportCost,
    fetchSolarIrradiation,
    haversineDistance,
    estimateRoadDistance,
    calculateDisplacementDistance,
    getDirection,
    LOCATION_CONFIG
  };
}
