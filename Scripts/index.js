// --- Login Modal Elements ---
const loginModal = document.getElementById("loginModal");
const loginBackdrop = document.getElementById("loginBackdrop");
const envFileInput = document.getElementById("envFile");
const passphraseInput = document.getElementById("passphrase");
const unlockBtn = document.getElementById("unlockBtn");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
let isAuthenticated = false;


logoutBtn.addEventListener("click", async () => {
    await fetch("/api/logout", {
        method: "POST",
        credentials: "include"
    });

    // Force fresh auth check
    showLoginModal();
});



// landing.js
document.addEventListener("DOMContentLoaded", () => {

    checkAuth();
});
async function checkAuth() {
    if (isAuthenticated) {
        return;
    }

    try {
        const res = await fetch("/api/session/me", {
            credentials: "include"
        });

        if (!res.ok) {
            showLoginModal();
            return null;
        }

        const user = await res.json();
        isAuthenticated = true;

        hideLoginModal();
        updateUserMenu(user);
        loadProducts();
        return user;

    } catch (err) {
        console.error("Auth check failed:", err);
        showLoginModal();
        return null;
    }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("logging in");
    loginError.style.display = "none";
    loginError.textContent = "";

    const file = envFileInput.files[0];
    const passphrase = passphraseInput.value.trim();

    if (!file) {
        loginError.textContent = "Please select an encrypted .enc file.";
        loginError.style.display = "block";
        return;
    }

    if (!passphrase) {
        loginError.textContent = "Please enter your passphrase.";
        loginError.style.display = "block";
        return;
    }

    try {
        const formData = new FormData();
        formData.append("envFile", file);
        formData.append("passphrase", passphrase);

        const res = await fetch("/api/login", {
            method: "POST",
            body: formData,
            credentials: "include"
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Login failed" }));
            loginError.textContent = err.error || "Login failed";
            loginError.style.display = "block";

            // 🔥 IMPORTANT FIX: reset file input so FormData is rebuilt next click
            envFileInput.value = "";

            return;
        }

        isAuthenticated = true;
        hideLoginModal();
        updateUserMenu(await res.json());
        loadProducts();


    } catch (err) {
        console.error("Login error:", err);
        loginError.textContent = "Unexpected error during login.";
        loginError.style.display = "block";
    }
});
// Show modal
function showLoginModal() {
    console.log("Showing login modal");
    loginModal.classList.remove("hidden");
    loginBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

// Hide modal
function hideLoginModal() {
    console.log("Hiding login modal");
    loginModal.classList.add("hidden");
    loginBackdrop.classList.add("hidden");
    document.body.style.overflow = "";
}

function setUserAvatar(name) {
    const avatar = document.getElementById("userAvatar");
    const initials = name
        .split(" ")
        .map(n => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    avatar.textContent = initials;
}

function updateUserMenu(data) {
    const menu = document.getElementById("userMenu");
    const label = document.getElementById("userNameLabel");

    // Normalize shape
    const user = data.user ?? data;

    setUserAvatar(user.displayName);
    label.textContent = `${user.displayName} (${user.roles})`;

    menu.classList.remove("hidden");
}

document.addEventListener("click", () => {
    if (!userDropdown || !userDisplay) return;

    userDropdown.classList.add("hidden");
    userDisplay.classList.remove("open");
});

userDropdown.addEventListener("click", (e) => {
    e.stopPropagation(); // allow click, but still close
    userDropdown.classList.add("hidden");
    userDisplay.classList.remove("open");
});

userDisplay.addEventListener("click", (e) => {
    e.stopPropagation(); // 🔑 this prevents the document handler

    userDropdown.classList.toggle("hidden");
    userDisplay.classList.toggle("open");
});

// Toggle script info popovers
document.addEventListener("click", (e) => {
    const infoBtn = e.target.closest(".info-btn");

    // If clicking a "?" button
    if (infoBtn) {
        const card = infoBtn.closest(".script-card");
        card.classList.toggle("show-info");
        return;
    }

    // If clicking anywhere else, close all popovers
    document.querySelectorAll(".script-card.show-info")
        .forEach(card => card.classList.remove("show-info"));
});

async function loadProducts() {
    console.log("loadProducts() CALLED");

    const productGrid = document.getElementById("productGrid");
    console.log("productGrid =", productGrid);
    if (!productGrid) return; // Not on the landing page

    try {
        const res = await fetch("/api/products", {
            credentials: "include"
        });

        const products = await res.json();

        const grid = document.querySelector(".product-grid");
        grid.innerHTML = ""; // clear any placeholder HTML

        products.forEach(product => {
            const card = document.createElement("section");
            card.className = "product-card";
            card.dataset.product = product.id;

            card.innerHTML = `
    <img src="${product.logo}" alt="${product.title}">
    <h3>${product.title}</h3>
    <p>${product.description}</p>
`;

            grid.appendChild(card);
        });

        attachProductHandlers();
    } catch (err) {
        console.error("Failed to load products:", err);
    }
}


function attachProductHandlers() {


    document.querySelectorAll(".product-card").forEach(card => {
        card.addEventListener("click", async () => {
            const product = card.dataset.product;


            try {
                const res = await fetch(`/api/products/${product}/manifest`, {
                    credentials: "include"
                });
                const manifest = await res.json();
                const scripts = manifest.scripts;

                // If only one script, go straight to runner
                if (scripts.length === 1) {
                    window.location.href = `/run/${product}/${scripts[0].id}`;
                    return;
                }

                showScriptPicker(product, scripts);
            } catch (err) {
                console.error("Failed to load manifest:", err);
            }
        });
    });
}

function showScriptPicker(product, scripts) {
    const picker = document.getElementById("scriptPicker");
    const grid = document.getElementById("scriptGrid");

    grid.innerHTML = "";

    scripts.forEach(script => {
        const card = document.createElement("div");
        card.className = "script-card";
        const icon = script.icon || "🧰";
        const hidden = script.description ? "" : "hidden";

        card.innerHTML = `
            <div class="script-icon">${icon}</div>
            <div class="script-name">${script.title}</div>
            <button class="info-btn ${hidden}">?</button>
            <div class="info-popover">${script.description}</div>
            <button class="open-btn">Open</button>
        `;

        card.addEventListener("click", () => {
            window.location.href = `/run/${product}/${script.id}`;
        });

        card.querySelector(".info-btn").addEventListener("click", (e) => {
            e.stopPropagation();
        });

        card.querySelector(".open-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            window.location.href = `/run/${product}/${script.id}`;
        });


        grid.appendChild(card);
    });

    picker.classList.remove("hidden");
}