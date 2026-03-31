/**
 * Certain bundled SDK providers (e.g. Ekubo) hold a bare reference to `fetch`
 * extracted from the window/global scope. When called as a plain function that
 * reference loses its `this` binding, causing "Illegal invocation" at runtime.
 *
 * Rebinding `globalThis.fetch` to itself is safe and idempotent — native fetch
 * already IS window.fetch, we're just ensuring the bound receiver is locked in
 * before any provider code can snapshot it.
 */
if (typeof globalThis.fetch === "function") {
  // eslint-disable-next-line no-self-assign
  globalThis.fetch = globalThis.fetch.bind(globalThis);
}
