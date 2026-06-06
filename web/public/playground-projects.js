const projectViewButtons = document.querySelectorAll("[data-project-view]");
const projectViewPanels = document.querySelectorAll("[data-project-panel]");

function setProjectView(view) {
  projectViewButtons.forEach((button) => {
    const active = button.dataset.projectView === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });

  projectViewPanels.forEach((panel) => {
    const active = panel.dataset.projectPanel === view;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

projectViewButtons.forEach((button, index) => {
  button.addEventListener("click", () => setProjectView(button.dataset.projectView));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = index === 0 ? projectViewButtons.length - 1 : index - 1;
    if (event.key === "ArrowRight") nextIndex = index === projectViewButtons.length - 1 ? 0 : index + 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = projectViewButtons.length - 1;
    const nextButton = projectViewButtons[nextIndex];
    setProjectView(nextButton.dataset.projectView);
    nextButton.focus();
  });
});
