#!/usr/bin/env node
/**
 * Fails the build on an i18n key mismatch between `en.json` and `ar.json`.
 *
 * Run via `npm run check:i18n`, from CI, and before story 10's Arabic sweep —
 * run it *before* the manual walk, not after, so the walk is spent on visual
 * and layout bugs rather than on keys this script catches for free.
 *
 * Both directions matter: a key in `en.json` missing from `ar.json` renders as
 * a raw key string under Arabic; a key in `ar.json` with no `en.json`
 * counterpart is a translation nobody's English copy defines, and it drifts
 * the same way in reverse the next time someone edits the English file and
 * has nothing telling them the Arabic one still has it.
 *
 * Line-count parity (both files happen to be the same length) is not key
 * parity — two files can match in line count while disagreeing on every key.
 * This flattens both to dotted paths and diffs the actual sets.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EN_PATH = join(ROOT, "src/i18n/en.json");
const AR_PATH = join(ROOT, "src/i18n/ar.json");

/** Every leaf key in a nested translation object, as dotted paths. */
const flatten = (obj, prefix = "") => {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.push(...flatten(value, path));
    } else {
      out.push(path);
    }
  }
  return out;
};

const en = JSON.parse(readFileSync(EN_PATH, "utf8"));
const ar = JSON.parse(readFileSync(AR_PATH, "utf8"));

const enKeys = new Set(flatten(en));
const arKeys = new Set(flatten(ar));

const missingInAr = [...enKeys].filter((key) => !arKeys.has(key)).sort();
const missingInEn = [...arKeys].filter((key) => !enKeys.has(key)).sort();

if (missingInAr.length === 0 && missingInEn.length === 0) {
  console.log(`check:i18n — ${enKeys.size} keys, en.json and ar.json in parity`);
  process.exit(0);
}

console.error("check:i18n — key parity failure:\n");
if (missingInAr.length > 0) {
  console.error(`  In en.json but missing from ar.json (${missingInAr.length}):`);
  for (const key of missingInAr) console.error(`    - ${key}`);
}
if (missingInEn.length > 0) {
  console.error(`  In ar.json but missing from en.json (${missingInEn.length}):`);
  for (const key of missingInEn) console.error(`    - ${key}`);
}
process.exit(1);
