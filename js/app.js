const root = document.documentElement;
const buttons = document.querySelectorAll("[data-theme-button]");

const savedTheme = localStorage.getItem("playground-theme");
if (savedTheme === "light" || savedTheme === "dark") {
  root.setAttribute("data-theme", savedTheme);
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const theme = button.getAttribute("data-theme-button");
    root.setAttribute("data-theme", theme);
    localStorage.setItem("playground-theme", theme);
  });
});
