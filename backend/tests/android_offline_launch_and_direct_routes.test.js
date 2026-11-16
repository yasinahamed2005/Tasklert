import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../../frontend/dist");
const swPath = path.join(distDir, "sw.js");

describe("Android Offline Launch & Direct Route Loading Suite", () => {
  it("Test 1: dist/sw.js is generated with Workbox injectManifest", () => {
    assert.ok(fs.existsSync(swPath), "dist/sw.js must exist after build");
    const content = fs.readFileSync(swPath, "utf-8");
    assert.ok(content.length > 1000, "sw.js must contain bundled Workbox code");
    assert.ok(content.includes("precache"), "sw.js must contain precache logic");
  });

  it("Test 2: Essential application shell chunks are precached (FocusTimerPage, Dashboard, etc.)", () => {
    const content = fs.readFileSync(swPath, "utf-8");

    // Verify key chunks are listed in precache manifest
    assert.ok(content.includes("FocusTimerPage"), "FocusTimerPage must be precached for /focus offline launch");
    assert.ok(content.includes("Dashboard"), "Dashboard must be precached for /dashboard");
    assert.ok(content.includes("CalendarPage"), "CalendarPage must be precached for /calendar");
    assert.ok(content.includes("PendingPage"), "PendingPage must be precached for /tasks (pending)");
    assert.ok(content.includes("CompletePage"), "CompletePage must be precached for /tasks (complete)");
    assert.ok(content.includes("AnalyticsPage"), "AnalyticsPage must be precached for /analytics");
    assert.ok(content.includes("index.html"), "index.html must be precached as core SPA shell");
    assert.ok(content.includes(".css"), "CSS stylesheets must be precached");
  });

  it("Test 3: Navigation fallback routing serves index.html for direct SPA paths (/focus, /dashboard, etc.)", () => {
    const content = fs.readFileSync(swPath, "utf-8");
    // Verify createHandlerBoundToURL and NavigationRoute are present
    assert.ok(
      content.includes("/index.html"),
      "sw.js must route SPA navigation requests to cached /index.html"
    );
    assert.ok(
      content.includes("/^\\/api\\//") || content.includes("/api/"),
      "sw.js must exclude /api/ routes from SPA navigation fallback"
    );
  });

  it("Test 4: Workbox catch handler provides Tasklert-branded offline fallback instead of ERR_FAILED", () => {
    const content = fs.readFileSync(swPath, "utf-8");
    assert.ok(
      content.includes("Tasklert - Offline Mode") || content.includes("You're Offline"),
      "sw.js must include branded offline fallback HTML preventing ERR_FAILED"
    );
    assert.ok(content.includes("#8B2CF5"), "sw.js offline fallback must preserve Tasklert purple branding");
  });

  it("Test 5: Vercel configuration routes SPA requests properly with correct headers", () => {
    const vercelConfigPath = path.resolve(__dirname, "../../frontend/vercel.json");
    assert.ok(fs.existsSync(vercelConfigPath));
    const config = JSON.parse(fs.readFileSync(vercelConfigPath, "utf-8"));

    // Verify rewrite exists
    assert.ok(Array.isArray(config.rewrites));
    const spaRewrite = config.rewrites.find((r) => r.destination === "/index.html");
    assert.ok(spaRewrite, "Vercel must have rewrite rule to /index.html");

    // Verify Service-Worker-Allowed header
    const swHeader = config.headers?.find((h) => h.source === "/sw.js");
    assert.ok(swHeader, "Vercel must specify sw.js headers");
    const allowedHeader = swHeader.headers?.find((hdr) => hdr.key === "Service-Worker-Allowed");
    assert.equal(allowedHeader?.value, "/", "Service-Worker-Allowed must be / for root scope");
  });

  it("Test 6: Offline chunk error handling in App.jsx never wipes caches while offline", () => {
    const appPath = path.resolve(__dirname, "../../frontend/src/App.jsx");
    const content = fs.readFileSync(appPath, "utf-8");

    // Verify navigator.onLine check prevents destructive cache wipe
    assert.ok(
      content.includes("!navigator.onLine"),
      "lazyWithRetry must check !navigator.onLine before attempting reload"
    );
    assert.ok(
      !content.includes("caches.delete(k)"),
      "lazyWithRetry must not delete all caches when a chunk fails offline"
    );
  });

  it("Test 7: scrollLock hook and Navbar safely guard against null dispatcher error", () => {
    const scrollLockPath = path.resolve(__dirname, "../../frontend/src/utils/scrollLock.js");
    const scrollContent = fs.readFileSync(scrollLockPath, "utf-8");
    assert.ok(scrollContent.includes("useBodyScrollLock"));
    assert.ok(scrollContent.includes("lockBodyScroll"));
    assert.ok(scrollContent.includes("unlockBodyScroll"));

    const navbarPath = path.resolve(__dirname, "../../frontend/src/components/Navbar.jsx");
    const navbarContent = fs.readFileSync(navbarPath, "utf-8");
    assert.ok(navbarContent.includes("lockBodyScroll()"));
    assert.ok(navbarContent.includes("unlockBodyScroll()"));
  });
});
