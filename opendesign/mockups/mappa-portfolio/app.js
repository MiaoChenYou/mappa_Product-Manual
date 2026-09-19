(() => {
  const slides = [...document.querySelectorAll(".slide")];
  const total = slides.length;
  const currentLabel = document.querySelector("#page-current");
  const progress = document.querySelector(".progress");
  const menu = document.querySelector(".page-menu");
  const menuToggle = document.querySelector(".page-indicator");
  function indexFromHash() {
    const page = Number.parseInt(location.hash.slice(1), 10);
    return Number.isFinite(page) ? Math.max(0, Math.min(total - 1, page - 1)) : 0;
  }

  let current = indexFromHash();
  let wheelLock = false;
  let touchStart = null;

  function fitCanvas() {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const scale = Math.min(viewportWidth / 1920, viewportHeight / 1080);
    document.documentElement.style.setProperty("--scale", String(scale));
  }

  function updateMenu() {
    menu.querySelectorAll("[data-go]").forEach((button) => {
      button.classList.toggle("is-current", Number(button.dataset.go) === current + 1);
    });
  }

  function goTo(index, direction = 0) {
    const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
    const next = Math.max(0, Math.min(total - 1, safeIndex));
    if (next === current && slides[next].classList.contains("is-active")) return;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === next);
      slide.dataset.direction = direction > 0 ? "next" : direction < 0 ? "prev" : "direct";
      slide.setAttribute("aria-hidden", i === next ? "false" : "true");
      slide.querySelectorAll("video").forEach((video) => {
        if (i === next) video.play().catch(() => {});
        else video.pause();
      });
    });
    current = next;
    currentLabel.textContent = String(current + 1).padStart(2, "0");
    progress.style.setProperty("--progress", String((current + 1) / total));
    history.replaceState(null, "", `#${current + 1}`);
    updateMenu();
  }

  function step(direction) {
    goTo(current + direction, direction);
  }

  function isDialogOpen() {
    return Boolean(document.querySelector("dialog[open]"));
  }

  function isMenuOpen() {
    return menu.classList.contains("is-open");
  }

  function closeMenu() {
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
  }

  document.querySelectorAll("[data-dir]").forEach((control) => {
    control.addEventListener("click", () => step(control.dataset.dir === "next" ? 1 : -1));
  });

  menuToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = menu.classList.toggle("is-open");
    menu.setAttribute("aria-hidden", open ? "false" : "true");
  });

  menu.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      goTo(Number(button.dataset.go) - 1);
      closeMenu();
    });
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
  });

  window.addEventListener("keydown", (event) => {
    if (isDialogOpen()) {
      if (event.key === "Escape") document.querySelector("dialog[open]")?.close();
      return;
    }
    if (event.target.closest?.("button, a, input, select, textarea, [contenteditable='true']")) return;
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      step(1);
    }
    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      step(-1);
    }
    if (event.key === "Home") goTo(0, -1);
    if (event.key === "End") goTo(total - 1, 1);
    if (event.key.toLowerCase() === "m") menuToggle.click();
  });

  window.addEventListener("wheel", (event) => {
    if (wheelLock || isDialogOpen() || isMenuOpen() || Math.abs(event.deltaY) < 24) return;
    wheelLock = true;
    step(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => { wheelLock = false; }, 650);
  }, { passive: true });

  window.addEventListener("touchstart", (event) => {
    if (isDialogOpen() || isMenuOpen()) return;
    touchStart = event.changedTouches[0].clientX;
  }, { passive: true });

  window.addEventListener("touchend", (event) => {
    if (touchStart === null || isDialogOpen() || isMenuOpen()) return;
    const delta = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(delta) > 60) step(delta < 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });

  const dialogs = {
    sitemap: document.querySelector("#sitemap-dialog"),
    "design-system": document.querySelector("#design-system-dialog")
  };

  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => dialogs[button.dataset.open]?.showModal());
  });

  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  const dsImage = document.querySelector("#ds-image");
  const dsSources = {
    overview: ["assets/ds-overview.png", "MAPPA Design System 設計總覽"],
    states: ["assets/ds-states.png", "MAPPA 元件狀態規範"],
    accessibility: ["assets/ds-accessibility.png", "MAPPA 無障礙與文字規範"]
  };

  document.querySelectorAll("[data-ds]").forEach((button) => {
    button.addEventListener("click", () => {
      const [src, alt] = dsSources[button.dataset.ds];
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        dsImage.animate([{ opacity: .25, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 260, easing: "ease-out" });
      }
      dsImage.src = src;
      dsImage.alt = alt;
      document.querySelectorAll("[data-ds]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
    });
  });

  window.addEventListener("resize", fitCanvas);
  window.addEventListener("hashchange", () => goTo(indexFromHash()));
  fitCanvas();
  slides.forEach((slide) => slide.classList.remove("is-active"));
  goTo(current);
})();
