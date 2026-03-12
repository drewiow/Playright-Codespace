// landing.js
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
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
    try {
        const res = await fetch("/api/products");
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
                const res = await fetch(`/api/products/${product}/manifest`);
                const manifest = await res.json();
                const scripts = manifest.scripts;

                // If only one script, go straight to runner
                if (scripts.length === 1) {
                    window.location.href =
                        `/runner.html?product=${product}&script=${scripts[0].id}`;
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

        card.querySelector(".open-btn").onclick = () => {
            window.location.href =
                `/runner.html?product=${product}&script=${script.id}`;
        };

        grid.appendChild(card);
    });

    picker.classList.remove("hidden");
}