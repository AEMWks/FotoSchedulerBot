# 📸 Documentación de APIs - Diario Visual

Esta documentación describe todas las APIs disponibles para la aplicación de diario fotográfico.

## 🌐 Configuración Base

- **URL Base**: `http://localhost:8090/api/`
- **Formato**: JSON
- **CORS**: Habilitado para todos los orígenes
- **Zona Horaria**: Europe/Madrid

## 📋 Índice de APIs

1. [📸 Photos API](#photos-api) - Obtener fotos por fecha
2. [🔍 Search API](#search-api) - Búsqueda y filtrado
3. [📊 Stats API](#stats-api) - Estadísticas y análisis
4. [📅 Dates API](#dates-api) - Fechas disponibles
5. [📥 Export API](#export-api) - Exportación de contenido
6. [🎲 Random API](#random-api) - Contenido aleatorio
7. [📅 Calendar API](#calendar-api) - Vista de calendario
8. [📰 Feed API](#feed-api) - Feed principal

---

## 📸 Photos API

Obtiene fotos y videos de una fecha específica.

### Endpoint
```
GET /api/photos/{year}/{month}/{day}
```

### Parámetros
- `year` (requerido): Año en formato YYYY
- `month` (requerido): Mes en formato MM
- `day` (requerido): Día en formato DD

### Ejemplo de Request
```bash
GET /api/photos/2024/01/15
```

### Ejemplo de Response
```json
[
  "10-30-45.jpg",
  "14-15-20.mp4",
  "18-30-00.jpg"
]
```

### Códigos de Estado
- `200`: Éxito (puede devolver array vacío si no hay fotos)
- `400`: Formato de fecha inválido
- `500`: Error interno del servidor

---

## 🔍 Search API

Búsqueda y filtrado avanzado de contenido multimedia.

### Endpoint
```
GET /api/search
```

### Parámetros Query
- `query` (opcional): Término de búsqueda
- `type` (opcional): `photo`, `video`, `all` (default: `all`)
- `date` (opcional): Fecha específica (YYYY-MM-DD)
- `start_date` (opcional): Fecha de inicio del rango
- `end_date` (opcional): Fecha de fin del rango
- `year` (opcional): Filtrar por año
- `month` (opcional): Filtrar por mes
- `day` (opcional): Filtrar por día
- `hour` (opcional): Filtrar por hora
- `min_size` (opcional): Tamaño mínimo en bytes
- `max_size` (opcional): Tamaño máximo en bytes
- `sort_by` (opcional): `date`, `size`, `filename`, `time` (default: `date`)
- `sort_order` (opcional): `asc`, `desc` (default: `desc`)
- `page` (opcional): Página para paginación (default: 1)
- `limit` (opcional): Elementos por página (default: 50, max: 100)

### Ejemplo de Request
```bash
GET /api/search?type=photo&start_date=2024-01-01&end_date=2024-01-31&sort_by=date&page=1&limit=10
```

### Ejemplo de Response
```json
{
  "results": [
    {
      "filename": "14-30-45.jpg",
      "date": "2024-01-15",
      "type": "photo",
      "timestamp": "14:30:45",
      "path": "/photos/2024/01/15/14-30-45.jpg",
      "size": 2048576,
      "hour": 14,
      "minute": 30
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 50,
    "items_per_page": 10
  },
  "summary": {
    "total_found": 50,
    "photos": 35,
    "videos": 15,
    "total_size": 104857600
  }
}
```

---

## 📊 Stats API

Obtiene estadísticas y análisis del contenido.

### Endpoint
```
GET /api/stats
```

### Parámetros Query
- `start_date` (opcional): Fecha de inicio para filtrar
- `end_date` (opcional): Fecha de fin para filtrar
- `type` (opcional): `all`, `photo`, `video` (default: `all`)

### Ejemplo de Request
```bash
GET /api/stats?start_date=2024-01-01&end_date=2024-01-31&type=all
```

### Ejemplo de Response
```json
{
  "total_files": 150,
  "total_photos": 120,
  "total_videos": 30,
  "total_size": 524288000,
  "total_size_mb": 500.0,
  "dates_with_content": ["2024-01-01", "2024-01-02"],
  "activity_by_date": [
    {"date": "2024-01-01", "count": 5},
    {"date": "2024-01-02", "count": 8}
  ],
  "activity_by_hour": [0, 0, 0, 2, 5, 8, 12, 15],
  "avg_photos_per_day": 5.2,
  "most_active_hour": 14,
  "charts": {
    "activity_timeline": [],
    "hourly_distribution": [],
    "weekly_distribution": []
  }
}
```

---

## 📅 Dates API

Obtiene lista de fechas con contenido disponible.

### Endpoint
```
GET /api/dates
```

### Parámetros Query
- `start_date` (opcional): Fecha de inicio del rango
- `end_date` (opcional): Fecha de fin del rango
- `limit` (opcional): Máximo número de fechas (default: 100)
- `format` (opcional): `simple`, `detailed` (default: `detailed`)

### Ejemplo de Request
```bash
GET /api/dates?format=detailed&limit=30
```

### Ejemplo de Response
```json
{
  "dates": [
    {
      "date": "2024-01-15",
      "year": 2024,
      "month": 1,
      "day": 15,
      "file_count": 8,
      "photos": 6,
      "videos": 2
    }
  ],
  "count": 25,
  "summary": {
    "total_files": 200,
    "total_photos": 150,
    "total_videos": 50,
    "date_range": {
      "earliest": "2024-01-01",
      "latest": "2024-01-31"
    }
  }
}
```

---

## 📥 Export API

Exporta contenido como ZIP o metadatos como JSON.

### Endpoint
```
GET /api/export
```

### Parámetros Query
- `type` (requerido): `day`, `week`, `month`, `range`, `all`
- `format` (opcional): `zip`, `json` (default: `zip`)
- `date` (requerido para `day`, `week`): Fecha en formato YYYY-MM-DD
- `month` (requerido para `month`): Mes en formato YYYY-MM
- `start_date` (requerido para `range`): Fecha de inicio
- `end_date` (requerido para `range`): Fecha de fin

### Ejemplos de Request
```bash
# Exportar día específico como ZIP
GET /api/export?type=day&date=2024-01-15&format=zip

# Exportar mes como JSON metadata
GET /api/export?type=month&month=2024-01&format=json

# Exportar rango como ZIP
GET /api/export?type=range&start_date=2024-01-01&end_date=2024-01-31&format=zip
```

### Response
- **ZIP**: Descarga directa del archivo ZIP
- **JSON**: Metadatos del contenido exportado

---

## 🎲 Random API

Obtiene contenido multimedia aleatorio.

### Endpoint
```
GET /api/random
```

### Parámetros Query
- `count` (opcional): Número de elementos (1-50, default: 1)
- `type` (opcional): `all`, `photo`, `video` (default: `all`)
- `start_date` (opcional): Fecha de inicio del rango
- `end_date` (opcional): Fecha de fin del rango
- `exclude_recent` (opcional): Excluir últimos N días
- `format` (opcional): `simple`, `detailed` (default: `detailed`)

### Ejemplo de Request
```bash
GET /api/random?count=3&type=photo&exclude_recent=7
```

### Ejemplo de Response
```json
{
  "random_files": [
    {
      "filename": "14-30-45.jpg",
      "type": "photo",
      "date": "2024-01-10",
      "timestamp": "14:30:45",
      "path": "/photos/2024/01/10/14-30-45.jpg",
      "date_formatted": "Miércoles, 10 de enero de 2024",
      "size_mb": 2.5,
      "age_days": 15,
      "time_of_day": "tarde"
    }
  ],
  "count": 3,
  "total_available": 150
}
```

---

## 📅 Calendar API

Obtiene datos para vista de calendario mensual.

### Endpoint
```
GET /api/calendar/{year}/{month}
```

### Parámetros
- `year` (opcional): Año (default: año actual)
- `month` (opcional): Mes (default: mes actual)

### Ejemplo de Request
```bash
GET /api/calendar/2024/01
```

### Ejemplo de Response
```json
{
  "month_info": {
    "year": 2024,
    "month": 1,
    "month_name_spanish": "Enero",
    "days_in_month": 31,
    "first_day_of_week": 1
  },
  "navigation": {
    "previous": {"year": 2023, "month": 12, "label": "December 2023"},
    "current": {"year": 2024, "month": 1, "label": "January 2024"},
    "next": {"year": 2024, "month": 2, "label": "February 2024"}
  },
  "calendar_data": [
    {
      "date": "2024-01-01",
      "day": 1,
      "has_content": true,
      "file_count": 5,
      "photos": 4,
      "videos": 1,
      "first_photo_time": "09:30",
      "last_photo_time": "18:45",
      "time_span_hours": 9.3,
      "files": [...]
    }
  ],
  "statistics": {
    "total_days": 31,
    "active_days": 15,
    "total_files": 120,
    "most_active_day": {"date": "2024-01-15", "count": 12},
    "most_productive_hours": [
      {"hour": "14:00", "count": 25}
    ]
  }
}
```

---

## 📰 Feed API

Feed principal con paginación para la interfaz web.

### Endpoint
```
GET /api/feed
```

### Parámetros Query
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (1-50, default: 10)
- `sort` (opcional): `asc`, `desc` (default: `desc`)
- `include_activity` (opcional): Incluir actividad reciente
- `activity_days` (opcional): Días de actividad a incluir (1-30, default: 7)

### Ejemplo de Request
```bash
GET /api/feed?page=1&limit=5&sort=desc&include_activity=true&activity_days=7
```

### Ejemplo de Response
```json
{
  "feed": [
    {
      "date": "2024-01-15",
      "date_formatted": "Lunes, 15 de enero de 2024",
      "day_of_week_spanish": "Lunes",
      "files": [
        {
          "filename": "09-30-45.jpg",
          "type": "photo",
          "timestamp": "09:30:45",
          "path": "/photos/2024/01/15/09-30-45.jpg",
          "size_mb": 2.1
        }
      ],
      "summary": {
        "total_files": 8,
        "photos": 6,
        "videos": 2,
        "total_size_mb": 15.7,
        "first_capture": "09:30:45",
        "last_capture": "19:15:30",
        "time_span": {
          "hours": 9,
          "minutes": 45,
          "total_minutes": 585
        }
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 10,
    "total_entries": 50,
    "has_next": true,
    "has_previous": false,
    "next_page": 2,
    "previous_page": null
  },
  "recent_activity": [
    {"date": "2024-01-15", "count": 8, "has_content": true},
    {"date": "2024-01-14", "count": 0, "has_content": false}
  ],
  "links": {
    "self": "/api/feed?page=1&limit=5",
    "next": "/api/feed?page=2&limit=5",
    "first": "/api/feed?page=1&limit=5",
    "last": "/api/feed?page=10&limit=5"
  }
}
```

---

## 🚨 Manejo de Errores

Todas las APIs devuelven errores en formato JSON consistente:

```json
{
  "error": true,
  "message": "Descripción del error",
  "code": 400,
  "timestamp": "2024-01-15T10:30:00+01:00",
  "details": {
    "field": "valor_problemático"
  }
}
```

### Códigos de Estado Comunes
- `200`: Éxito
- `400`: Solicitud inválida
- `404`: Recurso no encontrado
- `500`: Error interno del servidor

---

## 🔧 Consideraciones Técnicas

### Límites
- **Paginación**: Máximo 100 elementos por página
- **Búsqueda**: Máximo 1000 resultados
- **Exportación**: Máximo 10000 archivos o 500MB
- **Random**: Máximo 50 elementos aleatorios

### Optimización
- Las respuestas incluyen headers de cache apropiados
- Los archivos temporales se limpian automáticamente
- Logging configurable para debugging

### Seguridad
- CORS habilitado para desarrollo
- Validación de parámetros en todas las APIs
- Protección contra path traversal
- Límites de tamaño y tiempo de ejecución
