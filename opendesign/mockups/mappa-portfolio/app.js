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
  const coverScreens = [...document.querySelectorAll(".phone-screen")];
  const coverDots = [...document.querySelectorAll(".phone-carousel-status span")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let coverScreenIndex = 0;
  let coverTimer = null;

  function showCoverScreen(index) {
    if (!coverScreens.length) return;
    coverScreenIndex = (index + coverScreens.length) % coverScreens.length;
    coverScreens.forEach((screen, i) => {
      const active = i === coverScreenIndex;
      screen.classList.toggle("is-current", active);
      screen.setAttribute("aria-hidden", active ? "false" : "true");
    });
    coverDots.forEach((dot, i) => dot.classList.toggle("is-current", i === coverScreenIndex));
  }

  function syncCoverCarousel() {
    window.clearInterval(coverTimer);
    coverTimer = null;
    if (current !== 0 || reduceMotion.matches || coverScreens.length < 2) return;
    coverTimer = window.setInterval(() => showCoverScreen(coverScreenIndex + 1), 2000);
  }

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
    syncCoverCarousel();
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
    button.addEventListener("click", () => {
      const dialog = dialogs[button.dataset.open];
      dialog?.showModal();
      if (button.dataset.open === "design-system") scheduleDsHotspots();
    });
  });

  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  const dsImage = document.querySelector("#ds-image");
  const dsStage = document.querySelector(".ds-stage");
  const dsTabs = document.querySelector(".ds-tabs");
  const dsIndicator = document.querySelector(".ds-tab-indicator");

  function updateDsIndicator() {
    const activeTab = document.querySelector(".ds-tab.is-active");
    if (!activeTab || !dsIndicator) return;
    dsIndicator.style.width = Math.max(0, activeTab.offsetWidth - 6) + "px";
    dsIndicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
  }

  function positionDsHotspots() {
    if (!dsImage || !dsStage) return;
    const stageRect = dsStage.getBoundingClientRect();
    const imageRect = dsImage.getBoundingClientRect();
    const mobileReadingMode = window.matchMedia("(max-width: 760px)").matches;
    const scale = mobileReadingMode
      ? imageRect.width / 1920
      : Math.min(imageRect.width / 1920, imageRect.height / 1080);
    const renderedWidth = 1920 * scale;
    const renderedHeight = 1080 * scale;
    const offsetX = imageRect.left - stageRect.left + (mobileReadingMode ? 0 : (imageRect.width - renderedWidth) / 2);
    const offsetY = imageRect.top - stageRect.top + (mobileReadingMode ? 0 : (imageRect.height - renderedHeight) / 2);
    document.querySelectorAll(".ds-hotspot").forEach((button) => {
      button.style.left = (offsetX + Number(button.dataset.x) * scale) + "px";
      button.style.top = (offsetY + Number(button.dataset.y) * scale) + "px";
      button.style.width = (Number(button.dataset.width) * scale) + "px";
      button.style.height = (Number(button.dataset.height) * scale) + "px";
    });
    if (dsTabs) {
      dsTabs.style.left = (offsetX + Number(dsTabs.dataset.x) * scale) + "px";
      dsTabs.style.top = (offsetY + Number(dsTabs.dataset.y) * scale) + "px";
      dsTabs.style.transform = `scale(${scale})`;
    }
    updateDsIndicator();
  }

  function scheduleDsHotspots() {
    requestAnimationFrame(() => requestAnimationFrame(positionDsHotspots));
    window.setTimeout(positionDsHotspots, 100);
    window.setTimeout(positionDsHotspots, 260);
  }

  dsImage?.addEventListener("load", scheduleDsHotspots);
  if (dsStage && "ResizeObserver" in window) {
    new ResizeObserver(scheduleDsHotspots).observe(dsStage);
  }

  const dsSources = {
    overview: ["assets/ds-overview.png", "MAPPA Design System 設計總覽"],
    states: ["assets/ds-states.png", "MAPPA 元件狀態規範"],
    accessibility: ["assets/ds-accessibility.png", "MAPPA 無障礙與文字規範"]
  };

  let dsSwitchToken = 0;

  async function switchDsImage(button) {
    const [src, alt] = dsSources[button.dataset.ds];
    const tabs = document.querySelectorAll(".ds-tab[data-ds]");
    tabs.forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    updateDsIndicator();

    if (dsImage.getAttribute("src") === src) return;

    const token = ++dsSwitchToken;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    dsImage.getAnimations().forEach((animation) => animation.cancel());

    if (reducedMotion) {
      dsImage.src = src;
      dsImage.alt = alt;
      scheduleDsHotspots();
      return;
    }

    const currentOpacity = Number.parseFloat(getComputedStyle(dsImage).opacity) || 1;
    const fadeOut = dsImage.animate(
      [{ opacity: currentOpacity }, { opacity: 0 }],
      { duration: 90, easing: "cubic-bezier(.2, .72, .2, 1)", fill: "forwards" }
    );
    await fadeOut.finished.catch(() => {});
    if (token !== dsSwitchToken) return;

    dsImage.style.opacity = "0";
    fadeOut.cancel();
    dsImage.src = src;
    dsImage.alt = alt;
    await dsImage.decode?.().catch(() => {});
    if (token !== dsSwitchToken) return;

    scheduleDsHotspots();
    const fadeIn = dsImage.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 150, easing: "cubic-bezier(.2, .72, .2, 1)", fill: "forwards" }
    );
    await fadeIn.finished.catch(() => {});
    if (token === dsSwitchToken) {
      dsImage.style.removeProperty("opacity");
      fadeIn.cancel();
    }
  }

  document.querySelectorAll(".ds-tab[data-ds]").forEach((button) => {
    button.addEventListener("click", () => switchDsImage(button));
  });

  window.addEventListener("resize", () => { fitCanvas(); scheduleDsHotspots(); });
  reduceMotion.addEventListener?.("change", syncCoverCarousel);
  window.addEventListener("hashchange", () => goTo(indexFromHash()));
  fitCanvas();
  slides.forEach((slide) => slide.classList.remove("is-active"));
  goTo(current);
})();
