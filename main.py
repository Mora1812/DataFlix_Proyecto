from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import os
import shutil
import sqlite3
import pandas as pd
import numpy as np
import io
import json

app = FastAPI()

# =========================
# CONFIGURACIÓN DE DIRECTORIOS
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# STATIC FILES
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# =========================
# BASE DE DATOS (SQLITE3)
# =========================
DB_PATH = os.path.join(BASE_DIR, "dataflix.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Path global del dataset cargado
DEFAULT_DATASET = os.path.join(BASE_DIR, "dataflix_sample.csv")
CURRENT_DATASET_PATH = DEFAULT_DATASET if os.path.exists(DEFAULT_DATASET) else None

# =========================
# MODELOS DE DATOS
# =========================
class RegisterUser(BaseModel):
    name: str
    email: str
    password: str

class LoginUser(BaseModel):
    email: str
    password: str

# =========================
# RUTAS DE RENDEREADO HTML
# =========================
@app.get("/")
@app.get("/login")
def login_page():
    return FileResponse(os.path.join(FRONTEND_DIR, "login", "index.html"))

@app.get("/register")
def register_page():
    return FileResponse(os.path.join(FRONTEND_DIR, "register", "index.html"))

@app.get("/dashboard")
def dashboard_page():
    return FileResponse(os.path.join(FRONTEND_DIR, "dashboard", "index.html"))

# =========================
# APIS DE AUTENTICACIÓN
# =========================
@app.post("/api/register")
def register(user: RegisterUser):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Verificar si ya existe el correo
        cursor.execute("SELECT email FROM users WHERE email = ?", (user.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El correo ya está registrado")
        
        # Insertar nuevo usuario
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (user.name, user.email, user.password)
        )
        conn.commit()
        return {"message": "Usuario registrado correctamente"}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Error en la base de datos: {str(e)}")
    finally:
        conn.close()
        
# @app.get("/suma")
# def vista_suma():
#     return {
#         "mensaje": "Suma de valores",
#     }

# @app.get("/suma/{a}/{b}")
# def sumar(a: int, b: int):
#     resultado = a + b
#     return {
#         "a": a,
#         "b": b,
#         "resultado": resultado
#     }
    
@app.post("/api/login")
def login(user: LoginUser):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT name FROM users WHERE email = ? AND password = ?",
            (user.email, user.password)
        )
        row = cursor.fetchone()
        if row:
            return {"message": "Inicio de sesión exitoso", "user": row[0]}
        else:
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Error en la base de datos: {str(e)}")
    finally:
        conn.close()

# =========================
# APIS DE CARGA Y PANDAS
# =========================
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    global CURRENT_DATASET_PATH
    
    # Validar extensión
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(status_code=400, detail="Formato no soportado. Sube un CSV o Excel.")
    
    # Guardar archivo localmente
    filepath = os.path.join(UPLOAD_DIR, f"dataset{ext}")
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    CURRENT_DATASET_PATH = filepath
    file_size_mb = round(os.path.getsize(filepath) / (1024 * 1024), 2)
    
    try:
        # Leer con Pandas según la extensión
        if ext == ".csv":
            df = pd.read_csv(filepath)
        else:
            df = pd.read_excel(filepath)
            
        # Limpieza inicial básica de nombres de columnas
        df.columns = [c.strip().lower() for c in df.columns]
        
        # Calcular métricas básicas
        rows_count = len(df)
        cols_count = len(df.columns)
        nulls_count = int(df.isnull().sum().sum())
        
        # Obtener columnas y primeras 5 filas para la vista previa
        preview_cols = df.columns.tolist()
        # Rellenar nulos para evitar errores JSON
        df_preview = df.head(5).replace({np.nan: None})
        preview_data = df_preview.to_dict(orient="records")
        
        # Extraer plataformas y géneros únicos para los filtros de la interfaz
        filter_platforms = []
        if "plataforma" in df.columns:
            plat_set = set()
            for p in df["plataforma"].dropna():
                for item in str(p).split(","):
                    plat_set.add(item.strip())
            filter_platforms = sorted(list(plat_set))
            
        filter_genres = []
        if "genero" in df.columns:
            gen_set = set()
            for g in df["genero"].dropna():
                for item in str(g).split(","):
                    gen_set.add(item.strip())
            filter_genres = sorted(list(gen_set))
            
        return {
            "message": "Archivo cargado correctamente",
            "rows": rows_count,
            "cols": cols_count,
            "nulls": nulls_count,
            "size_mb": file_size_mb,
            "preview_cols": preview_cols,
            "preview_data": preview_data,
            "filter_platforms": filter_platforms,
            "filter_genres": filter_genres
        }
    except Exception as e:
        # Eliminar el archivo corrupto
        if os.path.exists(filepath):
            os.remove(filepath)
        CURRENT_DATASET_PATH = None
        raise HTTPException(status_code=500, detail=f"Error al leer el archivo con Pandas: {str(e)}")

@app.get("/api/dataset-info")
def get_dataset_info():
    global CURRENT_DATASET_PATH
    if not CURRENT_DATASET_PATH or not os.path.exists(CURRENT_DATASET_PATH):
        return {"loaded": False}
        
    ext = os.path.splitext(CURRENT_DATASET_PATH)[1].lower()
    try:
        if ext == ".csv":
            df = pd.read_csv(CURRENT_DATASET_PATH)
        else:
            df = pd.read_excel(CURRENT_DATASET_PATH)
            
        df.columns = [c.strip().lower() for c in df.columns]
        file_size_mb = round(os.path.getsize(CURRENT_DATASET_PATH) / (1024 * 1024), 2)
        
        filter_platforms = []
        if "plataforma" in df.columns:
            plat_set = set()
            for p in df["plataforma"].dropna():
                for item in str(p).split(","):
                    plat_set.add(item.strip())
            filter_platforms = sorted(list(plat_set))
            
        filter_genres = []
        if "genero" in df.columns:
            gen_set = set()
            for g in df["genero"].dropna():
                for item in str(g).split(","):
                    gen_set.add(item.strip())
            filter_genres = sorted(list(gen_set))
            
        preview_cols = df.columns.tolist()
        df_preview = df.head(5).replace({np.nan: None})
        preview_data = df_preview.to_dict(orient="records")
            
        return {
            "loaded": True,
            "filename": os.path.basename(CURRENT_DATASET_PATH),
            "rows": len(df),
            "cols": len(df.columns),
            "nulls": int(df.isnull().sum().sum()),
            "size_mb": file_size_mb,
            "preview_cols": preview_cols,
            "preview_data": preview_data,
            "filter_platforms": filter_platforms,
            "filter_genres": filter_genres
        }
    except Exception as e:
        return {"loaded": False, "error": str(e)}

@app.get("/api/dashboard-stats")
def get_dashboard_stats(
    platform: str = Query("Todos"),
    genre: str = Query("Todos")
):
    global CURRENT_DATASET_PATH
    if not CURRENT_DATASET_PATH or not os.path.exists(CURRENT_DATASET_PATH):
        raise HTTPException(status_code=400, detail="No se ha cargado ningún dataset en el servidor.")
        
    ext = os.path.splitext(CURRENT_DATASET_PATH)[1].lower()
    
    try:
        # Leer archivo
        if ext == ".csv":
            df = pd.read_csv(CURRENT_DATASET_PATH)
        else:
            df = pd.read_excel(CURRENT_DATASET_PATH)
            
        # Estandarizar columnas a minúsculas
        df.columns = [c.strip().lower() for c in df.columns]
        
        # 1. APLICAR FILTROS DINÁMICOS
        if platform != "Todos" and "plataforma" in df.columns:
            df = df[df["plataforma"].astype(str).str.contains(platform, case=False, na=False)]
            
        if genre != "Todos" and "genero" in df.columns:
            df = df[df["genero"].astype(str).str.contains(genre, case=False, na=False)]
            
        # Si el dataset queda vacío después del filtro
        if len(df) == 0:
            return {
                "metrics": {"total": 0, "avg_rating": 0, "top_genre": "-", "top_platform": "-", "top_year": "-", "avg_duration": 0, "nulls": 0, "cols": len(df.columns)},
                "genre_counts": {"labels": [], "values": []},
                "platform_counts": {"labels": [], "values": []},
                "year_counts": {"labels": [], "values": []},
                "scatter_data": [],
                "top10": [],
                "heatmap": {}
            }

        # 2. CALCULAR MÉTRICAS ESTADÍSTICAS PRINCIPALES
        total_count = len(df)
        avg_rating = float(df["rating"].mean()) if "rating" in df.columns else 0.0
        median_rating = float(df["rating"].median()) if "rating" in df.columns else 0.0
        std_rating = float(df["rating"].std()) if "rating" in df.columns else 0.0
        max_rating = float(df["rating"].max()) if "rating" in df.columns else 0.0
        min_rating = float(df["rating"].min()) if "rating" in df.columns else 0.0
        
        avg_duration = float(df["duracion"].mean()) if "duracion" in df.columns else 0.0
        max_duration = float(df["duracion"].max()) if "duracion" in df.columns else 0.0
        min_duration = float(df["duracion"].min()) if "duracion" in df.columns else 0.0
        
        nulls_count = int(df.isnull().sum().sum())
        memory_usage_mb = float(df.memory_usage(deep=True).sum() / (1024 * 1024))
        
        # Encontrar género más común
        top_genre = "-"
        if "genero" in df.columns:
            genre_series = df["genero"].dropna().str.split(",").explode().str.strip()
            if not genre_series.empty:
                top_genre = str(genre_series.mode()[0])
                
        # Encontrar plataforma más común
        top_platform = "-"
        if "plataforma" in df.columns:
            plat_series = df["plataforma"].dropna().str.split(",").explode().str.strip()
            if not plat_series.empty:
                top_platform = str(plat_series.mode()[0])
                
        # Año con más estrenos
        top_year = "-"
        if "ano" in df.columns:
            year_series = df["ano"].dropna()
            if not year_series.empty:
                top_year = str(int(year_series.mode()[0]))
                
        metrics = {
            "total": total_count,
            "avg_rating": 0.0 if np.isnan(avg_rating) else avg_rating,
            "median_rating": 0.0 if np.isnan(median_rating) else median_rating,
            "std_rating": 0.0 if np.isnan(std_rating) else std_rating,
            "max_rating": max_rating,
            "min_rating": min_rating,
            "avg_duration": 0.0 if np.isnan(avg_duration) else avg_duration,
            "max_duration": max_duration,
            "min_duration": min_duration,
            "top_genre": top_genre,
            "top_platform": top_platform,
            "top_year": top_year,
            "nulls": nulls_count,
            "cols": len(df.columns),
            "memory_mb": memory_usage_mb
        }

        # 3. AGREGACIONES PARA GRÁFICOS
        
        # A. Gráfico de barras: Cantidad por género (Top 8)
        genre_labels, genre_values = [], []
        if "genero" in df.columns:
            g_counts = df["genero"].dropna().str.split(",").explode().str.strip().value_counts()
            top_g = g_counts.head(8)
            genre_labels = top_g.index.tolist()
            genre_values = top_g.values.tolist()
            
        # B. Gráfico de dona: Distribución por plataforma
        platform_labels, platform_values = [], []
        if "plataforma" in df.columns:
            p_counts = df["plataforma"].dropna().str.split(",").explode().str.strip().value_counts()
            top_p = p_counts.head(6)
            platform_labels = top_p.index.tolist()
            platform_values = top_p.values.tolist()
            
        # C. Gráfico de línea: Estrenos por año
        year_labels, year_values = [], []
        if "ano" in df.columns:
            # Agrupar por año y ordenar cronológicamente
            y_counts = df["ano"].dropna().astype(int).value_counts().sort_index()
            # Si hay muchos años, limitamos el rango de los últimos 20 años para legibilidad
            if len(y_counts) > 20:
                y_counts = y_counts.tail(20)
            year_labels = [str(y) for y in y_counts.index.tolist()]
            year_values = y_counts.values.tolist()
            
        # D. Scatter Plot: Presupuesto vs Ganancias (Muestreo de 100 puntos para optimizar rendimiento)
        scatter_points = []
        if "presupuesto" in df.columns and "ganancias" in df.columns:
            df_scatter = df[["presupuesto", "ganancias"]].dropna()
            # Muestrear si hay muchos registros para no saturar Chart.js
            if len(df_scatter) > 120:
                df_scatter = df_scatter.sample(n=100, random_state=42)
            for _, r in df_scatter.iterrows():
                scatter_points.append({
                    "x": float(r["presupuesto"]),
                    "y": float(r["ganancias"])
                })
                
        # E. Tabla Top 10 películas/series por rating
        top10_list = []
        if "titulo" in df.columns and "rating" in df.columns:
            df_top = df.sort_values(by="rating", ascending=False).head(10)
            df_top = df_top.replace({np.nan: None})
            for _, r in df_top.iterrows():
                top10_list.append({
                    "titulo": str(r["titulo"]),
                    "tipo": str(r["tipo"]) if "tipo" in df.columns else "Película",
                    "ano": int(r["ano"]) if "ano" in df.columns and r["ano"] is not None else 0,
                    "rating": float(r["rating"]),
                    "votos": int(r["votos"]) if "votos" in df.columns and r["votos"] is not None else 0
                })
                
        # F. Mapa de calor: Género vs Distribución de Ratings
        # Agrupamos por género y distribuimos la cantidad en rangos de ratings: <5, 5-6, 6-7, 7-8, 8-9, >9
        heatmap_data = {}
        if "genero" in df.columns and "rating" in df.columns:
            df_heat = df[["genero", "rating"]].dropna()
            df_heat["genero"] = df_heat["genero"].str.split(",").str[0].str.strip() # Tomamos el género principal
            
            # Crear bins
            bins = [0, 5, 6, 7, 8, 9, 10]
            labels = ['<5', '5-6', '6-7', '7-8', '8-9', '>9']
            df_heat["rating_bin"] = pd.cut(df_heat["rating"], bins=bins, labels=labels, right=False)
            
            # Limitar a los 6 géneros principales para el mapa de calor
            top_genres_heat = df_heat["genero"].value_counts().head(6).index.tolist()
            df_heat = df_heat[df_heat["genero"].isin(top_genres_heat)]
            
            # Agrupar y pivotar
            crosstab = pd.crosstab(df_heat["genero"], df_heat["rating_bin"])
            
            for gen in top_genres_heat:
                heatmap_data[gen] = {}
                for l in labels:
                    heatmap_data[gen][l] = int(crosstab.loc[gen, l]) if gen in crosstab.index and l in crosstab.columns else 0

        return {
            "metrics": metrics,
            "genre_counts": {"labels": genre_labels, "values": genre_values},
            "platform_counts": {"labels": platform_labels, "values": platform_values},
            "year_counts": {"labels": year_labels, "values": year_values},
            "scatter_data": scatter_points,
            "top10": top10_list,
            "heatmap": heatmap_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al calcular estadísticas con Pandas: {str(e)}")


# =========================
# API: CATÁLOGO (PELÍCULAS / SERIES)
# =========================
@app.get("/api/catalog")
def get_catalog(
    tipo: str = Query("all"),       # "Movie", "TV Show", o "all"
    search: str = Query(""),
    genre: str = Query("Todos"),
    platform: str = Query("Todos"),
    page: int = Query(1),
    per_page: int = Query(20)
):
    global CURRENT_DATASET_PATH
    if not CURRENT_DATASET_PATH or not os.path.exists(CURRENT_DATASET_PATH):
        raise HTTPException(status_code=400, detail="No hay dataset cargado.")

    ext = os.path.splitext(CURRENT_DATASET_PATH)[1].lower()
    try:
        df = pd.read_csv(CURRENT_DATASET_PATH) if ext == ".csv" else pd.read_excel(CURRENT_DATASET_PATH)
        df.columns = [c.strip().lower() for c in df.columns]

        # Filtrar por tipo si la columna existe
        if tipo != "all" and "tipo" in df.columns:
            df = df[df["tipo"].astype(str).str.contains(tipo, case=False, na=False)]

        # Filtrar por búsqueda en título
        if search and "titulo" in df.columns:
            df = df[df["titulo"].astype(str).str.contains(search, case=False, na=False)]

        # Filtrar por género
        if genre != "Todos" and "genero" in df.columns:
            df = df[df["genero"].astype(str).str.contains(genre, case=False, na=False)]

        # Filtrar por plataforma
        if platform != "Todos" and "plataforma" in df.columns:
            df = df[df["plataforma"].astype(str).str.contains(platform, case=False, na=False)]

        # Ordenar por rating si existe
        if "rating" in df.columns:
            df = df.sort_values(by="rating", ascending=False)

        total_count = len(df)
        total_pages = max(1, (total_count + per_page - 1) // per_page)
        page = max(1, min(page, total_pages))
        offset = (page - 1) * per_page
        df_page = df.iloc[offset:offset + per_page].replace({np.nan: None})

        # Columnas relevantes para la tabla de catálogo
        cols_wanted = ["titulo", "tipo", "genero", "ano", "rating", "duracion", "plataforma", "votos", "pais"]
        cols_available = [c for c in cols_wanted if c in df_page.columns]
        records = df_page[cols_available].to_dict(orient="records")

        return {
            "total": total_count,
            "page": page,
            "total_pages": total_pages,
            "per_page": per_page,
            "records": records,
            "columns": cols_available
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en catálogo: {str(e)}")


# =========================
# API: EXPLORAR DATOS (TABLA COMPLETA)
# =========================
@app.get("/api/explore")
def explore_data(
    search: str = Query(""),
    page: int = Query(1),
    per_page: int = Query(25)
):
    global CURRENT_DATASET_PATH
    if not CURRENT_DATASET_PATH or not os.path.exists(CURRENT_DATASET_PATH):
        raise HTTPException(status_code=400, detail="No hay dataset cargado.")

    ext = os.path.splitext(CURRENT_DATASET_PATH)[1].lower()
    try:
        df = pd.read_csv(CURRENT_DATASET_PATH) if ext == ".csv" else pd.read_excel(CURRENT_DATASET_PATH)
        df.columns = [c.strip().lower() for c in df.columns]

        # Búsqueda en columna título
        if search and "titulo" in df.columns:
            df = df[df["titulo"].astype(str).str.contains(search, case=False, na=False)]

        total_count = len(df)
        total_pages = max(1, (total_count + per_page - 1) // per_page)
        page = max(1, min(page, total_pages))
        offset = (page - 1) * per_page
        df_page = df.iloc[offset:offset + per_page].replace({np.nan: None})

        all_cols = df_page.columns.tolist()
        records = df_page.to_dict(orient="records")

        return {
            "total": total_count,
            "page": page,
            "total_pages": total_pages,
            "per_page": per_page,
            "columns": all_cols,
            "records": records
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error explorando datos: {str(e)}")


# =========================
# API: EXPORTAR DATOS
# =========================
@app.get("/api/export")
def export_data(
    format: str = Query("csv"),   # "csv" o "json"
    tipo: str = Query("all"),
    genre: str = Query("Todos"),
    platform: str = Query("Todos")
):
    global CURRENT_DATASET_PATH
    if not CURRENT_DATASET_PATH or not os.path.exists(CURRENT_DATASET_PATH):
        raise HTTPException(status_code=400, detail="No hay dataset cargado.")

    ext = os.path.splitext(CURRENT_DATASET_PATH)[1].lower()
    try:
        df = pd.read_csv(CURRENT_DATASET_PATH) if ext == ".csv" else pd.read_excel(CURRENT_DATASET_PATH)
        df.columns = [c.strip().lower() for c in df.columns]

        if tipo != "all" and "tipo" in df.columns:
            df = df[df["tipo"].astype(str).str.contains(tipo, case=False, na=False)]
        if genre != "Todos" and "genero" in df.columns:
            df = df[df["genero"].astype(str).str.contains(genre, case=False, na=False)]
        if platform != "Todos" and "plataforma" in df.columns:
            df = df[df["plataforma"].astype(str).str.contains(platform, case=False, na=False)]

        if format == "json":
            df_clean = df.replace({np.nan: None})
            content = json.dumps(df_clean.to_dict(orient="records"), ensure_ascii=False, indent=2)
            return StreamingResponse(
                io.StringIO(content),
                media_type="application/json",
                headers={"Content-Disposition": "attachment; filename=dataflix_export.json"}
            )
        else:
            output = io.StringIO()
            df.to_csv(output, index=False, encoding="utf-8-sig")
            output.seek(0)
            return StreamingResponse(
                output,
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=dataflix_export.csv"}
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exportando: {str(e)}")