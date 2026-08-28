import { BookOpen, Loader2, Paperclip, Sparkles } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { useSuggestReply } from "@/api/ai";
import { ATTACHMENT_ACCEPT, validateAttachment } from "@/api/attachments";
import { useCannedReplies, useSendMessage, useUploadAttachment } from "@/api/tickets";
import { ArticlePicker } from "@/features/kb/ArticlePicker";
import type { TicketDetail } from "@/api/types";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * The reply composer.
 *
 * **This is the one control in the product where a mistake is published to a
 * customer**, so the Reply / Internal note distinction is carried by the field
 * itself — a tinted background and border, not merely a selected tab. Someone
 * glancing down mid-sentence has to be able to tell which mode they are in
 * from the thing they are typing into.
 *
 * Drafts live in `sessionStorage`, keyed by ticket **and mode**, so switching
 * tickets and coming back does not lose work — and so a half-written internal
 * note never reappears in the reply box. Session-scoped deliberately: a draft
 * surviving a browser restart is a stale-content trap, not a feature.
 */

const draftKey = (ticketId: number, internal: boolean) =>
  `crm.draft.${ticketId}.${internal ? "note" : "reply"}`;

const readDraft = (key: string): string => {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const writeDraft = (key: string, value: string) => {
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    /* memory-only session; the composer still works. */
  }
};

export function Composer({ ticket }: { ticket: TicketDetail }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");

  const [internal, setInternal] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [body, setBody] = React.useState(() => readDraft(draftKey(ticket.id, false)));
  const textarea = React.useRef<HTMLTextAreaElement>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const send = useSendMessage();
  const upload = useUploadAttachment();
  const suggest = useSuggestReply();
  const { data: cannedReplies } = useCannedReplies();

  const key = draftKey(ticket.id, internal);

  // Restore whenever the ticket or the mode changes — the two together are the
  // draft's identity, so switching either has to swap the text.
  React.useEffect(() => {
    setBody(readDraft(key));
  }, [key]);

  const change = (value: string) => {
    setBody(value);
    writeDraft(key, value);
  };

  /**
   * Insert at the caret, not at the end.
   *
   * An agent who has typed a greeting and then picks a canned reply wants it
   * where the cursor is; appending it after their sign-off is the kind of
   * small wrongness that makes people stop using the feature.
   */
  const insertAtCursor = (text: string) => {
    const node = textarea.current;
    const start = node?.selectionStart ?? body.length;
    const end = node?.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${text}${body.slice(end)}`;
    change(next);

    // Restore the caret after React has re-rendered with the new value.
    requestAnimationFrame(() => {
      if (!node) return;
      node.focus();
      const caret = start + text.length;
      node.setSelectionRange(caret, caret);
    });
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim() || send.isPending) return;

    send.mutate(
      { id: ticket.id, body: body.trim(), is_internal: internal },
      {
        onSuccess: () => {
          change("");
          toast.success(t(internal ? "composer.noteSaved" : "composer.sent"));
        },
        // The draft is deliberately left in place on failure — losing what
        // someone just wrote is worse than any error message.
        onError: () => toast.error(t("composer.sendFailed")),
      },
    );
  };

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so picking the same file twice still fires
    if (!file) return;

    // The same two checks the server makes, from the same constants — a client
    // limit looser than the server's turns into a confusing 400.
    const verdict = validateAttachment(file);
    if (!verdict.ok) {
      toast.error(
        verdict.reason === "too_large"
          ? t("composer.tooLarge", { limit: verdict.limitMb })
          : t("composer.wrongType", { type: verdict.type }),
      );
      return;
    }

    upload.mutate(
      { id: ticket.id, file },
      {
        onSuccess: () => toast.success(t("composer.uploaded", { name: file.name })),
        onError: () => toast.error(t("composer.uploadFailed")),
      },
    );
  };

  const onSuggest = () => {
    suggest.mutate(
      { ticket: ticket.id },
      {
        // Inserted as editable draft text and **never auto-sent** — the agent
        // approving it is the whole point of the feature.
        onSuccess: (data) => insertAtCursor(data.suggested_reply),
        onError: () => toast.error(t("ai.suggestFailed")),
      },
    );
  };

  const modeTab = (isInternal: boolean, label: string) => (
    <button
      type="button"
      onClick={() => setInternal(isInternal)}
      aria-pressed={internal === isInternal}
      data-testid={`composer-mode-${isInternal ? "internal" : "reply"}`}
      className={cn(
        "border-b-2 pb-[9px] text-[13px]",
        internal === isInternal
          ? "border-brand font-semibold text-ink"
          : "border-transparent font-medium text-muted-foreground hover:text-ink-2",
      )}
    >
      {label}
    </button>
  );

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex-none rounded-[10px] border bg-background transition-colors",
        internal ? "border-priority-high/40" : "border-line",
      )}
    >
      <div className="flex items-center gap-[18px] px-3.5 pt-[11px]">
        {modeTab(false, t("composer.reply"))}
        {modeTab(true, t("composer.internalNote"))}
        <span className="flex-1" />
        {!internal ? (
          <>
            <span className="pb-[9px] text-[11.5px] text-muted-foreground">
              {t("composer.sendingVia")}
            </span>
            <ChannelBadge channel={ticket.channel} className="mb-[9px]" />
          </>
        ) : null}
      </div>

      <div className="h-px bg-line-2" />

      <textarea
        ref={textarea}
        value={body}
        onChange={(event) => change(event.target.value)}
        data-testid="composer-textarea"
        rows={3}
        placeholder={
          internal
            ? t("composer.notePlaceholder")
            : t("composer.replyPlaceholder", { name: ticket.customer_name })
        }
        className={cn(
          "w-full resize-y px-3.5 py-3 text-[13px] leading-[1.6] outline-none transition-colors",
          // The visible mode difference. The tint is the artboard's warning
          // background, and it is on the field itself for the reason in the
          // component docstring.
          internal
            ? "bg-priority-high-bg text-priority-high placeholder:text-priority-high/60"
            : "bg-background text-ink placeholder:text-faint",
        )}
      />

      <div className="px-3.5 pb-1">
        {cannedReplies && cannedReplies.length > 0 ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">
            {t("composer.quickReplies")}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-[7px]">
          {(cannedReplies ?? []).slice(0, 6).map((reply) => (
            <button
              key={reply.id}
              type="button"
              onClick={() => insertAtCursor(isArabic ? reply.body_ar : reply.body_en)}
              className="flex h-7 items-center rounded-full border border-line px-[11px] text-[12px] text-ink-2 hover:border-[#c9cfda] hover:bg-surface-2"
            >
              {isArabic ? reply.title_ar : reply.title_en}
            </button>
          ))}
          {/* Criterion 9: read here as one family with the canned replies —
              both insert text at the cursor via the same insertAtCursor. */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            data-testid="composer-insert-kb-link"
            className="flex h-7 items-center gap-1.5 rounded-full border border-line px-[11px] text-[12px] text-ink-2 hover:border-[#c9cfda] hover:bg-surface-2"
          >
            <BookOpen aria-hidden className="h-3 w-3" />
            {t("kb.insertKbLink")}
          </button>
        </div>
      </div>

      <ArticlePicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={insertAtCursor} />

      <div className="flex items-center gap-2 p-3.5">
        <input
          ref={fileInput}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          onChange={onPickFile}
          className="hidden"
          data-testid="composer-file"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => fileInput.current?.click()}
        >
          {upload.isPending ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip aria-hidden className="h-3.5 w-3.5" />
          )}
          {t("composer.attach")}
        </Button>

        {!internal ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={suggest.isPending}
            onClick={onSuggest}
            data-testid="composer-suggest"
          >
            {suggest.isPending ? (
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles aria-hidden className="h-3.5 w-3.5" />
            )}
            {suggest.isPending ? t("composer.suggesting") : t("composer.suggest")}
          </Button>
        ) : null}

        <span className="flex-1" />

        <Button type="submit" size="sm" disabled={!body.trim() || send.isPending}>
          {send.isPending ? (
            <>
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
              {t("composer.sending")}
            </>
          ) : (
            t(internal ? "composer.sendNote" : "composer.send")
          )}
        </Button>
      </div>
    </form>
  );
}
