<?php
// web/api/photos.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Obtener parámetros de la URL
$year = $_GET['year'] ?? '';
$month = $_GET['month'] ?? '';
$day = $_GET['day'] ?? '';

// Validar que se proporcionaron todos los parámetros
if (empty($year) || empty($month) || empty($day)) {
    http_response_code(400);
    echo json_encode(['error' => 'Se requieren año, mes y día']);
    exit();
}

// Validar formato de fecha
if (!preg_match('/^\d{4}$/', $year) ||
    !preg_match('/^\d{2}$/', $month) ||
    !preg_match('/^\d{2}$/', $day)) {
    http_response_code(400);
    echo json_encode(['error' => 'Formato de fecha inválido']);
    exit();
}

// Construir ruta del directorio
$photosBasePath = $_ENV['PHOTOS_PATH'] ?? '/data/fotos';
$dirPath = "$photosBasePath/$year/$month/$day";

$files = [];

// Debug: log para verificar la ruta
error_log("Buscando fotos en: $dirPath");

if (is_dir($dirPath)) {
    $handle = opendir($dirPath);
    if ($handle) {
        while (false !== ($file = readdir($handle))) {
            // Filtrar solo archivos de imagen y video con el formato correcto
            if (preg_match('/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|mp4)$/i', $file)) {
                $files[] = $file;
                error_log("Archivo encontrado: $file");
            }
        }
        closedir($handle);

        // Ordenar archivos por nombre (que corresponde al timestamp)
        sort($files);
    }
} else {
    error_log("Directorio no encontrado: $dirPath");
}

// Devolver la lista de archivos
echo json_encode($files);
?>
