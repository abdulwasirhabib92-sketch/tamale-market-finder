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
