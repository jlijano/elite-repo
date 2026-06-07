(() => {
  if (window.__switchboardStabilityGuardInstalled || typeof window.MutationObserver !== "function") return;
  window.__switchboardStabilityGuardInstalled = true;

  const NativeMutationObserver = window.MutationObserver;

  class StableMutationObserver extends NativeMutationObserver {
    constructor(callback) {
      let scheduled = false;
      let queuedRecords = [];
      let observer = null;

      const guardedCallback = (records) => {
        queuedRecords = queuedRecords.concat(records || []);
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          const nextRecords = queuedRecords.splice(0, queuedRecords.length);
          callback(nextRecords, observer);
        });
      };

      super(guardedCallback);
      observer = this;
    }

    observe(target, options = {}) {
      const nextOptions = { ...options };
      if (target === document.body && nextOptions.subtree) {
        nextOptions.subtree = false;
        nextOptions.childList = true;
        delete nextOptions.attributes;
        delete nextOptions.attributeFilter;
        delete nextOptions.characterData;
      }
      return super.observe(target, nextOptions);
    }
  }

  Object.setPrototypeOf(StableMutationObserver, NativeMutationObserver);
  window.MutationObserver = StableMutationObserver;
})();