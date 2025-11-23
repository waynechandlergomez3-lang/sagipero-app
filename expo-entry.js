// Minimal shim to ensure `global.require` exists before Expo/AppEntry executes.
// Some native modules (or transformed code) try to access `global.require` very early
// which Hermes may not expose yet. This shim creates a safe alias and then delegates
// to the normal Expo entry point.
try {
  if (typeof globalThis.require === 'undefined' && typeof require !== 'undefined') {
    (globalThis).require = require;
  }
} catch (e) {
  // ignore — environment may not allow require here
}

module.exports = require('expo/AppEntry');
