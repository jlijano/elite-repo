(() => {
  const loader = document.getElementById("oligarchyLoadingScreen");
  if (!loader) return;

  const percent = loader.querySelector("[data-loader-percent]");
  const startedAt = performance.now();
  const minimumDuration = 950;
  let progress = 0;
  let loadComplete = document.readyState === "complete";
  let frameId = 0;

  function setProgress(value) {
    progress = Math.max(progress, Math.min(100, Math.round(value)));
    if (percent) percent.textContent = `${progress}%`;
  }

  function finish() {
    const elapsed = performance.now() - startedAt;
    const delay = Math.max(0, minimumDuration - elapsed);
    window.setTimeout(() => {
      setProgress(100);
      loader.classList.add("is-hiding");
      window.setTimeout(() => loader.remove(), 560);
    }, delay);
  }

  function tick() {
    const target = loadComplete ? 100 : Math.min(94, progress + Math.random() * 9 + 3);
    setProgress(target);
    if (loadComplete && progress >= 100) {
      finish();
      return;
    }
    frameId = window.setTimeout(tick, loadComplete ? 60 : 120);
  }

  window.addEventListener("load", () => {
    loadComplete = true;
    window.clearTimeout(frameId);
    tick();
  }, { once: true });

  tick();
})();
