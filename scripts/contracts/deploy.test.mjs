import assert from "node:assert/strict";
import { test } from "node:test";
import { assertDeployerKey } from "./deploy.mjs";

test("a malformed DEPLOYER_KEY is refused without quoting it", () => {
  const key = `0x${"ab".repeat(31)}c\r`;
  assert.throws(
    () => assertDeployerKey(key, "nitro-devnode"),
    (error) => /0x and 64 hex digits/.test(error.message) && !error.message.includes(key.slice(2, 20)),
  );
});
