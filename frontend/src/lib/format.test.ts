import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/i18n";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("format", () => {
  it("keeps numerals Western in Arabic", async () => {
    await i18n.changeLanguage("ar");

    // Intl with a bare "ar" locale renders ٤٧٩٦. The design uses 0–9 in both
    // languages, so the numbering system is pinned even though the locale is not.
    expect(formatNumber(4796)).toBe("4,796");
    expect(formatDate("2026-08-27T10:00:00Z")).toMatch(/\d/);
    expect(formatDate("2026-08-27T10:00:00Z")).not.toMatch(/[٠-٩]/);
  });

  it("formats a duration as the design writes it", () => {
    expect(formatDuration(14700)).toBe("4h 05m");
    expect(formatDuration(2280)).toBe("38m");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(180000)).toBe("2d 2h");
  });

  it("returns the magnitude of a negative duration, leaving the sign to the caller", () => {
    // SLA seconds are signed; the sign chooses the sentence, not the number.
    expect(formatDuration(-840)).toBe("14m");
  });
});
