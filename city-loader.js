/* City loader (external file, so the strict CSP never blocks it).
   All three city configs are loaded as plain scripts; this picks the right one
   for the hostname and exposes it as the global CITY_CONFIG that app.js reads. */
(function () {
  var host = (location.hostname || "").toLowerCase();
  var pick = window.__CITY_CFG_TAMALE;

  if (host.indexOf("accra-market-finder") !== -1 && window.__CITY_CFG_ACCRA) {
    pick = window.__CITY_CFG_ACCRA;
  } else if (host.indexOf("kumasi-market-finder") !== -1 && window.__CITY_CFG_KUMASI) {
    pick = window.__CITY_CFG_KUMASI;
  }

  // allow ?city=accra for previews and the GitHub Pages mirror
  try {
    var q = new URLSearchParams(location.search).get("city");
    if (q === "accra" && window.__CITY_CFG_ACCRA) pick = window.__CITY_CFG_ACCRA;
    if (q === "kumasi" && window.__CITY_CFG_KUMASI) pick = window.__CITY_CFG_KUMASI;
    if (q === "tamale" && window.__CITY_CFG_TAMALE) pick = window.__CITY_CFG_TAMALE;
  } catch (e) { /* URLSearchParams unavailable: hostname choice still stands */ }

  window.CITY_CONFIG = pick;
})();

/* Per-host canonical + social URL, so each city is indexed as its own site
   instead of every city telling Google it is really the Tamale domain. */
(function () {
  try {
    var host = (location.hostname || "").toLowerCase();
    if (!host || host === "localhost" || host === "127.0.0.1") return;
    var canonical = location.origin + location.pathname;
    var link = document.querySelector('link[rel="canonical"]');
    if (link) link.setAttribute("href", canonical);
    var og = document.querySelector('meta[property="og:url"]');
    if (og) og.setAttribute("content", canonical);
  } catch (e) {}
})();

/* Local development only: load the demo fixtures when running on localhost. */
(function () {
  try {
    var h = (location.hostname || "").toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) {
      var s = document.createElement("script");
      s.src = "/dev-demo.js";
      document.head.appendChild(s);
    }
  } catch (e) {}
})();
