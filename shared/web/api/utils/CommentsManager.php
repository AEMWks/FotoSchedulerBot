<?php
// shared/web/api/utils/CommentsManager.php - Gestión de comentarios por día

/**
 * Clase para gestionar comentarios de días en el diario visual
 */
class CommentsManager {

    private $config;
    private $commentsPath;

    public function __construct($config = []) {
        $this->config = array_merge([
            'base_path' => $_ENV['PHOTOS_PATH'] ?? '/data/fotos',
            'timezone' => $_ENV['TZ'] ?? 'Europe/Madrid',
            'permissions' => [
                'files' => 0664,
                'directories' => 0775,
                'owner' => 33,
                'group' => 33
            ]
        ], $config);

        $this->commentsPath = $this->config['base_path'] . '/comments';

        // Configurar zona horaria
        date_default_timezone_set($this->config['timezone']);

        // Asegurar que el directorio de comentarios existe
        $this->ensureCommentsDirectory();
    }

    /**
     * Obtener comentario para una fecha específica
     */
    public function getComment($date) {
        try {
            if (!$this->validateDate($date)) {
                throw new InvalidArgumentException('Formato de fecha inválido');
            }

            $filePath = $this->getCommentFilePath($date);

            if (!file_exists($filePath)) {
                return null;
            }

            $content = file_get_contents($filePath);
            if ($content === false) {
                throw new RuntimeException("Error leyendo archivo de comentario para $date");
            }

            $data = json_decode($content, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                error_log("Error decodificando JSON para comentario $date: " . json_last_error_msg());
                return null;
            }

            return $data;

        } catch (Exception $e) {
            error_log("Error obteniendo comentario para $date: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Guardar o actualizar comentario para una fecha
     */
    public function saveComment($date, $comment) {
        try {
            if (!$this->validateDate($date)) {
                throw new InvalidArgumentException('Formato de fecha inválido');
            }

            if (empty(trim($comment))) {
                throw new InvalidArgumentException('El comentario no puede estar vacío');
            }

            // Limpiar y validar comentario
            $comment = $this->sanitizeComment($comment);

            $filePath = $this->getCommentFilePath($date);
            $now = date('c'); // ISO 8601

            // Verificar si existe comentario previo
            $existingComment = null;
            if (file_exists($filePath)) {
                $existingComment = $this->getComment($date);
            }

            $commentData = [
                'date' => $date,
                'comment' => $comment,
                'created_at' => $existingComment['created_at'] ?? $now,
                'updated_at' => $now,
                'version' => 1
            ];

            $jsonContent = json_encode($commentData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if ($jsonContent === false) {
                throw new RuntimeException('Error codificando datos a JSON');
            }

            // Escribir archivo de forma atómica
            $tempFile = $filePath . '.tmp';
            if (file_put_contents($tempFile, $jsonContent, LOCK_EX) === false) {
                throw new RuntimeException("Error escribiendo archivo temporal para $date");
            }

            // Configurar permisos del archivo temporal
            $this->setupFilePermissions($tempFile);

            // Mover archivo temporal al final
            if (!rename($tempFile, $filePath)) {
                unlink($tempFile);
                throw new RuntimeException("Error moviendo archivo temporal para $date");
            }

            error_log("Comentario guardado exitosamente para $date");
            return $commentData;

        } catch (Exception $e) {
            error_log("Error guardando comentario para $date: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Eliminar comentario de una fecha
     */
    public function deleteComment($date) {
        try {
            if (!$this->validateDate($date)) {
                throw new InvalidArgumentException('Formato de fecha inválido');
            }

            $filePath = $this->getCommentFilePath($date);

            if (!file_exists($filePath)) {
                return false; // No existe, no hay nada que eliminar
            }

            if (!unlink($filePath)) {
                throw new RuntimeException("Error eliminando archivo de comentario para $date");
            }

            error_log("Comentario eliminado exitosamente para $date");
            return true;

        } catch (Exception $e) {
            error_log("Error eliminando comentario para $date: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Obtener todos los comentarios en un rango de fechas
     */
    public function getCommentsInRange($startDate, $endDate) {
        try {
            if (!$this->validateDate($startDate) || !$this->validateDate($endDate)) {
                throw new InvalidArgumentException('Formato de fecha inválido');
            }

            if ($startDate > $endDate) {
                throw new InvalidArgumentException('La fecha de inicio debe ser anterior a la fecha de fin');
            }

            $comments = [];
            $currentDate = new DateTime($startDate);
            $endDateTime = new DateTime($endDate);

            while ($currentDate <= $endDateTime) {
                $dateStr = $currentDate->format('Y-m-d');
                $comment = $this->getComment($dateStr);

                if ($comment !== null) {
                    $comments[$dateStr] = $comment;
                }

                $currentDate->add(new DateInterval('P1D'));
            }

            return $comments;

        } catch (Exception $e) {
            error_log("Error obteniendo comentarios en rango $startDate - $endDate: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Obtener estadísticas de comentarios
     */
    public function getCommentsStats() {
        try {
            $stats = [
                'total_comments' => 0,
                'total_characters' => 0,
                'avg_length' => 0,
                'first_comment_date' => null,
                'last_comment_date' => null,
                'most_recent_update' => null
            ];

            if (!is_dir($this->commentsPath)) {
                return $stats;
            }

            $files = glob($this->commentsPath . '/*.json');
            $stats['total_comments'] = count($files);

            if ($stats['total_comments'] === 0) {
                return $stats;
            }

            $totalChars = 0;
            $dates = [];
            $lastUpdate = null;

            foreach ($files as $file) {
                $basename = basename($file, '.json');
                if ($this->validateDate($basename)) {
                    $dates[] = $basename;

                    $comment = $this->getComment($basename);
                    if ($comment) {
                        $totalChars += strlen($comment['comment']);

                        $updateTime = strtotime($comment['updated_at']);
                        if ($lastUpdate === null || $updateTime > $lastUpdate) {
                            $lastUpdate = $updateTime;
                        }
                    }
                }
            }

            if (!empty($dates)) {
                sort($dates);
                $stats['first_comment_date'] = $dates[0];
                $stats['last_comment_date'] = $dates[count($dates) - 1];
            }

            $stats['total_characters'] = $totalChars;
            $stats['avg_length'] = $stats['total_comments'] > 0 ? round($totalChars / $stats['total_comments'], 1) : 0;
            $stats['most_recent_update'] = $lastUpdate ? date('c', $lastUpdate) : null;

            return $stats;

        } catch (Exception $e) {
            error_log("Error obteniendo estadísticas de comentarios: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Validar formato de fecha (YYYY-MM-DD)
     */
    private function validateDate($date) {
        if (!is_string($date)) {
            return false;
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return false;
        }

        $dateParts = explode('-', $date);
        return checkdate($dateParts[1], $dateParts[2], $dateParts[0]);
    }

    /**
     * Limpiar y sanitizar comentario
     */
    private function sanitizeComment($comment) {
        // Limpiar espacios
        $comment = trim($comment);

        // Eliminar caracteres de control excepto saltos de línea y tabs
        $comment = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $comment);

        // Limitar longitud
        if (strlen($comment) > 5000) {
            $comment = substr($comment, 0, 5000);
        }

        return $comment;
    }

    /**
     * Obtener ruta del archivo de comentario para una fecha
     */
    private function getCommentFilePath($date) {
        return $this->commentsPath . '/' . $date . '.json';
    }

    /**
     * Asegurar que el directorio de comentarios existe
     */
    private function ensureCommentsDirectory() {
        if (!is_dir($this->commentsPath)) {
            if (!mkdir($this->commentsPath, $this->config['permissions']['directories'], true)) {
                throw new RuntimeException("No se pudo crear directorio de comentarios: {$this->commentsPath}");
            }
            $this->setupFilePermissions($this->commentsPath);
        }
    }

    /**
     * Configurar permisos de archivo/directorio
     */
    private function setupFilePermissions($path) {
        if (!file_exists($path)) {
            return false;
        }

        try {
            $config = $this->config['permissions'];

            // Cambiar ownership si es posible
            @chown($path, $config['owner']);
            @chgrp($path, $config['group']);

            // Configurar permisos
            if (is_dir($path)) {
                chmod($path, $config['directories']);
            } else {
                chmod($path, $config['files']);
            }

            return true;
        } catch (Exception $e) {
            error_log("Error configurando permisos para $path: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Verificar salud del sistema de comentarios
     */
    public function healthCheck() {
        $health = [
            'status' => 'healthy',
            'checks' => [
                'comments_directory_exists' => is_dir($this->commentsPath),
                'comments_directory_writable' => is_writable($this->commentsPath),
                'base_path_readable' => is_readable($this->config['base_path'])
            ],
            'stats' => null,
            'timestamp' => date('c')
        ];

        try {
            $health['stats'] = $this->getCommentsStats();
        } catch (Exception $e) {
            $health['checks']['stats_accessible'] = false;
            $health['status'] = 'degraded';
        }

        // Determinar estado general
        $allHealthy = array_reduce($health['checks'], function($carry, $check) {
            return $carry && $check;
        }, true);

        if (!$allHealthy) {
            $health['status'] = 'unhealthy';
        }

        return $health;
    }
}
