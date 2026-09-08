/* Library load diagnostics - self-hosted vendor libs */
if (typeof L === 'undefined') { console.warn('Leaflet failed to load - map features disabled'); }
if (typeof window.supabase === 'undefined') { console.warn('Supabase JS failed to load - running in demo mode'); }
