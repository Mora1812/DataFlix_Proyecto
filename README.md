# DataFlix

Plataforma web para análisis y visualización de datasets de películas y series, construida con FastAPI y Python.

## Tecnologías

- **Backend:** FastAPI, Python 3.x, SQLite, Pandas, NumPy
- **Frontend:** HTML, CSS, JavaScript, Chart.js
- **Base de datos:** SQLite (usuarios), CSV / Excel (datasets)

## Funcionalidades

- Registro e inicio de sesión de usuarios
- Carga de archivos CSV o Excel con datos de películas/series
- Dashboard con gráficos interactivos (géneros, plataformas, años, ratings)
- Filtros dinámicos por plataforma y género
- Tabla Top 10 por rating
- Catálogo y explorador de datos paginado
- Exportación de datos en CSV o JSON

## Estructura del proyecto

```
DataFlix_Login/
├── main.py                  # API principal con FastAPI
├── dataflix_sample.csv      # Dataset de ejemplo
├── frontend/
│   ├── login/               # Vista de inicio de sesión
│   ├── register/            # Vista de registro
│   └── dashboard/           # Dashboard principal
└── venv/                    # Entorno virtual (no incluido en el repo)
```

## Instalación y ejecución

```bash
# 1. Activar el entorno virtual
venv\Scripts\activate

# 2. Instalar dependencias
pip install fastapi uvicorn pandas numpy openpyxl

# 3. Ejecutar el servidor
python -m uvicorn main:app --reload
```

Luego abrir el navegador en: [http://127.0.0.1:8000](http://127.0.0.1:8000)

## Arquitectura

El proyecto usa una **Arquitectura N-Tier (por capas)**:

| Capa | Tecnología |
|------|-----------|
| Presentación | HTML + CSS + JavaScript |
| Aplicación | FastAPI (rutas y endpoints) |
| Lógica de negocio | Pandas + NumPy |
| Datos | SQLite + CSV/Excel |
