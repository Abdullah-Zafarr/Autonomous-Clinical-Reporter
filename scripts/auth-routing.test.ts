import assert from "node:assert/strict";
import { test } from "node:test";
import { loginDestination, resolveRole } from "../src/lib/auth-role";

test("administrators land on the admin panel after role resolution", () => {
  assert.equal(loginDestination(resolveRole("admin", [])), "/admin");
  assert.equal(loginDestination(resolveRole(null, [{ role: "admin" }])), "/admin");
});

test("clinical roles retain the clinical workspace as their login destination", () => {
  for (const role of ["doctor", "radiologist", "sonographer"] as const) {
    assert.equal(loginDestination(role), "/");
  }
});

test("a stale admin role row cannot override an authoritative profile demotion", () => {
  assert.equal(loginDestination(resolveRole("doctor", [{ role: "admin" }])), "/");
  assert.equal(loginDestination(resolveRole(null, [])), "/");
});
