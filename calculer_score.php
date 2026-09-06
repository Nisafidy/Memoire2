<?php

header('Content-Type: application/json; charset=utf-8');

ini_set('display_errors', '0');
error_reporting(E_ALL);


/**
 * Réponse JSON standard
 */
function sendJson(bool $success, string $message, array $data = []): void
{
    echo json_encode(
        [
            'success' => $success,
            'message' => $message,
            'data'    => $data
        ],
        JSON_UNESCAPED_UNICODE
    );

    exit;
}


/**
 * 1. Lire les données envoyées par JavaScript
 */
$rawInput = file_get_contents('php://input');

if (!$rawInput) {
    sendJson(false, 'Aucune donnée reçue.');
}


/**
 * 2. Vérifier que le JSON est valide
 */
$input = json_decode($rawInput, true);

if (!is_array($input)) {
    sendJson(false, 'JSON reçu invalide.');
}


/**
 * 3. Préparer les données nécessaires au modèle
 */
$predictionData = [
    'salaire_mensuel' => $input['salaire_mensuel'] ?? null,
    'hhmilieu2'       => $input['hhmilieu2'] ?? null,
    'hhreg'           => $input['hhreg'] ?? null,
    'q4a_02'          => $input['q4a_02'] ?? null
];


/**
 * 4. Vérifications minimales
 */
if (
    $predictionData['salaire_mensuel'] === null ||
    $predictionData['hhmilieu2'] === null ||
    $predictionData['hhreg'] === null ||
    $predictionData['q4a_02'] === null
) {
    sendJson(
        false,
        'Données insuffisantes pour calculer le score.',
        $predictionData
    );
}


/**
 * 5. Chemins absolus
 */
$projectRoot = __DIR__;

$pythonPath = 'python';

$predictScript = $projectRoot . DIRECTORY_SEPARATOR
    . 'ml' . DIRECTORY_SEPARATOR
    . 'src' . DIRECTORY_SEPARATOR
    . 'predict.py';


/**
 * 6. Transformer les données en JSON
 */
$pythonInput = json_encode(
    $predictionData,
    JSON_UNESCAPED_UNICODE
);

if ($pythonInput === false) {
    sendJson(false, 'Impossible de préparer les données pour Python.');
}


/**
 * 7. Sécuriser le chemin du script Python
 */
$scriptArg = escapeshellarg($predictScript);


/**
 * 8. Appeler Python
 *
 * Le JSON est envoyé à Python via STDIN.
 * Cela évite les problèmes de guillemets sous Windows.
 */
$command = $pythonPath . ' ' . $scriptArg;

$descriptorspec = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w']
];

$process = proc_open($command, $descriptorspec, $pipes);

if (!is_resource($process)) {
    sendJson(
        false,
        'Impossible de démarrer le modèle Python.'
    );
}


/**
 * Envoyer le JSON à Python
 */
fwrite($pipes[0], $pythonInput);
fclose($pipes[0]);


/**
 * Lire la réponse de Python
 */
$output = stream_get_contents($pipes[1]);
fclose($pipes[1]);


/**
 * Lire les éventuelles erreurs Python
 */
$errorOutput = stream_get_contents($pipes[2]);
fclose($pipes[2]);


/**
 * Récupérer le code de retour Python
 */
$returnCode = proc_close($process);


/**
 * Python a rencontré une erreur
 */
if ($returnCode !== 0 && trim($output) === '') {
    sendJson(
        false,
        'Le modèle Python a rencontré une erreur.',
        [
            'error_output' => trim($errorOutput)
        ]
    );
}


/**
 * 9. Vérifier la réponse Python
 */
$output = trim($output);

if ($output === '') {
    sendJson(
        false,
        'Le modèle Python n’a renvoyé aucune réponse.',
        [
            'error_output' => trim($errorOutput)
        ]
    );
}


/**
 * 10. Transformer la réponse Python en tableau PHP
 */
$result = json_decode($output, true);


/**
 * 11. Vérifier que Python a bien renvoyé du JSON
 */
if (!is_array($result)) {
    sendJson(
        false,
        'Réponse invalide du modèle Python.',
        [
            'raw_output'  => $output,
            'error_output' => trim($errorOutput)
        ]
    );
}


/**
 * 12. Python peut lui-même retourner une erreur
 */
if (isset($result['error'])) {
    sendJson(
        false,
        'Erreur du modèle ML.',
        $result
    );
}


/**
 * 13. Succès
 */
sendJson(
    true,
    'Score calculé avec succès.',
    $result
);
