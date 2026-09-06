# MODULE 4 — MODÈLE SOCIO-ÉCONOMIQUE : IMPLÉMENTATION

**Date** : 21 août 2026
**Statut** : 🔶 SPÉCIFICATION FINALISÉE — entraînement à valider avec les sorties réelles de `notebooks/03_model_training.ipynb` et `04_evaluation.ipynb`
**Version** : 2.0

> ⚠️ Ce document complète le Module 4 tel que décrit dans `documentation2.md` (§15-19). Il précise la méthodologie qui manquait : comment construire la variable cible `score individuel`, quelles variables explicatives retenir dans `EMPL_complet.csv` / `variable.csv`, comment éviter les fuites de données (data leakage), et comment le modèle s'articule avec `metier.csv` et le Module 3. Les métriques de performance (MAE, RMSE, R²) doivent être reportées depuis `models/model_metadata.json` une fois l'entraînement exécuté — elles ne sont pas inventées ici.

---

## 📋 Vue d'ensemble

Le Module 4 transforme le profil familial produit par le Module 3 (`familyData`) en un indicateur socio-économique numérique, le `family_score`, utilisé ensuite par les Modules 5 (fond disponible) et 7 (besoin énergétique essentiel).

Le module répond à une contrainte précise : au moment de l'inférence en production, le système **ne connaît que ce que l'utilisateur a déclaré** — rôle, métier(s), salaire déclaré ou estimé via `metier.csv`, âge, localisation. Il ne dispose pas des variables riches de l'enquête EPM (sécurité sociale, contrat, niveau d'éducation, équipement du ménage, etc.). Le modèle ML doit donc apprendre à **estimer**, à partir des seules variables disponibles en production, un score qui reflète une réalité socio-économique plus large — c'est précisément le rôle d'un modèle prédictif plutôt que d'une formule directe.

---

## 🏗️ Architecture

### Fichiers concernés

| Fichier | Rôle |
|---|---|
| `raw/04_MDG_EPM2122_EMPL.dta` | Source brute EPM 2021-2022 (INSTAT) |
| `raw/EMPL_complet.csv` | Export CSV du `.dta`, converti par `raw/a.py` |
| `raw/variable.csv` | Dictionnaire des variables (libellés `q1_*`, `q4a_*`, `q4b_*`, `q4c_*`, `ilo_*`) |
| `metier.csv` | Grille salariale par métier/secteur (min, max, moyenne, observé/approx.) |
| `notebooks/01_EDA.ipynb` | Analyse exploratoire |
| `notebooks/02_feature_engineering.ipynb` | Construction de la cible + des variables explicatives |
| `notebooks/03_model_training.ipynb` | Entraînement et comparaison des modèles |
| `notebooks/04_evaluation.ipynb` | Évaluation finale (MAE, RMSE, R²) |
| `src/preprocess.py` | Pipeline de prétraitement réutilisé entraînement/inférence |
| `src/train.py` | Entraînement du modèle final, sauvegarde `models/` |
| `src/predict.py` | Chargement du modèle et scoring d'un travailleur en production |
| `src/api.py` | Point d'entrée appelé par `familyService.js` / `financeService.js` |
| `models/final_model.pkl` | Modèle retenu (sérialisé) |
| `models/scaler.pkl` | Normalisation des variables numériques |
| `models/model_metadata.json` | Métriques, liste des features, version du modèle |

---

## 1. Construction de la variable cible : `score_individuel_epm`

L'EPM ne contient pas de colonne « score socio-économique » toute faite. La cible doit donc être **construite** à partir d'un sous-ensemble de variables EPM qui décrivent la qualité de la situation professionnelle et le niveau de vie de l'individu, puis normalisée sur `[0, 100]`.

### 1.1 Composantes retenues (variables `variable.csv`)

| Composante | Variables sources | Poids proposé |
|---|---|---|
| Revenu (percentile national) | `q4a_46a` (salaire emploi principal), `q4a_62a` (salaire 2e emploi), ramenés en mensuel via `q4a_46b`/`q4a_62b` | 35 % |
| Formalité de l'emploi | `q4a_27` (secteur institutionnel), `q4a_29` (contrat écrit/verbal), `q4a_32` (affiliation CNAPS) | 20 % |
| Niveau de qualification | `ilo_job1_ocu_skill`, `q4a_18` (profession déclarée) | 15 % |
| Niveau d'éducation du ménage | `niveau_éducation` / `educ_cm` | 15 % |
| Accès aux services / équipement | `q1_25` (possède un tél), `q1_28d` (internet à domicile), `milieu_gcu` (urbain/rural) | 15 % |

Chaque composante est d'abord normalisée individuellement (min-max ou percentile), puis combinée par somme pondérée :

```text
score_individuel_epm =
    0.35 × revenu_normalisé
  + 0.20 × formalité_normalisée
  + 0.15 × qualification_normalisée
  + 0.15 × éducation_normalisée
  + 0.15 × accès_normalisé
```

Le résultat est ramené sur `[0, 100]`.

> Les poids ci-dessus sont un point de départ raisonnable, pas un résultat expérimental : ils doivent être justifiés (ou ajustés) dans le mémoire, par exemple via une analyse en composantes principales (ACP) confirmant que ces cinq axes captent l'essentiel de la variance, ou par une revue de la littérature sur les indices composites de niveau de vie (type indice de richesse DHS/PMT).

### 1.2 Pourquoi ne pas utiliser directement le revenu comme score ?

Un score fondé uniquement sur le revenu reproduirait une hiérarchie strictement proportionnelle à `S`, ce que le document de conception (§19) exclut explicitement : *« Le family_score ne représente pas directement la richesse absolue, le salaire total ou la consommation réelle mesurée. »* La composante multi-critères permet de distinguer, par exemple, un salaire moyen avec emploi stable et scolarisation élevée d'un salaire équivalent mais informel et précaire — deux situations différentes du point de vue du besoin énergétique et de la capacité de projet.

---

## 2. Variables explicatives (features), disponibles à l'inférence

C'est le point critique à documenter : **la cible (§1) est construite avec des variables riches, mais le modèle ne doit être entraîné qu'avec les variables que le système connaîtra réellement en production**, sous peine de fuite de données et d'un modèle inutilisable en pratique.

### 2.1 Features retenues

| Feature | Origine en production | Origine dans l'EPM (entraînement) |
|---|---|---|
| `metier` (libellé + secteur) | Saisi par l'utilisateur (Module 3) | `q4a_18` / `q4a_22` (profession, activité principale) |
| `secteur_activite` | Déduit de `metier.csv` (colonne `secteur`) | `q4a_23` / `NOMAC` (nomenclature activité) |
| `salaire` (déclaré ou estimé) | Module 3 (`salary`, `salary_source`) | `q4a_46a` recalculé en mensuel |
| `salary_source` (declared/estimated) | Module 3 | flag construit pendant l'entraînement pour simuler les deux cas (voir §2.3) |
| `age` | Module 3 | `q1_04m` (âge en mois → années) |
| `milieu` (urbain/rural) | Déduit de `nearest_town.lvl` / `pop` (Module 2) | `milieu_gcu` |
| `region` (optionnel, si dispo) | Déduite de `nearest_town` | `hhreg` |

Les variables de formalité, éducation, équipement, sécurité sociale (`q4a_27`, `q4a_29`, `q4a_32`, `niveau_éducation`, `q1_25`, `q1_28d`) **entrent dans la construction de la cible mais pas dans les features** — c'est ce qui évite la fuite de données.

### 2.2 Encodage

* `metier` / `secteur_activite` : encodage catégoriel (one-hot ou target encoding, à comparer) — cohérent avec les libellés de `metier.csv` pour permettre le mapping en production.
* `salaire` : variable continue, normalisée par le `scaler.pkl`.
* `milieu` : binaire urbain/rural.
* `age` : continue.

### 2.3 Simulation du cas « salaire estimé »

En production, une partie des salaires proviennent de `metier.csv` (estimation) et non d'une déclaration (Module 3, §13). Pour que le modèle reste fiable dans les deux cas, l'entraînement doit inclure des exemples où le salaire réel EPM est **remplacé par l'estimation `metier.csv` correspondant au métier**, avec `salary_source = estimated`. Cela permet au modèle d'apprendre une robustesse au bruit d'estimation plutôt que de sur-apprendre sur des salaires précis qui ne seront pas toujours disponibles en production.

---

## 3. Prétraitement (`src/preprocess.py`)

Pipeline partagé entre entraînement et inférence (pour garantir la cohérence) :

```text
1. Nettoyage des valeurs manquantes (NaN → imputation ou exclusion documentée)
2. Conversion des montants en mensuel (unité de temps q4a_46b / q4a_62b)
3. Rattachement métier → secteur via une table de correspondance
   alignée sur les catégories de metier.csv
4. Encodage catégoriel (métier, secteur, milieu)
5. Normalisation des variables continues (salaire, âge) via scaler.pkl
6. Construction de la cible score_individuel_epm (entraînement uniquement)
```

---

## 4. Entraînement et sélection du modèle (`notebooks/03_model_training.ipynb`, `src/train.py`)

Conformément à `documentation2.md` (§16), trois familles de modèles sont comparées :

```text
Régression linéaire   → référence interprétable
Random Forest          → robustesse, interactions non linéaires
XGBoost                → performance, gestion du surapprentissage
```

### 4.1 Protocole

* Séparation train/validation/test (ex. 70/15/15), stratifiée si possible par secteur d'activité pour éviter qu'un secteur sur-représenté ne domine l'apprentissage.
* Validation croisée (k-fold) sur l'ensemble d'entraînement pour la sélection d'hyperparamètres.
* Le modèle final est choisi sur la base de sa performance sur l'ensemble de test, **jamais** sur l'ensemble d'entraînement.

### 4.2 Indicateurs à reporter

| Modèle | MAE | RMSE | R² |
|---|---|---|---|
| Régression linéaire | *(voir `model_metadata.json`)* | | |
| Random Forest | *(voir `model_metadata.json`)* | | |
| XGBoost | *(voir `model_metadata.json`)* | | |

> Ce tableau doit être rempli avec les valeurs réellement produites par `04_evaluation.ipynb` — aucune valeur n'est estimée ici pour ne pas introduire de chiffres fictifs dans le mémoire.

### 4.3 Critère de sélection du modèle final

Comme indiqué dans `documentation2.md` (§16) : le modèle final n'est pas retenu parce qu'il est le plus complexe, mais parce qu'il présente le meilleur compromis MAE/RMSE/R² sur les données de validation, **et** un temps d'inférence compatible avec un usage en ligne (`src/api.py` doit répondre en quelques dizaines de millisecondes par travailleur).

### 4.4 Sortie de l'entraînement

```json
// models/model_metadata.json (structure attendue)
{
  "model_type": "RandomForest | XGBoost | LinearRegression",
  "version": "4.0",
  "trained_on": "EPM2021-2022 (INSTAT)",
  "features": ["metier", "secteur_activite", "salaire", "age", "milieu"],
  "target": "score_individuel_epm",
  "metrics": {
    "mae": null,
    "rmse": null,
    "r2": null
  },
  "training_date": null
}
```

---

## 5. Données synthétiques (si nécessaire)

Si certains métiers de `metier.csv` sont peu ou pas représentés dans l'échantillon EPM (ex. `Technologie`, `NGO_Association`), le principe défini en §17 de `documentation2.md` s'applique : générer des données synthétiques **à partir des distributions observées dans les secteurs proches**, les documenter séparément, et toujours valider en priorité sur les données réelles disponibles. Le modèle ne doit pas être jugé performant uniquement parce qu'il reproduit les hypothèses utilisées pour générer ses propres données synthétiques.

---

## 6. Inférence en production (`src/predict.py`, `src/api.py`)

```text
Entrée : { metier, secteur_activite, salaire, salary_source, age, milieu }
    ↓
preprocess.py (même pipeline que l'entraînement)
    ↓
final_model.pkl → score_i ∈ [0, 100]
```

Appelé une fois par activité déclarée dans `familyData.workers[].work[]` (Module 3), donc potentiellement plusieurs fois par travailleur si celui-ci cumule plusieurs activités.

---

## 7. Agrégation familiale (`family_score`)

Reprend telle quelle la formule de `documentation2.md` (§18), à partir des `score_i` produits par le modèle et des statistiques déjà calculées par le Module 3 (`statistics.total_income`, `salary` par travailleur) :

```text
poids_i = salaire_i / salaire_max

family_score =
    Σ(score_i × poids_i)
    ────────────────────
       Σ(poids_i)
```

`salaire_i` est le `total_salary` du travailleur (Module 3, §2 « Transformation des travailleurs »), qui somme déjà les activités multiples d'un même travailleur.

### Sortie du Module 4

```json
{
  "workers": [
    {
      "role": "vous",
      "score": 0,
      "score_source": "model_v4.0"
    }
  ],
  "family_score": 0,
  "mean_score_reference": 0,
  "model_version": "4.0"
}
```

`mean_score_reference` correspond au `mean_score` utilisé par les Modules 5 et 7 (§23, §30 de `documentation2.md`) — il doit être calculé une fois sur l'ensemble de l'échantillon EPM au moment de l'entraînement, puis figé dans `model_metadata.json` pour rester cohérent entre les exécutions.

---

## 8. Intégration dans le flux applicatif

```
Module 3 (familyData.workers[])
    ↓
    ⚡ buildSocioEconomicData()  ← NEW (Module 4)
    ├─ Pour chaque travailleur/activité : appel src/predict.py
    ├─ Calcul des poids par salaire
    └─ Agrégation → family_score
    ↓
    state.socioEconomicData = { workers[].score, family_score, mean_score_reference }
    ↓
    Module 5 (fond disponible) et Module 7 (besoin énergétique)
```

---

## 9. Limites à documenter (spécifiques au Module 4)

1. La variable cible `score_individuel_epm` est une **construction méthodologique** du mémoire, pas une mesure officielle publiée par l'INSTAT — son choix de pondération doit être justifié et si possible testé en sensibilité (faire varier les poids et observer l'impact sur `family_score`).
2. La séparation cible/features (§2) est nécessaire pour éviter la fuite de données, mais elle limite mécaniquement la performance atteignable : le modèle ne peut pas mieux faire que ce que le métier, le salaire, l'âge et le milieu permettent de prédire.
3. La simulation du cas « salaire estimé » (§2.3) introduit elle-même une source de bruit contrôlé — à documenter comme hypothèse, pas comme donnée réelle.
4. Les métiers absents ou sous-représentés dans l'EPM dépendent de `metier.csv` et/ou de données synthétiques, avec l'incertitude que cela implique (cf. §17 de `documentation2.md`).
5. `mean_score_reference`, figé au moment de l'entraînement, doit être recalculé si le modèle est ré-entraîné sur une nouvelle version de l'EPM, sous peine d'incohérence avec les Modules 5 et 7.

---

## ✅ Checklist d'acceptation

- [ ] Construction de `score_individuel_epm` implémentée dans `02_feature_engineering.ipynb`
- [ ] Vérification qu'aucune variable de la cible ne fuit dans les features
- [ ] Entraînement comparatif des 3 modèles dans `03_model_training.ipynb`
- [ ] Sélection et sauvegarde du modèle final (`final_model.pkl`, `scaler.pkl`)
- [ ] `model_metadata.json` rempli avec les métriques réelles (MAE, RMSE, R²)
- [ ] `mean_score_reference` calculé et figé
- [ ] `src/predict.py` testé en cohérence avec `preprocess.py`
- [ ] Intégration `buildSocioEconomicData()` dans le flux applicatif (suite logique de `buildFamilyData()`)
- [ ] Test bout-à-bout : `familyData` → `family_score` sur l'exemple Rakoto Jean du Module 3
- [ ] Section « Limites » relue et intégrée au mémoire

---

**Module 4 — SPÉCIFICATION PRÊTE POUR IMPLÉMENTATION / ENTRAÎNEMENT**
