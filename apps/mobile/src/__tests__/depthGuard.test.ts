/// <reference types="node" />
import { describe, expect, it } from "@jest/globals";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Design guard: level-1 depth lives in the theme and reaches cards only through Surface (DESIGN.md section 6).
const SRC = join(__dirname, "..");

const BOX_SHADOW = /\bboxShadow\b/;
const LEGACY_SHADOW = /\bshadow(Color|Offset|Opacity|Radius)\b|\belevation\s*:/;
const DEPTH_TOKEN = /\bdepth\b/;

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => f.split("\\").join("/"));
}

const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;
const STRINGS = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

function code(text: string): string {
  return text.replace(COMMENTS, "").replace(STRINGS, '""');
}

function filesMatching(pattern: RegExp): string[] {
  return sourceFiles().filter((f) => pattern.test(readFileSync(join(SRC, f), "utf8")));
}

function filesWithCodeMatching(pattern: RegExp): string[] {
  return sourceFiles().filter((f) => pattern.test(code(readFileSync(join(SRC, f), "utf8"))));
}

describe("depth guard", () => {
  it("finds the source files to check", () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain("theme/index.ts");
    expect(files).toContain("components/Surface.tsx");
  });

  it("writes boxShadow only in the theme", () => {
    expect(filesMatching(BOX_SHADOW)).toEqual([
      "theme/index.ts",
    ]);
  });

  it("uses no other shadow or elevation properties", () => {
    expect(filesMatching(LEGACY_SHADOW)).toEqual([]);
  });

  it("uses the depth token only in the theme and Surface", () => {
    expect(filesWithCodeMatching(DEPTH_TOKEN)).toEqual(["components/Surface.tsx", "theme/index.ts"]);
  });

  it("detects the patterns", () => {
    expect(BOX_SHADOW.test("boxShadow: x")).toBe(true);
    expect(LEGACY_SHADOW.test("elevation: 2")).toBe(true);
    expect(DEPTH_TOKEN.test("...depth.level1")).toBe(true);
    expect(DEPTH_TOKEN.test('depth["level1"]')).toBe(true);
    expect(DEPTH_TOKEN.test("const { level1 } = depth")).toBe(true);
    expect(DEPTH_TOKEN.test("depthLevel")).toBe(false);
    expect(DEPTH_TOKEN.test(code("// level-1 depth"))).toBe(false);
    expect(DEPTH_TOKEN.test(code('"depth"'))).toBe(false);
    expect(DEPTH_TOKEN.test(code('import { depth } from "@/theme"'))).toBe(true);
    expect(DEPTH_TOKEN.test(code('depth["level1"]'))).toBe(true);
    expect(DEPTH_TOKEN.test(code("const { level1 } = depth"))).toBe(true);
    expect(DEPTH_TOKEN.test(code('import { depth as d } from "@/theme"'))).toBe(true);
    expect(BOX_SHADOW.test("depthLevel")).toBe(false);
    expect(LEGACY_SHADOW.test("depthLevel")).toBe(false);
  });
});
