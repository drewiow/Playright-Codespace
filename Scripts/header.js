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

function updateUserMenu(user) {
    const menu = document.getElementById("userMenu");
    const label = document.getElementById("userNameLabel");
    setUserAvatar(user.user.displayName);
    label.textContent = `${user.user.displayName} (${user.user.roles})`;
    menu.classList.remove("hidden");
}

document.getElementById("userDisplay").addEventListener("click", () => {
    const dropdown = document.getElementById("userDropdown");
    const display = document.getElementById("userDisplay");

    dropdown.classList.toggle("hidden");
    display.classList.toggle("open");
});