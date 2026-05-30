// Cache de gráficos globales para destruirlos antes de volver a pintarlos
let charts = {
    genre: null,
    platform: null,
    year: null,
    scatter: null
};

// Variable para rastrear el archivo actual y evitar recargas
let isDataLoaded = false;

// ======================
// NAV Y CONTROL DE VISTAS (SPA)
// ======================
document.addEventListener("DOMContentLoaded", () => {
    // Nombre del usuario desde localStorage
    const savedUser = localStorage.getItem("userEmail");
    if (savedUser) {
        // Mostrar nombre legible basado en el email
        const namePart = savedUser.split("@")[0];
        document.getElementById("headerUserName").innerText = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }

    // Configurar menú de navegación
    const menuItems = document.querySelectorAll(".menu-item[data-section]");
    menuItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute("data-section");
            switchSection(sectionId);
        });
    });

    // Configuración del Drag & Drop
    setupDragAndDrop();
    
    // Configuración del input de archivo directo
    const fileInput = document.getElementById("fileInput");
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Comprobar si ya existe un dataset cargado por defecto en el servidor
    checkExistingDataset();
});

async function checkExistingDataset() {
    try {
        const response = await fetch("/api/dataset-info");
        const data = await response.json();
        
        if (response.ok && data.loaded) {
            isDataLoaded = true;
            
            // Mostrar resumen del dataset en las tarjetas de metadatos
            document.getElementById("metaRows").innerText = Number(data.rows).toLocaleString("es-ES");
            document.getElementById("metaCols").innerText = data.cols;
            document.getElementById("metaNulls").innerText = Number(data.nulls).toLocaleString("es-ES");
            document.getElementById("metaSize").innerText = data.size_mb + " MB";

            // Llenar vista previa de la tabla en la sección de carga
            renderPreviewTable(data.preview_cols, data.preview_data);
            
            // Mostrar contenedor de previsualización
            document.getElementById("previewContainer").classList.remove("hidden");

            // Llenar filtros del Dashboard (también sincroniza los de catálogo)
            populateFilters(data.filter_platforms, data.filter_genres);

            // Pre-cargar peliculas, series y explorador en segundo plano
            preloadAllSections();

            // Cargar datos en el Dashboard e ir directamente allí
            switchSection("dashboard");
        } else {
            // Si no hay datos por defecto, ir a la vista de carga de archivos
            switchSection("cargar");
        }
    } catch (error) {
        console.error("Error al comprobar dataset por defecto:", error);
        switchSection("cargar");
    }
}

// Pre-carga silenciosa de todas las secciones con tablas
function preloadAllSections() {
    loadCatalog('movie', 1);
    loadCatalog('series', 1);
    loadExplore(1);
}

// Nota: switchSection está definida al final del archivo con todas las secciones



// Cierre de sesión simple
function logout() {
    localStorage.removeItem("userEmail");
    window.location.href = "/";
}

// ======================
// DRAG AND DROP
// ======================
function setupDragAndDrop() {
    const dropzone = document.getElementById("dropzone");

    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
        }, false);
    });

    dropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    // Permitir clic en el dropzone para abrir selector
    dropzone.addEventListener("click", () => {
        document.getElementById("fileInput").click();
    });
}

// ======================
// UPLOAD DATASET
// ======================
async function handleFileUpload(file) {
    const statusDiv = document.getElementById("uploadStatus");
    const previewContainer = document.getElementById("previewContainer");
    
    statusDiv.className = "upload-status info";
    statusDiv.innerText = "Subiendo y analizando el archivo con Pandas...";

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            statusDiv.className = "upload-status success";
            statusDiv.innerText = "¡Archivo cargado y procesado con éxito!";
            
            isDataLoaded = true;
            
            // Mostrar resumen del dataset en las tarjetas
            document.getElementById("metaRows").innerText = Number(data.rows).toLocaleString("es-ES");
            document.getElementById("metaCols").innerText = data.cols;
            document.getElementById("metaNulls").innerText = Number(data.nulls).toLocaleString("es-ES");
            document.getElementById("metaSize").innerText = data.size_mb + " MB";

            // Llenar vista previa de la tabla
            renderPreviewTable(data.preview_cols, data.preview_data);
            
            // Mostrar contenedor
            previewContainer.classList.remove("hidden");

            // Llenar filtros del Dashboard
            populateFilters(data.filter_platforms, data.filter_genres);

            // Cargar datos en el Dashboard después de un breve delay
            // y pre-cargar películas, series y explorador en paralelo
            setTimeout(() => {
                switchSection("dashboard");
                preloadAllSections();
            }, 1200);
            
        } else {
            statusDiv.className = "upload-status error";
            statusDiv.innerText = data.detail || "Error al procesar el archivo. Verifica el formato.";
        }
    } catch (error) {
        statusDiv.className = "upload-status error";
        statusDiv.innerText = "Error de conexión con el servidor.";
        console.error(error);
    }
}

function renderPreviewTable(cols, rows) {
    const header = document.getElementById("tableHeader");
    const body = document.getElementById("tableBody");

    // Limpiar tabla
    header.innerHTML = "";
    body.innerHTML = "";

    // Insertar cabecera
    cols.forEach(col => {
        const th = document.createElement("th");
        th.innerText = col;
        header.appendChild(th);
    });

    // Insertar filas
    rows.forEach(row => {
        const tr = document.createElement("tr");
        cols.forEach(col => {
            const td = document.createElement("td");
            // Formatear ratings en rojo y negrita en la tabla
            if (col.toLowerCase() === "rating") {
                td.style.color = "#ed0612";
                td.style.fontWeight = "700";
            }
            td.innerText = row[col] !== null ? row[col] : "-";
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });
}

function populateFilters(platforms, genres) {
    const platformSelect = document.getElementById("platformFilter");
    const genreSelect = document.getElementById("genreFilter");

    // Limpiar selectores excepto la primera opción ("Todos")
    platformSelect.innerHTML = '<option value="Todos">Todos</option>';
    genreSelect.innerHTML = '<option value="Todos">Todos</option>';

    platforms.forEach(p => {
        if(p) {
            const opt = document.createElement("option");
            opt.value = p;
            opt.innerText = p;
            platformSelect.appendChild(opt);
        }
    });

    genres.forEach(g => {
        if(g) {
            const opt = document.createElement("option");
            opt.value = g;
            opt.innerText = g;
            genreSelect.appendChild(opt);
        }
    });

    // Sincronizar filtros de catálogo, series y reportes
    syncCatalogFilters(platforms, genres);
}

// ======================
// CARGAR ESTADÍSTICAS DEL DASHBOARD
// ======================
async function loadDashboardStats(platform = "Todos", genre = "Todos") {
    if (!isDataLoaded) return;

    try {
        const response = await fetch(`/api/dashboard-stats?platform=${encodeURIComponent(platform)}&genre=${encodeURIComponent(genre)}`);
        const data = await response.json();

        if (response.ok) {
            updateMetrics(data.metrics);
            renderCharts(data);
        } else {
            console.error("Error al obtener las estadísticas del dashboard.");
        }
    } catch (error) {
        console.error("Error de conexión:", error);
    }
}

function applyFilters() {
    const platform = document.getElementById("platformFilter").value;
    const genre = document.getElementById("genreFilter").value;
    loadDashboardStats(platform, genre);
}

// Actualizar los textos de las tarjetas superiores
function updateMetrics(metrics) {
    document.getElementById("metricTotal").innerText = Number(metrics.total).toLocaleString("es-ES");
    document.getElementById("metricRating").innerText = Number(metrics.avg_rating).toFixed(2);
    document.getElementById("metricGenre").innerText = metrics.top_genre || "-";
    document.getElementById("metricPlatform").innerText = metrics.top_platform || "-";
    document.getElementById("metricYear").innerText = metrics.top_year || "-";
    document.getElementById("metricDuration").innerText = Math.round(metrics.avg_duration || 0);

    // Resumen estadístico
    document.getElementById("summaryMeanRating").innerText = Number(metrics.avg_rating).toFixed(2);
    document.getElementById("summaryMedianRating").innerText = Number(metrics.median_rating || 0).toFixed(2);
    document.getElementById("summaryStdRating").innerText = Number(metrics.std_rating || 0).toFixed(2);
    document.getElementById("summaryMaxRating").innerText = Number(metrics.max_rating || 0).toFixed(2);
    document.getElementById("summaryMinRating").innerText = Number(metrics.min_rating || 0).toFixed(2);
    document.getElementById("summaryMeanDuration").innerText = Math.round(metrics.avg_duration || 0);
    document.getElementById("summaryMaxDuration").innerText = Math.round(metrics.max_duration || 0);
    document.getElementById("summaryMinDuration").innerText = Math.round(metrics.min_duration || 0);

    // Información del dataset
    document.getElementById("summaryRows").innerText = Number(metrics.total).toLocaleString("es-ES");
    document.getElementById("summaryCols").innerText = metrics.cols || "-";
    document.getElementById("summaryNulls").innerText = Number(metrics.nulls).toLocaleString("es-ES");
    document.getElementById("summaryMemory").innerText = metrics.memory_mb ? (metrics.memory_mb.toFixed(2) + " MB") : "-";
}

// ======================
// PINTAR GRÁFICOS (CHART.JS & CUSTOM HEATMAP)
// ======================
function renderCharts(data) {
    // 1. Gráfico de Barras: Género
    if (charts.genre) charts.genre.destroy();
    const ctxBar = document.getElementById("genreBarChart").getContext("2d");
    charts.genre = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: data.genre_counts.labels,
            datasets: [{
                label: 'Películas/Series',
                data: data.genre_counts.values,
                backgroundColor: '#ed0612',
                borderRadius: 4,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#888' } },
                y: { grid: { color: '#222' }, ticks: { color: '#888' } }
            }
        }
    });

    // 2. Gráfico de Dona: Plataforma
    if (charts.platform) charts.platform.destroy();
    const ctxDonut = document.getElementById("platformDonutChart").getContext("2d");
    charts.platform = new Chart(ctxDonut, {
        type: 'doughnut',
        data: {
            labels: data.platform_counts.labels,
            datasets: [{
                data: data.platform_counts.values,
                backgroundColor: ['#ed0612', '#2196f3', '#9c27b0', '#ff9800', '#4caf50', '#9e9e9e'],
                borderColor: '#141414',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#aaa', font: { size: 10 } }
                }
            },
            cutout: '65%'
        }
    });

    // 3. Gráfico de Línea: Estrenos por año
    if (charts.year) charts.year.destroy();
    const ctxLine = document.getElementById("yearLineChart").getContext("2d");
    
    // Crear degradado para el área bajo la línea
    const gradient = ctxLine.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(237, 6, 18, 0.4)');
    gradient.addColorStop(1, 'rgba(237, 6, 18, 0.0)');

    charts.year = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: data.year_counts.labels,
            datasets: [{
                label: 'Estrenos',
                data: data.year_counts.values,
                borderColor: '#ed0612',
                backgroundColor: gradient,
                fill: true,
                borderWidth: 2,
                tension: 0.3,
                pointBackgroundColor: '#ed0612',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#888' } },
                y: { grid: { color: '#222' }, ticks: { color: '#888' } }
            }
        }
    });

    // 4. Scatter Plot: Presupuesto vs Ganancias
    if (charts.scatter) charts.scatter.destroy();
    const ctxScatter = document.getElementById("scatterPlot").getContext("2d");
    charts.scatter = new Chart(ctxScatter, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Películas',
                data: data.scatter_data, // [{x: presupuesto, y: ganancias}, ...]
                backgroundColor: 'rgba(237, 6, 18, 0.7)',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { 
                    grid: { color: '#222' }, 
                    ticks: { color: '#888' },
                    title: { display: true, text: 'Presupuesto (M USD)', color: '#888', font: { size: 10 } }
                },
                y: { 
                    grid: { color: '#222' }, 
                    ticks: { color: '#888' },
                    title: { display: true, text: 'Ganancias (M USD)', color: '#888', font: { size: 10 } }
                }
            }
        }
    });

    // 5. Tabla Top 10
    const top10Body = document.getElementById("top10Body");
    top10Body.innerHTML = "";
    data.top10.forEach((item, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight: 600;">${item.titulo}</td>
            <td>${item.tipo || "-"}</td>
            <td>${item.ano}</td>
            <td style="color: #ed0612; font-weight: 700;">${Number(item.rating).toFixed(1)}</td>
            <td>${Number(item.votos || 0).toLocaleString("es-ES")}</td>
        `;
        top10Body.appendChild(tr);
    });

    // 6. Mapa de calor interactivo
    renderHeatmap(data.heatmap);
}

function renderHeatmap(heatmapData) {
    const grid = document.getElementById("heatmapGrid");
    grid.innerHTML = "";

    const ratingBins = ['<5', '5-6', '6-7', '7-8', '8-9', '>9'];
    const genres = Object.keys(heatmapData);

    if (genres.length === 0) {
        grid.innerHTML = '<div style="text-align:center; padding: 20px; color: #555;">No hay datos para el mapa de calor</div>';
        return;
    }

    genres.forEach(genre => {
        const row = document.createElement("div");
        row.className = "heatmap-row";

        const label = document.createElement("div");
        label.className = "heatmap-label-y";
        label.innerText = genre;
        label.title = genre;
        row.appendChild(label);

        const cellsContainer = document.createElement("div");
        cellsContainer.className = "heatmap-cells";

        ratingBins.forEach(bin => {
            const count = heatmapData[genre][bin] || 0;
            const cell = document.createElement("div");
            cell.className = "heatmap-cell";
            
            // Determinar color en base a la intensidad de la cantidad
            const maxIntensity = 100; // Normalización básica para el degradado
            const weight = Math.min(count / maxIntensity, 1);
            
            // Mezclamos morado oscuro (#311b92) para bajo conteo y rojo brillante (#b71c1c) para alto conteo
            if (count === 0) {
                cell.style.backgroundColor = "#1a1a1a";
            } else {
                const r = Math.round(49 + (183 - 49) * weight);
                const g = Math.round(27 + (28 - 27) * weight);
                const b = Math.round(146 + (28 - 146) * weight);
                cell.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
            }

            const tooltip = document.createElement("span");
            tooltip.className = "heatmap-tooltip";
            tooltip.innerText = `${genre} (${bin}): ${count} películas/series`;
            
            cell.appendChild(tooltip);
            cellsContainer.appendChild(cell);
        });

        row.appendChild(cellsContainer);
        grid.appendChild(row);
    });
}

// ======================
// CATÁLOGO: PELÍCULAS Y SERIES
// ======================
let moviePage = 1;
let seriesPage = 1;
let explorePage = 1;

// Filtros compartidos de plataforma/género (ya poblados desde populateFilters)
function syncCatalogFilters(platforms, genres) {
    const filterIds = [
        { g: "moviesGenreFilter", p: "moviesPlatformFilter" },
        { g: "seriesGenreFilter", p: "seriesPlatformFilter" },
        { g: "csvGenreFilter", p: "csvPlatformFilter" },
        { g: "jsonGenreFilter", p: "jsonPlatformFilter" }
    ];

    filterIds.forEach(({ g, p }) => {
        const gEl = document.getElementById(g);
        const pEl = document.getElementById(p);
        if (!gEl || !pEl) return;

        gEl.innerHTML = '<option value="Todos">Todos los géneros</option>';
        genres.forEach(gv => {
            if (gv) {
                const opt = document.createElement("option");
                opt.value = gv; opt.innerText = gv;
                gEl.appendChild(opt);
            }
        });

        pEl.innerHTML = '<option value="Todos">Todas las plataformas</option>';
        platforms.forEach(pv => {
            if (pv) {
                const opt = document.createElement("option");
                opt.value = pv; opt.innerText = pv;
                pEl.appendChild(opt);
            }
        });
    });
}

async function loadCatalog(type, page = 1) {
    if (!isDataLoaded) return;

    let tipoParam, bodyId, totalLabelId, paginationId, searchId, genreId, platformId;
    if (type === 'movie') {
        tipoParam = "Película";
        bodyId = "moviesBody";
        totalLabelId = "moviesTotalLabel";
        paginationId = "moviesPagination";
        searchId = "moviesSearch";
        genreId = "moviesGenreFilter";
        platformId = "moviesPlatformFilter";
        moviePage = page;
    } else {
        tipoParam = "Serie";
        bodyId = "seriesBody";
        totalLabelId = "seriesTotalLabel";
        paginationId = "seriesPagination";
        searchId = "seriesSearch";
        genreId = "seriesGenreFilter";
        platformId = "seriesPlatformFilter";
        seriesPage = page;
    }

    const search = document.getElementById(searchId)?.value || "";
    const genre = document.getElementById(genreId)?.value || "Todos";
    const platform = document.getElementById(platformId)?.value || "Todos";

    try {
        const url = `/api/catalog?tipo=${encodeURIComponent(tipoParam)}&search=${encodeURIComponent(search)}&genre=${encodeURIComponent(genre)}&platform=${encodeURIComponent(platform)}&page=${page}&per_page=20`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) return;

        document.getElementById(totalLabelId).innerText = `${Number(data.total).toLocaleString("es-ES")} ${type === 'movie' ? 'películas' : 'series'}`;

        const tbody = document.getElementById(bodyId);
        tbody.innerHTML = "";
        if (data.records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="table-empty">No se encontraron resultados.</td></tr>`;
        } else {
            const offset = (data.page - 1) * data.per_page;
            data.records.forEach((item, i) => {
                const tr = document.createElement("tr");
                const rating = item.rating !== null ? Number(item.rating).toFixed(1) : "—";
                const duracion = item.duracion !== null ? `${item.duracion} min` : "—";
                const votos = item.votos !== null ? Number(item.votos).toLocaleString("es-ES") : "—";
                tr.innerHTML = `
                    <td style="color:#666;">${offset + i + 1}</td>
                    <td style="font-weight:600; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.titulo || ''}">${item.titulo || '—'}</td>
                    <td style="color:#aaa; font-size:12px;">${item.genero || '—'}</td>
                    <td>${item.ano || '—'}</td>
                    <td style="color:#ed0612; font-weight:700;">${rating}</td>
                    <td style="color:#aaa;">${duracion}</td>
                    <td style="color:#aaa; font-size:12px;">${item.plataforma || '—'}</td>
                    <td style="color:#aaa;">${votos}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        renderPagination(paginationId, data.page, data.total_pages, (p) => loadCatalog(type, p));

    } catch (e) {
        console.error("Error cargando catálogo:", e);
    }
}

// ======================
// EXPLORAR DATOS
// ======================
async function loadExplore(page = 1) {
    if (!isDataLoaded) return;

    explorePage = page;
    const search = document.getElementById("exploreSearch")?.value || "";

    try {
        const url = `/api/explore?search=${encodeURIComponent(search)}&page=${page}&per_page=25`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) return;

        document.getElementById("exploreTotalLabel").innerText = `${Number(data.total).toLocaleString("es-ES")} registros`;

        // Encabezados dinámicos
        const header = document.getElementById("exploreHeader");
        header.innerHTML = "";
        data.columns.forEach(col => {
            const th = document.createElement("th");
            th.innerText = col;
            header.appendChild(th);
        });

        const tbody = document.getElementById("exploreBody");
        tbody.innerHTML = "";
        if (data.records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${data.columns.length || 5}" class="table-empty">No se encontraron resultados.</td></tr>`;
        } else {
            data.records.forEach(row => {
                const tr = document.createElement("tr");
                data.columns.forEach(col => {
                    const td = document.createElement("td");
                    if (col === "rating" && row[col] !== null) {
                        td.style.color = "#ed0612";
                        td.style.fontWeight = "700";
                    }
                    td.innerText = row[col] !== null ? row[col] : "—";
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }

        renderPagination("explorePagination", data.page, data.total_pages, (p) => loadExplore(p));

    } catch (e) {
        console.error("Error explorando datos:", e);
    }
}

// ======================
// PAGINACIÓN GENÉRICA
// ======================
function renderPagination(containerId, currentPage, totalPages, onPageClick) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    if (totalPages <= 1) return;

    const makeBtn = (label, page, disabled = false, active = false) => {
        const btn = document.createElement("button");
        btn.className = "page-btn" + (active ? " active" : "") + (disabled ? " disabled" : "");
        btn.innerText = label;
        btn.disabled = disabled;
        if (!disabled) btn.onclick = () => onPageClick(page);
        return btn;
    };

    container.appendChild(makeBtn("«", 1, currentPage === 1));
    container.appendChild(makeBtn("‹", currentPage - 1, currentPage === 1));

    // Páginas cercanas
    const startP = Math.max(1, currentPage - 2);
    const endP = Math.min(totalPages, currentPage + 2);
    for (let p = startP; p <= endP; p++) {
        container.appendChild(makeBtn(p, p, false, p === currentPage));
    }

    container.appendChild(makeBtn("›", currentPage + 1, currentPage === totalPages));
    container.appendChild(makeBtn("»", totalPages, currentPage === totalPages));

    // Indicador de página
    const info = document.createElement("span");
    info.className = "page-info";
    info.innerText = `Pág. ${currentPage} / ${totalPages}`;
    container.appendChild(info);
}

// ======================
// DEBOUNCE PARA BÚSQUEDA
// ======================
let debounceMoviesTimer = null;
let debounceSeriesTimer = null;
let debounceExploreTimer = null;

function debounceMovies() {
    clearTimeout(debounceMoviesTimer);
    debounceMoviesTimer = setTimeout(() => loadCatalog('movie', 1), 350);
}
function debounceSeries() {
    clearTimeout(debounceSeriesTimer);
    debounceSeriesTimer = setTimeout(() => loadCatalog('series', 1), 350);
}
function debounceExplore() {
    clearTimeout(debounceExploreTimer);
    debounceExploreTimer = setTimeout(() => loadExplore(1), 350);
}

// ======================
// REPORTES / EXPORTACIÓN
// ======================
function exportData(format) {
    const tipoEl = document.getElementById(`${format}TipoFilter`);
    const genreEl = document.getElementById(`${format}GenreFilter`);
    const platformEl = document.getElementById(`${format}PlatformFilter`);

    const tipo = tipoEl ? tipoEl.value : "all";
    const genre = genreEl ? genreEl.value : "Todos";
    const platform = platformEl ? platformEl.value : "Todos";

    const url = `/api/export?format=${format}&tipo=${encodeURIComponent(tipo)}&genre=${encodeURIComponent(genre)}&platform=${encodeURIComponent(platform)}`;
    window.open(url, "_blank");
}

async function loadReportSummary() {
    try {
        const response = await fetch("/api/dataset-info");
        const data = await response.json();
        if (response.ok && data.loaded) {
            document.getElementById("rptFilename").innerText = data.filename || "—";
            document.getElementById("rptRows").innerText = Number(data.rows).toLocaleString("es-ES");
            document.getElementById("rptCols").innerText = data.cols;
            document.getElementById("rptNulls").innerText = Number(data.nulls).toLocaleString("es-ES");
            document.getElementById("rptSize").innerText = data.size_mb + " MB";
        }
    } catch (e) {}
    // El rating lo tomamos del último fetch del dashboard si está disponible
    const ratingEl = document.getElementById("metricRating");
    if (ratingEl) {
        document.getElementById("rptRating").innerText = ratingEl.innerText || "—";
    }
}

// ======================
// CONFIGURACIÓN
// ======================
function loadConfigSection() {
    const email = localStorage.getItem("userEmail") || "—";
    const namePart = email !== "—" ? email.split("@")[0] : "—";
    const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    document.getElementById("cfgEmail").innerText = email;
    document.getElementById("cfgName").innerText = displayName;

    // Dataset info
    fetch("/api/dataset-info").then(r => r.json()).then(data => {
        if (data.loaded) {
            document.getElementById("cfgDataset").innerText = data.filename || "Archivo cargado";
            document.getElementById("cfgRows").innerText = Number(data.rows).toLocaleString("es-ES");
            document.getElementById("cfgCols").innerText = data.cols;
            document.getElementById("cfgSize").innerText = data.size_mb + " MB";

            // Chips de columnas
            const chipsContainer = document.getElementById("cfgColumns");
            chipsContainer.innerHTML = "";
            data.preview_cols.forEach(col => {
                const chip = document.createElement("span");
                chip.className = "col-chip";
                chip.innerText = col;
                chipsContainer.appendChild(chip);
            });
        }
    }).catch(() => {});
}

// ======================
// REDEFINIR switchSection PARA CARGAR DATOS AL ENTRAR
// ======================
function switchSection(sectionId) {
    // Actualizar clase activa del menú
    document.querySelectorAll(".menu-item").forEach(el => el.classList.remove("active"));
    const activeItem = document.querySelector(`.menu-item[data-section="${sectionId}"]`);
    if (activeItem) activeItem.classList.add("active");

    // Ocultar todas las secciones y mostrar la elegida
    document.querySelectorAll(".content-section").forEach(sec => sec.classList.add("hidden"));
    const activeSection = document.getElementById(`section-${sectionId}`);
    if (activeSection) {
        activeSection.classList.remove("hidden");
    }

    // Helper: comprobar si una tabla ya tiene filas de datos (no el placeholder vacío)
    const tableHasData = (tbodyId) => {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return false;
        const rows = tbody.querySelectorAll("tr");
        // Si solo tiene 1 fila con la clase table-empty (placeholder), no tiene datos aún
        if (rows.length === 1 && rows[0].querySelector(".table-empty")) return false;
        return rows.length > 0;
    };

    // Disparar cargas de datos específicas por sección
    // (solo recarga si la tabla aún no tiene datos pre-cargados)
    if (sectionId === "dashboard" && isDataLoaded) {
        loadDashboardStats();
    } else if (sectionId === "peliculas" && isDataLoaded) {
        if (!tableHasData("moviesBody")) loadCatalog('movie', 1);
    } else if (sectionId === "series" && isDataLoaded) {
        if (!tableHasData("seriesBody")) loadCatalog('series', 1);
    } else if (sectionId === "explorar" && isDataLoaded) {
        if (!tableHasData("exploreBody")) loadExplore(1);
    } else if (sectionId === "reportes") {
        loadReportSummary();
    } else if (sectionId === "configuracion") {
        loadConfigSection();
    }
}
