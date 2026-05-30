import pandas as pd
import random
import os

# Directorios y rutas
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(BASE_DIR, "dataflix_sample.csv")

print("Generando dataset de prueba de 50,000 filas y 20 columnas...")

# Bancos de datos realistas
titulos_peliculas = [
    "El secreto de los datos", "Pandas salvajes", "La red de la IA", "Búsqueda Binaria", "Interstellar II",
    "La casa de código", "Juego de Servidores", "Stranger Code", "El despertar de la base de datos",
    "SQL: El Imperio Contraataca", "La terminal de los secretos", "FastAPI veloz", "Donut Chart Adventure",
    "El Heatmap del Destino", "Matrix Reloaded in Python", "Inception: Loop Infinito", "Django desencadenado",
    "El laberinto del silicio", "Los señores del algoritmo", "Parque de Servidores", "Crónicas de Git",
    "El Club de la Computación", "Pulp Python", "Forrest Git", "El Resplandor del Monitor",
    "El Padrino del código", "Gladiador del backend", "Titanic: Bug Hundido", "Avatar: Renderizado",
    "Batman: El programador de la noche", "La lista de bugs", "El rey algoritmo", "El precio del servidor",
    "El silencio de los compiladores", "La milla de código", "La vida en la nube", "Cazadores de código",
    "La teoría de las bases de datos", "Código de honor", "En busca del commit perdido"
]

tipos = ["Película", "Serie"]

generos_lista = [
    "Drama", "Acción", "Comedia", "Terror", "C.Ficción", "Romance", 
    "Aventura", "Crimen", "Fantasía", "Suspenso", "Documental"
]

plataformas_lista = ["Netflix", "HBO Max", "Disney+", "Prime Video", "Apple TV+"]
idiomas = ["Español", "Inglés", "Portugués", "Francés", "Alemán"]
paises = ["USA", "España", "México", "Reino Unido", "Francia", "Canadá", "Japón"]
directores = [
    "Christopher Nolan", "Quentin Tarantino", "Martin Scorsese", "Steven Spielberg", 
    "Guillermo del Toro", "James Cameron", "Denis Villeneuve", "Hayao Miyazaki"
]
clasificaciones = ["G", "PG", "PG-13", "R", "NC-17"]

actores = [
    "Leonardo DiCaprio", "Brad Pitt", "Scarlett Johansson", "Cillian Murphy", 
    "Morgan Freeman", "Robert Downey Jr.", "Meryl Streep", "Tom Hanks",
    "Natalie Portman", "Joaquin Phoenix", "Christian Bale", "Matthew McConaughey"
]

estudios = [
    "Warner Bros.", "Universal Pictures", "Paramount Pictures", "Columbia Pictures", 
    "Walt Disney Studios", "Marvel Studios", "A24", "Netflix Studio"
]

sinopsis_templates = [
    "Una emocionante aventura donde el destino de la humanidad pende de un hilo.",
    "Un drama conmovedor que explora los límites de la mente y la tecnología.",
    "Un oscuro thriller policial que te mantendrá al filo de tu asiento.",
    "Una comedia hilarante sobre las complejidades de la vida cotidiana.",
    "Un viaje fantástico a través de dimensiones inexploradas del universo.",
    "Un análisis profundo del impacto social e histórico de las grandes eras.",
    "Un misterio escalofriante que desvela secretos familiares ocultos."
]

rows = []

# Generar 50,000 registros
for i in range(1, 50001):
    tipo = random.choice(tipos)
    
    # Géneros: aleatorio entre 1 y 3 géneros
    num_gens = random.randint(1, 3)
    generos = ", ".join(random.sample(generos_lista, num_gens))
    
    # Plataformas: aleatorio entre 1 y 2 plataformas
    num_plats = random.randint(1, 2)
    plataformas = ", ".join(random.sample(plataformas_lista, num_plats))
    
    ano = random.randint(1970, 2026)
    
    # Rating: distribución realista con decimal
    rating = round(random.uniform(4.5, 9.8) if random.random() > 0.05 else random.uniform(1.0, 4.4), 1)
    
    # Duración: películas duran 80-210min, series duran 20-65min
    duracion = random.randint(80, 210) if tipo == "Película" else random.randint(20, 65)
    
    presupuesto = round(random.uniform(5.0, 250.0), 1)
    # ingresos (revenue)
    ingresos = round(presupuesto * random.uniform(0.3, 4.5), 1)
    # ganancias (net profit/loss)
    ganancias = round(ingresos - presupuesto, 1)
    
    votos = random.randint(500, 2500000)
    popularidad = round(random.uniform(10.0, 99.9), 1)
    
    titulo = f"{random.choice(titulos_peliculas)} ({ano})" if random.random() > 0.5 else f"{random.choice(titulos_peliculas)} Vol. {random.randint(1, 4)}"
    
    # Generar fecha de estreno aleatoria
    mes = str(random.randint(1, 12)).zfill(2)
    dia = str(random.randint(1, 28)).zfill(2)
    fecha_estreno = f"{ano}-{mes}-{dia}"
    
    rows.append({
        "id": i,
        "titulo": titulo,
        "tipo": tipo,
        "genero": generos,
        "ano": ano,
        "rating": rating,
        "duracion": duracion,
        "plataforma": plataformas,
        "idioma": random.choice(idiomas),
        "pais": random.choice(paises),
        "director": random.choice(directores),
        "clasificacion": random.choice(clasificaciones),
        "votos": votos,
        "presupuesto": presupuesto,
        "ingresos": ingresos,
        "ganancias": ganancias,
        "actor_principal": random.choice(actores),
        "estudio": random.choice(estudios),
        "fecha_estreno": fecha_estreno,
        "sinopsis": random.choice(sinopsis_templates)
    })

# Crear DataFrame y guardar como CSV
df = pd.DataFrame(rows)
df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8")

print(f"Dataset generado exitosamente en: {OUTPUT_PATH}")
print(f"Filas: {len(df)} (esperadas: 50000), Columnas: {len(df.columns)} (esperadas: 20)")
