/**
 * Cache buster utility to ensure clients use the latest code version
 * Helps prevent issues with cached JavaScript that might call deprecated functions
 */

// Current app version - increment this when making breaking changes
export const APP_VERSION = '1.0.3';
const APP_VERSION_KEY = 'addon_app_version';
const LAST_RELOAD_KEY = 'addon_last_reload';
const RELOAD_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Legacy code patterns to detect
const LEGACY_CODE_PATTERNS = [
  { pattern: 'create_order_with_items', description: 'Legacy RPC function call for orders' },
  { pattern: 'product_code', description: 'Reference to removed product_code column' }
];

/**
 * Force reload the page if cached version is detected
 * Call this on app initialization
 */
export function initCacheBuster() {
  // Add cache-control meta tags
  const cacheControlMeta = document.createElement('meta');
  cacheControlMeta.httpEquiv = 'Cache-Control';

  // Check if we have a stored version and if it matches
  const storedVersion = localStorage.getItem(APP_VERSION_KEY);
  
  // Add meta tags to prevent caching
  addNoCacheMeta();

  // Periodic forced reload to clear caches (once per day)
  const lastReload = localStorage.getItem(LAST_RELOAD_KEY);
  const now = Date.now();
  if (!lastReload || (now - parseInt(lastReload)) > RELOAD_INTERVAL) {
    console.log('Periodic cache clearing reload triggered');
    localStorage.setItem(LAST_RELOAD_KEY, now.toString());
    clearCaches();
    forceReload();
    return;
  }
  
  if (storedVersion !== APP_VERSION) {
    console.warn(`Version mismatch: Stored v${storedVersion} vs Current v${APP_VERSION}`);
    // Store the new version
    localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
    // Force a hard reload to clear cache
    clearCaches();
    forceReload();
  }
  
  // Add legacy code detection
  detectLegacyCode();
}

/**
 * Detect legacy code patterns in the currently executing code
 */
export function detectLegacyCode() {
  // We'll examine the document's scripts and function definitions to detect legacy patterns
  setTimeout(() => {
    try {
      // Get all <script> elements
      const scriptElements = document.getElementsByTagName('script');
      
      // Convert to array and check each for legacy patterns
      const scripts = Array.from(scriptElements);
      
      let legacyCodeDetected = false;
      
      // Function to check if script content contains legacy patterns
      const checkForLegacyPatterns = (content: string) => {
        for (const pattern of LEGACY_CODE_PATTERNS) {
          if (content.includes(pattern.pattern)) {
            console.error(`CRITICAL: Detected legacy code pattern: ${pattern.description}`);
            legacyCodeDetected = true;
          }
        }
      };
      
      // Check inline scripts
      scripts.forEach(script => {
        if (script.textContent) {
          checkForLegacyPatterns(script.textContent);
        }
      });
      
      // Also check for any functions that might contain these patterns
      // This is an imperfect heuristic but can help detect legacy code
      if (window.hasOwnProperty('handleCheckout')) {
        // @ts-ignore - Dynamic property check
        const checkoutFn = window['handleCheckout']?.toString() || '';
        checkForLegacyPatterns(checkoutFn);
      }
      
      // If legacy code is detected, force a reload
      if (legacyCodeDetected) {
        console.error('CRITICAL: Legacy code detected! Forcing reload to use latest version.');
        clearCaches();
        forceReload();
      }
    } catch (e) {
      console.error('Error checking for legacy code:', e);
    }
  }, 2000); // Check after 2 seconds to allow scripts to load
}

/**
 * Add no-cache meta tags to prevent browser caching
 */
function addNoCacheMeta() {
  const metaTags = [
    { httpEquiv: 'Cache-Control', content: 'no-cache, no-store, must-revalidate' },
    { httpEquiv: 'Pragma', content: 'no-cache' },
    { httpEquiv: 'Expires', content: '0' }
  ];
  
  metaTags.forEach(tag => {
    // Check if meta tag already exists
    const existing = document.querySelector(`meta[http-equiv="${tag.httpEquiv}"]`);
    if (!existing) {
      const meta = document.createElement('meta');
      meta.httpEquiv = tag.httpEquiv;
      meta.content = tag.content;
      document.head.appendChild(meta);
    }
  });
}

/**
 * Clear all caches
 */
export function clearCaches() {
  try {
    // Clear localStorage cart-related data and cached data
    Object.keys(localStorage).forEach(key => {
      if (key.includes('cart') || key.includes('Cache') || key.includes('cache')) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear application cache if available
    if ('caches' in window) {
      caches.keys().then((keyList) => {
        return Promise.all(keyList.map((key) => {
          return caches.delete(key);
        }));
      });
    }
    
    // Clear service workers
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
  } catch (e) {
    console.error('Error clearing cache:', e);
  }
}

/**
 * Force a hard reload with cache busting parameter
 */
export function forceReload() {
  // Pointing to location.href with cache parameter instead of using reload(true) which is deprecated
  window.location.href = cacheBustUrl(window.location.href);
}

/**
 * Helper to add cache busting parameter to a URL
 */
export function cacheBustUrl(url: string): string {
  const urlObj = new URL(url, window.location.origin);
  urlObj.searchParams.set('_bust', Date.now().toString());
  return urlObj.toString();
}
