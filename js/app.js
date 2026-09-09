/**
 * DSAA — Module 1 : Interface de saisie
 *
 * Construit progressivement l'objet `state`, transmis en sortie
 * aux services :
 *   - Module 2 : localisation
 *   - Module 3 : profil familial
 *   - Modules suivants : score socio-économique
 *
 * Gestion des métiers :
 *   metier.csv
 *      ↓
 *   normalisation
 *      ↓
 *   correspondance exacte / alias / tokens
 *      ↓
 *   estimation du salaire
 *      ↓
 *   state.family.workers[].activities[]
 *      ↓
 *   FamilyService
 */

// ================================================================
// ÉTAT GLOBAL
// ================================================================

const state = {
  objectif: null,
  habitat: null,

  // Module 2
  locationData: null,

  // Module 3
  familyData: null,

  // Module 4
  socioEconomicData: null,

  // Module 5
  financeData: null,

  // Module 6
  dimensioningData: null,

  // Module 7
  energyData: null,

  // Module 8
  solarDimensioningData: null,

  family: {
    name: "",
    age: null,
    family_nbr: null,

    workers: []
    /*
      {
        id,
        role,
        activities: [
          {
            work,
            salary,
            source,
            salary_reference,
            salary_match_type,
            salary_match_confidence
          }
        ]
      }
    */
  }
};

let currentStep = 1;
const TOTAL_STEPS = 4;

// ================================================================
// DONNÉES DE RÉFÉRENCE
// ================================================================

const metierIndex = new Map();
const metierNames = [];
let villes = [];

// ================================================================
// NORMALISATION DES MÉTIERS
// ================================================================

/**
 * Transforme toutes les variantes d'écriture vers une forme
 * comparable.
 *
 * Exemple :
 *   "Opératrice de saisie"
 *   "operatrice-de-saisie"
 *   "OPÉRATRICE DE SAISIE"
 *
 * deviennent :
 *
 *   "operatrice de saisie"
 */
function normalizeMetier(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// ================================================================
// ALIAS MÉTIERS
// ================================================================

/**
 * Les alias sont écrits normalement ici.
 *
 * Ils seront automatiquement normalisés au chargement.
 */
const rawMetierAliases = {
  "petit commerce": "vendeur",
  "petite commerce": "vendeur",
  "vendeuse": "vendeur",
  "vendeur ambulant": "vendeur",
  "vendeuse ambulante": "vendeur",

  "operatrice de saisie": "agent administratif",
  "operateur de saisie": "agent administratif",
  "opératrice de saisie": "agent administratif",
  "opérateur de saisie": "agent administratif",
  "agent de saisie": "agent administratif",
  "saisie informatique": "agent administratif",

  "developpeuse junior": "développeur junior",
  "dev junior": "développeur junior",
  "developpeur web junior": "développeur junior",
  "developpeuse web junior": "développeur junior",

  "macon batiment": "maçon",
  "maçon batiment": "maçon",
  "ouvrier macon": "maçon",
  "ouvrier maçon": "maçon"
};

/**
 * Map normalisée des alias.
 *
 * Cela évite le problème :
 *
 * normalizeMetier("Opératrice de saisie")
 * → "operatrice de saisie"
 *
 * alors que la clé originale pourrait contenir un accent.
 */
const metierAliases = new Map();

Object.entries(rawMetierAliases).forEach(([alias, reference]) => {
  metierAliases.set(
    normalizeMetier(alias),
    normalizeMetier(reference)
  );
});

// ================================================================
// SIMILARITÉ PAR TOKENS
// ================================================================

function tokenSimilarity(a, b) {
  const aTokens = new Set(
    normalizeMetier(a)
      .split(" ")
      .filter(Boolean)
  );

  const bTokens = new Set(
    normalizeMetier(b)
      .split(" ")
      .filter(Boolean)
  );

  if (!aTokens.size || !bTokens.size) {
    return 0;
  }

  let common = 0;

  aTokens.forEach((token) => {
    if (bTokens.has(token)) {
      common++;
    }
  });

  const union = new Set([
    ...aTokens,
    ...bTokens
  ]).size;

  return union ? common / union : 0;
}

// ================================================================
// RECHERCHE D'UNE RÉFÉRENCE MÉTIER
// ================================================================

function findMetierReference(work) {
  const input = normalizeMetier(work);

  if (!input) {
    return null;
  }

  // --------------------------------------------------------------
  // 1. CORRESPONDANCE EXACTE
  // --------------------------------------------------------------

  const exact = metierIndex.get(input);

  if (exact) {
    return {
      ...exact,
      reference: input,
      match_type: "exact",
      confidence: 1
    };
  }

  // --------------------------------------------------------------
  // 2. ALIAS
  // --------------------------------------------------------------

  const aliasReference = metierAliases.get(input);

  if (aliasReference) {
    const aliasMatch = metierIndex.get(aliasReference);

    if (aliasMatch) {
      return {
        ...aliasMatch,
        reference: aliasReference,
        match_type: "alias",
        confidence: 0.95
      };
    }
  }

  // --------------------------------------------------------------
  // 3. RECHERCHE PAR TOKENS
  // --------------------------------------------------------------

  let bestMatch = null;
  let bestScore = 0;

  for (const [key, data] of metierIndex.entries()) {
    const score = tokenSimilarity(input, key);

    if (score > bestScore) {
      bestScore = score;

      bestMatch = {
        ...data,
        reference: key
      };
    }
  }

  /**
   * On évite les rapprochements hasardeux.
   *
   * Exemple :
   * "responsable logistique" → "responsable commercial"
   *
   * ne doit pas être accepté uniquement parce que
   * le mot "responsable" est commun.
   */
  if (bestMatch && bestScore >= 0.5) {
    return {
      ...bestMatch,
      match_type: "token",
      confidence: bestScore
    };
  }

  return null;
}

// ================================================================
// APPLICATION DE L'ESTIMATION DE SALAIRE (AVEC TRACABILITÉ)
// ================================================================

function applyEstimatedSalary(act) {
  const match = findMetierReference(act.work);

  // Aucun métier correspondant OU salaire de référence invalide
  if (
    !match ||
    !Number.isFinite(match.salaire_moyen_ariary) ||
    match.salaire_moyen_ariary <= 0
  ) {
    act.salary = null;
    act.source = "unresolved";
    act.salary_reference = match?.reference || null;
    act.salary_match_type = match?.match_type || null;
    act.salary_match_confidence = match?.confidence || 0;

    return false;
  }

  // Estimation trouvée
  act.salary = match.salaire_moyen_ariary;
  act.source = "estimated";
  act.salary_reference = match.reference;
  act.salary_match_type = match.match_type;
  act.salary_match_confidence = match.confidence;

  return true;
}

// ================================================================
// RÉSOLUTION DU LIBELLÉ "metier_trouve" (FEATURE ML)
// ================================================================

/**
 * Détermine le libellé de métier à envoyer au modèle ML
 * (feature `metier_trouve`), INDÉPENDAMMENT du fait qu'un
 * salaire ait été déclaré manuellement ou estimé.
 *
 * On réutilise findMetierReference() pour profiter de la
 * correspondance exacte / alias / tokens, et on renvoie le
 * libellé D'ORIGINE (avec casse et accents), tel que présent
 * dans metier.csv et utilisé à l'entraînement du modèle.
 *
 * Si aucune correspondance fiable n'est trouvée, on retombe
 * sur le texte brut saisi par l'utilisateur : le pipeline ML
 * traitera alors cette valeur comme une catégorie inconnue
 * (encodage ignoré) plutôt que de faire échouer la prédiction.
 */
function resolveMetierTrouve(work) {
  const match = findMetierReference(work);

  if (match && match.label) {
    return match.label;
  }

  const trimmed = (work || "").toString().trim();

  return trimmed || null;
}

// ================================================================
// ENRICHISSEMENT AUTOMATIQUE DE METIER.CSV
// ================================================================

async function enrichMetierReference(activity) {

  try {

    // ==============================================================
    // VÉRIFICATION DES DONNÉES
    // ==============================================================

    const metier = String(
      activity.work ?? ""
    ).trim();

    const salaire = Number(
      activity.salary
    );

    if (!metier) {
      console.warn(
        "⚠️ Enrichissement annulé : métier vide."
      );

      return false;
    }

    if (
      !Number.isFinite(salaire) ||
      salaire <= 0
    ) {
      console.warn(
        "⚠️ Enrichissement annulé : salaire invalide."
      );

      return false;
    }

    // ==============================================================
    // ENVOI AU PHP
    // ==============================================================

    const response = await fetch(
      "enrichir_metier.php",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          metier: metier,
          salaire: salaire,
          secteur:
            activity.secteur ??
            "Non classé"
        })
      }
    );

    // ==============================================================
    // RÉCUPÉRATION DE LA RÉPONSE
    // ==============================================================

    const text =
      await response.text();

    console.log(
      "Réponse PHP :",
      text
    );

    let result;

    try {

      result =
        JSON.parse(text);

    } catch (jsonError) {

      console.error(
        "⚠️ Réponse PHP invalide :",
        text
      );

      return false;
    }

    // ==============================================================
    // TRAITEMENT DU RÉSULTAT
    // ==============================================================

    if (!result.success) {

      console.warn(
        "⚠️",
        result.message
      );

      return false;
    }

    console.log(
      "✓ metier.csv enrichi :",
      result.message
    );

    return true;

  } catch (error) {

    console.error(
      "⚠️ Erreur enrichissement metier.csv :",
      error
    );

    return false;
  }
}


// ================================================================
// CHARGEMENT DES DONNÉES DE RÉFÉRENCE
// ================================================================

async function loadReferenceData() {

  // --------------------------------------------------------------
  // METIERS
  // --------------------------------------------------------------

  try {

    const metiers = await loadCSV(
      "dynamiques/data/metier.csv",
      ","
    );

    metiers.forEach((row) => {

      const rawName = row.metier;

      const key = normalizeMetier(rawName);

      if (!key) {
        return;
      }

      const salary = Number(
        String(row.salaire_moyen_ariary || "")
          .replace(/\s/g, "")
          .replace(",", ".")
      );

      metierIndex.set(key, {

        // Libellé d'origine (casse/accents), tel qu'utilisé
        // pour entraîner le modèle (feature `metier_trouve`).
        label: rawName,

        secteur: row.secteur || null,

        salaire_moyen_ariary:
          Number.isFinite(salary) && salary > 0
            ? salary
            : null,

        type: row.type || null

      });

      if (rawName && !metierNames.includes(rawName)) {
        metierNames.push(rawName);
      }

    });

    console.log(
      `✓ metier.csv chargé : ${metierIndex.size} métiers`
    );

  } catch (e) {

    console.warn(
      "⚠️ metier.csv non chargé :",
      e.message
    );

  }

  // --------------------------------------------------------------
  // VILLES
  // --------------------------------------------------------------

  try {

    villes = await loadCSV(
      "dynamiques/data/villes.csv",
      ","
    );

    console.log(
      `✓ villes.csv chargé : ${villes.length} villes`
    );

  } catch (e) {

    console.warn(
      "⚠️ villes.csv non chargé :",
      e.message
    );

  }

  // --------------------------------------------------------------
  // DATALIST MÉTIERS
  // --------------------------------------------------------------

  let datalist = document.getElementById(
    "metier-options"
  );

  if (!datalist) {

    datalist = document.createElement("datalist");

    datalist.id = "metier-options";

    document.body.appendChild(datalist);
  }

  datalist.innerHTML = "";

  metierNames.forEach((name) => {

    const option = document.createElement("option");

    option.value = name;

    datalist.appendChild(option);

  });
}

// ================================================================
// ÉTAPE 1 — CARTE
// ================================================================

let map = null;
let markerObjectif = null;
let markerHabitat = null;
let installationLine = null;

// ================================================================
// INITIALISATION CARTE
// ================================================================

function initMap() {

  map = L.map("map").setView(
    [-18.9, 47.0],
    6
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        "&copy; OpenStreetMap contributors",

      maxZoom: 18
    }
  ).addTo(map);

  map.on("click", (e) => {

    // ------------------------------------------------------------
    // OBJECTIF
    // ------------------------------------------------------------

    if (!state.objectif) {

      state.objectif = {
        lat: e.latlng.lat,
        long: e.latlng.lng
      };

      markerObjectif = L.marker(
        e.latlng,
        {
          title: "Objectif"
        }
      )
        .addTo(map)
        .bindPopup(
          "Objectif (installation)"
        )
        .openPopup();

      updateCoordChips();

      previewNearestTown();

    }

    // ------------------------------------------------------------
    // HABITAT
    // ------------------------------------------------------------

    else if (!state.habitat) {

      state.habitat = {
        lat: e.latlng.lat,
        long: e.latlng.lng
      };

      markerHabitat = L.marker(
        e.latlng,
        {
          title: "Habitat",

          icon: L.icon({
            iconUrl:
              "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",

            iconSize: [20, 33],

            className:
              "habitat-marker"
          })
        }
      )
        .addTo(map)
        .bindPopup("Habitat")
        .openPopup();

      installationLine = L.polyline(
        [
          markerObjectif.getLatLng(),
          markerHabitat.getLatLng()
        ],
        {
          color: "#a3431f",
          dashArray: "4 4"
        }
      ).addTo(map);

      updateCoordChips();
    }

    updateNextButtonState();
  });
}

// ================================================================
// COORDONNÉES
// ================================================================

function updateCoordChips() {

  const coordObjectif =
    document.getElementById(
      "coord-objectif"
    );

  const coordHabitat =
    document.getElementById(
      "coord-habitat"
    );

  const chipObjectif =
    document.getElementById(
      "chip-objectif"
    );

  const chipHabitat =
    document.getElementById(
      "chip-habitat"
    );

  if (state.objectif) {

    coordObjectif.textContent =
      `${state.objectif.lat.toFixed(4)}, ${state.objectif.long.toFixed(4)}`;

    chipObjectif.classList.add(
      "filled"
    );
  }

  if (state.habitat) {

    coordHabitat.textContent =
      `${state.habitat.lat.toFixed(4)}, ${state.habitat.long.toFixed(4)}`;

    chipHabitat.classList.add(
      "filled"
    );
  }
}

// ================================================================
// HAVERSINE
// ================================================================

function haversine(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +

    Math.cos(
      (lat1 * Math.PI) / 180
    ) *

    Math.cos(
      (lat2 * Math.PI) / 180
    ) *

    Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.asin(
      Math.sqrt(a)
    )
  );
}

// ================================================================
// APERÇU VILLE LA PLUS PROCHE
// ================================================================

function previewNearestTown() {

  if (
    !villes.length ||
    !state.objectif
  ) {
    return;
  }

  let nearest = null;
  let best = Infinity;

  villes.forEach((v) => {

    const lat = Number(v.lat);
    const lng = Number(v.lng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return;
    }

    const distance = haversine(
      state.objectif.lat,
      state.objectif.long,
      lat,
      lng
    );

    if (distance < best) {

      best = distance;
      nearest = v;
    }
  });

  const el =
    document.getElementById(
      "town-preview"
    );

  if (!el || !nearest) {
    return;
  }

  el.style.display = "block";

  el.innerHTML = `
    Ville de référence la plus proche
    (à vol d'oiseau) :
    <strong>${nearest.name}</strong>
    — ≈ ${best.toFixed(1)} km.

    <br>

    <span class="hint">
      La distance routière exacte sera calculée
      par le module de localisation
      (OSRM/Valhalla).
    </span>
  `;
}

// ================================================================
// RESET CARTE
// ================================================================

const resetMapButton =
  document.getElementById(
    "reset-map"
  );

if (resetMapButton) {

  resetMapButton.addEventListener(
    "click",
    () => {

      state.objectif = null;
      state.habitat = null;

      if (markerObjectif) {
        map.removeLayer(
          markerObjectif
        );
      }

      if (markerHabitat) {
        map.removeLayer(
          markerHabitat
        );
      }

      if (installationLine) {
        map.removeLayer(
          installationLine
        );
      }

      markerObjectif = null;
      markerHabitat = null;
      installationLine = null;

      document.getElementById(
        "coord-objectif"
      ).textContent =
        "— non défini —";

      document.getElementById(
        "coord-habitat"
      ).textContent =
        "— non défini —";

      document.getElementById(
        "chip-objectif"
      ).classList.remove(
        "filled"
      );

      document.getElementById(
        "chip-habitat"
      ).classList.remove(
        "filled"
      );

      document.getElementById(
        "town-preview"
      ).style.display = "none";

      // Les données du Module 2 doivent être recalculées
      state.locationData = null;

      updateNextButtonState();
    }
  );
}

// ================================================================
// ÉTAPE 2 — PROFIL FAMILIAL
// ================================================================

function getRolesForAge(age) {

  if (age <= 21) {
    return [
      "père",
      "mère",
      "frère / sœur"
    ];
  }

  if (age <= 35) {
    return [
      "vous",
      "époux / épouse",
      "père",
      "mère",
      "frère / sœur"
    ];
  }

  if (age <= 40) {
    return [
      "vous",
      "époux / épouse",
      "père",
      "mère"
    ];
  }

  return [
    "vous",
    "époux / épouse",
    "père",
    "mère",
    "enfant"
  ];
}

// ================================================================
// NOM
// ================================================================

const nameInput =
  document.getElementById(
    "f-name"
  );

if (nameInput) {

  nameInput.addEventListener(
    "input",
    (e) => {

      state.family.name =
        e.target.value;

      state.familyData = null;

      updateNextButtonState();
    }
  );
}

// ================================================================
// ÂGE
// ================================================================

const ageInput =
  document.getElementById(
    "f-age"
  );

if (ageInput) {

  ageInput.addEventListener(
    "input",
    (e) => {

      state.family.age =
        Number(e.target.value) || null;

      state.familyData = null;

      const hint =
        document.getElementById(
          "age-hint"
        );

      if (
        hint &&
        state.family.age
      ) {

        const roles =
          getRolesForAge(
            state.family.age
          );

        hint.textContent =
          `Relations proposées pour ce profil : ${roles.join(", ")}.`;

      }
      else if (hint) {

        hint.textContent = "";
      }

      renderWorkers();

      updateNextButtonState();
    }
  );
}

// ================================================================
// TAILLE DU FOYER
// ================================================================

const familyNumberInput =
  document.getElementById(
    "f-nbr"
  );

if (familyNumberInput) {

  familyNumberInput.addEventListener(
    "input",
    (e) => {

      state.family.family_nbr =
        Number(e.target.value) || null;

      state.familyData = null;

      updateNextButtonState();
    }
  );
}

// ================================================================
// ÉTAPE 3 — TRAVAILLEURS
// ================================================================

let workerAutoId = 1;

// ================================================================
// FACTORY ACTIVITÉ
// ================================================================

function createEmptyActivity() {

  return {
    work: "",
    salary: null,

    // null = aucune décision prise
    // declared = salaire fourni par utilisateur
    // estimated = salaire issu de metier.csv
    // unresolved = métier non reconnu
    source: null,

    salary_reference: null,
    salary_match_type: null,
    salary_match_confidence: 0,

    // Libellé "propre" du métier (casse/accents d'origine),
    // utilisé comme feature `metier_trouve` par le modèle ML.
    metier_trouve: null,

    // Score individuel calculé par calculer_score.php pour CETTE activité.
    scoreIndividuel: null
  };
}

// ================================================================
// AJOUT TRAVAILLEUR
// ================================================================

function addWorker() {

  state.family.workers.push({

    id: workerAutoId++,

    role: "",

    activities: [
      createEmptyActivity()
    ]
  });

  state.familyData = null;

  renderWorkers();
}

// ================================================================
// SUPPRESSION TRAVAILLEUR
// ================================================================

function removeWorker(id) {

  state.family.workers =
    state.family.workers.filter(
      (worker) =>
        worker.id !== id
    );

  state.familyData = null;

  renderWorkers();
}

// ================================================================
// AJOUT ACTIVITÉ
// ================================================================

function addActivity(workerId) {

  const worker =
    state.family.workers.find(
      (w) => w.id === workerId
    );

  if (!worker) {
    return;
  }

  worker.activities.push(
    createEmptyActivity()
  );

  state.familyData = null;

  renderWorkers();
}

// ================================================================
// SUPPRESSION ACTIVITÉ
// ================================================================

function removeActivity(
  workerId,
  index
) {

  const worker =
    state.family.workers.find(
      (w) => w.id === workerId
    );

  if (!worker) {
    return;
  }

  worker.activities.splice(
    index,
    1
  );

  if (
    worker.activities.length === 0
  ) {

    worker.activities.push(
      createEmptyActivity()
    );
  }

  state.familyData = null;

  renderWorkers();
}

// ================================================================
// RENDU DES TRAVAILLEURS
// ================================================================

function renderWorkers() {

  const container =
    document.getElementById(
      "workers-container"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const roles =
    getRolesForAge(
      state.family.age || 30
    );

  state.family.workers.forEach(
    (worker) => {

      const block =
        document.createElement(
          "div"
        );

      block.className =
        "worker-block";

      // ----------------------------------------------------------
      // TITRE
      // ----------------------------------------------------------

      const title =
        document.createElement(
          "div"
        );

      title.className =
        "worker-title";

      title.textContent =
        `Travailleur #${worker.id}`;

      block.appendChild(title);

      // ----------------------------------------------------------
      // RÔLE
      // ----------------------------------------------------------

      const roleField =
        document.createElement(
          "div"
        );

      roleField.className =
        "field";

      const roleLabel =
        document.createElement(
          "label"
        );

      roleLabel.textContent =
        "Rôle dans le foyer";

      roleField.appendChild(
        roleLabel
      );

      const roleSelect =
        document.createElement(
          "select"
        );

      const emptyOption =
        document.createElement(
          "option"
        );

      emptyOption.value = "";
      emptyOption.textContent =
        "— choisir —";

      roleSelect.appendChild(
        emptyOption
      );

      roles.forEach((role) => {

        const option =
          document.createElement(
            "option"
          );

        option.value = role;
        option.textContent = role;

        if (
          worker.role === role
        ) {
          option.selected = true;
        }

        roleSelect.appendChild(
          option
        );
      });

      roleSelect.addEventListener(
        "change",
        (e) => {

          worker.role =
            e.target.value;

          state.familyData = null;

          updateNextButtonState();
        }
      );

      roleField.appendChild(
        roleSelect
      );

      block.appendChild(
        roleField
      );

      // ----------------------------------------------------------
      // ACTIVITÉS
      // ----------------------------------------------------------

      const activitiesTitle =
        document.createElement(
          "h3"
        );

      activitiesTitle.textContent =
        "Activités";

      block.appendChild(
        activitiesTitle
      );

      worker.activities.forEach(
        (activity, activityIndex) => {

          const row =
            document.createElement(
              "div"
            );

          row.className =
            "activity-row";

          // ======================================================
          // MÉTIER
          // ======================================================

          const workField =
            document.createElement(
              "div"
            );

          workField.className =
            "field";

          const workLabel =
            document.createElement(
              "label"
            );

          workLabel.textContent =
            "Métier / activité";

          workField.appendChild(
            workLabel
          );

          const workInput =
            document.createElement(
              "input"
            );

          workInput.type = "text";

          workInput.setAttribute(
            "list",
            "metier-options"
          );

          workInput.placeholder =
            "Ex. agriculteur";

          workInput.value =
            activity.work;

          // ------------------------------------------------------
          // INPUT MÉTIER
          // ------------------------------------------------------

          workInput.addEventListener(
            "input",
            (e) => {

              const newWork =
                e.target.value;

              activity.work =
                newWork;

              /**
               * Le métier change : le libellé ML et le score
               * qui en dépendent ne sont plus valides tant que
               * le champ n'a pas été re-résolu (au blur).
               */
              activity.metier_trouve = null;
              activity.scoreIndividuel = null;

              /**
               * Si le métier change,
               * une ancienne estimation n'est plus fiable.
               *
               * En revanche, si l'utilisateur avait déclaré
               * manuellement un salaire, on le conserve.
               */
              if (
                activity.source !==
                "declared"
              ) {

                activity.salary = null;

                activity.source = null;

                activity.salary_reference =
                  null;

                activity.salary_match_type =
                  null;

                activity.salary_match_confidence =
                  0;
              }

              state.familyData = null;

              renderSalarySourceTag(
                worker.id,
                activityIndex
              );

              renderMatchInfo(
                worker.id,
                activityIndex
              );

              updateNextButtonState();
            }
          );

          // ------------------------------------------------------
          // BLUR MÉTIER
          // ------------------------------------------------------

          workInput.addEventListener(
            "blur",
            () => {

              // Si le champ métier est vide, on réinitialise tout
              if (!activity.work.trim()) {
                activity.salary = null;
                activity.source = null;
                activity.salary_reference = null;
                activity.salary_match_type = null;
                activity.salary_match_confidence = 0;
                activity.metier_trouve = null;
                activity.scoreIndividuel = null;

                renderSalarySourceTag(worker.id, activityIndex);
                renderMatchInfo(worker.id, activityIndex);
                updateNextButtonState();

                return;
              }

              // Si l'utilisateur n'a pas déclaré de salaire,
              // on tente l'estimation.
              if (activity.source !== "declared") {
                applyEstimatedSalary(activity);
              }

              /**
               * Le libellé `metier_trouve` (feature ML) est résolu
               * indépendamment de la source du salaire : même si
               * l'utilisateur déclare son salaire manuellement, le
               * modèle a quand même besoin du métier normalisé.
               */
              activity.metier_trouve =
                resolveMetierTrouve(activity.work);

              state.familyData = null;

              renderSalarySourceTag(
                worker.id,
                activityIndex
              );

              renderMatchInfo(
                worker.id,
                activityIndex
              );

              updateNextButtonState();
            }
          );

          workField.appendChild(
            workInput
          );

          // ======================================================
          // SALAIRE
          // ======================================================

          const salaryField =
            document.createElement(
              "div"
            );

          salaryField.className =
            "field";

          const salaryLabel =
            document.createElement(
              "label"
            );

          salaryLabel.textContent =
            "Salaire mensuel (Ar)";

          salaryField.appendChild(
            salaryLabel
          );

          const salaryInput =
            document.createElement(
              "input"
            );

          salaryInput.type =
            "number";

          salaryInput.min = "0";

          salaryInput.placeholder =
            "Facultatif";

          salaryInput.value =
            activity.salary ?? "";

          salaryInput.disabled =
            activity.source ===
            "estimated";

          // ------------------------------------------------------
          // SALAIRE INPUT
          // ------------------------------------------------------

          salaryInput.addEventListener(
            "input",
            (e) => {

              const value =
                e.target.value.trim();

              // --------------------------------------------------
              // SALAIRE VIDE
              // --------------------------------------------------

              if (value === "") {

                activity.salary =
                  null;

                activity.source =
                  null;

                activity.salary_reference =
                  null;

                activity.salary_match_type =
                  null;

                activity.salary_match_confidence =
                  0;

                activity.scoreIndividuel =
                  null;
              }

              // --------------------------------------------------
              // SALAIRE DÉCLARÉ
              // --------------------------------------------------

              else {

                const numericValue =
                  Number(value);

                if (
                  !Number.isFinite(
                    numericValue
                  ) ||
                  numericValue < 0
                ) {
                  return;
                }

                activity.salary =
                  numericValue;

                activity.source =
                  "declared";

                /**
                 * Une déclaration manuelle
                 * ne doit pas garder les traces
                 * d'une ancienne estimation.
                 */
                activity.salary_reference =
                  null;

                activity.salary_match_type =
                  null;

                activity.salary_match_confidence =
                  0;
              }

              // Le salaire change : le score dépendant doit être
              // recalculé à la prochaine étape de récapitulatif.
              activity.scoreIndividuel = null;

              state.familyData = null;

              renderSalarySourceTag(
                worker.id,
                activityIndex
              );

              renderMatchInfo(
                worker.id,
                activityIndex
              );

              updateNextButtonState();
            }
          );

          // ------------------------------------------------------
          // BLUR SALAIRE
          // ------------------------------------------------------

          salaryInput.addEventListener(
            "blur",
            async () => {

              /**
               * Si aucun salaire n'est déclaré
               * et qu'un métier existe,
               * on tente l'estimation.
               */
              if (
                activity.salary === null &&
                activity.work.trim() &&
                activity.source !==
                  "declared"
              ) {

                applyEstimatedSalary(
                  activity
                );
              }

              /**
               * Filet de sécurité : si le libellé `metier_trouve`
               * n'a pas encore été résolu (ex. l'utilisateur a
               * rempli le salaire avant de quitter le champ métier),
               * on le résout maintenant.
               */
              if (
                !activity.metier_trouve &&
                activity.work.trim()
              ) {
                activity.metier_trouve =
                  resolveMetierTrouve(activity.work);
              }

              /*
              * Si le salaire a été déclaré
              * manuellement par l'utilisateur,
              * on utilise cette donnée pour
              * enrichir metier.csv.
              */
              if (
                activity.source === "declared" &&
                Number.isFinite(activity.salary) &&
                activity.salary > 0 &&
                activity.work.trim()
              ) {

                await enrichMetierReference(
                  activity
                );
              }

              state.familyData = null;

              renderSalarySourceTag(
                worker.id,
                activityIndex
              );

              renderMatchInfo(
                worker.id,
                activityIndex
              );

              updateNextButtonState();
            }
          );

          // ======================================================
          // AJOUT DU CHAMP SALAIRE (CORRECTION)
          // ======================================================

          salaryField.appendChild(
            salaryInput
          );

          // ======================================================
          // CHECKBOX ESTIMATION
          // ======================================================

          const checkLine =
            document.createElement(
              "label"
            );

          checkLine.className =
            "checkbox-line";

          const check =
            document.createElement(
              "input"
            );

          check.type =
            "checkbox";

          check.checked =
            activity.source ===
            "estimated";

          check.addEventListener(
            "change",
            (e) => {

              // --------------------------------------------------
              // ACTIVER ESTIMATION
              // --------------------------------------------------

              if (
                e.target.checked
              ) {

                activity.source =
                  "estimated";

                applyEstimatedSalary(
                  activity
                );

                activity.metier_trouve =
                  resolveMetierTrouve(activity.work);
              }

              // --------------------------------------------------
              // DÉSACTIVER ESTIMATION
              // --------------------------------------------------

              else {

                /**
                 * On remet le salaire à null
                 * afin que l'utilisateur puisse
                 * éventuellement le déclarer.
                 */
                activity.salary =
                  null;

                activity.source =
                  null;

                activity.salary_reference =
                  null;

                activity.salary_match_type =
                  null;

                activity.salary_match_confidence =
                  0;
              }

              activity.scoreIndividuel = null;

              state.familyData = null;

              renderWorkers();
            }
          );

          checkLine.appendChild(
            check
          );

          checkLine.append(
            "Salaire inconnu (estimer)"
          );

          salaryField.appendChild(
            checkLine
          );

          // ======================================================
          // SOURCE
          // ======================================================

          const sourceElement =
            document.createElement(
              "div"
            );

          sourceElement.id =
            `src-${worker.id}-${activityIndex}`;

          salaryField.appendChild(
            sourceElement
          );

          // ======================================================
          // MATCH INFO
          // ======================================================

          const matchElement =
            document.createElement(
              "div"
            );

          matchElement.id =
            `match-info-${worker.id}-${activityIndex}`;

          matchElement.className =
            "match-info";

          salaryField.appendChild(
            matchElement
          );

          // ======================================================
          // SUPPRESSION ACTIVITÉ
          // ======================================================

          const removeButton =
            document.createElement(
              "button"
            );

          removeButton.className =
            "icon-btn";

          removeButton.type =
            "button";

          removeButton.textContent =
            "✕";

          removeButton.title =
            "Retirer cette activité";

          removeButton.addEventListener(
            "click",
            () => {

              removeActivity(
                worker.id,
                activityIndex
              );
            }
          );

          // ======================================================
          // ASSEMBLAGE
          // ======================================================

          row.appendChild(
            workField
          );

          row.appendChild(
            salaryField
          );

          row.appendChild(
            removeButton
          );

          block.appendChild(
            row
          );

          // ------------------------------------------------------
          // AFFICHAGE INITIAL
          // ------------------------------------------------------

          renderSalarySourceTag(
            worker.id,
            activityIndex
          );

          renderMatchInfo(
            worker.id,
            activityIndex
          );
        }
      );

      // ==========================================================
      // AJOUT ACTIVITÉ
      // ==========================================================

      const addActivityButton =
        document.createElement(
          "button"
        );

      addActivityButton.className =
        "ghost-btn";

      addActivityButton.type =
        "button";

      addActivityButton.textContent =
        "+ Ajouter une activité";

      addActivityButton.style.marginBottom =
        "0.75rem";

      addActivityButton.addEventListener(
        "click",
        () => {

          addActivity(
            worker.id
          );
        }
      );

      block.appendChild(
        addActivityButton
      );

      // ==========================================================
      // SUPPRESSION TRAVAILLEUR
      // ==========================================================

      const removeWorkerButton =
        document.createElement(
          "button"
        );

      removeWorkerButton.className =
        "icon-btn";

      removeWorkerButton.type =
        "button";

      removeWorkerButton.textContent =
        "Retirer ce travailleur";

      removeWorkerButton.style.display =
        "block";

      removeWorkerButton.addEventListener(
        "click",
        () => {

          removeWorker(
            worker.id
          );
        }
      );

      block.appendChild(
        removeWorkerButton
      );

      container.appendChild(
        block
      );
    }
  );

  updateNextButtonState();
}

// ================================================================
// SOURCE DU SALAIRE
// ================================================================

function renderSalarySourceTag(
  workerId,
  activityIndex
) {

  const element =
    document.getElementById(
      `src-${workerId}-${activityIndex}`
    );

  if (!element) {
    return;
  }

  const worker =
    state.family.workers.find(
      (w) => w.id === workerId
    );

  if (!worker) {
    return;
  }

  const activity =
    worker.activities[
      activityIndex
    ];

  if (!activity) {
    return;
  }

  // Aucun métier / aucune source
  if (!activity.source) {
    element.innerHTML = `
      <span class="salary-source none">
        — non défini
      </span>
    `;
    return;
  }

  // Salaire estimé
  if (activity.source === "estimated") {
    element.innerHTML = `
      <span class="salary-source estimated">
        estimé (metier.csv)
      </span>
    `;
    return;
  }

  // Salaire déclaré
  if (activity.source === "declared") {
    element.innerHTML = `
      <span class="salary-source declared">
        déclaré
      </span>
    `;
    return;
  }

  // Métier trouvé/impossible à estimer
  if (activity.source === "unresolved") {
    element.innerHTML = `
      <span class="salary-source unresolved">
        ⚠️ salaire requis
      </span>
    `;
  }
}

// ================================================================
// INFORMATIONS DE CORRESPONDANCE
// ================================================================

function renderMatchInfo(
  workerId,
  activityIndex
) {

  const element =
    document.getElementById(
      `match-info-${workerId}-${activityIndex}`
    );

  if (!element) {
    return;
  }

  const worker =
    state.family.workers.find(
      (w) => w.id === workerId
    );

  if (!worker) {
    return;
  }

  const activity =
    worker.activities[
      activityIndex
    ];

  if (!activity) {
    return;
  }

  // --------------------------------------------------------------
  // MÉTIER NON ENCORE RENSEIGNÉ
  // --------------------------------------------------------------
  if (!activity.work || !activity.work.trim()) {
    element.innerHTML = "";
    return;
  }

  // --------------------------------------------------------------
  // ESTIMATION TROUVÉE
  // --------------------------------------------------------------
  if (activity.source === "estimated" && activity.salary !== null) {
    const typeLabels = {
      exact: "Correspondance exacte",
      alias: "Alias connu",
      token: "Rapprochement par mots"
    };

    const typeLabel =
      typeLabels[activity.salary_match_type] ||
      activity.salary_match_type ||
      "Correspondance";

    element.innerHTML = `
      <span class="match-badge">
        Réf. : <strong>${activity.salary_reference || "?"}</strong>
        · ${typeLabel}
        · confiance ${Math.round(
          (activity.salary_match_confidence || 0) * 100
        )}%
      </span>
    `;

    return;
  }

  // --------------------------------------------------------------
  // SALAIRE DÉCLARÉ PAR L'UTILISATEUR
  // --------------------------------------------------------------
  if (
    activity.source === "declared" &&
    Number.isFinite(activity.salary) &&
    activity.salary > 0
  ) {
    element.innerHTML = `
      <span class="match-badge">
        Salaire déclaré par l'utilisateur
      </span>
    `;

    return;
  }

  // --------------------------------------------------------------
  // MÉTIER NON RECONNU / SALAIRE NON ESTIMABLE
  // --------------------------------------------------------------
  if (activity.source === "unresolved") {
    element.innerHTML = `
      <span class="match-badge warning">
        ⚠️ Salaire non estimable pour ce métier.
        Saisissez le salaire mensuel ou supprimez cette activité.
      </span>
    `;

    return;
  }

  // --------------------------------------------------------------
  // SALAIRE MANQUANT
  // --------------------------------------------------------------
  element.innerHTML = `
    <span class="match-badge warning">
      ⚠️ Veuillez saisir un salaire ou activer l'estimation.
    </span>
  `;
}

// ================================================================
// BOUTON AJOUT TRAVAILLEUR
// ================================================================

const addWorkerButton =
  document.getElementById(
    "add-worker"
  );

if (addWorkerButton) {

  addWorkerButton.addEventListener(
    "click",
    addWorker
  );
}

// ================================================================
// VALIDATION DES ÉTAPES
// ================================================================

function stepIsValid(step) {

  // --------------------------------------------------------------
  // ÉTAPE 1 — Localisation
  // --------------------------------------------------------------

  if (step === 1) {
    return !!(state.objectif && state.habitat);
  }

  // --------------------------------------------------------------
  // ÉTAPE 2 — Profil familial
  // --------------------------------------------------------------

  if (step === 2) {
    return (
      state.family.name.trim().length > 0 &&
      Number.isFinite(state.family.age) &&
      state.family.age > 0 &&
      Number.isFinite(state.family.family_nbr) &&
      state.family.family_nbr > 0
    );
  }

  // --------------------------------------------------------------
  // ÉTAPE 3 — Travailleurs et revenus
  // --------------------------------------------------------------

  if (step === 3) {
    // Il faut au moins un travailleur
    if (state.family.workers.length === 0) {
      return false;
    }

    // Chaque travailleur doit avoir un rôle
    // et chaque activité doit être complètement résolue.
    return state.family.workers.every((worker) => {
      if (!worker.role) {
        return false;
      }

      return worker.activities.every((activity) => {
        // Une activité sans métier n'est pas valide
        if (!activity.work || !activity.work.trim()) {
          return false;
        }

        // Un salaire null est toujours interdit
        if (!Number.isFinite(activity.salary) || activity.salary <= 0) {
          return false;
        }

        // Seules ces deux sources sont considérées comme valides
        if (
          activity.source !== "declared" &&
          activity.source !== "estimated"
        ) {
          return false;
        }

        return true;
      });
    });
  }

  // --------------------------------------------------------------
  // ÉTAPE 4
  // --------------------------------------------------------------

  return true;
}

// ================================================================
// BOUTON SUIVANT
// ================================================================

function updateNextButtonState() {

  const button =
    document.getElementById(
      "btn-next"
    );

  if (!button) {
    return;
  }

  if (
    currentStep ===
    TOTAL_STEPS
  ) {

    button.style.display =
      "none";

    return;
  }

  button.style.display =
    "inline-block";

  button.disabled =
    !stepIsValid(
      currentStep
    );

  button.textContent =
    currentStep ===
    TOTAL_STEPS - 1

      ? "Voir le récapitulatif →"

      : "Suivant →";
}

// ================================================================
// AFFICHAGE D'UNE ÉTAPE
// ================================================================

function showStep(step) {

  currentStep = step;

  document
    .querySelectorAll(
      ".step-panel"
    )
    .forEach((panel) => {

      panel.classList.remove(
        "active"
      );
    });

  const panel =
    document.getElementById(
      `panel-${step}`
    );

  if (panel) {

    panel.classList.add(
      "active"
    );
  }

  document
    .querySelectorAll(
      ".step-tick"
    )
    .forEach((tick) => {

      const tickStep =
        Number(
          tick.dataset.step
        );

      tick.classList.toggle(
        "active",
        tickStep === step
      );

      tick.classList.toggle(
        "done",
        tickStep < step
      );
    });

  const captions = {

    1:
      "Étape 1 sur 4 — Indiquez l'emplacement de l'installation, puis celui de votre habitat.",

    2:
      "Étape 2 sur 4 — Parlez-nous de votre foyer.",

    3:
      "Étape 3 sur 4 — Qui travaille dans le foyer, et pour quel revenu ?",

    4:
      "Étape 4 sur 4 — Vérifiez le dossier avant de le transmettre."
  };

  const caption =
    document.getElementById(
      "step-caption"
    );

  if (caption) {

    caption.textContent =
      captions[step] || "";
  }

  const previousButton =
    document.getElementById(
      "btn-prev"
    );

  if (previousButton) {

    previousButton.disabled =
      step === 1;
  }

  if (step === 4) {

    buildRecapWithLocationData();
  }

  updateNextButtonState();

  if (
    step === 1 &&
    map
  ) {

    setTimeout(
      () => map.invalidateSize(),
      50
    );
  }
}

// ================================================================
// BOUTON SUIVANT
// ================================================================

const nextButton =
  document.getElementById(
    "btn-next"
  );

if (nextButton) {

  nextButton.addEventListener(
    "click",
    () => {

      if (
        !stepIsValid(
          currentStep
        )
      ) {
        return;
      }

      if (
        currentStep <
        TOTAL_STEPS
      ) {

        showStep(
          currentStep + 1
        );
      }
    }
  );
}

// ================================================================
// BOUTON PRÉCÉDENT
// ================================================================

const previousButton =
  document.getElementById(
    "btn-prev"
  );

if (previousButton) {

  previousButton.addEventListener(
    "click",
    () => {

      if (
        currentStep > 1
      ) {

        showStep(
          currentStep - 1
        );
      }
    }
  );
}

// ================================================================
// CONSTRUCTION DU PAYLOAD FINAL
// ================================================================

function buildOutputPayload() {

  return {

    // ------------------------------------------------------------
    // MODULE 1 — LOCALISATION BRUTE
    // ------------------------------------------------------------

    objectif:
      state.objectif,

    habitat:
      state.habitat,

    // ------------------------------------------------------------
    // MODULE 2
    // ------------------------------------------------------------

    locationData:
      state.locationData,

    // ------------------------------------------------------------
    // MODULE 3
    // ------------------------------------------------------------

    familyData:
      state.familyData,

    // ------------------------------------------------------------
    // MODULE 4 — SCORE SOCIO-ÉCONOMIQUE
    // ------------------------------------------------------------

    socioEconomicData:
      state.socioEconomicData,

    // ------------------------------------------------------------
    // MODULE 5 — CAPACITÉ FINANCIÈRE
    // ------------------------------------------------------------

    financeData:
      state.financeData,

    // ------------------------------------------------------------
    // MODULE 6 — FAISABILITÉ FINANCIÈRE
    // ------------------------------------------------------------

    dimensioningData:
      state.dimensioningData,

    // ------------------------------------------------------------
    // MODULE 7 — BESOIN ÉNERGÉTIQUE
    // ------------------------------------------------------------

    energyData:
      state.energyData,

    // ------------------------------------------------------------
    // MODULE 8 — DIMENSIONNEMENT PHOTOVOLTAÏQUE
    // ------------------------------------------------------------

    solarDimensioningData:
      state.solarDimensioningData,

    // ------------------------------------------------------------
    // DONNÉES FAMILIALES BRUTES / NORMALISÉES
    // ------------------------------------------------------------

    family: {

      name:
        state.family.name,

      age:
        state.family.age,

      family_nbr:
        state.family.family_nbr,

      workers:
        state.family.workers.map(
          (worker) => ({

            role:
              worker.role,

            work:
              worker.activities.map(
                (activity) =>
                  activity.work
              ),

            salary:
              worker.activities.map(
                (activity) =>
                  activity.salary
              ),

            salary_source:
              worker.activities.map(
                (activity) =>
                  activity.source
              ),

            salary_reference:
              worker.activities.map(
                (activity) =>
                  activity.salary_reference
              ),

            salary_match_type:
              worker.activities.map(
                (activity) =>
                  activity.salary_match_type
              ),

            salary_match_confidence:
              worker.activities.map(
                (activity) =>
                  activity.salary_match_confidence
              ),

            // Libellé métier envoyé au modèle ML pour chaque activité
            metier_trouve:
              worker.activities.map(
                (activity) =>
                  activity.metier_trouve
              ),

            // Score individuel calculé par calculer_score.php
            // pour chaque activité (aligné sur work/salary/metier_trouve)
            scoreIndividuel:
              worker.activities.map(
                (activity) =>
                  activity.scoreIndividuel
              )
          })
        )
    }
  };
}

// ================================================================
// AFFICHAGE RÉCAPITULATIF
// ================================================================

function buildRecap() {

  const payload =
    buildOutputPayload();

  const recap =
    document.getElementById(
      "recap-json"
    );

  if (!recap) {
    return;
  }

  recap.textContent =
    JSON.stringify(
      payload,
      null,
      2
    );
}

// ================================================================
// RÉCAPITULATIF AVEC MODULES 2 ET 3
// ================================================================

async function buildRecapWithLocationData() {

  // --------------------------------------------------------------
  // MODULE 2 — LOCALISATION
  // --------------------------------------------------------------

  if (
    !state.locationData &&
    state.objectif &&
    state.habitat
  ) {

    try {

      state.locationData =
        await buildLocationData(
          state,
          villes
        );

      console.log(
        "✓ Module 2 (Localisation) complété :",
        state.locationData
      );

    } catch (e) {

      console.error(
        "✗ Erreur Module 2 :",
        e
      );

      state.locationData = {
        error: e.message
      };
    }
  }

  // --------------------------------------------------------------
  // MODULE 3 — PROFIL FAMILIAL
  // --------------------------------------------------------------

  if (
    !state.familyData
  ) {

    try {

      state.familyData =
        await buildFamilyData(
          state
        );

      console.log(
        "✓ Module 3 (Profil Familial) complété :",
        state.familyData
      );

    } catch (e) {

      console.error(
        "✗ Erreur Module 3 :",
        e
      );

      state.familyData = {
        error: e.message
      };
    }
  }

  // --------------------------------------------------------------
  // MODULE 4 — CALCUL DU SCORE
  // --------------------------------------------------------------

  const habitatNearestTown =
    findNearestTown(
      state.habitat,
      villes
    );

  console.log(
    "✓ Habitat — ville la plus proche :",
    habitatNearestTown
  );

  /**
   * On calcule un score individuel POUR CHAQUE ACTIVITÉ de
   * CHAQUE TRAVAILLEUR (et non plus uniquement pour la première
   * activité du premier travailleur).
   *
   * Chaque appel repose sur `state.family.workers[*].activities[*]`
   * (la saisie brute du Module 1), seule source qui connaît le
   * libellé `metier_trouve` résolu à l'étape précédente.
   *
   * Les appels sont faits séquentiellement (et non en parallèle)
   * car chaque requête à calculer_score.php démarre un processus
   * Python qui recharge le pipeline ML : les lancer tous en même
   * temps solliciterait inutilement le serveur.
   */
  for (const worker of state.family.workers) {

    for (const activity of worker.activities) {

      const hasWork =
        activity.work && activity.work.trim();

      const hasSalary =
        Number.isFinite(activity.salary) &&
        activity.salary > 0;

      // Rien à envoyer pour cette activité : on ignore.
      if (!hasWork || !hasSalary) {
        activity.scoreIndividuel = null;
        continue;
      }

      // Filet de sécurité si metier_trouve n'a pas pu être résolu
      // plus tôt dans le parcours utilisateur.
      if (!activity.metier_trouve) {
        activity.metier_trouve =
          resolveMetierTrouve(activity.work);
      }

      const predictionData = {
        salaire_mensuel: activity.salary,
        hhmilieu2: habitatNearestTown.zone_type || "Unknown",
        hhreg: habitatNearestTown.region,
        q4a_02: "Non",
        metier_trouve: activity.metier_trouve
      };

      console.log(
        "→ Données envoyées à calculer_score.php :",
        predictionData
      );

      try {

        const response =
          await fetch(
            "calculer_score.php",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify(
                  predictionData
                )
            }
          );

        const result =
          await response.json();

        if (result.success && Number.isFinite(
          Number(result.data?.score_individuel_epm)
        )) {

          activity.scoreIndividuel =
            Number(result.data.score_individuel_epm);

          console.log(
            "✓ Score individuel :",
            activity.work,
            "→",
            activity.scoreIndividuel
          );

        } else {

          activity.scoreIndividuel = null;

          console.error(
            "✗ Score non calculé pour",
            activity.work,
            `(${response.status}) :`,
            result.message || "Score absent de la réponse PHP.",
            result.data
          );
        }

      } catch (e) {

        activity.scoreIndividuel = null;

        console.error(
          "✗ Erreur calcul du score pour",
          activity.work,
          ":",
          e
        );
      }
    }
  }

  state.socioEconomicData = buildSocioEconomicData(state);

  // Le fond depend des scores individuels qui viennent d'etre calcules.
  state.financeData = buildFinanceData(state);

  // Le Module 6 utilise le fond, le transport et les prix locaux.
  try {
    state.dimensioningData = await loadDimensioningData(
      state.financeData,
      state.locationData
    );
  } catch (e) {
    state.dimensioningData = {
      status: "error",
      financial_feasible: false,
      reason: e.message
    };
    console.error("✗ Erreur Module 6 :", e);
  }

  state.energyData = buildEnergyData(state.financeData);

  try {
    state.solarDimensioningData = await loadSolarDimensioningData(
      state.financeData,
      state.dimensioningData,
      state.energyData,
      state.locationData
    );
  } catch (e) {
    state.solarDimensioningData = {
      status: "error",
      reason: e.message,
      recommendation: null
    };
    console.error("✗ Erreur Module 8 :", e);
  }

  buildRecap();
}

// ================================================================
// TÉLÉCHARGEMENT JSON
// ================================================================

const downloadButton =
  document.getElementById(
    "download-json"
  );

if (downloadButton) {

  downloadButton.addEventListener(
    "click",
    () => {

      const payload =
        buildOutputPayload();

      const blob =
        new Blob(
          [
            JSON.stringify(
              payload,
              null,
              2
            )
          ],
          {
            type:
              "application/json"
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      link.download =
        "dsaa_dossier.json";

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url
      );
    }
  );
}

// ================================================================
// COPIE JSON
// ================================================================

const copyButton =
  document.getElementById(
    "copy-json"
  );

if (copyButton) {

  copyButton.addEventListener(
    "click",
    async () => {

      try {

        const payload =
          buildOutputPayload();

        await navigator.clipboard.writeText(
          JSON.stringify(
            payload,
            null,
            2
          )
        );

        const original =
          copyButton.textContent;

        copyButton.textContent =
          "Copié ✓";

        setTimeout(
          () => {

            copyButton.textContent =
              original;

          },
          1500
        );

      } catch (e) {

        console.error(
          "Impossible de copier le JSON :",
          e
        );
      }
    }
  );
}

// ================================================================
// INITIALISATION
// ================================================================

(async function init() {

  try {

    // 1. Charger metier.csv + villes.csv
    await loadReferenceData();

    // 2. Initialiser la carte
    initMap();

    // 3. Créer le premier travailleur
    addWorker();

    // 4. Afficher la première étape
    showStep(1);

    console.log(
      "✓ Module 1 initialisé"
    );

    console.log(
      `✓ ${metierIndex.size} références métiers disponibles`
    );

  } catch (e) {

    console.error(
      "✗ Erreur initialisation Module 1 :",
      e
    );
  }

})();