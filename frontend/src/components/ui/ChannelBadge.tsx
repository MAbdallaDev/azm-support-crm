import { Globe, Mail, MessageCircle, MessageSquare, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { TicketChannel } from "@/api/types";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

/**
 * The five `Channel` choices, each with the colour its `c-*` class carries in
 * the artboards: web→slate, email→brand, whatsapp→ok, sms→sky, chat→violet.
 */
const CLASSES: Record<TicketChannel, string> = {
  web: "bg-channel-web-bg text-channel-web",
  email: "bg-channel-email-bg text-channel-email",
  whatsapp: "bg-channel-whatsapp-bg text-channel-whatsapp",
  sms: "bg-channel-sms-bg text-channel-sms",
  chat: "bg-channel-chat-bg text-channel-chat",
};

const ICONS: Record<TicketChannel, LucideIcon> = {
  web: Globe,
  email: Mail,
  whatsapp: MessageCircle,
  sms: Smartphone,
  chat: MessageSquare,
};

export type ChannelBadgeProps = {
  channel: TicketChannel;
  /** Icon only, for the dense queue rows story 07 builds. */
  iconOnly?: boolean;
  className?: string;
};

export function ChannelBadge({ channel, iconOnly = false, className }: ChannelBadgeProps) {
  const { t } = useTranslation();
  const Icon = ICONS[channel];
  const label = t(`channel.${channel}`);

  return (
    <Pill
      className={cn(CLASSES[channel], className)}
      data-testid={`channel-${channel}`}
      title={iconOnly ? label : undefined}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </Pill>
  );
}
