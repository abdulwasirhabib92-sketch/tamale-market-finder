// TMF menu guard + visible error reporter
// Loaded BEFORE app.js. The menu must work even if the main script fails.
(function () {
  "use strict";

  function el(id) { return document.getElementById(id); }

  function setDrawer(open) {
    var drawer = el("menuDrawer");
    var backdrop = el("drawerBackdrop");
    if (!drawer) return false;
    if (open) {
      var popup = el("spotlightPopupModal");
      if (popup) popup.style.display = "none";
    }
    drawer.classList.toggle("active", !!open);
    drawer.style.display = "flex";
    drawer.style.transform = open ? "translateX(0)" : "translateX(100%)";
    drawer.style.visibility = open ? "visible" : "hidden";
    drawer.style.zIndex = "100000";
    drawer.style.pointerEvents = "auto";
    if (backdrop) {
      backdrop.classList.toggle("active", !!open);
      backdrop.style.opacity = open ? "1" : "0";
      backdrop.style.pointerEvents = open ? "auto" : "none";
      backdrop.style.zIndex = "99999";
    }
    return true;
  }

  function toggleDrawer() {
    var drawer = el("menuDrawer");
    if (!drawer) return;
    setDrawer(!drawer.classList.contains("active"));
  }

  // Capture phase: owns the menu button completely, so a failing app.js or a
  // second listener can never cancel the toggle.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    if (t.closest("#menuToggle")) {
      e.preventDefault();
      e.stopPropagation();
      toggleDrawer();
      return;
    }
    if (t.closest("#closeDrawer")) {
      e.preventDefault();
      e.stopPropagation();
      setDrawer(false);
      return;
    }
    if (t.closest("#drawerBackdrop")) {
      setDrawer(false);
      return;
    }
    if (t.closest(".drawer-item") || t.closest(".drawer-nav a")) {
      var drawer = el("menuDrawer");
      if (drawer && drawer.classList.contains("active")) setDrawer(false);
    }
  }, true);

  // Expose for app.js so both paths agree
  window.tmfSetDrawer = setDrawer;
  window.tmfToggleDrawer = toggleDrawer;

  // Make any script error visible instead of silent
  window.addEventListener("error", function (ev) {
    try {
      if (el("tmfErrorBar")) return;
      var bar = document.createElement("div");
      bar.id = "tmfErrorBar";
      bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:200000;background:#B91C1C;color:#fff;font:12px/1.5 monospace;padding:8px 10px;max-height:40vh;overflow:auto";
      bar.textContent = "App error: " + (ev.message || "unknown") + " @ " + (ev.filename || "").split("/").pop() + ":" + (ev.lineno || 0);
      document.body.appendChild(bar);
    } catch (ignore) {}
  });
})();
