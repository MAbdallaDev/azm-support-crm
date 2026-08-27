import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LanguageToggle } from "@/components/shell/LanguageToggle";
import i18n, { LANG_KEY, applyDocumentLanguage } from "@/i18n";

beforeEach(async () => {
  window.localStorage.removeItem(LANG_KEY);
  await i18n.changeLanguage("en");
  applyDocumentLanguage("en");
});

afterEach(async () => {
  window.localStorage.removeItem(LANG_KEY);
  await i18n.changeLanguage("en");
});

const renderToggle = (props: { profileLanguage?: "en" | "ar" } = {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <LanguageToggle {...props} />
    </I18nextProvider>,
  );

describe("LanguageToggle", () => {
  it("sets lang and dir on <html> and persists the choice", () => {
    renderToggle();

    fireEvent.click(screen.getByRole("button", { name: "ع" }));

    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(window.localStorage.getItem(LANG_KEY)).toBe("ar");
    expect(i18n.language).toBe("ar");
  });

  it("flips back to ltr", () => {
    renderToggle();

    fireEvent.click(screen.getByRole("button", { name: "ع" }));
    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    expect(document.documentElement.dir).toBe("ltr");
    expect(window.localStorage.getItem(LANG_KEY)).toBe("en");
  });

  it("applies the profile language on first load when nothing is persisted", () => {
    renderToggle({ profileLanguage: "ar" });

    expect(i18n.language).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    // Not persisted: a profile default must stay distinguishable from a
    // choice the user made, or the next profile change is ignored forever.
    expect(window.localStorage.getItem(LANG_KEY)).toBeNull();
  });

  it("does NOT override an already-persisted choice with the profile default", () => {
    window.localStorage.setItem(LANG_KEY, "en");

    renderToggle({ profileLanguage: "ar" });

    expect(i18n.language).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("marks the active half for assistive tech", () => {
    renderToggle();
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "ع" })).toHaveAttribute("aria-pressed", "false");
  });
});
