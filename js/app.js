/**
 * DSAA — Module 1 : Interface de saisie
 * Construit progressivement l'objet `state`, transmis en sortie de module
 * aux services de localisation (§2), de profil familial (§10) et de score
 * socio-économique (§15) décrits dans le mémoire.
 */

// ---------------------------------------------------------------
// ÉTAT GLOBAL
// ---------------------------------------------------------------

const state = {
  objectif: null,   // { lat, long }
  habitat: null,    // { lat, long }
  locationData: null, // Module 2 — données de localisation (ville, transport, irradiation)
  family: {
    name: "",
    age: null,
    family_nbr: null,
    workers: [],     // { id, role, activities: [{ work, salary, source }] }
  },
};

let currentStep = 1;
const TOTAL_STEPS = 4;
let metierIndex = new Map();   // nom métier (lowercase) -> { secteur, salaire_moyen_ariary }
let metierNames = [];          // liste pour le datalist
let villes = [];                // liste chargée de ville.csv

// ---------------------------------------------------------------
// CHARGEMENT DES DONNÉES DE RÉFÉRENCE
// ---------------------------------------------------------------

async function loadReferenceData() {
  try {
    const metiers = await loadCSV("dynamiques/data/metier.csv", ",");
    metiers.forEach((row) => {
      const key = (row.metier || "").trim().toLowerCase();
      if (!key) return;
      metierIndex.set(key, {
        secteur: row.secteur,
        salaire_moyen_ariary: Number(row.salaire_moyen_ariary) || null,
      });
      metierNames.push(row.metier);
    });
  } catch (e) {
    console.warn("metier.csv non chargé :", e.message);
  }

  try {
    villes = await loadCSV("dynamiques/data/villes.csv", ",");
  } catch (e) {
    console.warn("villes.csv non chargé :", e.message);
  }

  const datalist = document.createElement("datalist");
  datalist.id = "metier-options";
  metierNames.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n;
    datalist.appendChild(opt);
  });
  document.body.appendChild(datalist);
}

// ---------------------------------------------------------------
// ÉTAPE 1 — CARTE (Leaflet)
// ---------------------------------------------------------------

let map, markerObjectif, markerHabitat;

function initMap() {
  map = L.map("map").setView([-18.9, 47.0], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);

  map.on("click", (e) => {
    if (!state.objectif) {
      state.objectif = { lat: e.latlng.lat, long: e.latlng.lng };
      markerObjectif = L.marker(e.latlng, { title: "Objectif" })
        .addTo(map)
        .bindPopup("Objectif (installation)")
        .openPopup();
      updateCoordChips();
      previewNearestTown();
    } else if (!state.habitat) {
      state.habitat = { lat: e.latlng.lat, long: e.latlng.lng };
      markerHabitat = L.marker(e.latlng, {
        title: "Habitat",
        icon: L.icon({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconSize: [20, 33],
          className: "habitat-marker",
        }),
      })
        .addTo(map)
        .bindPopup("Habitat")
        .openPopup();
      L.polyline([markerObjectif.getLatLng(), markerHabitat.getLatLng()], {
        color: "#a3431f",
        dashArray: "4 4",
      }).addTo(map);
      updateCoordChips();
    }
    updateNextButtonState();
  });
}

function updateCoordChips() {
  const o = document.getElementById("coord-objectif");
  const h = document.getElementById("coord-habitat");
  const chipO = document.getElementById("chip-objectif");
  const chipH = document.getElementById("chip-habitat");

  if (state.objectif) {
    o.textContent = `${state.objectif.lat.toFixed(4)}, ${state.objectif.long.toFixed(4)}`;
    chipO.classList.add("filled");
  }
  if (state.habitat) {
    h.textContent = `${state.habitat.lat.toFixed(4)}, ${state.habitat.long.toFixed(4)}`;
    chipH.classList.add("filled");
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function previewNearestTown() {
  if (!villes.length || !state.objectif) return;
  let nearest = null;
  let best = Infinity;
  villes.forEach((v) => {
    const d = haversine(state.objectif.lat, state.objectif.long, Number(v.lat), Number(v.lng));
    if (d < best) {
      best = d;
      nearest = v;
    }
  });
  const el = document.getElementById("town-preview");
  if (nearest) {
    el.style.display = "block";
    el.innerHTML = `Ville de référence la plus proche (à vol d'oiseau) : <strong>${nearest.name}</strong> — ≈ ${best.toFixed(1)} km.
      <br><span class="hint">La distance routière exacte sera calculée par le module de localisation (OSRM/Valhalla).</span>`;
  }
}

document.getElementById("reset-map").addEventListener("click", () => {
  state.objectif = null;
  state.habitat = null;
  if (markerObjectif) map.removeLayer(markerObjectif);
  if (markerHabitat) map.removeLayer(markerHabitat);
  map.eachLayer((layer) => {
    if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) map.removeLayer(layer);
  });
  document.getElementById("coord-objectif").textContent = "— non défini —";
  document.getElementById("coord-habitat").textContent = "— non défini —";
  document.getElementById("chip-objectif").classList.remove("filled");
  document.getElementById("chip-habitat").classList.remove("filled");
  document.getElementById("town-preview").style.display = "none";
  updateNextButtonState();
});

// ---------------------------------------------------------------
// ÉTAPE 2 — PROFIL FAMILIAL
// ---------------------------------------------------------------

function getRolesForAge(age) {
  if (age <= 21) return ["père", "mère", "frère / sœur"];
  if (age <= 35) return ["vous", "époux / épouse", "père", "mère", "frère / sœur"];
  if (age <= 40) return ["vous", "époux / épouse", "père", "mère"];
  return ["vous", "époux / épouse", "père", "mère", "enfant"];
}

document.getElementById("f-name").addEventListener("input", (e) => {
  state.family.name = e.target.value;
  updateNextButtonState();
});
document.getElementById("f-age").addEventListener("input", (e) => {
  state.family.age = Number(e.target.value) || null;
  const hint = document.getElementById("age-hint");
  if (state.family.age) {
    const roles = getRolesForAge(state.family.age);
    hint.textContent = `Relations proposées pour ce profil : ${roles.join(", ")}.`;
  } else {
    hint.textContent = "";
  }
  renderWorkers(); // les rôles disponibles dépendent de l'âge
  updateNextButtonState();
});
document.getElementById("f-nbr").addEventListener("input", (e) => {
  state.family.family_nbr = Number(e.target.value) || null;
  updateNextButtonState();
});

// ---------------------------------------------------------------
// ÉTAPE 3 — TRAVAILLEURS
// ---------------------------------------------------------------

let workerAutoId = 1;

function addWorker() {
  state.family.workers.push({
    id: workerAutoId++,
    role: "",
    activities: [{ work: "", salary: null, source: "declared" }],
  });
  renderWorkers();
}

function removeWorker(id) {
  state.family.workers = state.family.workers.filter((w) => w.id !== id);
  renderWorkers();
}

function addActivity(workerId) {
  const w = state.family.workers.find((w) => w.id === workerId);
  w.activities.push({ work: "", salary: null, source: "declared" });
  renderWorkers();
}

function removeActivity(workerId, idx) {
  const w = state.family.workers.find((w) => w.id === workerId);
  w.activities.splice(idx, 1);
  if (w.activities.length === 0) w.activities.push({ work: "", salary: null, source: "declared" });
  renderWorkers();
}

function renderWorkers() {
  const container = document.getElementById("workers-container");
  container.innerHTML = "";
  const roles = getRolesForAge(state.family.age || 30);

  state.family.workers.forEach((w) => {
    const block = document.createElement("div");
    block.className = "worker-block";

    const title = document.createElement("div");
    title.className = "worker-title";
    title.textContent = `Travailleur #${w.id}`;
    block.appendChild(title);

    // rôle
    const roleField = document.createElement("div");
    roleField.className = "field";
    roleField.innerHTML = `<label>Rôle dans le foyer</label>`;
    const roleSelect = document.createElement("select");
    roleSelect.innerHTML =
      `<option value="">— choisir —</option>` +
      roles.map((r) => `<option value="${r}" ${w.role === r ? "selected" : ""}>${r}</option>`).join("");
    roleSelect.addEventListener("change", (e) => {
      w.role = e.target.value;
      updateNextButtonState();
    });
    roleField.appendChild(roleSelect);
    block.appendChild(roleField);

    // activités
    const actLabel = document.createElement("h3");
    actLabel.textContent = "Activités";
    block.appendChild(actLabel);

    w.activities.forEach((act, idx) => {
      const row = document.createElement("div");
      row.className = "activity-row";

      const workField = document.createElement("div");
      workField.className = "field";
      workField.innerHTML = `<label>Métier / activité</label>`;
      const workInput = document.createElement("input");
      workInput.type = "text";
      workInput.setAttribute("list", "metier-options");
      workInput.placeholder = "Ex. agriculteur";
      workInput.value = act.work;
      workInput.addEventListener("input", (e) => {
        act.work = e.target.value;
        if (act.source === "estimated") applyEstimatedSalary(act);
        renderSalarySourceTag(w.id, idx);
        updateNextButtonState();
      });
      workField.appendChild(workInput);

      const salaryField = document.createElement("div");
      salaryField.className = "field";
      salaryField.innerHTML = `<label>Salaire mensuel (Ar)</label>`;
      const salaryInput = document.createElement("input");
      salaryInput.type = "number";
      salaryInput.min = "0";
      salaryInput.placeholder = "Facultatif";
      salaryInput.value = act.salary ?? "";
      salaryInput.disabled = act.source === "estimated";
      salaryInput.addEventListener("input", (e) => {
        act.salary = e.target.value ? Number(e.target.value) : null;
        act.source = "declared";
        renderSalarySourceTag(w.id, idx);
      });
      salaryField.appendChild(salaryInput);
      const checkLine = document.createElement("label");
      checkLine.className = "checkbox-line";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = act.source === "estimated";
      check.addEventListener("change", (e) => {
        act.source = e.target.checked ? "estimated" : "declared";
        if (act.source === "estimated") applyEstimatedSalary(act);
        renderWorkers();
      });
      checkLine.appendChild(check);
      checkLine.append("Salaire inconnu (estimer)");
      salaryField.appendChild(checkLine);
      salaryField.innerHTML += `<div id="src-${w.id}-${idx}"></div>`;

      const removeBtn = document.createElement("button");
      removeBtn.className = "icon-btn";
      removeBtn.type = "button";
      removeBtn.textContent = "✕";
      removeBtn.title = "Retirer cette activité";
      removeBtn.addEventListener("click", () => removeActivity(w.id, idx));

      row.appendChild(workField);
      row.appendChild(salaryField);
      row.appendChild(removeBtn);
      block.appendChild(row);
    });

    const addActBtn = document.createElement("button");
    addActBtn.className = "ghost-btn";
    addActBtn.type = "button";
    addActBtn.textContent = "+ Ajouter une activité";
    addActBtn.style.marginBottom = "0.75rem";
    addActBtn.addEventListener("click", () => addActivity(w.id));
    block.appendChild(addActBtn);

    const removeWorkerBtn = document.createElement("button");
    removeWorkerBtn.className = "icon-btn";
    removeWorkerBtn.type = "button";
    removeWorkerBtn.textContent = "Retirer ce travailleur";
    removeWorkerBtn.style.display = "block";
    removeWorkerBtn.addEventListener("click", () => removeWorker(w.id));
    block.appendChild(removeWorkerBtn);

    container.appendChild(block);

    w.activities.forEach((_, idx) => renderSalarySourceTag(w.id, idx));
  });

  updateNextButtonState();
}

function applyEstimatedSalary(act) {
  const match = metierIndex.get((act.work || "").trim().toLowerCase());
  act.salary = match ? match.salaire_moyen_ariary : null;
}

function renderSalarySourceTag(workerId, idx) {
  const el = document.getElementById(`src-${workerId}-${idx}`);
  if (!el) return;
  const w = state.family.workers.find((w) => w.id === workerId);
  const act = w.activities[idx];
  const cls = act.source === "estimated" ? "estimated" : "declared";
  const label = act.source === "estimated" ? "estimé (metier.csv)" : "déclaré";
  el.innerHTML = `<span class="salary-source ${cls}">${label}</span>`;
}

document.getElementById("add-worker").addEventListener("click", addWorker);

// ---------------------------------------------------------------
// NAVIGATION ENTRE ÉTAPES
// ---------------------------------------------------------------

function stepIsValid(step) {
  if (step === 1) return !!(state.objectif && state.habitat);
  if (step === 2)
    return (
      state.family.name.trim().length > 0 &&
      Number.isFinite(state.family.age) &&
      state.family.age > 0 &&
      Number.isFinite(state.family.family_nbr) &&
      state.family.family_nbr > 0
    );
  if (step === 3)
    return (
      state.family.workers.length > 0 &&
      state.family.workers.every((w) => w.role && w.activities.every((a) => a.work.trim().length > 0))
    );
  return true;
}

function updateNextButtonState() {
  const btn = document.getElementById("btn-next");
  if (currentStep === TOTAL_STEPS) {
    btn.style.display = "none";
    return;
  }
  btn.style.display = "inline-block";
  btn.disabled = !stepIsValid(currentStep);
  btn.textContent = currentStep === TOTAL_STEPS - 1 ? "Voir le récapitulatif →" : "Suivant →";
}

function showStep(step) {
  currentStep = step;
  document.querySelectorAll(".step-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`panel-${step}`).classList.add("active");

  document.querySelectorAll(".step-tick").forEach((t) => {
    const s = Number(t.dataset.step);
    t.classList.toggle("active", s === step);
    t.classList.toggle("done", s < step);
  });

  const captions = {
    1: "Étape 1 sur 4 — Indiquez l'emplacement de l'installation, puis celui de votre habitat.",
    2: "Étape 2 sur 4 — Parlez-nous de votre foyer.",
    3: "Étape 3 sur 4 — Qui travaille dans le foyer, et pour quel revenu ?",
    4: "Étape 4 sur 4 — Vérifiez le dossier avant de le transmettre.",
  };
  document.getElementById("step-caption").textContent = captions[step];

  document.getElementById("btn-prev").disabled = step === 1;

  if (step === 4) buildRecapWithLocationData();
  updateNextButtonState();

  if (step === 1 && map) setTimeout(() => map.invalidateSize(), 50);
}

document.getElementById("btn-next").addEventListener("click", () => {
  if (!stepIsValid(currentStep)) return;
  if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
});
document.getElementById("btn-prev").addEventListener("click", () => {
  if (currentStep > 1) showStep(currentStep - 1);
});

// ---------------------------------------------------------------
// ÉTAPE 4 — RÉCAPITULATIF
// ---------------------------------------------------------------

function buildOutputPayload() {
  return {
    objectif: state.objectif,
    habitat: state.habitat,
    locationData: state.locationData,
    family: {
      name: state.family.name,
      age: state.family.age,
      family_nbr: state.family.family_nbr,
      workers: state.family.workers.map((w) => ({
        role: w.role,
        work: w.activities.map((a) => a.work),
        salary: w.activities.map((a) => a.salary),
        salary_source: w.activities.map((a) => a.source),
      })),
    },
  };
}

function buildRecap() {
  const payload = buildOutputPayload();
  document.getElementById("recap-json").textContent = JSON.stringify(payload, null, 2);
}

async function buildRecapWithLocationData() {
  // Appeler le Module 2 — Localisation
  if (!state.locationData && state.objectif && state.habitat) {
    try {
      state.locationData = await buildLocationData(state, villes);
      console.log("✓ Module 2 (Localisation) complété :", state.locationData);
    } catch (e) {
      console.error("✗ Erreur Module 2 :", e);
      state.locationData = { error: e.message };
    }
  }
  buildRecap();
}

document.getElementById("download-json").addEventListener("click", () => {
  const payload = buildOutputPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dsaa_dossier.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("copy-json").addEventListener("click", async () => {
  const payload = buildOutputPayload();
  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  const btn = document.getElementById("copy-json");
  const original = btn.textContent;
  btn.textContent = "Copié ✓";
  setTimeout(() => (btn.textContent = original), 1500);
});

// ---------------------------------------------------------------
// INITIALISATION
// ---------------------------------------------------------------

(async function init() {
  await loadReferenceData();
  initMap();
  addWorker(); // un premier bloc travailleur par défaut
  showStep(1);
})();