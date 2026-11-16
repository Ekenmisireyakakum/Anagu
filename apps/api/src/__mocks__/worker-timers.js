// Stub for worker-timers in Node.js test environment.
// mqtt's get-timer.js uses worker-timers only in browser context;
// in Node.js it falls back to native setInterval/clearInterval.
// We just need this module to load without error.
module.exports = {
  setInterval: (fn, delay) => setInterval(fn, delay),
  clearInterval: (id) => clearInterval(id),
  setTimeout: (fn, delay) => setTimeout(fn, delay),
  clearTimeout: (id) => clearTimeout(id),
};
