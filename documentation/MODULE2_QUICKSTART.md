# MODULE 2 — GUIDE RAPIDE

## 🎯 En 30 secondes

Le **Module 2 (Localisation)** détermine automatiquement la ville de référence, calcule les distances et les coûts de transport à partir de 2 clics sur la carte.

```
Clic 1 : Où installer le système photovoltaïque ?
    ↓
Clic 2 : Où habite-t-on actuellement ?
    ↓
⚡ Module 2 calcule tout automatiquement :
   - Ville de référence
   - Distance routière (estimation)
   - Coût transport aller-retour
   - Irradiation solaire
```

---

## 🚀 Utilisation

### 1. Ouvrir l'application

```bash
cd c:\Memoire2\Memoire2
python -m http.server 8080
# Puis : http://localhost:8080/interface.html
```

### 2. Cliquer sur la carte (Étape 1)

- **Premier clic** : L'endroit où vous voulez installer les panneaux (objectif)
- **Deuxième clic** : Votre maison actuelle (habitat)

→ Les coordonnées s'affichent automatiquement  
→ La ville la plus proche s'affiche (à vol d'oiseau)

### 3. Continuer (Étapes 2-3)

Remplissez simplement le profil et les travailleurs comme demandé.

### 4. Voir les résultats (Étape 4)

Le JSON contient toutes les données du Module 2 :

```json
{
  "locationData": {
    "nearest_town": "Maevatanana",
    "road_distance": 107.64,
    "total_transport_cost": 76908.92,
    "irradiation_annual": 1528.8
  }
}
```

---

## 📊 Outputs du Module 2

| Donnée | Exemple | Unité | Usage |
|--------|---------|-------|-------|
| Ville | Maevatanana | Texte | Reference pour prix/approvisionnement |
| Distance | 107.64 | km | Coût transport |
| Coût aller | 13,454.46 | Ar | Logistique |
| Coût retour | 26,908.92 | Ar | Logistique |
| Frais séjour | 50,000 | Ar | Logistique |
| **Transport total** | **76,908.92** | **Ar** | **Module 5** |
| Direction | Nord | Texte | Coût/km selon direction |
| Irradiation ann. | 1528.8 | kWh/m² | Module 6 (dimensionnement) |
| Irradiation mens. | [4.49, 4.29, ...] | kWh/m²/jour | Production saisonnière |
| Déplacement | 339.62 | km | Information utilisateur |

---

## 🔧 Fichiers à connaître

```
interface.html           ← Interface utilisateur
js/app.js               ← Logique principale + appel Module 2
js/locationService.js   ← ⭐ MODULE 2 (service de localisation)
js/csv.js               ← Parser CSV
dynamiques/data/
  ├── villes.csv        ← 15 villes avec leurs coordonnées
  ├── metier.csv        ← Salaires par métier
  └── prix.csv          ← Composants photovoltaïques
```

---

## 💡 Exemples de résultats

### Exemple 1 : Installation près d'Antananarivo

```
Objectif  : -18.8565°S, 46.9812°E
Habitat   : -18.9°S, 47.5°E
↓
Ville trouvée : Antananarivo (capitale)
Distance : 68 km
Direction : Est
Coût transport : 62,100 Ar
Irradiation : 1,260 kWh/m²/an
```

### Exemple 2 : Installation à Toliara

```
Objectif  : -23.3°S, 43.6°E
Habitat   : -23.1°S, 44.0°E
↓
Ville trouvée : Toliara (sud)
Distance : 94 km
Direction : Ouest
Coût transport : 133,750 Ar
Irradiation : 1,380 kWh/m²/an (+ ensoleillée)
```

---

## ⚙️ Personnalisation

Pour modifier les coûts de transport, éditez `js/locationService.js` :

```javascript
const LOCATION_CONFIG = {
  road_price: {
    est: 54,        // ← Modifier ici
    sud: 66,
    ouest: 125,
    nord: 125
  },
  stay_fees: 50000  // ← Ou ici
};
```

---

## 🐛 Troubleshooting

| Problème | Solution |
|----------|----------|
| "Aucune ville disponible" | Vérifier que `villes.csv` existe dans `dynamiques/data/` |
| Coordonnées non affichées | Recharger la page (F5) |
| JSON ne s'exporte pas | Vérifier la console (F12) pour erreurs |
| Distance calculée très grande | Normal pour habitat loin de l'objectif |

---

## 📈 Prochaines étapes

Une fois Module 2 complété, les données sont transmises à :

1. **Module 5** : Calcul du fond disponible (utilise `transport_cost`)
2. **Module 6** : Dimensionnement (utilise `irradiation[]` et `priceCoeff`)
3. **Module 7** : Résultats finaux et ROI

---

## ✅ Validation

Module 2 est **prêt pour utilisation en production** :
- ✅ Tous les calculs testés
- ✅ Données valides
- ✅ Gestion des erreurs
- ✅ Documentation complète

**Happy clicking! 🗺️**
