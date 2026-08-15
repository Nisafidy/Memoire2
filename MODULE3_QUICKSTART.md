# MODULE 3 — GUIDE RAPIDE

## 🎯 En 30 secondes

Le **Module 3 (Profil Familial)** prend les informations brutes du formulaire (nom, âge, travailleurs) et les transforme en structure propre, valide et enrichie de statistiques.

```
Données brutes (interface)
    ↓
    Validation
    ↓
    Transformation
    ↓
⚡ Résultat : familyData
   - Profil validé
   - Travailleurs structurés
   - Statistiques complètes
```

---

## 📦 Outputs du Module 3

### Structure de sortie

```javascript
familyData = {
  name: string,           // Nom complet
  age: number,           // Âge 
  family_nbr: number,    // Taille du foyer
  age_group: string,     // "youth" | "adult" | "mature" | "senior"
  
  workers: [             // Travailleurs transformés
    {
      role: string,              // "vous", "père", etc.
      work: string[],            // Métiers/activités
      salary: number[],          // Salaires (Ar/mois)
      salary_source: string[],   // "declared" | "estimated"
      total_salary: number,      // Somme des salaires
      activity_count: number     // Nombre d'activités
    }
  ],
  
  statistics: {          // Statistiques du ménage
    total_income: number,           // Revenu total (Ar/mois)
    worker_count: number,           // Nombre de travailleurs
    non_worker_count: number,       // Personnes sans revenu
    income_per_worker: number,      // Revenu moyen par travailleur
    income_per_person: number,      // Revenu par personne au foyer
    max_salary: number,
    min_salary: number,
    avg_salary: number,
    declared_salary_count: number,  // Salaires saisis
    estimated_salary_count: number, // Salaires estimés
    has_declared_income: boolean,   // Au moins un salaire déclaré
    has_estimated_income: boolean,  // Au moins un salaire estimé
    salary_coverage_percent: number // % de couverture
  }
}
```

### Exemple complet

```json
{
  "name": "Rakoto Jean",
  "age": 34,
  "age_group": "adult",
  "family_nbr": 5,
  "workers": [
    {
      "role": "vous",
      "work": ["agriculteur"],
      "salary": [250000],
      "salary_source": ["declared"],
      "total_salary": 250000,
      "activity_count": 1
    },
    {
      "role": "époux / épouse",
      "work": ["commerce"],
      "salary": [180000],
      "salary_source": ["declared"],
      "total_salary": 180000,
      "activity_count": 1
    }
  ],
  "statistics": {
    "total_income": 430000,
    "worker_count": 2,
    "non_worker_count": 3,
    "family_size": 5,
    "income_per_worker": 215000,
    "income_per_person": 86000,
    "max_salary": 250000,
    "min_salary": 180000,
    "avg_salary": 215000,
    "declared_salary_count": 2,
    "estimated_salary_count": 0,
    "total_activities": 2,
    "salary_coverage_percent": 100
  }
}
```

---

## 🔧 Utilisage

### 1. Remplir le formulaire

**Étape 2** : Profil familial
- Nom complet : ex. "Rakoto Jean"
- Âge : ex. 34
- Nombre de personnes : ex. 5

**Étape 3** : Travailleurs
- Ajouter chaque travailleur
- Sélectionner son rôle
- Ajouter ses activités
- Rentrer le salaire (ou laisser estimer)

### 2. Voir les résultats

**Étape 4** : Récapitulatif
→ Le JSON contient `familyData` avec tous les résultats

---

## 📊 Exemples de résultats

### Exemple 1 : Ménage simple (1 travailleur)

```
Nom : Jean Dupont
Âge : 28
Foyer : 3 personnes
Travailleur : Jean (employé, 150 000 Ar/mois)

Résultat Module 3:
├─ Revenu total : 150 000 Ar
├─ Revenu par personne : 50 000 Ar
├─ Groupe d'âge : adult
└─ Travailleurs : 1 (non-travailleurs : 2)
```

### Exemple 2 : Ménage complexe (2 travailleurs)

```
Nom : Rakoto Jean
Âge : 34
Foyer : 5 personnes
Travailleurs :
  - Rakoto (agriculteur, 250 000 Ar + commerce, 80 000 Ar)
  - Épouse (commerce, 180 000 Ar)

Résultat Module 3:
├─ Revenu total : 510 000 Ar
├─ Revenu par travailleur : 255 000 Ar
├─ Revenu par personne : 102 000 Ar
├─ Activités totales : 3
└─ Groupe d'âge : adult
```

### Exemple 3 : Ménage avec salaires estimés

```
Nom : Marie Rakotozafy
Âge : 42
Foyer : 4 personnes
Travailleurs :
  - Marie (métier : agriculteur, salaire ESTIMÉ via metier.csv)
  - Père (métier : retraité) — NON TRAVAILLEUR

Résultat Module 3:
├─ Revenu total : 225 000 Ar (estimé)
├─ Salaires déclarés : 0
├─ Salaires estimés : 1
├─ Groupe d'âge : senior
└─ Avertissement : 50% de couverture salariale
```

---

## 💡 Validation & Erreurs

### Validations effectuées

✅ Nom : non-vide, min 2 caractères  
✅ Âge : 1-110 ans  
✅ Taille : 1-30 personnes  
✅ Travailleurs : au moins 1  
✅ Activités : métier obligatoire  

### Messages d'erreur

```
❌ "Nom complet manquant"
❌ "Âge doit être entre 1 et 110 ans"
❌ "Nombre de personnes doit être entre 1 et 30"
❌ "Au moins un travailleur doit être ajouté"
❌ "Travailleur 1, activité 1 : métier manquant"
```

---

## 🧮 Statistiques expliquées

| Statistique | Formule | Exemple |
|-------------|---------|---------|
| **total_income** | Σ(salaire) | 430 000 |
| **income_per_worker** | total / worker_count | 215 000 |
| **income_per_person** | total / family_size | 86 000 |
| **salary_coverage** | (salaires_fournis / total_activités) × 100 | 100% |

---

## ⚙️ Personnalisation

Modifier `js/familyService.js` pour changer :

```javascript
const FAMILY_CONFIG = {
  min_family_size: 1,      // ← Minimum foyer
  max_family_size: 30,     // ← Maximum foyer
  min_age: 1,
  max_age: 110,
  
  roles_by_age: {
    youth: { min: 0, max: 21, roles: [...] },  // ← Âges
    // ...
  }
};
```

---

## 🐛 Troubleshooting

| Problème | Solution |
|----------|----------|
| "Au moins un travailleur doit être ajouté" | Ajouter un travailleur (bouton "+ Ajouter") |
| "Métier manquant" | Remplir le champ "Métier / activité" |
| Statistiques = 0 | Vérifier que les salaires sont renseignés |
| Age incorrecte | Revérifier la date de naissance |

---

## 📈 Prochaines étapes

Une fois Module 3 complété, les données sont transmises à :

1. **Module 4** : Calcul du score socio-économique (utilise `workers[]` et `statistics.total_income`)
2. **Module 5** : Calcul du fond disponible (utilise `total_income` et `family_size`)
3. **Module 6** : Dimensionnement (utilise tous les calculs précédents)

---

## ✅ Validation

Module 3 est **prêt pour utilisation en production** :
- ✅ Tous les calculs testés
- ✅ Validation robuste
- ✅ Gestion erreurs
- ✅ Documentation complète

**Let's build some solar systems! ☀️**
