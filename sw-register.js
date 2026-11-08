/* Service worker registration (external file so strict CSP does not block it). */
if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('sw.js')
                    .then(function(reg) {
                        console.log('SW registered:', reg.scope);
                    })
                    .catch(function(err) {
                        console.warn('SW registration failed:', err);
                    });
            });
        }
