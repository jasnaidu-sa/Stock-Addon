import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';
// Import cache-busting utilities
import { initCacheBuster, clearCaches, forceReload, APP_VERSION } from './lib/cache-buster';

// EMERGENCY CACHE BREAKING - v1.2.0 (2023-07-17)
const APP_BUILD_TIMESTAMP = '2023-07-17-1217';
console.log(`Initializing app version: ${APP_VERSION}`);
const STORED_BUILD_KEY = 'addon_app_build';

// Compare build timestamp with stored value
const storedBuild = localStorage.getItem(STORED_BUILD_KEY);
if (storedBuild !== APP_BUILD_TIMESTAMP) {
  console.log(`%cNEW BUILD DETECTED: ${APP_BUILD_TIMESTAMP} vs stored ${storedBuild}`, 'color: red; font-weight: bold');
  
  // Store new build timestamp
  localStorage.setItem(STORED_BUILD_KEY, APP_BUILD_TIMESTAMP);
  
  // Show notification about update
  if (storedBuild) { // Only show if not first visit
    alert('A new version of the application is available. The page will now refresh to update.');
  }
  
  // Force extreme cache clearing
  const wipeALL = () => {
    try {
      // Clear all localStorage
      localStorage.clear();
      sessionStorage.clear();
      
      // Set the build timestamp again (we just cleared it)
      localStorage.setItem(STORED_BUILD_KEY, APP_BUILD_TIMESTAMP);
      
      // Mark that we've forced a reload
      localStorage.setItem('addon_force_reload_applied', 'true');
      
      // Clear application cache API if available
      if ('caches' in window) {
        caches.keys().then(keyList => Promise.all(keyList.map(key => caches.delete(key))));
      }
      
      // Clear service workers
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
      
      // Apply very aggressive cache-busting URL parameter
      const url = new URL(window.location.href);
      url.searchParams.set('_forcecachebust', Date.now().toString());
      url.searchParams.set('_build', APP_BUILD_TIMESTAMP);
      window.location.href = url.toString();
    } catch (e) {
      console.error('Failed to wipe cache:', e);
      // Last resort - reload with no-cache pragma
      window.location.href = window.location.href + 
        (window.location.href.includes('?') ? '&' : '?') + 
        '_nocache=' + Date.now();
    }
    return false;
  };
  
  // Execute the cache wipe
  wipeALL();
  // Prevent further execution
  throw new Error('STOPPING EXECUTION FOR CACHE REFRESH');
}

// Initialize standard cache buster
initCacheBuster();

// Block old RPC calls if they somehow get through
const blockRPCCalls = () => {
  // @ts-ignore - Access window.supabase which might be set globally
  if (window.supabase && typeof window.supabase?.rpc === 'function') {
    // @ts-ignore
    const originalRpc = window.supabase.rpc;
    // @ts-ignore
    window.supabase.rpc = function(fnName, ...args) {
      if (fnName === 'create_order_with_items') {
        console.error('%cBLOCKED legacy RPC call to create_order_with_items!', 'color: red; font-size: 20px; font-weight: bold');
        alert('Detected outdated code. The page will refresh to update to the latest version.');
        clearCaches();
        forceReload();
        throw new Error('Legacy RPC call blocked');
      }
      // @ts-ignore
      return originalRpc.call(this, fnName, ...args);
    };
    console.log('Installed RPC call interceptor');
  }
};

// Install the RPC blocker
setTimeout(blockRPCCalls, 1000);

// Get Clerk publishable key with better error handling
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Enhanced error handling for Clerk key issues
if (!PUBLISHABLE_KEY) {
  console.error("ERROR: Missing Clerk Publishable Key in environment variables");
  // Display a user-friendly error message
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e53e3e;">Authentication Configuration Error</h2>
        <p>The application couldn't initialize because the authentication service is not properly configured.</p>
        <p><strong>Error:</strong> Missing Clerk Publishable Key</p>
        <div style="margin-top: 20px; padding: 15px; background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
          <h4 style="margin-top: 0;">Developer Information:</h4>
          <p>Please ensure your <code>.env.local</code> file contains a valid <code>VITE_CLERK_PUBLISHABLE_KEY</code>.</p>
          <p>If you're seeing 401 Unauthorized errors, your key may be expired or invalid. Check your Clerk dashboard for the correct key.</p>
        </div>
      </div>
    `;
  }
  throw new Error("Missing Clerk Publishable Key");
}

// Debug info for Clerk key
console.log(`Clerk key format check: ${PUBLISHABLE_KEY.substring(0, 8)}...${PUBLISHABLE_KEY.substring(PUBLISHABLE_KEY.length - 4)}`);
console.log(`Clerk key length: ${PUBLISHABLE_KEY.length} characters`);

// Check if key appears to be base64 encoded (common format)
if (!/^pk_(test|live)_[A-Za-z0-9+/=]+$/.test(PUBLISHABLE_KEY)) {
  console.warn("Warning: Clerk publishable key may not be in the correct format");
}



// Wrapper component to use useNavigate hook
const ClerkProviderWithNavigate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      routerPush={(to: string) => navigate(to)}
      routerReplace={(to: string) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkProviderWithNavigate>
        <App />
      </ClerkProviderWithNavigate>
    </BrowserRouter>
  </StrictMode>
);