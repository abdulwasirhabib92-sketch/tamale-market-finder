/* City loader (external, CSP-safe). The Tamale config is loaded as a plain static tag.
   This file only matters on non-Tamale hosts, and never runs on the Tamale deployment. */
(function () {
  try {
    if (typeof CITY_CONFIG !== "undefined" && CITY_CONFIG && CITY_CONFIG.slug) {
      var host = location.hostname;
      if (host.indexOf("accra-market-finder") === -1 && host.indexOf("kumasi-market-finder") === -1) return;
    }
  } catch (e) {}
})();
