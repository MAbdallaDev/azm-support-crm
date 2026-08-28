#!/usr/bin/env node
/**
 * Fails the build on a directional Tailwind utility anywhere in src/.
 *
 * Run via `npm run check:rtl`, from CI, and from story 10's Arabic sweep.
 * A regex over the source text, not a linter plugin — zero new dependencies,
 * and precise enough for the exact class list the story names.
 *
 * The rule this enforces: `ms-*`/`me-*` never `ml-*`/`mr-*`, `ps-*`/`pe-*`
 * never `pl-*`/`pr-*`, `text-start`/`text-end` never `text-left`/`text-right`,
 * `start-*`/`end-*` never `left-*`/`right-*`. Held from story 06 onward, the
 * Arabic flip stays a translation pass instead of a per-margin audit.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

/**
 * Each pattern is anchored on a class-boundary — start of string, whitespace,
 * a quote or a backtick — so `text-left` cannot match inside a longer word
 * like `content-left-align`, and `left-` cannot match the tail of `flex-1`.
 */
const BOUNDARY = "(?<=^|[\\s\"'`{(\\[])";
const PATTERNS = [
  ["ml-", `${BOUNDARY}-?ml-`, "use ms-* (margin-inline-start)"],
  ["mr-", `${BOUNDARY}-?mr-`, "use me-* (margin-inline-end)"],
  ["pl-", `${BOUNDARY}-?pl-`, "use ps-* (padding-inline-start)"],
  ["pr-", `${BOUNDARY}-?pr-`, "use pe-* (padding-inline-end)"],
  ["text-left", `${BOUNDARY}text-left\\b`, "use text-start"],
  ["text-right", `${BOUNDARY}text-right\\b`, "use text-end"],
  ["left-", `${BOUNDARY}-?left-`, "use start-*"],
  ["right-", `${BOUNDARY}-?right-`, "use end-*"],
].map(([name, source, hint]) => ({ name, hint, re: new RegExp(source) }));

/** Escape hatch for a genuinely direction-fixed value, used sparingly. */
const ALLOW = "rtl-ok";

/**
 * Comments are stripped before matching.
 *
 * Prose says "left-to-right" and "right-hand column" constantly, and a guard
 * that cries wolf on English is a guard people start bypassing. Class names
 * never live in comments, so nothing real is lost.
 *
 * The scan is **stateful across lines**, because a JSX block comment
 * (`{/* ... *\/}`) puts its prose on continuation lines that begin with an
 * ordinary word — a per-line "does this start with a comment marker?" test
 * misses exactly those and flags the sentence inside them.
 */
const makeStripper = () => {
  let inBlock = false;

  return (line) => {
    let out = "";
    let i = 0;

    while (i < line.length) {
      if (inBlock) {
        const close = line.indexOf("*/", i);
        if (close === -1) return out;
        inBlock = false;
        i = close + 2;
        continue;
      }

      const lineComment = line.indexOf("//", i);
      const blockOpen = line.indexOf("/*", i);

      if (blockOpen !== -1 && (lineComment === -1 || blockOpen < lineComment)) {
        out += line.slice(i, blockOpen);
        inBlock = true;
        i = blockOpen + 2;
        continue;
      }
      if (lineComment !== -1) return out + line.slice(i, lineComment);

      return out + line.slice(i);
    }
    return out;
  };
};

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });

const findings = [];

for (const file of walk(SRC)) {
  // The guard is a string list; it would otherwise flag itself.
  if (file.endsWith("check-rtl.mjs")) continue;

  // One stripper per file: block-comment state must not leak between files.
  const stripComments = makeStripper();

  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (line.includes(ALLOW)) return;
      const code = stripComments(line);
      if (code.trim() === "") return;

      for (const { name, hint, re } of PATTERNS) {
        if (re.test(code)) {
          findings.push({
            file: relative(ROOT, file),
            line: index + 1,
            name,
            hint,
            text: line.trim(),
          });
        }
      }
    });
}

if (findings.length === 0) {
  console.log("check:rtl — no directional utilities in src/");
  process.exit(0);
}

console.error(`check:rtl — ${findings.length} directional utility/utilities found:\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.name}  → ${f.hint}`);
  console.error(`    ${f.text}\n`);
}
process.exit(1);
