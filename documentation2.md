# ALGORITHME DE DIMENSIONNEMENT SOLAIRE ADAPTATIF (DSAA)

**Version : 2.0**
**Contexte :** Mémoire d'ingénierie — Dimensionnement photovoltaïque adapté aux ménages malgaches
**Objectif général :** Déterminer si une installation photovoltaïque est financièrement et techniquement envisageable pour un ménage, puis rechercher la configuration d'installation la plus adaptée à sa situation socio-économique, à sa localisation, aux conditions solaires et aux prix locaux.

---

# 1. PRINCIPE GÉNÉRAL

Le DSAA repose sur une approche différente du dimensionnement photovoltaïque classique.

Dans une approche Bottom-Up classique, le dimensionnement commence généralement par l'identification des équipements électriques :

```text
Équipements
    ↓
Puissance
    ↓
Durée d'utilisation
    ↓
Consommation énergétique
    ↓
Dimensionnement photovoltaïque
```

Le DSAA introduit une étape supplémentaire permettant d'adapter le niveau d'équipement à la situation réelle du ménage :

```text
Situation socio-économique
            ↓
     Profil familial
            ↓
     Family Score
            ↓
Consommation énergétique estimée
            ↓
       Besoin essentiel
            ↓
Budget réellement disponible
            ↓
Faisabilité financière
            ↓
Optimisation du système
            ↓
Installation photovoltaïque recommandée
```

L'objectif n'est donc pas de rechercher l'installation la plus puissante possible, mais de rechercher **l'installation la plus pertinente compte tenu des ressources du ménage et de son contexte géographique et énergétique.**

---

# 2. ARCHITECTURE GÉNÉRALE

Le système est constitué de sept modules principaux.

```text
┌─────────────────────────────────────────────┐
│  MODULE 1 — INTERFACE                       │
│  Documentation + saisie utilisateur        │
└──────────────────────┬──────────────────────┘
                       ↓
┌─────────────────────────────────────────────┐
│  MODULE 2 — LOCALISATION                    │
│  Objectif + habitat + ville + distance      │
│  + irradiation                              │
└──────────────────────┬──────────────────────┘
                       ↓
┌─────────────────────────────────────────────┐
│  MODULE 3 — PROFIL FAMILIAL                 │
│  Travailleurs + métiers + salaires          │
└──────────────────────┬──────────────────────┘
                       ↓
┌─────────────────────────────────────────────┐
│  MODULE 4 — MODÈLE SOCIO-ÉCONOMIQUE         │
│  ML → score individuel → family_score       │
└──────────────────────┬──────────────────────┘
                       ↓
┌─────────────────────────────────────────────┐
│  MODULE 5 — CAPACITÉ FINANCIÈRE             │
│  Fond disponible + transport + faisabilité  │
└──────────────────────┬──────────────────────┘
                       ↓
┌─────────────────────────────────────────────┐
│  MODULE 6 — DIMENSIONNEMENT                 │
│  Recherche des configurations admissibles   │
│  + optimisation sous contraintes             │
└──────────────────────┬──────────────────────┘
                       ↓
┌─────────────────────────────────────────────┐
│  MODULE 7 — RÉSULTATS                       │
│  Devis + schéma + ROI + recommandations     │
└─────────────────────────────────────────────┘
```

---

# 3. MODULE 1 — INTERFACE ET SAISIE

## 3.1 Page de documentation

La page `documentation.html` constitue le point d'entrée du système.

Elle présente :

* l'objectif de l'application ;
* le principe général du dimensionnement ;
* les principales informations demandées à l'utilisateur ;
* les limites de l'estimation ;
* les conditions générales d'utilisation ;
* les éventuelles mentions légales.

L'utilisateur clique sur **« Commencer »** pour accéder à l'interface de saisie.

---

# 4. MODULE 2 — LOCALISATION

Le module de localisation utilise une carte interactive basée sur OpenStreetMap et Leaflet.js.

Deux positions distinctes sont demandées.

---

## 4.1 Localisation de l'installation

L'utilisateur clique une première fois sur la carte pour indiquer l'endroit où il souhaite installer le système photovoltaïque.

La position est enregistrée sous la forme :

```text
objectif = {
    lat,
    long
}
```

Cette position devient la référence géographique de l'installation.

---

# 5. DÉTERMINATION DE LA VILLE DE RÉFÉRENCE

Le fichier `villes.csv` contient les informations relatives aux villes utilisées par le système.

Structure conceptuelle :

```text
ville = {
    name,
    lat,
    long,
    pop,
    lvl,
    priceCoeff
}
```

### Signification

* `name` : nom de la ville ;
* `lat` : latitude ;
* `long` : longitude ;
* `pop` : population estimée ;
* `lvl` : niveau hiérarchique de la ville ;
* `priceCoeff` : coefficient d'adaptation du prix du matériel selon la localisation.

---

## 5.1 Recherche de la ville candidate

Pour chaque ville du fichier `villes.csv`, le système calcule une distance géographique entre :

```text
objectif
```

et :

```text
ville_i
```

Cette première distance peut être calculée à vol d'oiseau.

Elle sert à identifier les villes candidates les plus proches.

---

## 5.2 Distance routière

La distance géographique ne représente pas nécessairement la distance réellement parcourue.

Le système utilise donc un moteur de routage tel que :

* OSRM ;
* ou éventuellement Valhalla si celui-ci est retenu lors de l'implémentation.

Le moteur de routage fournit la distance routière entre l'objectif et la ville candidate.

```text
objectif
    ↓
moteur de routage
    ↓
distance routière
```

La ville de référence est alors déterminée en fonction de la proximité réellement pertinente pour le transport.

La structure obtenue est :

```text
nearest_town = {
    name,
    lat,
    long,
    pop,
    lvl,
    priceCoeff,
    road_distance
}
```

---

# 6. COEFFICIENT DE TRANSPORT

Le coût de transport dépend de la direction géographique.

Les valeurs utilisées par le système sont stockées dans la configuration :

```text
road_price = {
    est: 54,
    sud: 66,
    ouest: 125,
    nord: 125
}
```

Les valeurs exactes sont considérées comme des paramètres issus des données et sources retenues dans le cadre du projet.

Le coût de déplacement peut être calculé selon :

```text
transport_one_way =
    road_distance × road_price
```

Puis :

```text
transport_round_trip =
    transport_one_way × 2
```

où `2` représente le trajet aller-retour.

Les frais de séjour peuvent ensuite être ajoutés séparément.

---

# 7. IRRADIATION SOLAIRE

À partir des coordonnées :

```text
objectif = {
    lat,
    long
}
```

le système interroge NASA POWER.

La donnée obtenue est :

```text
irradiation[]
```

Elle contient les valeurs d'irradiation solaire disponibles pour la localisation.

L'utilisation d'une année complète permet de tenir compte de la variation saisonnière.

Structure conceptuelle :

```text
irradiation = [
    janvier,
    février,
    mars,
    ...
    décembre
]
```

Lorsque les données disponibles permettent une période plus longue, celle-ci peut être utilisée pour améliorer l'analyse saisonnière.

---

# 8. SORTIE INTERMÉDIAIRE DU MODULE GÉOGRAPHIQUE

À la fin de cette première étape, le système possède :

```text
locationData = {

    objectif: {
        lat,
        long
    },

    nearest_town: {
        name,
        lat,
        long,
        pop,
        lvl,
        priceCoeff,
        road_distance
    },

    transport: {
        road_price,
        one_way_distance,
        round_trip_distance,
        transport_cost
    },

    irradiation: [
        ...
    ]
}
```

L'interface affiche également graphiquement le trajet entre l'installation et la ville de référence.

Le trajet est rendu dynamiquement sur la carte au moyen d'une ligne (`Polyline`).

---

# 9. LOCALISATION DE L'HABITAT

L'utilisateur effectue ensuite un deuxième clic sur la carte.

Cette fois, il indique :

> l'emplacement actuel de son habitat.

La position est enregistrée sous la forme :

```text
habitat = {
    lat,
    long
}
```

Le même mécanisme de calcul routier peut être utilisé pour déterminer la distance entre :

```text
habitat
```

et :

```text
objectif
```

Cette distance est enregistrée comme :

```text
deplacement_distance
```

Elle représente la distance supplémentaire nécessaire pour rejoindre le lieu d'installation depuis l'habitat.

---

# 10. MODULE 3 — PROFIL FAMILIAL

Le formulaire recueille les caractéristiques générales du ménage.

```text
family = {
    name,
    age,
    family_nbr,
    workers[]
}
```

Les informations principales sont :

* nom complet ;
* âge ;
* nombre de personnes dans le foyer ;
* travailleurs du ménage ;
* activité professionnelle ;
* salaire mensuel lorsque celui-ci est connu.

---

# 11. STRUCTURE DES TRAVAILLEURS

Chaque travailleur est représenté par :

```text
worker = {
    role,
    work[],
    salary[]
}
```

Un ménage peut contenir plusieurs travailleurs.

Un travailleur peut également déclarer plusieurs activités professionnelles.

Exemple :

```text
workers = [

    {
        role: "père",
        work: [
            "agriculteur",
            "petit commerce"
        ],
        salary: [
            180000,
            50000
        ]
    },

    {
        role: "mère",
        work: [
            "commerce"
        ],
        salary: [
            150000
        ]
    }

]
```

Le revenu total du ménage correspond à la somme des revenus retenus pour les travailleurs.

---

# 12. LOGIQUE DE SÉLECTION DES MEMBRES

Le formulaire adapte les relations familiales proposées en fonction de l'âge de l'utilisateur.

Pour un utilisateur âgé de 0 à 21 ans :

```text
père
mère
frère / sœur
```

Pour un utilisateur âgé de 21 à 35 ans :

```text
vous
époux / épouse
père
mère
frère / sœur
```

Pour un utilisateur âgé de 35 à 40 ans :

```text
vous
époux / épouse
père
mère
```

Pour un utilisateur âgé de 40 ans ou plus :

```text
vous
époux / épouse
père
mère
enfant
```

Cette logique permet de construire dynamiquement le formulaire en fonction de la situation familiale déclarée.

---

# 13. ESTIMATION DES SALAIRES

Le salaire est facultatif.

Si l'utilisateur connaît le salaire d'un travailleur, celui-ci est utilisé directement.

Si le salaire n'est pas fourni, le système utilise :

```text
metier.csv
```

afin d'obtenir une estimation du revenu mensuel correspondant au métier et, lorsque les données le permettent, à sa localisation.

Le système conserve l'information permettant de distinguer :

```text
salaire déclaré
```

de :

```text
salaire estimé
```

afin de préserver la traçabilité du calcul.

---

# 14. SORTIE DU PROFIL FAMILIAL

Le module produit :

```text
family = {

    name,
    age,
    family_nbr,

    workers: [

        {
            role,
            work,
            salary,
            salary_source
        }

    ]
}
```

où :

```text
salary_source ∈ {
    "declared",
    "estimated"
}
```

---

# 15. MODULE 4 — MODÈLE SOCIO-ÉCONOMIQUE

Le module socio-économique constitue une partie importante du DSAA.

Il a pour objectif de transformer les informations relatives au travail et aux revenus en un indicateur permettant de représenter le profil socio-économique du ménage.

Le processus est :

```text
Métier
+
Salaire
+
Données socio-économiques disponibles
        ↓
Modèle ML
        ↓
Score individuel
        ↓
Agrégation familiale
        ↓
family_score
```

---

# 16. APPRENTISSAGE AUTOMATIQUE DU SCORE INDIVIDUEL

Le modèle est entraîné à partir des données disponibles de l'EPM 2021-2022 de l'INSTAT.(dynamiques\data\EMPL_complet_energy_score.csv,variable.csv)

La variable cible est :

```text
score individuel ∈ [0,100]
```

Les variables explicatives retenues dépendent des données réellement disponibles dans l'échantillon.

Elles peuvent notamment comprendre :

* profession ;
* revenu ;
* caractéristiques socio-économiques disponibles ;
* autres variables pertinentes présentes dans les données.

Plusieurs modèles peuvent être comparés :

```text
Régression linéaire
Random Forest
XGBoost
```

Le modèle final n'est pas choisi parce qu'il est théoriquement plus complexe, mais parce qu'il présente les performances les plus pertinentes sur les données de validation.

Les indicateurs d'évaluation comprennent notamment :

```text
MAE
RMSE
R²
```

---

# 17. GÉNÉRATION ÉVENTUELLE DE DONNÉES SYNTHÉTIQUES

Lorsque la quantité de données réelles disponibles est insuffisante, des données synthétiques peuvent être utilisées pour compléter l'expérimentation.

Cependant, les données synthétiques ne doivent pas être considérées comme équivalentes aux données réelles.

Leur utilisation doit être documentée séparément.

Le principe est :

```text
Données réelles
       ↓
Analyse des distributions
       ↓
Génération synthétique
       ↓
Entraînement expérimental
       ↓
Validation prioritaire sur données réelles
```

L'objectif est d'éviter de conclure qu'un modèle est performant uniquement parce qu'il reproduit les hypothèses utilisées pour générer ses propres données.

---

# 18. CALCUL DU SCORE FAMILIAL

Chaque travailleur obtient un score individuel :

```text
score_i
```

compris entre 0 et 100.

Le poids associé au travailleur est :

```text
poids_i = salaire_i / salaire_max
```

où :

```text
salaire_max =
maximum des salaires retenus dans le ménage
```

Le score familial est :

```text
family_score =
Σ(score_i × poids_i)
--------------------
Σ(poids_i)
```

Ainsi, les membres disposant d'un revenu plus important exercent une influence plus importante dans l'agrégation du profil socio-économique familial.

Le score familial est ensuite normalisé ou conservé sur l'intervalle :

```text
0 ≤ family_score ≤ 100
```

selon l'implémentation retenue.

---

# 19. INTERPRÉTATION DU FAMILY SCORE

Le `family_score` ne représente pas directement :

* la richesse absolue ;
* le salaire total ;
* la consommation réelle mesurée.

Il constitue un **indicateur socio-économique modélisé** permettant d'adapter l'estimation du niveau de consommation et le dimensionnement à la situation du ménage.

Cette distinction est importante.

Le score est donc un facteur d'adaptation du modèle et non une mesure directe de la consommation électrique.

---

# 20. MODULE 5 — CALCUL DU FOND DISPONIBLE

Le fond disponible représente la somme que le ménage peut théoriquement consacrer au projet après prise en compte de ses dépenses courantes.

On définit :

```text
S = revenu mensuel total du ménage
N = nombre de personnes dans le foyer
W = nombre de travailleurs
D = N - W
```

Le coût de vie de référence par personne est :

```text
baseline_living_cost = 210000 Ar/mois
```

Cette constante provient des sources économiques retenues pour le projet.

---

# 21. DÉPENSES DE VIE

Afin de tenir compte de la composition du ménage, une échelle d'équivalence est appliquée aux personnes supplémentaires.

Avec :

```text
equivalence_scale = 0.4
```

la dépense contrainte est modélisée par :

```text
living_cost =
210000 × (W + 0.4 × D)
```

Cette formulation traduit le principe selon lequel l'augmentation de la taille du ménage ne provoque pas une augmentation strictement proportionnelle de toutes les dépenses.

La valeur exacte du coefficient est documentée dans les sources économiques du projet.

---

# 22. TAUX DE SIMULTANÉITÉ

Le ménage n'utilise pas nécessairement toutes les ressources individuelles simultanément.

Le modèle introduit donc :

```text
simultaneity =
0.35 + 0.65 / √N
```

Cette valeur est utilisée pour modéliser la réduction de certaines dépenses partagées.

---

# 23. DÉPENSES DISCRÉTIONNAIRES

Une dépense mensuelle de référence est définie par :

```text
leisure_base = 25000 Ar/personne/mois
```

Le coût discrétionnaire est alors :

```text
leisure_cost =
N × leisure_base
× (1 - simultaneity)
× (family_score / mean_score)^0.2
```

où :

```text
mean_score
```

représente le score moyen de référence utilisé par le modèle.

L'exposant `0.2` permet d'introduire l'influence du profil socio-économique sans faire varier cette dépense de manière linéaire avec le score.

---

# 24. FOND MENSUEL

Le fond disponible est calculé par :

```text
fond =
S
- living_cost
- leisure_cost
```

soit :

```text
fond =
S
- 210000 × (W + 0.4D)
- N × 25000
  × (1 - (0.35 + 0.65/√N))
  × (family_score / mean_score)^0.2
```

Si :

```text
fond ≤ 0
```

le ménage ne dispose pas d'une capacité mensuelle théorique suffisante pour financer le projet.

Le système peut alors déclarer l'installation non recommandée.

---

# 25. MODULE 6 — FAISABILITÉ FINANCIÈRE

Le système commence par déterminer le coût minimal théorique d'une installation.

```text
min_possible =
prix_kit_minimum × priceCoeff
```

où `prix_kit_minimum` est défini dans `prix.csv` ou dans la configuration du système.

Le coût de déplacement est calculé séparément :

```text
transport_cost =
road_distance
× road_price
× 2
+
frais_de_séjour
```

Le facteur `2` correspond à l'aller-retour.

Les frais de séjour sont déterminés selon la valeur retenue dans les paramètres économiques du projet.

---

# 26. PREMIÈRE CONDITION DE FAISABILITÉ

La capacité annuelle théorique du ménage est :

```text
annual_capacity =
fond × 12
```

Si :

```text
fond × 12 < min_possible
```

l'installation minimale n'est pas finançable dans un horizon d'un an.

Le projet peut alors être déclaré non recommandé selon les règles de décision définies.

---

# 27. CAPACITÉ À FINANCER LE DÉPLACEMENT

Le système vérifie séparément que le ménage peut supporter les dépenses associées au déplacement.

La logique générale est :

```text
fond ≥ coût_transport_mensuel
```

ou selon le modèle retenu :

```text
fond ≥ transport_round_trip + frais_de_séjour
```

La formule exacte doit utiliser le coût de déplacement calculé précédemment afin d'éviter de compter deux fois l'aller-retour.

---

# 28. HORIZON D'ÉPARGNE

Lorsque le ménage ne peut pas financer immédiatement l'installation, le système recherche le nombre de mois d'épargne nécessaires.

On teste :

```text
x ∈ [0,11]
```

et pour chaque valeur :

```text
budget_x = fond × (x + 1)
```

Le système cherche le premier `x` tel que :

```text
budget_x ≥ install_cost
```

Lorsque cette condition est satisfaite, l'installation peut être considérée comme financièrement accessible après `x + 1` mois de capacité d'épargne.

Si aucune valeur de `x` comprise entre 0 et 11 ne permet de financer l'installation, le système utilise l'horizon annuel :

```text
budget_available = fond × 12
```

selon la règle de décision retenue.

---

# 29. BUDGET DE DIMENSIONNEMENT

Le moteur de dimensionnement reçoit :

```text
budget_available
```

ainsi que :

```text
family_score
irradiation[]
transport_cost
priceCoeff
```

et les prix disponibles dans :

```text
prix.csv
```

---

# 30. MODULE 7 — ESTIMATION DU BESOIN ÉNERGÉTIQUE

Le `family_score` intervient ici comme facteur d'adaptation du besoin énergétique.

Le système définit d'abord un besoin énergétique de référence.

```text
base_energy_need
```

Ce besoin représente le niveau essentiel d'utilisation retenu par le modèle.

Le besoin adapté à la famille est ensuite obtenu à partir du profil socio-économique.

Une formulation possible est :

```text
essential_energy =
base_energy_need
× (family_score / mean_score)^α
```

où `α` est un paramètre du modèle déterminé et justifié expérimentalement.

L'objectif est d'éviter une relation strictement proportionnelle entre niveau socio-économique et consommation.

Le `family_score` devient ainsi le mécanisme qui adapte le niveau de consommation de référence au profil du ménage.

---

# 31. POURQUOI SÉPARER LE ML DU DIMENSIONNEMENT ?

Le ML répond à la question :

```text
Quel profil socio-économique et quel niveau de consommation
peut-on estimer pour cette famille ?
```

Le moteur de dimensionnement répond à une autre question :

```text
Quel ensemble de composants peut satisfaire ce besoin
dans les contraintes financières et techniques disponibles ?
```

Cette séparation permet d'éviter d'utiliser artificiellement le machine learning pour résoudre un problème qui peut être traité directement par des équations physiques et une recherche sous contraintes.

---

# 32. MODULE 8 — DIMENSIONNEMENT PHOTOVOLTAÏQUE

Les variables de décision sont notamment :

```text
n_p = nombre de panneaux
P_p = puissance d'un panneau

n_b = nombre de batteries
C_b = capacité d'une batterie

onduleur = modèle sélectionné

regulateur = MPPT ou PWM

n_lampes
n_prises
longueur_cable
protections
```

Les différents composants disponibles sont décrits dans :

```text
prix.csv
```

---

# 33. PRODUCTION PHOTOVOLTAÏQUE

Pour une configuration donnée :

```text
E_day =
n_p
× P_p
× irradiation
× rendement_systeme
```

Le calcul peut être effectué pour chaque mois :

```text
E_month[i] =
n_p
× P_p
× irradiation[i]
× rendement_systeme
```

Cela permet de tenir compte de la variation saisonnière.

Le système peut alors retenir :

* la production moyenne ;
* la production minimale mensuelle ;
* ou une autre métrique définie dans les critères du mémoire.

Pour une approche conservatrice, la production du mois défavorable peut être utilisée comme contrainte de sécurité.

---

# 34. CAPACITÉ DES BATTERIES

Pour une batterie :

```text
usable_capacity =
C_b × DoD
```

Pour plusieurs batteries :

```text
usable_capacity_total =
n_b × C_b × DoD
```

Le `DoD` dépend du type de batterie.

Exemple :

```text
Lithium :
DoD = 0.8
```

La valeur exacte est définie dans la configuration et justifiée par les caractéristiques techniques retenues.

---

# 35. AUTONOMIE

L'autonomie est estimée par :

```text
autonomy_days =
usable_capacity_total
/
daily_energy_need
```

La configuration est considérée comme techniquement admissible uniquement si :

```text
autonomy_days ≥ autonomy_min
```

La valeur minimale d'autonomie est définie dans les paramètres du système.

---

# 36. COHÉRENCE ÉLECTRIQUE

Chaque configuration doit respecter les contraintes électriques.

Notamment :

* tension du système ;
* tension des batteries ;
* nombre de batteries en série ;
* nombre de panneaux en série ;
* courant admissible du régulateur ;
* puissance nominale de l'onduleur ;
* puissance maximale des charges ;
* compatibilité MPPT/PWM ;
* sections de câbles ;
* protections.

Une configuration peut donc être rejetée même si elle respecte le budget.

---

# 37. MONTAGE DES PANNEAUX

Le système détermine le montage nécessaire :

```text
série
```

ou :

```text
parallèle
```

selon la tension du système et les caractéristiques électriques des panneaux.

Par exemple, pour un système 24 V, deux panneaux adaptés peuvent être associés en série lorsque leurs caractéristiques le permettent.

Le système doit vérifier la cohérence de la configuration plutôt que simplement diviser ou multiplier les quantités.

---

# 38. MONTAGE DES BATTERIES

Même principe pour les batteries.

Le montage dépend de la tension du système :

```text
12 V
```

ou :

```text
24 V
```

Le système détermine :

```text
nombre en série
```

puis :

```text
nombre de branches parallèles
```

afin d'obtenir :

```text
tension_système
```

et :

```text
capacité_utile
```

compatibles avec le dimensionnement.

---

# 39. SÉLECTION DE L'ONDULEUR

L'onduleur est sélectionné parmi les modèles présents dans `prix.csv`.

Il doit satisfaire :

```text
P_onduleur ≥ P_charge_max
```

et être compatible avec la tension du système.

Le type d'onduleur influence également le choix du régulateur.

---

# 40. RÉGULATEUR

Le système vérifie si le modèle d'onduleur choisi intègre déjà un dispositif de régulation.

Dans le cas contraire, un régulateur externe est ajouté :

```text
MPPT
```

ou :

```text
PWM
```

selon la configuration retenue.

Le choix doit être compatible avec :

* la tension du système ;
* la puissance photovoltaïque ;
* le courant maximal ;
* le type de batterie ;
* l'onduleur.

---

# 41. RECHERCHE DES CONFIGURATIONS

Plutôt que d'utiliser obligatoirement une métaheuristique, le DSAA utilise une recherche des configurations admissibles.

Le principe est :

```text
Pour chaque nombre de panneaux possible
    Pour chaque nombre de batteries possible
        Pour chaque onduleur compatible
            Pour chaque régulateur compatible

                Calculer :
                    production
                    autonomie
                    coût
                    puissance
                    contraintes électriques

                Si toutes les contraintes sont respectées :
                    enregistrer la configuration
```

Cette méthode est appelée **recherche exhaustive contrainte / Grid Search**.

Elle est particulièrement adaptée lorsque le nombre de composants et de configurations possibles reste limité.

---

# 42. CONTRAINTES DU DIMENSIONNEMENT

Une configuration est admissible si :

```text
coût_total ≤ budget_available
```

et :

```text
production_énergétique ≥ essential_energy
```

et :

```text
autonomy_days ≥ autonomie_min
```

et :

```text
P_onduleur ≥ P_charge_max
```

et :

```text
tension_système compatible
```

et :

```text
régulateur compatible
```

et :

```text
montage électrique réalisable
```

et :

```text
composants disponibles
```

---

# 43. CRITÈRE DE SÉLECTION DE LA MEILLEURE CONFIGURATION

Parmi les configurations admissibles, le système recherche celle qui offre le meilleur compromis entre :

* couverture énergétique ;
* coût ;
* autonomie ;
* marge de puissance ;
* possibilité d'évolution.

Une fonction de score peut être utilisée :

```text
F =
α × couverture_énergétique
- β × coût_normalisé
+ γ × autonomie_normalisée
+ δ × capacité_d_extension
```

Les coefficients `α`, `β`, `γ` et `δ` doivent être définis et justifiés dans le cadre expérimental.

Une autre possibilité, plus simple et plus facile à défendre, est de procéder par priorité :

```text
1. respecter toutes les contraintes ;
2. minimiser le coût ;
3. maximiser la couverture ;
4. maximiser l'autonomie ;
5. favoriser l'extension future.
```

Cette seconde méthode a l'avantage de rendre la décision plus facilement interprétable.

---

# 44. PRIX TOTAL

Pour chaque configuration :

```text
cost_material =
cost_panels
+ cost_batteries
+ cost_inverter
+ cost_regulator
+ cost_lamps
+ cost_outlets
+ cost_cables
+ cost_protection
+ autres_composants
```

Puis :

```text
install_cost =
cost_material
+ transport_cost
```

Le coefficient géographique `priceCoeff` est appliqué aux composants concernés selon la politique tarifaire définie dans le système.

---

# 45. CONFIGURATION FINALE

La meilleure configuration produit une structure similaire à :

```text
recommendation = {

    panels: {
        model,
        power_unit,
        quantity,
        unit_price,
        total_price,
        series,
        parallel
    },

    batteries: {
        technology,
        capacity_unit,
        quantity,
        unit_price,
        total_price,
        series,
        parallel,
        usable_capacity,
        autonomy_days
    },

    inverter: {
        type,
        power,
        price
    },

    regulator: {
        type,
        current,
        price,
        integrated
    },

    lamps: {
        quantity,
        power,
        price
    },

    outlets: {
        quantity,
        price
    },

    cables: {
        estimated_length,
        section,
        price
    },

    protection: {
        technology,
        price
    },

    financial: {
        material_cost,
        transport_cost,
        installation_cost,
        available_budget,
        remaining_budget
    },

    energy: {
        essential_energy,
        estimated_production,
        autonomy_days
    }
}
```

---

# 46. ROI

Le système calcule ensuite un indicateur financier.

Le ROI simplifié est calculé à partir des économies attendues par rapport à la solution énergétique de référence utilisée dans le modèle.

Par exemple :

```text
ROI =
économies_annuelles_estimées
/
coût_installation
```

ou, si exprimé en pourcentage :

```text
ROI_percent =
(économies_annuelles_estimées
/
coût_installation)
× 100
```

La définition exacte doit rester cohérente avec la méthode économique retenue dans le mémoire.

---

# 47. INTERPRÉTATION DU ROI

Le ROI ne doit pas être interprété comme une garantie financière.

Il représente une estimation basée sur les hypothèses :

* coût de l'installation ;
* dépenses énergétiques évitées ;
* durée d'utilisation ;
* prix de référence de l'énergie ;
* entretien.

Le système peut donc présenter :

```text
économie estimée par mois
économie estimée par an
temps de retour estimé
```

---

# 48. POSSIBILITÉ D'EXTENSION

Le système analyse également la marge disponible après installation.

Si :

```text
budget_remaining > 0
```

ou si l'analyse du besoin futur indique une augmentation probable de la demande, le système peut recommander une extension future.

Exemples :

```text
ajout d'un panneau
```

```text
augmentation de la capacité batterie
```

```text
remplacement de l'onduleur
```

La recommandation dépend des contraintes électriques de l'installation existante.

---

# 49. MODULE 9 — VISUALISATION

La page de résultat affiche :

### Informations générales

```text
Nom
Prénom
Localisation
Ville de référence
Distance
```

### Informations économiques

```text
Fond mensuel
Budget disponible
Coût du matériel
Coût du transport
Coût total
Reste disponible
ROI
```

### Informations énergétiques

```text
Besoin énergétique estimé
Production estimée
Autonomie
Puissance installée
```

---

# 50. TABLEAU RÉCAPITULATIF

Le système génère un tableau :

| Composant  | Spécification          | Quantité | Prix unitaire | Prix total |
| ---------- | ---------------------- | -------: | ------------: | ---------: |
| Panneaux   | modèle / puissance     |      ... |           ... |        ... |
| Batteries  | technologie / capacité |      ... |           ... |        ... |
| Onduleur   | puissance / type       |        1 |           ... |        ... |
| Régulateur | MPPT / PWM             |      ... |           ... |        ... |
| Lampes     | puissance              |      ... |           ... |        ... |
| Prises     | type                   |      ... |           ... |        ... |
| Câbles     | section / longueur     |      ... |           ... |        ... |
| Protection | technologie            |      ... |           ... |        ... |
| **Total**  |                        |          |               |    **...** |

---

# 51. TABLEAU DE BORD

Un tableau de bord synthétique présente :

```text
┌─────────────────────────────────────┐
│ FOND DISPONIBLE                     │
│ XXX XXX Ar                          │
├─────────────────────────────────────┤
│ COÛT INSTALLATION                   │
│ XXX XXX Ar                          │
├─────────────────────────────────────┤
│ RESTANT                             │
│ XXX XXX Ar                          │
├─────────────────────────────────────┤
│ AUTONOMIE                           │
│ X jours                             │
├─────────────────────────────────────┤
│ ROI                                 │
│ XX %                                │
└─────────────────────────────────────┘
```

---

# 52. SCHÉMA SVG DE L'INSTALLATION

Le système génère dynamiquement un schéma SVG.

Le schéma représente :

```text
Panneaux solaires
       ↓
Régulateur
       ↓
Batteries
       ↓
Onduleur
       ↓
Tableau / distribution
       ↓
Lampes / prises
```

Les composants sont générés dynamiquement selon la configuration recommandée.

Par exemple :

```text
2 panneaux
```

produisent deux représentations graphiques.

```text
4 batteries
```

produisent quatre représentations.

Le montage série/parallèle est également représenté.

---

# 53. RECOMMANDATIONS PERSONNALISÉES

Le système fournit des messages correspondant au résultat.

Exemples :

### Entretien

```text
Nettoyer régulièrement les panneaux.
Vérifier les connexions.
Contrôler l'état des batteries.
Vérifier les dispositifs de protection.
```

### Utilisation

Le système indique les équipements compatibles avec la puissance disponible.

Exemple :

```text
Ce système peut alimenter :
- plusieurs lampes LED ;
- des téléphones ;
- un ordinateur portable ;
- une radio ;
- certains petits appareils.
```

Les appareils fortement consommateurs sont signalés comme incompatibles lorsque leur puissance dépasse les capacités du système.

---

# 54. STRUCTURE FINALE DES DONNÉES

L'ensemble du résultat peut être regroupé dans :

```text
DSAA_Result = {

    user: {
        name,
        age
    },

    location: {

        objectif: {
            lat,
            long
        },

        habitat: {
            lat,
            long
        },

        nearest_town: {
            name,
            lat,
            long,
            pop,
            lvl,
            priceCoeff
        },

        distance: {
            road_distance,
            deplacement_distance
        },

        irradiation: []
    },

    family: {

        family_nbr,

        workers: [
            {
                role,
                work,
                salary,
                salary_source,
                score
            }
        ],

        family_score
    },

    finance: {

        monthly_income,
        living_cost,
        leisure_cost,
        fond,
        transport_cost,
        available_budget
    },

    energy: {

        essential_energy,
        production,
        autonomy
    },

    recommendation: {

        panels,
        batteries,
        inverter,
        regulator,
        lamps,
        outlets,
        cables,
        protection,

        material_cost,
        transport_cost,
        installation_cost,

        ROI
    }

}
```

---

# 55. ALGORITHME GLOBAL

Le fonctionnement général peut être résumé par le pseudo-code suivant :

```text
DEBUT

Afficher documentation

Attendre clic "Commencer"

────────────────────────────────
ÉTAPE 1 — LOCALISATION OBJECTIF
────────────────────────────────

objectif ← position sélectionnée sur la carte

villes ← charger villes.csv

candidats ← rechercher villes proches de objectif

Pour chaque ville candidate :
    calculer distance géographique
    obtenir distance routière via OSRM/Valhalla

nearest_town ← ville retenue

Déterminer road_price

transport_distance ← distance routière

transport_cost ← calcul du transport aller-retour

irradiation ← récupérer NASA POWER(objectif)

Afficher le trajet sur la carte

────────────────────────────────
ÉTAPE 2 — LOCALISATION HABITAT
────────────────────────────────

habitat ← deuxième position sélectionnée

deplacement_distance ← distance routière(habitat, objectif)

────────────────────────────────
ÉTAPE 3 — PROFIL FAMILIAL
────────────────────────────────

Lire :
    nom
    âge
    nombre de personnes

Construire dynamiquement les membres possibles

Pour chaque travailleur :
    lire métier
    lire salaire

    Si salaire absent :
        salary ← estimation depuis metier.csv
        salary_source ← estimated
    Sinon :
        salary_source ← declared

────────────────────────────────
ÉTAPE 4 — SCORE SOCIO-ÉCONOMIQUE
────────────────────────────────

Pour chaque travailleur :

    score_i ← modèle ML(métier, salaire, autres variables)

Calculer :

    salaire_max ← maximum des salaires

Pour chaque travailleur :

    poids_i ← salaire_i / salaire_max

family_score ←
    Σ(score_i × poids_i) / Σ(poids_i)

────────────────────────────────
ÉTAPE 5 — BESOIN ÉNERGÉTIQUE
────────────────────────────────

Déterminer besoin énergétique de référence

essential_energy ←
    adaptation(base_energy_need, family_score)

────────────────────────────────
ÉTAPE 6 — FOND DISPONIBLE
────────────────────────────────

S ← somme des revenus

W ← nombre de travailleurs

N ← nombre de personnes

D ← N - W

living_cost ←
    baseline_living_cost × (W + 0.4D)

simultaneity ←
    0.35 + 0.65 / √N

leisure_cost ←
    N × leisure_base
    × (1 - simultaneity)
    × (family_score / mean_score)^0.2

fond ←
    S - living_cost - leisure_cost

Si fond ≤ 0 :
    installation non recommandée
    FIN

────────────────────────────────
ÉTAPE 7 — FAISABILITÉ
────────────────────────────────

min_possible ←
    prix_kit_minimum × priceCoeff

budget_annuel ← fond × 12

Si budget_annuel < min_possible :
    installation non recommandée

Vérifier capacité de déplacement

Rechercher x ∈ [0,11]

    budget_x ← fond × (x + 1)

    Si budget_x permet de financer une installation :
        budget_available ← budget_x
        enregistrer délai d'épargne
        continuer

Sinon :
    budget_available ← budget_annuel

────────────────────────────────
ÉTAPE 8 — DIMENSIONNEMENT
────────────────────────────────

prix ← charger prix.csv

solutions ← liste vide

Pour chaque configuration possible :

    calculer production énergétique

    calculer capacité batterie

    calculer autonomie

    calculer puissance maximale

    calculer coût matériel

    ajouter coût transport

    vérifier contraintes

    Si configuration admissible :
        ajouter à solutions

Si solutions est vide :
    installation techniquement ou financièrement impossible
    FIN

────────────────────────────────
ÉTAPE 9 — SÉLECTION
────────────────────────────────

Classer les solutions selon :

    1. respect des contraintes
    2. coût
    3. couverture énergétique
    4. autonomie
    5. potentiel d'extension

solution_finale ← meilleure solution

────────────────────────────────
ÉTAPE 10 — CALCUL FINANCIER
────────────────────────────────

Calculer :

    coût matériel
    coût transport
    coût total
    budget restant
    économies estimées
    ROI
    temps de retour

────────────────────────────────
ÉTAPE 11 — VISUALISATION
────────────────────────────────

Afficher :

    nom
    ville de référence
    distance
    fond
    budget
    coût total
    ROI
    autonomie

Générer tableau des composants

Générer schéma SVG

Générer recommandations

Afficher informations d'entretien

Afficher possibilités d'extension

FIN
```

---

# 56. RÉPARTITION DES RESPONSABILITÉS

L'architecture logicielle peut être organisée ainsi :

```text
documentation.html
    ↓
interface.js
    ↓
map-selection.js
    ↓
locationService.js
    ├── villes.csv
    ├── OSRM / Valhalla
    └── NASA POWER

questionnaire.js
    ↓
familyService.js
    ├── metier.csv
    └── modèle ML

financeService.js
    ↓
calcul du fond
    ↓
calcul de la faisabilité

energyService.js
    ↓
calcul du besoin
    ↓
calcul de production

dimensioningService.js
    ↓
prix.csv
    ↓
Grid Search
    ↓
solution optimale

recommendation.js
    ↓
ROI
    ↓
messages

svgGenerator.js
    ↓
schéma de l'installation
```

---

# 57. PHILOSOPHIE DU DSAA

Le DSAA repose finalement sur quatre niveaux de décision.

### Niveau 1 — Observer

Le système observe :

```text
où ?
qui ?
combien ?
quel métier ?
quel revenu ?
quelle irradiation ?
quelle distance ?
```

### Niveau 2 — Estimer

Le système estime :

```text
score individuel
family_score
besoin énergétique
fond disponible
```

### Niveau 3 — Vérifier

Le système vérifie :

```text
faisabilité financière
faisabilité logistique
faisabilité énergétique
faisabilité électrique
```

### Niveau 4 — Décider

Le système sélectionne :

```text
l'installation la plus adaptée
```

sous les contraintes imposées.

---

# 58. APPORT DU DSAA

L'originalité principale du système ne réside donc pas dans l'utilisation isolée d'une technologie particulière.

Elle réside dans l'intégration de plusieurs dimensions :

```text
SOCIO-ÉCONOMIQUE
       +
GÉOGRAPHIQUE
       +
LOGISTIQUE
       +
ÉNERGÉTIQUE
       +
FINANCIÈRE
       +
TECHNIQUE
       ↓
DIMENSIONNEMENT ADAPTATIF
```

Le système cherche ainsi à éviter deux situations :

```text
Installation techniquement suffisante
mais financièrement inaccessible
```

et :

```text
Installation financièrement accessible
mais techniquement insuffisante
```

Le résultat recherché est une solution située à l'intersection des deux :

```text
          TECHNIQUEMENT
              ┌───────┐
              │       │
              │  DSAA │
              │       │
              └───────┘
          FINANCIÈREMENT
```

Le dimensionnement devient alors un problème de **compromis entre capacité financière du ménage, niveau de besoin estimé, ressources solaires disponibles, contraintes techniques et contraintes logistiques.**

---

# 59. LIMITES À DOCUMENTER

Le système doit explicitement reconnaître plusieurs limites :

1. Le `family_score` est un indicateur modélisé et non une mesure directe de la consommation.
2. La qualité du modèle ML dépend directement de la qualité et de la représentativité des données EPM disponibles.
3. Les salaires estimés par `metier.csv` introduisent une incertitude supplémentaire.
4. Les prix présents dans `prix.csv` sont dépendants des fournisseurs et de la période d'observation.
5. La distance routière dépend de la disponibilité et de la précision du moteur de routage.
6. Les données d'irradiation sont des estimations issues d'un modèle satellitaire/météorologique et non des mesures réalisées sur le site.
7. Le calcul du ROI dépend des hypothèses économiques utilisées.
8. Le dimensionnement final constitue une recommandation d'aide à la décision et doit être vérifié par un professionnel avant installation réelle.

---

# 60. CONCLUSION

Le DSAA propose une approche de dimensionnement photovoltaïque adaptée au contexte socio-économique et géographique du ménage.

Contrairement à une approche reposant uniquement sur la demande électrique déclarée, le système prend en compte :

```text
le profil familial
les revenus
le niveau socio-économique
la localisation
la distance routière
le coût logistique
l'irradiation solaire
le budget disponible
les contraintes électriques
les prix des équipements
```

Le machine learning est utilisé pour estimer le profil socio-économique individuel et contribuer au calcul du `family_score`.

Le dimensionnement lui-même est ensuite réalisé par un moteur de recherche et d'optimisation sous contraintes, permettant de sélectionner une configuration techniquement admissible et financièrement compatible.

L'ensemble constitue ainsi un système d'aide à la décision destiné à proposer une installation photovoltaïque **adaptée non seulement à ce qu'un ménage pourrait consommer, mais également à ce qu'il peut raisonnablement financer et exploiter.**
