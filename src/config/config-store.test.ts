import assert from "node:assert/strict";
import { test } from "node:test";
import { migrateConfig } from "./config-store.js";

test("migrateConfig keeps a legacy local login in the local profile", () => {
  const config = migrateConfig({
    apiUrl: "http://localhost:3000",
    accessToken: "local-token",
  });

  assert.equal(config.activeProfile, "local");
  assert.deepEqual(config.profiles.local, {
    apiUrl: "http://localhost:3000",
    accessToken: "local-token",
  });
});

test("migrateConfig preserves independent production and local profiles", () => {
  const config = migrateConfig({
    schemaVersion: 2,
    activeProfile: "production",
    profiles: {
      local: { apiUrl: "http://localhost:3000", accessToken: "local-token" },
      production: { apiUrl: "https://api.shineo.app", accessToken: "production-token" },
    },
  });

  assert.equal(config.activeProfile, "production");
  assert.equal(config.profiles.local.accessToken, "local-token");
  assert.equal(config.profiles.production.accessToken, "production-token");
});
