/* Charge la configuration externe avant l'initialisation de l'application. */
const DSAA_CONFIG = {
  app: { total_steps: 4 },
  location: {},
  family: {},
  socio_economic: {},
  finance: {},
  dimensioning: {},
  energy: {},
  solar_dimensioning: {}
};

function mergeConfig(target, source) {
  Object.entries(source || {}).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      mergeConfig(target[key], value);
    } else {
      target[key] = value;
    }
  });
}

const DSAA_CONFIG_READY = fetch("config.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Impossible de charger config.json (${response.status})`);
    return response.json();
  })
  .then((config) => mergeConfig(DSAA_CONFIG, config));
