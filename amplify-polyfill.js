// Polyfill for localStorage in Node.js environment
// This fixes the @typescript/vfs localStorage issue when running Amplify CLI

if (typeof global !== 'undefined') {
  // Only polyfill if localStorage doesn't exist or doesn't have getItem
  if (typeof global.localStorage === 'undefined' || typeof global.localStorage.getItem !== 'function') {
    const storage = new Map();
    
    global.localStorage = {
      getItem: (key) => {
        return storage.get(String(key)) || null;
      },
      setItem: (key, value) => {
        storage.set(String(key), String(value));
      },
      removeItem: (key) => {
        storage.delete(String(key));
      },
      clear: () => {
        storage.clear();
      },
      get length() {
        return storage.size;
      },
      key: (index) => {
        const keys = Array.from(storage.keys());
        return keys[index] || null;
      }
    };
  }
  
  // Also set on globalThis for ES modules
  if (typeof globalThis !== 'undefined') {
    globalThis.localStorage = global.localStorage;
  }
}

