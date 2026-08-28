import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CHANNELS } from "@/api/types";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import en from "@/i18n/en.json";

import "@/i18n";

describe("ChannelBadge", () => {
  it.each(CHANNELS)("renders %s with an icon and the artboard's colour pair", (channel) => {
    const { container } = render(<ChannelBadge channel={channel} />);

    const badge = screen.getByTestId(`channel-${channel}`);
    expect(badge).toHaveTextContent(en.channel[channel]);
    expect(badge.className).toContain(`bg-channel-${channel}-bg`);
    expect(badge.className).toContain(`text-channel-${channel}`);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("keeps the label available to screen readers when icon-only", () => {
    render(<ChannelBadge channel="whatsapp" iconOnly />);
    expect(screen.getByText(en.channel.whatsapp)).toHaveClass("sr-only");
  });
});
