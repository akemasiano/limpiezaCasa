"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function serviceWorker(overrides = {}) {
  const listeners = new Map();
  const self = {
    registration: { scope: "https://example.com/casa/" },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (name, handler) => listeners.set(name, handler),
    ...overrides.self,
  };
  const context = {
    self,
    URL,
    Request: class {
      constructor(url, options) {
        this.url = new URL(url, self.registration.scope).href;
        this.cache = options.cache;
      }
    },
    caches: overrides.caches,
    fetch: overrides.fetch,
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../sw.js"), "utf8"), context);
  return { listeners, self };
}

test("offline install bypasses HTTP cache for every app file", async () => {
  let files;
  const { listeners } = serviceWorker({
    caches: { open: async () => ({ addAll: async (requests) => { files = requests; } }) },
  });
  let installed;
  listeners.get("install")({ waitUntil: (promise) => { installed = promise; } });
  await installed;
  assert.ok(files.length > 0);
  assert.ok(files.every((file) => file.cache === "reload"));
  assert.ok(files.some((file) => file.url.endsWith("/casa/index.html")));
  assert.ok(files.some((file) => file.url.endsWith("/casa/app.js")));
});

test("waiting worker activates only on an explicit update message", async () => {
  let activations = 0;
  const { listeners } = serviceWorker({
    self: { skipWaiting: async () => { activations++; } },
  });
  const message = listeners.get("message");
  message({ data: null });
  message({ data: { type: "OTHER" } });
  assert.equal(activations, 0);
  let activated;
  message({ data: { type: "SKIP_WAITING" }, waitUntil: (promise) => { activated = promise; } });
  await activated;
  assert.equal(activations, 1);
});

test("failed download rejects installation without deleting existing caches", async () => {
  const deleted = [];
  const { listeners } = serviceWorker({
    caches: {
      open: async () => ({ addAll: async () => { throw new Error("Download failed"); } }),
      delete: async (name) => { deleted.push(name); },
    },
  });
  let installed;
  listeners.get("install")({ waitUntil: (promise) => { installed = promise; } });
  await assert.rejects(installed, /Download failed/);
  assert.deepEqual(deleted, []);
});

test("activation removes only obsolete Casa caches and claims open pages", async () => {
  const deleted = [];
  let current;
  let claimed = false;
  const { listeners } = serviceWorker({
    caches: {
      open: async (name) => { current = name; return { addAll: async () => {} }; },
      keys: async () => ["hello-pwa-old", current, "another-app-cache"],
      delete: async (name) => { deleted.push(name); },
    },
    self: { clients: { claim: async () => { claimed = true; } } },
  });
  let installed;
  listeners.get("install")({ waitUntil: (promise) => { installed = promise; } });
  await installed;
  let activated;
  listeners.get("activate")({ waitUntil: (promise) => { activated = promise; } });
  await activated;
  assert.deepEqual(deleted, ["hello-pwa-old"]);
  assert.equal(claimed, true);
});

test("cached navigation and assets remain available without a network", async () => {
  const response = { body: "cached app" };
  const { listeners } = serviceWorker({
    caches: { open: async () => ({ match: async () => response }) },
    fetch: async () => { throw new Error("Offline"); },
  });
  for (const mode of ["navigate", "cors"]) {
    let result;
    listeners.get("fetch")({
      request: { method: "GET", url: "https://example.com/casa/", mode },
      respondWith: (promise) => { result = promise; },
    });
    assert.equal(await result, response);
  }
});
