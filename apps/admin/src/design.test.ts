import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Design guard: every design value lives in src/styles/index.css (@theme).
const SRC = dirname(fileURLToPath(import.meta.url));

// DESIGN.md section 5 spacing scale.
const SCALE = new Set([0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64]);

const SIZE_UTILITIES = [
  "gap-x", "gap-y", "gap", "min-w", "min-h", "max-w", "max-h", "inset",
  "size", "top", "right", "bottom", "left",
  "px", "py", "pt", "pr", "pb", "pl", "p",
  "mx", "my", "mt", "mr", "mb", "ml", "m",
  "w", "h",
].join("|");
const NUMERIC_UTILITY = new RegExp(
  `(?<![\\w-])-?(?:${SIZE_UTILITIES})-(\\d+(?:\\.\\d+)?)(?![\\w./-])`,
  "g",
);
const NAMED_SIZE = new RegExp(
  `(?<![\\w-])-?(?:${SIZE_UTILITIES})-(?:xs|sm|md|lg|xl|\\d+xl)(?![\\w-])`,
);
const LINE_UTILITY = /(?<![\w-])(?:border|outline|ring)(?:-[trblxy])?-\d/;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const COLOR_FUNCTION = /\b(?:rgba?|hsla?)\(/;
const STYLE_PROP = /\bstyle=/;
const ARBITRARY_VALUE = /[\w:-]-\[/;

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f))
    .map((f) => join(SRC, f));
}

function violations(file: string, text: string): string[] {
  const found: string[] = [];
  if (HEX.test(text)) found.push(`${file}: hex colour`);
  if (COLOR_FUNCTION.test(text)) found.push(`${file}: colour function`);
  if (STYLE_PROP.test(text)) found.push(`${file}: style prop`);
  if (ARBITRARY_VALUE.test(text)) found.push(`${file}: arbitrary value`);
  if (NAMED_SIZE.test(text)) found.push(`${file}: named size`);
  if (LINE_UTILITY.test(text)) found.push(`${file}: border, outline or ring width`);
  for (const match of text.matchAll(NUMERIC_UTILITY)) {
    const n = Number(match[1]);
    if (!SCALE.has(n)) found.push(`${file}: off-scale size ${match[0]}`);
  }
  return found;
}

describe("design guard", () => {
  it("finds source files to check", () => {
    expect(sourceFiles().length).toBeGreaterThan(0);
  });

  it("source files hold no values outside the design system", () => {
    const all = sourceFiles().flatMap((file) =>
      violations(file, readFileSync(file, "utf8")),
    );
    expect(all).toEqual([]);
  });

  it("detects raw values", () => {
    expect(violations("x", 'className="p-5"')).not.toEqual([]);
    expect(violations("x", 'className="p-12"')).toEqual([]);
    expect(violations("x", 'const c = "#fff"')).not.toEqual([]);
    expect(violations("x", 'className="w-[13px]"')).not.toEqual([]);
    expect(violations("x", 'className="max-w-md"')).not.toEqual([]);
    expect(violations("x", 'className="border-3"')).not.toEqual([]);
    expect(violations("x", 'className="w-3/5 inset-0"')).toEqual([]);
    expect(violations("x", "<p style={{}} />")).not.toEqual([]);
  });

  it("keeps hex and rgba in the stylesheet inside @theme", () => {
    const css = readFileSync(join(SRC, "styles", "index.css"), "utf8");
    const start = css.indexOf("@theme");
    const open = css.indexOf("{", start);
    let depth = 0;
    let end = open;
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth++;
      if (css[i] === "}" && --depth === 0) {
        end = i;
        break;
      }
    }
    const outside = start === -1 ? css : css.slice(0, start) + css.slice(end + 1);
    expect(HEX.test(outside) || COLOR_FUNCTION.test(outside)).toBe(false);
  });
});
