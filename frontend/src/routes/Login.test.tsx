import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "../i18n";
import Login from "./Login";

describe("Login", () => {
  it("renders its heading through i18next", () => {
    render(<Login />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
