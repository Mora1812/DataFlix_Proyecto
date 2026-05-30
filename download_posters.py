# import os
# import urllib.request

# img_dir = os.path.join("frontend", "img")
# os.makedirs(img_dir, exist_ok=True)

# posters = {
#     "interstellar.jpg": "https://image.tmdb.org/t/p/w300/gEU2QvE47gZO2KGwOY31wEB5stG.jpg",
#     "lacasa.jpg": "https://image.tmdb.org/t/p/w300/reKs8tU314e7aavt20TC4HTdB6z.jpg",
#     "gameofthrones.jpg": "https://image.tmdb.org/t/p/w300/1XS1oq12LLjDFkpq42rvzsS68UC.jpg",
#     "strangerthings.jpg": "https://image.tmdb.org/t/p/w300/49W7xyvNgImJRLl569tM6Brptsz.jpg",
#     "joker.jpg": "https://image.tmdb.org/t/p/w300/udDclsv60r16w4gzND0mFoZsZKO.jpg"
# }

# print("Iniciando descarga de posters...")
# for name, url in posters.items():
#     path = os.path.join(img_dir, name)
#     try:
#         print(f"Descargando {name} desde {url}...")
#         urllib.request.urlretrieve(url, path)
#         print(f"Descargado con éxito: {path}")
#     except Exception as e:
#         print(f"Error al descargar {name}: {e}")

# print("Proceso completado.")
