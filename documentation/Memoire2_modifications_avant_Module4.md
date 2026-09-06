# Mémoire 2 --- Modifications avant le Module 4

**Statut :** Modules 1 à 3 stabilisés --- préparation du passage au
Module 4\
**Date :** 3 septembre 2026

## 1. Objet

Cette documentation rassemble les modifications réalisées dans Mémoire 2
avant l'implémentation du **Module 4 --- Modèle socio-économique**.

L'objectif principal des dernières modifications était de fiabiliser le
**Module 3 --- Profil familial**, en particulier la gestion des
activités professionnelles et des salaires.

Principe retenu :

> Une activité professionnelle ne doit pas arriver dans la suite du
> traitement avec un salaire `null` ou inexploitable.

Le Module 3 fournit ensuite aux modules suivants les travailleurs, leurs
activités, leurs salaires et leur source (`declared` ou `estimated`).

## 2. Gestion des activités professionnelles

Chaque travailleur peut avoir une ou plusieurs activités
professionnelles.

Une activité contient notamment :

``` text
work
salary
source
salary_reference
salary_match_type
salary_match_confidence
```

Le Module 4 utilisera notamment les informations relatives au métier, au
secteur, au salaire et à sa source.

## 3. Ajout du champ salaire

Le formulaire du Module 3 contient désormais un champ :

``` text
Salaire mensuel (Ar)
```

Le champ est créé dynamiquement pour chaque activité professionnelle.

Il reprend la valeur de `activity.salary`. Lorsqu'un salaire provient
d'une estimation automatique, le champ est désactivé.

Une correction importante a été effectuée : le champ salaire est
réellement ajouté au conteneur avec :

``` javascript
salaryField.appendChild(salaryInput);
```

Cela a corrigé le problème où le champ était créé dans le code mais
n'apparaissait pas correctement dans l'interface.

## 4. Distinction salaire déclaré / salaire estimé

### Salaire déclaré

Lorsque l'utilisateur saisit directement un salaire :

``` text
source = "declared"
```

La valeur saisie devient le salaire de l'activité.

Les anciennes informations d'estimation sont supprimées :

``` text
salary_reference = null
salary_match_type = null
salary_match_confidence = 0
```

### Salaire estimé

Lorsque l'utilisateur utilise l'estimation :

``` text
source = "estimated"
```

Le système recherche une référence dans :

``` text
dynamiques/data/metier.csv
```

Les informations de correspondance sont conservées afin de savoir quelle
référence métier a été utilisée.

## 5. Case « Salaire inconnu (estimer) »

Une case à cocher permet d'activer l'estimation automatique.

Lorsqu'elle est activée :

1.  `activity.source` devient `estimated` ;
2.  le système recherche une référence métier ;
3.  le salaire estimé est appliqué ;
4.  le champ de saisie manuelle est désactivé.

Lorsqu'elle est désactivée :

``` javascript
activity.salary = null;
activity.source = null;
```

Les anciennes informations de correspondance sont également supprimées.

L'utilisateur peut alors déclarer lui-même son salaire.

## 6. Estimation à partir de `metier.csv`

Le fichier utilisé comme référence est :

``` text
dynamiques/data/metier.csv
```

Il contient notamment :

``` text
index
secteur
metier
salaire_min_ariary
salaire_max_ariary
salaire_moyen_ariary
type
```

Le système charge ce fichier au démarrage.

Le métier est normalisé avant la recherche afin de gérer notamment les
différences de casse, d'accents et de ponctuation.

## 7. Validation du salaire

Une activité ne doit pas être considérée comme correctement renseignée
si son salaire est absent ou invalide.

Le salaire doit être :

``` text
numérique
> 0
```

et sa source doit être connue :

``` text
declared
```

ou :

``` text
estimated
```

Cela évite de transmettre silencieusement des activités avec un salaire
`null`.

## 8. Enrichissement automatique de `metier.csv`

Une fonctionnalité d'enrichissement automatique a été ajoutée.

Le flux est :

``` text
Utilisateur
    ↓
métier + salaire déclaré
    ↓
enrichMetierReference()
    ↓
enrichir_metier.php
    ↓
metier.csv
```

L'appel est effectué après la saisie du salaire, lors de la perte de
focus du champ.

Le JavaScript transmet notamment :

``` javascript
{
    metier: metier,
    salaire: salaire,
    secteur: secteur
}
```

Le PHP valide les données avant de modifier le CSV.

## 9. Écriture sécurisée du CSV

`enrichir_metier.php` :

1.  vérifie l'existence de `metier.csv` ;
2.  récupère le JSON ;
3.  vérifie le métier ;
4.  vérifie le salaire ;
5.  ouvre le fichier en lecture/écriture ;
6.  verrouille le fichier avec `flock()` ;
7.  recherche le métier ;
8.  modifie ou ajoute la ligne ;
9.  réécrit le fichier si nécessaire ;
10. libère le verrou ;
11. retourne une réponse JSON.

## 10. Règle d'enrichissement d'un métier existant

Pour un métier déjà présent, les bornes existantes sont utilisées.

La règle est :

``` text
salaire déclaré < salaire_min
    → salaire de référence = salaire_min

salaire_min <= salaire déclaré <= salaire_max
    → salaire de référence = moyenne de min et max

salaire déclaré > salaire_max
    → salaire de référence = salaire_max
```

L'objectif est d'éviter qu'une seule déclaration atypique remplace
directement les références existantes.

## 11. Création d'un nouveau métier

Si le métier n'existe pas encore, une nouvelle ligne est créée.

La règle est :

``` text
index         = dernier index + 1
salaire_min   = salaire déclaré - 50 000
salaire_moyen = salaire déclaré
salaire_max   = salaire déclaré + 100 000
type          = observed
```

Le salaire minimum est protégé afin de ne pas devenir négatif.

Exemple :

``` text
Salaire déclaré : 800 000 Ar

salaire_min     : 750 000 Ar
salaire_moyen   : 800 000 Ar
salaire_max     : 900 000 Ar
```

`index` est l'identifiant numérique du métier dans le CSV. Pour un
nouveau métier, il est obtenu en prenant le plus grand index existant et
en ajoutant `1`.

## 12. Métier existant mais sans salaire

Si le métier existe déjà mais que ses données salariales sont vides ou
nulles, la ligne existante peut être complétée à partir de la
déclaration.

Elle reçoit :

``` text
salaire_min   = salaire déclaré - 50 000
salaire_moyen = salaire déclaré
salaire_max   = salaire déclaré + 100 000
type          = observed
```

## 13. Réinitialisation après une déclaration manuelle

Une déclaration manuelle doit effacer les traces d'une ancienne
estimation.

Ainsi :

``` text
source = declared
salary_reference = null
salary_match_type = null
salary_match_confidence = 0
```

Cela garantit qu'un salaire déclaré ne conserve pas les métadonnées
d'une estimation précédente.

## 14. Recalcul de `familyData`

Après une modification du salaire ou de sa source :

``` javascript
state.familyData = null;
```

Les données familiales sont donc reconstruites avec les nouvelles
informations lors du prochain calcul du récapitulatif.

Le flux est :

``` text
Collecte
   ↓
state.family
   ↓
buildRecapWithLocationData()
   ↓
Module 2 — Localisation
   ↓
Module 3 — Profil familial
   ↓
state.familyData
   ↓
Récapitulatif / export
```

## 15. Données transmises aux modules suivants

Le Module 3 fournit notamment :

``` text
workers[]
salary
salary_source
statistics.total_income
income_per_person
family_size
age
```

Le Module 4 reçoit donc des données déjà préparées et n'a pas à refaire
la saisie ou la validation du salaire.

## 16. État actuel

-   [x] Saisie des travailleurs
-   [x] Plusieurs activités professionnelles
-   [x] Champ de salaire mensuel
-   [x] Distinction salaire déclaré / salaire estimé
-   [x] Estimation à partir de `metier.csv`
-   [x] Métadonnées de correspondance métier
-   [x] Réinitialisation des données d'estimation
-   [x] Validation des salaires
-   [x] Enrichissement automatique de `metier.csv`
-   [x] Création automatique des nouveaux métiers
-   [x] Attribution automatique du nouvel `index`
-   [x] Gestion des métiers existants
-   [x] Recalcul de `familyData`
-   [x] Transmission des données du Module 3 vers les modules suivants

## 17. Point de passage vers le Module 4

Le Module 3 constitue maintenant la couche de **collecte, validation et
préparation du profil familial**.

Le principe général est :

``` text
MODULE 1
Collecte initiale
      ↓
MODULE 2
Localisation
      ↓
MODULE 3
Profil familial
      ↓
Validation + salaires + références métiers
      ↓
familyData
      ↓
MODULE 4
Modèle socio-économique
```

Le Module 4 ne doit donc pas refaire le travail du Module 3. Il doit
exploiter les données préparées et se concentrer sur son propre rôle :
**l'analyse et le calcul du modèle socio-économique**.

## 18. Conclusion

Les dernières modifications ont rendu le Module 3 plus robuste et ont
ajouté une boucle d'enrichissement progressive de `metier.csv`.

Le système distingue maintenant clairement :

``` text
DONNÉE DÉCLARÉE
        +
DONNÉE ESTIMÉE
        +
RÉFÉRENCE MÉTIER
        +
MÉTADONNÉES DE CORRESPONDANCE
```

Le flux de données est désormais suffisamment structuré pour passer à
l'étape suivante :

> **Module 4 --- Modèle socio-économique.**
