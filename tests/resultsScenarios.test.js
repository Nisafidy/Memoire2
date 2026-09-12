const assert = require("assert");
const { describeDecision } = require("../js/results.js");

const scenarios = [
  ["recommended_target", "Installation recommandée", "Besoin couvert"],
  ["recommended_budget_limited", "Installation possible, mais limitée par le budget", "Besoin partiellement couvert"],
  ["no_solution_budget", "Budget insuffisant pour une configuration fiable", "Budget à revoir"],
  ["no_catalog_solution", "Aucune configuration fiable trouvée", "Catalogue à compléter"],
  ["blocked", "Résultat incomplet", "Vérification nécessaire"]
];

for (const [status, title, badge] of scenarios) {
  const decision = describeDecision(status, {});
  assert.equal(decision.title, title);
  assert.equal(decision.badge, badge);
  assert(decision.meaning.length > 30);
  assert(decision.action.length > 30);
}

const missing = describeDecision("no_catalog_solution", {
  missing_components: ["batterie tarifée avec capacité et tension"]
});
assert(missing.explanation.includes("batterie tarifée"));

const unknown = describeDecision("unexpected_status", {});
assert.equal(unknown.badge, "Statut inconnu");

console.log(`✓ ${scenarios.length} scénarios de décision expliqués`);
