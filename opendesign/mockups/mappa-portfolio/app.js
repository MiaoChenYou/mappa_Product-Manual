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

  const sitemapDialog = dialogs.sitemap;
  const sitemapViewport = document.querySelector("#sitemap-viewport");
  const sitemapCanvas = document.querySelector("#sitemap-canvas");
  const sitemapZoomValue = document.querySelector("#sitemap-zoom-value");
  const sitemapMode = document.querySelector("#sitemap-mode");
  const sitemapTargetButtons = [...document.querySelectorAll("[data-map-target]")];
  const SITEMAP_WIDTH = 1920;
  const SITEMAP_HEIGHT = 1080;
  const sitemapState = {
    scale: 1,
    minScale: .2,
    maxScale: 2.4,
    x: 0,
    y: 0,
    pointers: new Map(),
    dragStart: null,
    pinchStart: null,
    animationTimer: null
  };

  const sitemapTargets = {
    entry: { x: 430, y: 360, label: "Landing 與登入" },
    home: { x: 1140, y: 430, label: "首頁與探索" },
    map: { x: 1570, y: 430, label: "地圖與地點" },
    record: { x: 320, y: 820, label: "快速紀錄" },
    profile: { x: 690, y: 820, label: "個人檔案" }
  };

  function clampSitemap(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampSitemapPan() {
    if (!sitemapViewport) return;
    const width = sitemapViewport.clientWidth;
    const height = sitemapViewport.clientHeight;
    const scaledWidth = SITEMAP_WIDTH * sitemapState.scale;
    const scaledHeight = SITEMAP_HEIGHT * sitemapState.scale;
    const edge = 56;

    sitemapState.x = scaledWidth <= width
      ? (width - scaledWidth) / 2
      : clampSitemap(sitemapState.x, width - scaledWidth - edge, edge);
    sitemapState.y = scaledHeight <= height
      ? (height - scaledHeight) / 2
      : clampSitemap(sitemapState.y, height - scaledHeight - edge, edge);
  }

  function renderSitemap(animate = false) {
    if (!sitemapCanvas) return;
    window.clearTimeout(sitemapState.animationTimer);
    sitemapCanvas.classList.toggle("is-animating", animate && !reduceMotion.matches);
    sitemapCanvas.style.transform = `translate3d(${sitemapState.x}px, ${sitemapState.y}px, 0) scale(${sitemapState.scale})`;
    if (sitemapZoomValue) sitemapZoomValue.textContent = Math.round(sitemapState.scale * 100) + "%";
    if (animate && !reduceMotion.matches) {
      sitemapState.animationTimer = window.setTimeout(() => sitemapCanvas.classList.remove("is-animating"), 300);
    }
  }

  function setSitemapMode(label, target = null) {
    if (sitemapMode) sitemapMode.textContent = label;
    sitemapTargetButtons.forEach((button) => {
      const active = button.dataset.mapTarget === target;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function fitSitemap(animate = false) {
    if (!sitemapViewport || !sitemapViewport.clientWidth || !sitemapViewport.clientHeight) return;
    const padding = sitemapViewport.clientWidth < 700 ? 18 : 42;
    const fitScale = Math.min(
      (sitemapViewport.clientWidth - padding * 2) / SITEMAP_WIDTH,
      (sitemapViewport.clientHeight - padding * 2) / SITEMAP_HEIGHT
    );
    sitemapState.minScale = Math.max(.12, fitScale);
    sitemapState.maxScale = Math.max(2.4, sitemapState.minScale * 4);
    sitemapState.scale = sitemapState.minScale;
    sitemapState.x = (sitemapViewport.clientWidth - SITEMAP_WIDTH * sitemapState.scale) / 2;
    sitemapState.y = (sitemapViewport.clientHeight - SITEMAP_HEIGHT * sitemapState.scale) / 2;
    setSitemapMode("全覽模式", "overview");
    renderSitemap(animate);
  }

  function sitemapPoint(clientX, clientY) {
    const rect = sitemapViewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function zoomSitemapAt(nextScale, clientX, clientY, animate = false) {
    if (!sitemapViewport) return;
    const rect = sitemapViewport.getBoundingClientRect();
    const point = Number.isFinite(clientX) && Number.isFinite(clientY)
      ? { x: clientX - rect.left, y: clientY - rect.top }
      : { x: rect.width / 2, y: rect.height / 2 };
    const imageX = (point.x - sitemapState.x) / sitemapState.scale;
    const imageY = (point.y - sitemapState.y) / sitemapState.scale;
    sitemapState.scale = clampSitemap(nextScale, sitemapState.minScale, sitemapState.maxScale);
    sitemapState.x = point.x - imageX * sitemapState.scale;
    sitemapState.y = point.y - imageY * sitemapState.scale;
    clampSitemapPan();
    renderSitemap(animate);
  }

  function focusSitemap(targetName) {
    if (targetName === "overview") {
      fitSitemap(true);
      return;
    }
    const target = sitemapTargets[targetName];
    if (!target || !sitemapViewport) return;
    const readableScale = sitemapViewport.clientWidth < 700 ? .9 : 1.05;
    sitemapState.scale = clampSitemap(
      Math.max(readableScale, sitemapState.minScale * 1.65),
      sitemapState.minScale,
      sitemapState.maxScale
    );
    sitemapState.x = sitemapViewport.clientWidth / 2 - target.x * sitemapState.scale;
    sitemapState.y = sitemapViewport.clientHeight / 2 - target.y * sitemapState.scale;
    clampSitemapPan();
    setSitemapMode(target.label, targetName);
    renderSitemap(true);
  }

  function beginSitemapPinch() {
    const points = [...sitemapState.pointers.values()].slice(0, 2);
    if (points.length < 2) return;
    const center = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };
    const localCenter = sitemapPoint(center.x, center.y);
    sitemapState.pinchStart = {
      distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
      scale: sitemapState.scale,
      imageX: (localCenter.x - sitemapState.x) / sitemapState.scale,
      imageY: (localCenter.y - sitemapState.y) / sitemapState.scale
    };
  }

  sitemapViewport?.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".sitemap-zoom-control")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    sitemapViewport.setPointerCapture(event.pointerId);
    sitemapState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    sitemapViewport.classList.add("is-dragging");
    sitemapCanvas.classList.remove("is-animating");

    if (sitemapState.pointers.size === 1) {
      sitemapState.dragStart = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        x: sitemapState.x,
        y: sitemapState.y
      };
    } else if (sitemapState.pointers.size === 2) {
      beginSitemapPinch();
    }
  });

  sitemapViewport?.addEventListener("pointermove", (event) => {
    if (!sitemapState.pointers.has(event.pointerId)) return;
    sitemapState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (sitemapState.pointers.size >= 2 && sitemapState.pinchStart) {
      const points = [...sitemapState.pointers.values()].slice(0, 2);
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const center = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2
      };
      const localCenter = sitemapPoint(center.x, center.y);
      sitemapState.scale = clampSitemap(
        sitemapState.pinchStart.scale * distance / Math.max(1, sitemapState.pinchStart.distance),
        sitemapState.minScale,
        sitemapState.maxScale
      );
      sitemapState.x = localCenter.x - sitemapState.pinchStart.imageX * sitemapState.scale;
      sitemapState.y = localCenter.y - sitemapState.pinchStart.imageY * sitemapState.scale;
    } else if (sitemapState.dragStart) {
      sitemapState.x = sitemapState.dragStart.x + event.clientX - sitemapState.dragStart.pointerX;
      sitemapState.y = sitemapState.dragStart.y + event.clientY - sitemapState.dragStart.pointerY;
    }

    clampSitemapPan();
    setSitemapMode("自由瀏覽");
    renderSitemap();
    event.preventDefault();
  });

  function endSitemapPointer(event) {
    if (!sitemapState.pointers.has(event.pointerId)) return;
    sitemapState.pointers.delete(event.pointerId);
    if (sitemapState.pointers.size === 1) {
      const [remaining] = sitemapState.pointers.values();
      sitemapState.dragStart = {
        pointerX: remaining.x,
        pointerY: remaining.y,
        x: sitemapState.x,
        y: sitemapState.y
      };
      sitemapState.pinchStart = null;
    } else if (sitemapState.pointers.size === 0) {
      sitemapState.dragStart = null;
      sitemapState.pinchStart = null;
      sitemapViewport.classList.remove("is-dragging");
    }
  }

  sitemapViewport?.addEventListener("pointerup", endSitemapPointer);
  sitemapViewport?.addEventListener("pointercancel", endSitemapPointer);

  sitemapViewport?.addEventListener("wheel", (event) => {
    if (event.target.closest(".sitemap-zoom-control")) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * .0014);
    zoomSitemapAt(sitemapState.scale * factor, event.clientX, event.clientY);
    setSitemapMode("自由瀏覽");
  }, { passive: false });

  sitemapViewport?.addEventListener("dblclick", (event) => {
    if (event.target.closest(".sitemap-zoom-control")) return;
    zoomSitemapAt(sitemapState.scale * 1.35, event.clientX, event.clientY, true);
    setSitemapMode("自由瀏覽");
  });

  sitemapViewport?.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomSitemapAt(sitemapState.scale * 1.2, undefined, undefined, true);
      setSitemapMode("自由瀏覽");
    } else if (event.key === "-") {
      event.preventDefault();
      zoomSitemapAt(sitemapState.scale / 1.2, undefined, undefined, true);
      setSitemapMode("自由瀏覽");
    } else if (event.key === "0") {
      event.preventDefault();
      fitSitemap(true);
    }
  });

  document.querySelectorAll("[data-sitemap-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.sitemapAction;
      if (action === "fit") {
        fitSitemap(true);
      } else {
        zoomSitemapAt(
          action === "zoom-in" ? sitemapState.scale * 1.22 : sitemapState.scale / 1.22,
          undefined,
          undefined,
          true
        );
        setSitemapMode("自由瀏覽");
      }
    });
  });

  sitemapTargetButtons.forEach((button) => {
    button.addEventListener("click", () => focusSitemap(button.dataset.mapTarget));
  });

  if (sitemapViewport && "ResizeObserver" in window) {
    new ResizeObserver(() => {
      if (sitemapDialog?.open) fitSitemap(false);
    }).observe(sitemapViewport);
  }

  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialog = dialogs[button.dataset.open];
      dialog?.showModal();
      if (button.dataset.open === "sitemap") {
        requestAnimationFrame(() => requestAnimationFrame(() => fitSitemap(false)));
      }
      if (button.dataset.open === "design-system") scheduleDsHotspots();
    });
  });

  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => dialog.close());
    });
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
