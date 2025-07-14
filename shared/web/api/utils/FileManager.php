<?php
// web/api/utils/FileManager.php - Utilidad para gestión de archivos

/**
 * Clase para gestión centralizada de archivos y directorios
 */
class FileManager {

    private static $config = [
        'base_path' => '/data/fotos',
        'allowed_extensions' => ['jpg', 'jpeg', 'png', 'heic', 'heif', 'mp4', 'mov'],
        'filename_pattern' => '/^\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png|heic|heif|mp4|mov)$/i',
        'max_file_size' => 20971520, // 20MB
        'permissions' => [
            'files' => 0664,
            'directories' => 0775,
            'owner' => 33,
            'group' => 33
        ],
        'cache_enabled' => true,
        'cache_ttl' => 300 // 5 minutos
    ];

    private static $cache = [];

    /**
     * Configurar FileManager
     */
    public static function configure($newConfig = []) {
        self::$config = array_merge(self::$config, $newConfig);
    }

    /**
     * Obtener archivos válidos en un directorio
     */
    public static function getValidFiles($dirPath, $useCache = true) {
        $cacheKey = "files_" . md5($dirPath);

        // Verificar caché
        if ($useCache && self::$config['cache_enabled'] && isset(self::$cache[$cacheKey])) {
            $cached = self::$cache[$cacheKey];
            if ((time() - $cached['timestamp']) < self::$config['cache_ttl']) {
                return $cached['data'];
            }
        }

        $files = [];

        if (!is_dir($dirPath)) {
            return $files;
        }

        try {
            $handle = opendir($dirPath);
            if (!$handle) {
                return $files;
            }

            while (false !== ($filename = readdir($handle))) {
                if (self::isValidFilename($filename)) {
                    $fullPath = $dirPath . '/' . $filename;

                    if (is_file($fullPath)) {
                        $fileInfo = self::getFileInfo($fullPath, $filename);
                        if ($fileInfo) {
                            $files[] = $fileInfo;
                        }
                    }
                }
            }

            closedir($handle);

            // Ordenar por timestamp
            usort($files, function($a, $b) {
                return strcmp($a['timestamp'], $b['timestamp']);
            });

            // Guardar en caché
            if (self::$config['cache_enabled']) {
                self::$cache[$cacheKey] = [
                    'data' => $files,
                    'timestamp' => time()
                ];
            }

        } catch (Exception $e) {
            error_log("Error reading directory $dirPath: " . $e->getMessage());
        }

        return $files;
    }

    /**
     * Obtener información de un archivo
     */
    public static function getFileInfo($fullPath, $filename = null) {
        if (!file_exists($fullPath)) {
            return null;
        }

        $filename = $filename ?: basename($fullPath);

        // Extraer información del path
        $pathInfo = self::extractPathInfo($fullPath);

        // Extraer timestamp del nombre del archivo
        $timestamp = self::extractTimestamp($filename);

        // Determinar tipo de archivo
        $type = self::getFileType($filename);

        $fileInfo = [
            'filename' => $filename,
            'type' => $type,
            'timestamp' => $timestamp,
            'size' => filesize($fullPath),
            'modified' => filemtime($fullPath),
            'path' => str_replace(self::$config['base_path'], '', $fullPath),
            'full_path' => $fullPath
        ];

        // Agregar información de fecha si está disponible en el path
        if ($pathInfo) {
            $fileInfo = array_merge($fileInfo, $pathInfo);
        }

        return $fileInfo;
    }

    /**
     * Verificar si un nombre de archivo es válido
     */
    public static function isValidFilename($filename) {
        // Verificar patrón de nombre
        if (!preg_match(self::$config['filename_pattern'], $filename)) {
            return false;
        }

        // Verificar extensión
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return in_array($extension, self::$config['allowed_extensions']);
    }

    /**
     * Extraer timestamp del nombre del archivo
     */
    public static function extractTimestamp($filename) {
        if (preg_match('/^(\d{2})-(\d{2})-(\d{2})\./', $filename, $matches)) {
            return $matches[1] . ':' . $matches[2] . ':' . $matches[3];
        }
        return '';
    }

    /**
     * Extraer información del path
     */
    public static function extractPathInfo($fullPath) {
        $relativePath = str_replace(self::$config['base_path'] . '/', '', $fullPath);
        $pathParts = explode('/', dirname($relativePath));

        if (count($pathParts) >= 3) {
            $year = $pathParts[0];
            $month = $pathParts[1];
            $day = $pathParts[2];

            if (preg_match('/^\d{4}$/', $year) &&
                preg_match('/^\d{2}$/', $month) &&
                preg_match('/^\d{2}$/', $day)) {

                return [
                    'date' => "$year-$month-$day",
                    'year' => intval($year),
                    'month' => intval($month),
                    'day' => intval($day)
                ];
            }
        }

        return null;
    }

    /**
     * Obtener tipo de archivo
     */
    public static function getFileType($filename) {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        $videoExtensions = ['mp4', 'mov'];
        return in_array($extension, $videoExtensions) ? 'video' : 'photo';
    }

    /**
     * Buscar archivos recursivamente
     */
    public static function searchFiles($basePath = null, $criteria = []) {
        $basePath = $basePath ?: self::$config['base_path'];
        $files = [];

        if (!is_dir($basePath)) {
            return $files;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($basePath, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $filename = $file->getFilename();

                if (self::isValidFilename($filename)) {
                    $fileInfo = self::getFileInfo($file->getPathname(), $filename);

                    if ($fileInfo && self::matchesCriteria($fileInfo, $criteria)) {
                        $files[] = $fileInfo;
                    }
                }
            }
        }

        return $files;
    }

    /**
     * Verificar si un archivo coincide con criterios
     */
    private static function matchesCriteria($fileInfo, $criteria) {
        // Filtro por tipo
        if (isset($criteria['type']) && $criteria['type'] !== 'all') {
            if ($criteria['type'] !== $fileInfo['type']) {
                return false;
            }
        }

        // Filtro por fecha
        if (isset($criteria['date']) && isset($fileInfo['date'])) {
            if ($criteria['date'] !== $fileInfo['date']) {
                return false;
            }
        }

        // Filtro por rango de fechas
        if (isset($criteria['start_date']) && isset($criteria['end_date']) && isset($fileInfo['date'])) {
            if ($fileInfo['date'] < $criteria['start_date'] || $fileInfo['date'] > $criteria['end_date']) {
                return false;
            }
        }

        // Filtro por año/mes/día
        if (isset($criteria['year']) && isset($fileInfo['year'])) {
            if ($criteria['year'] !== $fileInfo['year']) {
                return false;
            }
        }

        if (isset($criteria['month']) && isset($fileInfo['month'])) {
            if ($criteria['month'] !== $fileInfo['month']) {
                return false;
            }
        }

        if (isset($criteria['day']) && isset($fileInfo['day'])) {
            if ($criteria['day'] !== $fileInfo['day']) {
                return false;
            }
        }

        // Filtro por tamaño
        if (isset($criteria['min_size']) && $fileInfo['size'] < $criteria['min_size']) {
            return false;
        }

        if (isset($criteria['max_size']) && $fileInfo['size'] > $criteria['max_size']) {
            return false;
        }

        // Búsqueda por texto
        if (isset($criteria['query']) && !empty($criteria['query'])) {
            $searchText = strtolower($criteria['query']);
            $searchableContent = strtolower($fileInfo['filename'] . ' ' . ($fileInfo['date'] ?? ''));

            if (strpos($searchableContent, $searchText) === false) {
                return false;
            }
        }

        return true;
    }

    /**
     * Obtener fechas disponibles
     */
    public static function getAvailableDates($basePath = null) {
        $basePath = $basePath ?: self::$config['base_path'];
        $dates = [];

        if (!is_dir($basePath)) {
            return $dates;
        }

        try {
            // Buscar directorios año/mes/día
            $years = glob($basePath . '/[0-9][0-9][0-9][0-9]', GLOB_ONLYDIR);

            foreach ($years as $yearPath) {
                $year = basename($yearPath);
                $months = glob($yearPath . '/[0-9][0-9]', GLOB_ONLYDIR);

                foreach ($months as $monthPath) {
                    $month = basename($monthPath);
                    $days = glob($monthPath . '/[0-9][0-9]', GLOB_ONLYDIR);

                    foreach ($days as $dayPath) {
                        $day = basename($dayPath);

                        // Verificar si hay archivos válidos
                        $files = self::getValidFiles($dayPath, false);

                        if (!empty($files)) {
                            $dates[] = [
                                'date' => "$year-$month-$day",
                                'year' => intval($year),
                                'month' => intval($month),
                                'day' => intval($day),
                                'file_count' => count($files),
                                'photos' => count(array_filter($files, fn($f) => $f['type'] === 'photo')),
                                'videos' => count(array_filter($files, fn($f) => $f['type'] === 'video'))
                            ];
                        }
                    }
                }
            }
        } catch (Exception $e) {
            error_log("Error getting available dates: " . $e->getMessage());
        }

        return $dates;
    }

    /**
     * Configurar permisos de archivo/directorio
     */
    public static function setupPermissions($path) {
        if (!file_exists($path)) {
            return false;
        }

        try {
            $config = self::$config['permissions'];

            // Cambiar ownership
            if (function_exists('chown') && function_exists('chgrp')) {
                @chown($path, $config['owner']);
                @chgrp($path, $config['group']);
            }

            // Cambiar permisos
            if (is_dir($path)) {
                chmod($path, $config['directories']);
            } else {
                chmod($path, $config['files']);
            }

            return true;
        } catch (Exception $e) {
            error_log("Error setting permissions for $path: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Crear estructura de directorios
     */
    public static function createDirectoryStructure($date) {
        list($year, $month, $day) = explode('-', $date);
        $dirPath = self::$config['base_path'] . "/$year/$month/$day";

        if (!is_dir($dirPath)) {
            if (mkdir($dirPath, self::$config['permissions']['directories'], true)) {
                // Configurar permisos para toda la estructura
                $paths = [
                    self::$config['base_path'] . "/$year",
                    self::$config['base_path'] . "/$year/$month",
                    $dirPath
                ];

                foreach ($paths as $path) {
                    self::setupPermissions($path);
                }

                return $dirPath;
            }
        }

        return is_dir($dirPath) ? $dirPath : false;
    }

    /**
     * Validar archivo
     */
    public static function validateFile($filePath) {
        $errors = [];

        // Verificar existencia
        if (!file_exists($filePath)) {
            $errors[] = 'Archivo no encontrado';
            return $errors;
        }

        // Verificar tamaño
        $fileSize = filesize($filePath);
        if ($fileSize > self::$config['max_file_size']) {
            $errors[] = 'Archivo demasiado grande (' . self::formatFileSize($fileSize) . ')';
        }

        // Verificar nombre
        $filename = basename($filePath);
        if (!self::isValidFilename($filename)) {
            $errors[] = 'Nombre de archivo inválido';
        }

        // Verificar tipo MIME
        if (function_exists('mime_content_type')) {
            $mimeType = mime_content_type($filePath);
            $allowedMimes = [
                'image/jpeg', 'image/png', 'image/heic', 'image/heif',
                'video/mp4', 'video/quicktime'
            ];

            if (!in_array($mimeType, $allowedMimes)) {
                $errors[] = 'Tipo de archivo no permitido';
            }
        }

        return $errors;
    }

    /**
     * Obtener estadísticas de archivos
     */
    public static function getStatistics($basePath = null) {
        $files = self::searchFiles($basePath);

        $stats = [
            'total_files' => count($files),
            'total_photos' => 0,
            'total_videos' => 0,
            'total_size' => 0,
            'dates_with_content' => [],
            'activity_by_hour' => array_fill(0, 24, 0),
            'oldest_file' => null,
            'newest_file' => null
        ];

        $dates = [];
        $timestamps = [];

        foreach ($files as $file) {
            // Contar tipos
            if ($file['type'] === 'photo') {
                $stats['total_photos']++;
            } else {
                $stats['total_videos']++;
            }

            // Sumar tamaño
            $stats['total_size'] += $file['size'];

            // Fechas
            if (isset($file['date']) && !in_array($file['date'], $dates)) {
                $dates[] = $file['date'];
            }

            // Actividad por hora
            if ($file['timestamp']) {
                $hour = intval(explode(':', $file['timestamp'])[0]);
                $stats['activity_by_hour'][$hour]++;
            }

            // Timestamps para oldest/newest
            $timestamps[] = $file['modified'];
        }

        $stats['dates_with_content'] = $dates;

        if (!empty($timestamps)) {
            $stats['oldest_file'] = date('c', min($timestamps));
            $stats['newest_file'] = date('c', max($timestamps));
        }

        return $stats;
    }

    /**
     * Limpiar archivos temporales
     */
    public static function cleanup($maxAge = 86400) {
        $tempDir = sys_get_temp_dir();
        $patterns = ['fotos_*.zip', 'export_*.json'];

        foreach ($patterns as $pattern) {
            $files = glob($tempDir . '/' . $pattern);
            foreach ($files as $file) {
                if (is_file($file) && (time() - filemtime($file)) > $maxAge) {
                    unlink($file);
                }
            }
        }

        // Limpiar caché interno
        self::$cache = [];
    }

    /**
     * Formatear tamaño de archivo
     */
    public static function formatFileSize($bytes) {
        if ($bytes == 0) return '0 Bytes';

        $k = 1024;
        $sizes = ['Bytes', 'KB', 'MB', 'GB'];
        $i = floor(log($bytes) / log($k));

        return round($bytes / pow($k, $i), 2) . ' ' . $sizes[$i];
    }

    /**
     * Crear archivo ZIP
     */
    public static function createZip($files, $zipName) {
        $tempDir = sys_get_temp_dir();
        $zipPath = "$tempDir/$zipName.zip";

        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
            throw new Exception('No se pudo crear el archivo ZIP');
        }

        foreach ($files as $file) {
            if (isset($file['full_path']) && file_exists($file['full_path'])) {
                $archiveName = isset($file['archive_name']) ? $file['archive_name'] : $file['filename'];
                $zip->addFile($file['full_path'], $archiveName);
            }
        }

        $zip->close();
        return $zipPath;
    }

    /**
     * Obtener archivos aleatorios
     */
    public static function getRandomFiles($count = 1, $criteria = []) {
        $allFiles = self::searchFiles(null, $criteria);

        if (empty($allFiles)) {
            return [];
        }

        if ($count >= count($allFiles)) {
            return $allFiles;
        }

        $randomKeys = array_rand($allFiles, $count);

        if ($count === 1) {
            return [$allFiles[$randomKeys]];
        }

        $result = [];
        foreach ($randomKeys as $key) {
            $result[] = $allFiles[$key];
        }

        return $result;
    }

    /**
     * Obtener información de salud del sistema de archivos
     */
    public static function getHealthInfo() {
        $basePath = self::$config['base_path'];

        return [
            'base_path_exists' => is_dir($basePath),
            'base_path_writable' => is_writable($basePath),
            'disk_free_space' => disk_free_space($basePath),
            'disk_total_space' => disk_total_space($basePath),
            'permissions_config' => self::$config['permissions'],
            'cache_enabled' => self::$config['cache_enabled'],
            'temp_dir_writable' => is_writable(sys_get_temp_dir())
        ];
    }

    /**
     * Limpiar caché
     */
    public static function clearCache() {
        self::$cache = [];
    }

    /**
     * Obtener configuración actual
     */
    public static function getConfig() {
        return self::$config;
    }

    /**
     * Verificar integridad de archivos
     */
    public static function verifyIntegrity($basePath = null) {
        $basePath = $basePath ?: self::$config['base_path'];
        $report = [
            'total_checked' => 0,
            'valid_files' => 0,
            'invalid_files' => 0,
            'errors' => []
        ];

        $files = self::searchFiles($basePath);
        $report['total_checked'] = count($files);

        foreach ($files as $file) {
            $errors = self::validateFile($file['full_path']);

            if (empty($errors)) {
                $report['valid_files']++;
            } else {
                $report['invalid_files']++;
                $report['errors'][] = [
                    'file' => $file['filename'],
                    'path' => $file['path'],
                    'errors' => $errors
                ];
            }
        }

        return $report;
    }

    /**
     * Migrar estructura de archivos (si es necesario)
     */
    public static function migrateStructure($oldBasePath, $newBasePath = null) {
        $newBasePath = $newBasePath ?: self::$config['base_path'];
        $migrated = 0;
        $errors = [];

        if (!is_dir($oldBasePath)) {
            throw new Exception("Ruta origen no existe: $oldBasePath");
        }

        // Crear directorio destino si no existe
        if (!is_dir($newBasePath)) {
            mkdir($newBasePath, self::$config['permissions']['directories'], true);
            self::setupPermissions($newBasePath);
        }

        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($oldBasePath, RecursiveDirectoryIterator::SKIP_DOTS)
            );

            foreach ($iterator as $file) {
                if ($file->isFile() && self::isValidFilename($file->getFilename())) {
                    $relativePath = str_replace($oldBasePath . '/', '', $file->getPathname());
                    $newPath = $newBasePath . '/' . $relativePath;

                    // Crear directorio destino si no existe
                    $newDir = dirname($newPath);
                    if (!is_dir($newDir)) {
                        mkdir($newDir, self::$config['permissions']['directories'], true);
                        self::setupPermissions($newDir);
                    }

                    // Copiar archivo
                    if (copy($file->getPathname(), $newPath)) {
                        self::setupPermissions($newPath);
                        $migrated++;
                    } else {
                        $errors[] = "Error copiando: " . $file->getPathname();
                    }
                }
            }
        } catch (Exception $e) {
            $errors[] = "Error durante migración: " . $e->getMessage();
        }

        return [
            'migrated' => $migrated,
            'errors' => $errors
        ];
    }

    /**
     * Obtener resumen de actividad por períodos
     */
    public static function getActivitySummary($period = 'month', $limit = 12) {
        $files = self::searchFiles();
        $activity = [];

        foreach ($files as $file) {
            if (!isset($file['date'])) continue;

            $date = new DateTime($file['date']);

            switch ($period) {
                case 'day':
                    $key = $date->format('Y-m-d');
                    break;
                case 'week':
                    $key = $date->format('Y-W');
                    break;
                case 'month':
                    $key = $date->format('Y-m');
                    break;
                case 'year':
                    $key = $date->format('Y');
                    break;
                default:
                    $key = $date->format('Y-m-d');
            }

            if (!isset($activity[$key])) {
                $activity[$key] = [
                    'period' => $key,
                    'total_files' => 0,
                    'photos' => 0,
                    'videos' => 0,
                    'total_size' => 0
                ];
            }

            $activity[$key]['total_files']++;
            $activity[$key]['total_size'] += $file['size'];

            if ($file['type'] === 'photo') {
                $activity[$key]['photos']++;
            } else {
                $activity[$key]['videos']++;
            }
        }

        // Ordenar por período (más reciente primero)
        krsort($activity);

        // Aplicar límite
        return array_slice(array_values($activity), 0, $limit);
    }

    /**
     * Buscar duplicados (por tamaño y nombre similar)
     */
    public static function findDuplicates() {
        $files = self::searchFiles();
        $duplicates = [];
        $sizeGroups = [];

        // Agrupar por tamaño
        foreach ($files as $file) {
            $size = $file['size'];
            if (!isset($sizeGroups[$size])) {
                $sizeGroups[$size] = [];
            }
            $sizeGroups[$size][] = $file;
        }

        // Verificar grupos con más de un archivo
        foreach ($sizeGroups as $size => $group) {
            if (count($group) > 1) {
                $duplicates[] = [
                    'size' => $size,
                    'count' => count($group),
                    'files' => $group
                ];
            }
        }

        return $duplicates;
    }

    /**
     * Exportar metadatos como JSON
     */
    public static function exportMetadata($criteria = []) {
        $files = self::searchFiles(null, $criteria);
        $metadata = [
            'exported_at' => date('c'),
            'total_files' => count($files),
            'criteria' => $criteria,
            'files' => []
        ];

        foreach ($files as $file) {
            // Remover información sensible del path completo
            $cleanFile = $file;
            unset($cleanFile['full_path']);
            $metadata['files'][] = $cleanFile;
        }

        return $metadata;
    }

    /**
     * Obtener archivos por rango de fechas
     */
    public static function getFilesByDateRange($startDate, $endDate, $includeStats = false) {
        $criteria = [
            'start_date' => $startDate,
            'end_date' => $endDate
        ];

        $files = self::searchFiles(null, $criteria);

        if (!$includeStats) {
            return $files;
        }

        // Calcular estadísticas del rango
        $stats = [
            'total_files' => count($files),
            'photos' => count(array_filter($files, fn($f) => $f['type'] === 'photo')),
            'videos' => count(array_filter($files, fn($f) => $f['type'] === 'video')),
            'total_size' => array_sum(array_column($files, 'size')),
            'date_range' => ['start' => $startDate, 'end' => $endDate],
            'daily_breakdown' => []
        ];

        // Desglose diario
        $dailyBreakdown = [];
        foreach ($files as $file) {
            $date = $file['date'];
            if (!isset($dailyBreakdown[$date])) {
                $dailyBreakdown[$date] = ['count' => 0, 'size' => 0];
            }
            $dailyBreakdown[$date]['count']++;
            $dailyBreakdown[$date]['size'] += $file['size'];
        }

        $stats['daily_breakdown'] = $dailyBreakdown;

        return [
            'files' => $files,
            'stats' => $stats
        ];
    }

    /**
     * Monitorear cambios en directorio (para desarrollo)
     */
    public static function watchDirectory($callback = null, $interval = 5) {
        if (!function_exists('inotify_init')) {
            throw new Exception('inotify extension no disponible');
        }

        $basePath = self::$config['base_path'];
        $inotify = inotify_init();

        // Agregar watch para el directorio base
        $watch = inotify_add_watch($inotify, $basePath, IN_CREATE | IN_DELETE | IN_MODIFY);

        echo "Monitoreando cambios en: $basePath\n";
        echo "Presiona Ctrl+C para detener...\n";

        while (true) {
            $events = inotify_read($inotify);

            if ($events) {
                foreach ($events as $event) {
                    $eventType = '';
                    if ($event['mask'] & IN_CREATE) $eventType = 'CREATED';
                    if ($event['mask'] & IN_DELETE) $eventType = 'DELETED';
                    if ($event['mask'] & IN_MODIFY) $eventType = 'MODIFIED';

                    $message = "[$eventType] {$event['name']}";
                    echo date('Y-m-d H:i:s') . " - $message\n";

                    if ($callback && is_callable($callback)) {
                        $callback($event, $eventType);
                    }
                }
            }

            sleep($interval);
        }

        inotify_rm_watch($inotify, $watch);
        fclose($inotify);
    }
}

// Auto-configuración
if (!defined('FILE_MANAGER_CONFIGURED')) {
    FileManager::configure();
    define('FILE_MANAGER_CONFIGURED', true);
}

// Cleanup automático ocasional
if (rand(1, 200) === 1) {
    FileManager::cleanup();
}
?>
