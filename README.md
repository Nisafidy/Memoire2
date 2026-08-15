# Memoire2
Application qui aide à la planification energique.

# DSAA — Module 1 : Interface de saisie

Implémentation du **Module 1** du mémoire (§3 à §14) : page de documentation,
localisation (carte), profil familial dynamique, et saisie des travailleurs.

## Lancer le projet

Le navigateur bloque `fetch()` sur des fichiers ouverts en `file://`. Il faut
donc servir le dossier via un petit serveur local :

```bash
cd dsaa
python -m http.server 8000
```

Puis ouvrir : `http://localhost:14464/documentation.html`

## Structure

```
dsaa/
├── documentation.html   → page d'entrée (§3.1)
├── interface.html        → assistant de saisie en 4 étapes
├── css/style.css
├── js/
│   ├── csv.js             → parseur CSV générique (, ou ;)
│   └── app.js              → état, carte Leaflet, formulaires dynamiques
└── data/
    ├── ville.csv           → échantillon fourni (à remplacer par le fichier complet)
    ├── metier.csv          → échantillon fourni
    └── prix.csv            → échantillon fourni (réservé au Module 6)
```

## Ce que fait déjà l'interface

- **Étape 1 — Localisation** : deux clics sur la carte (objectif puis
  habitat), calcul d'un aperçu de ville la plus proche à vol d'oiseau à
  partir de `ville.csv`. La distance **routière** exacte (OSRM/Valhalla) et
  l'irradiation (NASA POWER) ne sont **pas** calculées ici — ce sont les
  responsabilités du Module 2 (backend), car elles nécessitent des appels
  réseau côté serveur.
- **Étape 2 — Profil familial** : nom, âge, taille du foyer. L'âge déclenche
  dynamiquement la liste des relations disponibles (§12 du mémoire).
- **Étape 3 — Travailleurs** : ajout de plusieurs travailleurs, chacun avec
  un rôle (dépendant de l'âge) et une ou plusieurs activités. Pour chaque
  activité, le salaire est facultatif : cocher « salaire inconnu » va
  chercher `salaire_moyen_ariary` dans `metier.csv` (correspondance sur le
  nom du métier) et marque la source comme `estimated`, sinon `declared`.
- **Étape 4 — Récapitulatif** : génère le JSON final, téléchargeable ou
  copiable, prêt à être transmis aux modules suivants.

## Écart volontaire par rapport au schéma du mémoire

Le mémoire (§14) place `salary_source` comme un champ unique par
travailleur. Ici, `salary_source` est un **tableau parallèle** à `work[]` et
`salary[]` (une source par activité), pour ne pas perdre l'information
qu'un même travailleur puisse avoir un salaire déclaré pour une activité et
estimé pour une autre. À harmoniser avec le reste du mémoire si vous
préférez garder un champ unique.

## Prochaines étapes

- Remplacer les 3 CSV d'échantillon par vos fichiers complets.
- Module 2 (backend) : appel OSRM/Valhalla + NASA POWER à partir du JSON
  produit ici.
- Module 4-5 : modèle ML du score socio-économique (entraînement séparé,
  non inclus dans ce livrable).
- Module 6-8 : moteur de dimensionnement (grid search) à partir de
  `prix.csv`.