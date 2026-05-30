// ======================
// MOSTRAR/OCULTAR CONTRASEÑA
// ======================
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
    } else {
        input.type = "password";
    }
}

// ======================
// MOVER CARRUSEL DE CARTELES
// ======================
let currentSlide = 0;
function moveCarousel(direction) {
    const posterRow = document.getElementById("posterRow");
    
    // Desactivamos la animación automática de CSS al interactuar manualmente
    posterRow.style.animation = "none";
    
    const posters = document.querySelectorAll(".poster");
    if (posters.length === 0) return;
    
    const posterWidth = posters[0].offsetWidth + 18; // ancho de poster + 18px de gap
    currentSlide += direction;
    
    // Limitar el rango para no salirse de los posters
    if (currentSlide < 0) currentSlide = 0;
    if (currentSlide > posters.length - 3) {
        currentSlide = posters.length - 3;
    }
    
    posterRow.style.transform = `translateX(-${currentSlide * posterWidth}px)`;
    
    // Actualizar puntos de navegación (dots) activos
    const dots = document.querySelectorAll("#carouselDots span");
    dots.forEach((dot, index) => {
        dot.classList.toggle("active", index === currentSlide);
    });
}

// ======================
// SUBMIT
// ======================
async function submitForm() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const message = document.getElementById("message");

    if (!email || !password) {
        message.className = "error-msg";
        message.innerText = "Por favor, completa todos los campos.";
        return;
    }

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            message.className = "success-msg";
            message.innerText = data.message || "Inicio de sesión exitoso. Redirigiendo...";
            
            // Guardar datos básicos en localStorage para el header
            localStorage.setItem("userEmail", email);
            
            setTimeout(() => {
                window.location.href = "/dashboard";
            }, 1000);
        } else {
            message.className = "error-msg";
            message.innerText = data.detail || "Correo o contraseña incorrectos";
        }
    } catch (error) {
        message.className = "error-msg";
        message.innerText = "Error de conexión al servidor";
        console.error(error);
    }
}
