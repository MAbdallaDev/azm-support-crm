import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip, X } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { usePortalTicket, useSubmitPortalTicket } from "@/api/portal";
import { ATTACHMENT_ACCEPT, validateAttachment } from "@/api/attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

/**
 * `/portal/new` — `PortalSubmit.dc.html`.
 *
 * **No priority, assignee, department or status control anywhere in this
 * form.** The backend already drops those fields silently if a payload
 * carries them (`PortalTicketCreateSerializer`), but the honest fix is to
 * never render a control for a field the API will not honour — an agent
 * priority picker that quietly does nothing is worse than no picker at all.
 *
 * **No category picker either, and that omission is the same principle
 * applied a second time.** `PortalTicketCreateSerializer.category` does
 * accept a category id, but no portal-reachable endpoint lists what those
 * ids are — `src/api/portal.ts` is not allowed to import the agent-facing
 * `useCategories()` (criterion 14's own constraint), and adding a
 * `portal/categories/` endpoint was not in this story's backend tasks. A
 * dropdown built from nothing would either be empty or secretly reuse the
 * agent list, so the honest choice is to submit `category: null` and record
 * this as a gap for a later story rather than fake a working control.
 */

const schema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function SubmitTicket() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const submit = useSubmitPortalTicket();
  const [files, setFiles] = React.useState<File[]>([]);
  const [confirmedId, setConfirmedId] = React.useState<number | null>(null);
  // The create response is PortalTicketCreateSerializer's narrower shape —
  // no target_date. A fresh detail fetch is what confirms the promise
  // actually made to the customer, not the one the create endpoint's own
  // response shape happens to omit.
  const { data: confirmed } = usePortalTicket(confirmedId);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "", description: "" },
  });

  const onFilesChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of picked) {
      const check = validateAttachment(file);
      if (!check.ok) {
        toast.error(
          check.reason === "too_large"
            ? t("composer.tooLarge", { limit: check.limitMb })
            : t("composer.wrongType", { type: check.type }),
        );
        continue;
      }
      setFiles((previous) => [...previous, file]);
    }
  };

  const removeFile = (index: number) => setFiles((previous) => previous.filter((_, i) => i !== index));

  const onSubmit = handleSubmit((values) => {
    submit.mutate(
      { subject: values.subject, description: values.description, category: null, attachments: files },
      {
        onSuccess: (created) => setConfirmedId(created.id),
        onError: () => toast.error(t("portal.submitFailed")),
      },
    );
  });

  if (confirmedId !== null) {
    return (
      <div className="mx-auto max-w-[480px] rounded-[10px] border border-line bg-background p-7 text-center">
        <h1 className="text-[19px] font-bold">{t("portal.submitted")}</h1>
        <p className="mono-ltr mt-3 text-[16px] font-semibold">{confirmed?.number ?? "…"}</p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {t("portal.submittedBody", { date: formatTargetDate(confirmed?.target_date ?? null) })}
        </p>
        <Button className="mt-5" onClick={() => navigate("/portal", { replace: true })}>
          {t("portal.backToRequests")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <h1 className="text-[20px] font-bold tracking-[-0.01em]">{t("portal.submitTitle")}</h1>

      <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
        <div>
          <Label htmlFor="subject">{t("newTicket.subject")}</Label>
          <Input id="subject" className="mt-1.5" aria-invalid={!!errors.subject} {...register("subject")} />
          {errors.subject ? <p className="mt-1 text-[11.5px] text-priority-urgent">{t("auth.required")}</p> : null}
        </div>

        <div>
          <Label htmlFor="description">{t("newTicket.description")}</Label>
          <textarea
            id="description"
            rows={5}
            className="mt-1.5 w-full resize-y rounded-lg border border-line bg-background px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-invalid={!!errors.description}
            {...register("description")}
          />
          {errors.description ? <p className="mt-1 text-[11.5px] text-priority-urgent">{t("auth.required")}</p> : null}
        </div>

        <div>
          <Label>{t("portal.attachments")}</Label>
          <label className="mt-1.5 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 text-[12.5px] text-ink-2 hover:bg-surface-2">
            <Paperclip aria-hidden className="h-3.5 w-3.5" />
            {t("portal.addAttachment")}
            <input type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={onFilesChosen} data-testid="submit-attachments-input" />
          </label>
          {files.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-line-2 px-2.5 py-1.5 text-[12px]">
                  <span className="min-w-0 truncate">{file.name}</span>
                  <button type="button" onClick={() => removeFile(index)} aria-label={t("common.remove")}>
                    <X aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Button type="submit" disabled={submit.isPending} data-testid="submit-ticket-button">
          {submit.isPending ? t("newTicket.creating") : t("portal.submitTitle")}
        </Button>
      </form>
    </div>
  );
}

const formatTargetDate = (value: string | null) => (value ? formatDate(value) : "—");
