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
// DESIGN.md section 6: only the dialog shadow exists for depth and layers use --z-* tokens.
// Sections 6 and 10: the admin theme has no opacity, duration, delay, easing or aspect-ratio
// tokens, so those utilities are forbidden in every form.
const TOKEN_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /(?<![\w-])(?:(?:drop|inset|text)-shadow(?:-[\w(]|(?![\w/-]))|shadow-(?!dialog(?![\w/-]))[\w(])[^\s"'`]*/,
    "shadow outside the dialog token",
  ],
  [/(?<![\w-])-?z-(?:\d|\((?!--z-))[^\s"'`]*/, "z-index outside the layer tokens"],
  [/(?<![\w-])(?:backdrop-)?opacity-[\w(][^\s"'`]*/, "opacity utility (no opacity token)"],
  [/(?<![\w-])(?:duration|delay)-[\w(][^\s"'`]*/, "duration or delay utility (no motion token)"],
  [/(?<![\w-])ease-[\w(][^\s"'`]*/, "easing utility (no easing token)"],
  [/(?<![\w-])aspect-[\w(][^\s"'`]*/, "aspect ratio utility (no aspect token)"],
];

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
  for (const [rule, reason] of TOKEN_RULES) {
    const match = rule.exec(text);
    if (match) found.push(`${file}: ${reason} ${match[0]}`);
  }
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

  it("detects utilities outside the depth, layer and motion tokens", () => {
    const flagged = [
      "shadow-md",
      "shadow-ink",
      "hover:shadow-md",
      "shadow-dialog/50",
      "drop-shadow",
      "hover:drop-shadow",
      "drop-shadow-sm",
      "inset-shadow-xs",
      "text-shadow-lg",
      "z-10",
      "-z-10",
      "md:z-50",
      "z-(--layer)",
      "opacity-50",
      "backdrop-opacity-50",
      "opacity-(--fade)",
      "duration-200",
      "delay-100",
      "ease-linear",
      "ease-in-out",
      "aspect-square",
      "aspect-3/4",
    ];
    for (const c of flagged) {
      expect(violations("x", `className="${c}"`), c).not.toEqual([]);
    }

    const allowed = [
      'className="shadow-dialog"',
      'className="z-(--z-overlay)"',
      'className="z-(--z-toast)"',
      'className="z-auto"',
      'className="fixed inset-0 z-(--z-overlay) grid place-items-center overflow-y-auto bg-scrim p-16"',
      'className="relative flex w-dialog max-w-full flex-col rounded-18 bg-surface shadow-dialog"',
      'const css = "z-index"',
      'className="foo-shadow-md"',
      'className="size-z-10"',
    ];
    for (const s of allowed) {
      expect(violations("x", s), s).toEqual([]);
    }

    expect(violations("x", 'className="z-10"')).toEqual([
      "x: z-index outside the layer tokens z-10",
    ]);
    expect(violations("x", 'className="shadow-md"')).toEqual([
      "x: shadow outside the dialog token shadow-md",
    ]);
    expect(violations("x", 'className="aspect-3/4"')).toEqual([
      "x: aspect ratio utility (no aspect token) aspect-3/4",
    ]);
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
