<?php

header('Content-Type: application/json; charset=utf-8');

// Empêche PHP d'afficher les warnings dans la réponse HTTP
ini_set('display_errors', 0);
error_reporting(E_ALL);

// ================================================================
// CONFIGURATION
// ================================================================

$csvFile = __DIR__ . '/dynamiques/data/metier.csv';

// ================================================================
// FONCTION DE RÉPONSE
// ================================================================

function responseJson(bool $success, string $message, array $data = []): void
{
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data'    => $data
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

// ================================================================
// VÉRIFICATION DU FICHIER
// ================================================================

if (!file_exists($csvFile)) {
    responseJson(
        false,
        'Fichier metier.csv introuvable.'
    );
}

// ================================================================
// RÉCUPÉRATION DES DONNÉES
// ================================================================

$input = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($input)) {
    responseJson(
        false,
        'Données JSON invalides.'
    );
}

// ================================================================
// VALIDATION
// ================================================================

$metier = trim((string)($input['metier'] ?? ''));
$salaireDeclare = $input['salaire'] ?? null;

$secteur = trim(
    (string)($input['secteur'] ?? 'Non classé')
);

if ($metier === '') {
    responseJson(
        false,
        'Le métier est obligatoire.'
    );
}

if (
    !is_numeric($salaireDeclare) ||
    (float)$salaireDeclare <= 0
) {
    responseJson(
        false,
        'Le salaire doit être un nombre supérieur à zéro.'
    );
}

$salaireDeclare = (float)$salaireDeclare;

// ================================================================
// NORMALISATION
// ================================================================

function normalizeMetier(string $value): string
{
    $value = trim($value);

    if (function_exists('transliterator_transliterate')) {
        $value = transliterator_transliterate(
            'Any-Latin; Latin-ASCII',
            $value
        );
    } else {
        $value = iconv(
            'UTF-8',
            'ASCII//TRANSLIT//IGNORE',
            $value
        );
    }

    $value = strtolower($value);

    $value = preg_replace(
        '/[^a-z0-9]+/',
        ' ',
        $value
    );

    return trim(
        preg_replace('/\s+/', ' ', $value)
    );
}

$normalizedInput = normalizeMetier($metier);

// ================================================================
// OUVERTURE DU FICHIER AVEC VERROU
// ================================================================

$handle = fopen($csvFile, 'r+');

if (!$handle) {
    responseJson(
        false,
        'Impossible d\'ouvrir metier.csv.'
    );
}

// Verrouillage exclusif pendant toute l'opération
if (!flock($handle, LOCK_EX)) {
    fclose($handle);
    responseJson(
        false,
        'Impossible de verrouiller metier.csv.'
    );
}

// ================================================================
// LECTURE DU CSV
// ================================================================

$header = fgetcsv(
    $handle,
    0,
    ',',
    '"',
    '\\'
);

if (!$header) {
    flock($handle, LOCK_UN);
    fclose($handle);

    responseJson(
        false,
        'En-tête du CSV introuvable.'
    );
}

// ================================================================
// NORMALISATION DE L'EN-TÊTE
// ================================================================

$header = array_map(
    function ($column) {
        $column = (string)$column;
        // Supprime le BOM UTF-8 éventuel
        $column = preg_replace('/^\xEF\xBB\xBF/', '', $column);
        // Supprime les espaces / retours éventuels
        return trim($column);
    },
    $header
);

// ================================================================
// INDICES DES COLONNES
// ================================================================

$indexColumn = array_search('index', $header, true);
$secteurColumn = array_search('secteur', $header, true);
$metierColumn = array_search('metier', $header, true);
$minColumn = array_search('salaire_min_ariary', $header, true);
$maxColumn = array_search('salaire_max_ariary', $header, true);
$averageColumn = array_search('salaire_moyen_ariary', $header, true);
$typeColumn = array_search('type', $header, true);

// ================================================================
// VÉRIFICATION DE LA STRUCTURE (sans index obligatoire)
// ================================================================

$requiredColumns = [
    'secteur',
    'metier',
    'salaire_min_ariary',
    'salaire_max_ariary',
    'salaire_moyen_ariary',
    'type'
];

$missingColumns = [];

foreach ($requiredColumns as $column) {
    if (!in_array($column, $header, true)) {
        $missingColumns[] = $column;
    }
}

if (!empty($missingColumns)) {
    flock($handle, LOCK_UN);
    fclose($handle);

    responseJson(
        false,
        'Structure de metier.csv invalide.',
        [
            'colonnes_manquantes' => $missingColumns,
            'header_lu_par_php' => $header
        ]
    );
}

// ================================================================
// FONCTION POUR CALCULER LE SALAIRE DE RÉFÉRENCE
// ================================================================

function calculerSalaireReference(float $salaireDeclare, float $min, float $max): float
{
    if ($salaireDeclare < $min) {
        return $min;
    } elseif ($salaireDeclare > $max) {
        return $max;
    } else {
        // Entre min et max → on utilise la moyenne
        return ($min + $max) / 2;
    }
}

// ================================================================
// RECHERCHE DU MÉTIER ET COLLECTE DES LIGNES
// ================================================================

$rows = [];
$existingRowIndex = null;
$metierTrouve = false;

while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {

    if (count($row) < count($header)) {
        continue;
    }

    $rows[] = $row;

    $existingMetier = trim($row[$metierColumn] ?? '');

    if (normalizeMetier($existingMetier) === $normalizedInput) {
        $metierTrouve = true;
        $existingRowIndex = count($rows) - 1;
        break;
    }
}

// ================================================================
// SI LE MÉTIER EXISTE DÉJÀ
// ================================================================

if ($metierTrouve && $existingRowIndex !== null) {

    // Récupérer les salaires min et max existants
    $salaireMinExistant = (float)str_replace(
        [' ', ','],
        ['', '.'],
        $rows[$existingRowIndex][$minColumn] ?? 0
    );

    $salaireMaxExistant = (float)str_replace(
        [' ', ','],
        ['', '.'],
        $rows[$existingRowIndex][$maxColumn] ?? 0
    );

    $salaireMoyenExistant = (float)str_replace(
        [' ', ','],
        ['', '.'],
        $rows[$existingRowIndex][$averageColumn] ?? 0
    );

    // Cas 1 : Métier existe déjà avec une référence complète
    if ($salaireMinExistant > 0 && $salaireMaxExistant > 0 && $salaireMoyenExistant > 0) {
        
        // Calculer le salaire de référence selon la règle
        $salaireReference = calculerSalaireReference(
            $salaireDeclare,
            $salaireMinExistant,
            $salaireMaxExistant
        );

        flock($handle, LOCK_UN);
        fclose($handle);

        responseJson(
            true,
            'Métier déjà présent. Salaire de référence calculé.',
            [
                'action' => 'existing',
                'metier' => $metier,
                'salaire_declare' => $salaireDeclare,
                'salaire_min_reference' => $salaireMinExistant,
                'salaire_max_reference' => $salaireMaxExistant,
                'salaire_moyen_reference' => $salaireMoyenExistant,
                'salaire_reference_calcule' => $salaireReference
            ]
        );
    }

    // Cas 2 : Métier existe mais les salaires sont vides ou à 0
    // → On le considère comme un nouveau métier à créer
    // (on continue l'exécution pour le créer)
}

// ================================================================
// NOUVEAU MÉTIER - CRÉATION (ou mise à jour d'un métier vide)
// ================================================================

// Si le métier existait déjà mais avec des salaires vides, on écrase la ligne
// Sinon, on ajoute une nouvelle ligne

if ($metierTrouve && $existingRowIndex !== null) {
    // Mise à jour de la ligne existante
    $newRow = $rows[$existingRowIndex];
    
    // Valeurs par défaut pour un nouveau métier
    $newMin = max(0, $salaireDeclare - 50000);
    $newMax = $salaireDeclare + 100000;
    $newAverage = $salaireDeclare;
    
    $newRow[$minColumn] = $newMin;
    $newRow[$maxColumn] = $newMax;
    $newRow[$averageColumn] = $newAverage;
    $newRow[$typeColumn] = 'observed';
    
    if ($secteurColumn !== false) {
        $newRow[$secteurColumn] = $secteur;
    }
    
    // Remplacer la ligne dans le tableau
    $rows[$existingRowIndex] = $newRow;
    
    // Réécrire tout le fichier
    rewind($handle);
    ftruncate($handle, 0);
    
    fputcsv($handle, $header, ',', '"', '\\');
    foreach ($rows as $row) {
        fputcsv($handle, $row, ',', '"', '\\');
    }
    
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    
    responseJson(
        true,
        'Métier existant (sans salaire) mis à jour.',
        [
            'action' => 'updated_empty',
            'metier' => $metier,
            'salaire_declare' => $salaireDeclare,
            'salaire_min' => $newMin,
            'salaire_max' => $newMax,
            'salaire_moyen' => $newAverage,
            'secteur' => $secteur
        ]
    );
}

// ================================================================
// NOUVEAU MÉTIER (inexistant dans le CSV)
// ================================================================

// Calcul du nouvel index (si la colonne existe)
$newIndex = null;
if ($indexColumn !== false) {
    $maxIndex = -1;
    foreach ($rows as $row) {
        $value = (int)($row[$indexColumn] ?? -1);
        if ($value > $maxIndex) {
            $maxIndex = $value;
        }
    }
    $newIndex = $maxIndex + 1;
}

// Construction de la nouvelle ligne
$newRow = array_fill(0, count($header), '');

if ($indexColumn !== false && $newIndex !== null) {
    $newRow[$indexColumn] = $newIndex;
}

$newRow[$secteurColumn] = $secteur;
$newRow[$metierColumn] = $metier;

$newMin = max(0, $salaireDeclare - 50000);
$newMax = $salaireDeclare + 100000;

$newRow[$minColumn] = $newMin;
$newRow[$maxColumn] = $newMax;
$newRow[$averageColumn] = $salaireDeclare;
$newRow[$typeColumn] = 'observed';

// Ajouter la ligne
fseek($handle, 0, SEEK_END);
fputcsv($handle, $newRow, ',', '"', '\\');

fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);

// ================================================================
// SUCCÈS - CRÉATION
// ================================================================

responseJson(
    true,
    'Nouveau métier ajouté à metier.csv.',
    [
        'action' => 'created',
        'index' => $newIndex,
        'metier' => $metier,
        'salaire_declare' => $salaireDeclare,
        'salaire_min' => $newMin,
        'salaire_max' => $newMax,
        'salaire_moyen' => $salaireDeclare,
        'secteur' => $secteur
    ]
);