import assert from "node:assert/strict";
import { test } from "node:test";
import { isSchemaCacheError } from "../src/lib/supabase-schema-helpers";

test("schema cache error detection: identifies PGRST204 column not found error", () => {
  const error = {
    code: "PGRST204",
    message: "Could not find the 'gender' column of 'patients' in the schema cache",
    details: null,
    hint: null,
  };

  assert.equal(isSchemaCacheError(error), true);
});

test("schema cache error detection: identifies Postgres 42703 undefined column error", () => {
  const error = {
    code: "42703",
    message: 'column "referring_physician" of relation "studies" does not exist',
  };

  assert.equal(isSchemaCacheError(error), true);
});

test("schema cache error detection: detects schema cache text in details or message", () => {
  const error = {
    message: "Failed query",
    details: "Relation patients column gender missing from schema cache",
  };

  assert.equal(isSchemaCacheError(error), true);
});

test("schema cache error detection: rejects non-schema errors", () => {
  const duplicateKeyError = {
    code: "23505",
    message: "duplicate key value violates unique constraint",
  };
  assert.equal(isSchemaCacheError(duplicateKeyError), false);

  const authError = {
    code: "401",
    message: "JWT expired",
  };
  assert.equal(isSchemaCacheError(authError), false);

  assert.equal(isSchemaCacheError(null), false);
  assert.equal(isSchemaCacheError(undefined), false);
});
