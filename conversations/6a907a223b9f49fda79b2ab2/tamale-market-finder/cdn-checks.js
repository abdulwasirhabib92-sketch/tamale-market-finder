/* CDN Fallback Checks - External file to avoid CSP 'unsafe-inline' */
if (typeof L === 'undefined') { console.warn('Leaflet CDN failed - map features disabled'); }
if (typeof window.supabase === 'undefined') { console.warn('Supabase CDN failed - running in demo mode'); }
