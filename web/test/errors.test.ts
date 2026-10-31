import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { describeError, ERRORS } from "../src/errors";

const errorRs = readFileSync(new URL("../../core/src/error.rs", import.meta.url), "utf8");

/** The core's error variants, `Name = code,`, as [code, name]. */
const coreErrors = Array.from(errorRs.matchAll(/^\s+([A-Z][A-Za-z]+) = (\d+),$/gm), ([, name, code]) => [Number(code), name]);

describe("errors", () => {
  it("names every error code as the core does", () => {
    expect(Object.entries(ERRORS).map(([code, [name]]) => [Number(code), name])).toEqual(coreErrors);
  });

  it("describes a known code by its name and meaning", () => {
    expect(describeError(7)).toBe("error 7 (EventCount): the journal counts more than 2,700 events");
  });

  it("describes an unknown code by its number", () => {
    expect(describeError(99)).toBe("error 99");
  });
});
