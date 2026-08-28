import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";

import { useKBArticle, useKBCategories, useCreateArticle, useUpdateArticle } from "@/api/kb";
import type { KBStatus } from "@/api/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * `/app/kb/new` and `/app/kb/:slug/edit` — the two-column bilingual editor.
 *
 * **The Arabic column renders `dir="rtl"` regardless of the interface
 * language** — an English-speaking manager reviewing a colleague's Arabic
 * article is editing Arabic, not reading the app in it.
 *
 * **`slug` is auto-generated from `title_en` on create, frozen on edit.**
 * Changing a slug on a published article breaks every link a story-09 KB
 * link already inserted into a ticket reply — the one thing this editor must
 * never let happen by accident.
 */

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

type Draft = {
  slug: string;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  category: string;
  status: KBStatus;
};

const EMPTY: Draft = {
  slug: "",
  title_en: "",
  title_ar: "",
  body_en: "",
  body_ar: "",
  category: "",
  status: "draft",
};

/** `Complete` needs both title and body; `Title only` names what's missing. */
const completeness = (title: string, body: string): "empty" | "titleOnly" | "complete" => {
  if (!title && !body) return "empty";
  if (!body) return "titleOnly";
  return "complete";
};

export default function KBEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug: editingSlug } = useParams();
  const isEditing = editingSlug !== undefined;

  const { data: existing, isPending: loadingExisting } = useKBArticle(editingSlug ?? null);
  const { data: categories } = useKBCategories();
  const create = useCreateArticle();
  const update = useUpdateArticle();

  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [dirty, setDirtyState] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [confirmPublish, setConfirmPublish] = React.useState(false);

  /**
   * `useBlocker`'s boolean form re-renders the blocker from the render that
   * created it — so a save's `setDirty(false)` immediately followed by a
   * synchronous `navigate()` in the same handler still sees the *previous*
   * render's `dirty=true`, and the guard blocks its own successful save.
   * A ref sidesteps the render cycle entirely: `dirtyRef.current` is already
   * `false` by the time `navigate()` runs, because setting a ref is
   * synchronous, not scheduled.
   */
  const dirtyRef = React.useRef(false);
  const setDirty = (value: boolean) => {
    dirtyRef.current = value;
    setDirtyState(value);
  };

  React.useEffect(() => {
    if (existing) {
      setDraft({
        slug: existing.slug,
        title_en: existing.title_en,
        title_ar: existing.title_ar,
        body_en: existing.body_en,
        body_ar: existing.body_ar,
        category: existing.category ?? "",
        status: existing.status,
      });
      setDirty(false);
    }
  }, [existing]);

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === "title_en" && !isEditing && !slugTouched) {
        next.slug = slugify(String(value));
      }
      return next;
    });
    setDirty(true);
  };

  // Unsaved-changes guard: fires only on a dirty form, and a successful save
  // clears `dirty` before navigating away — otherwise the very save that
  // resolves the warning would trigger it.
  const blocker = useBlocker(React.useCallback(() => dirtyRef.current, []));

  const body = () => ({
    slug: draft.slug,
    title_en: draft.title_en,
    title_ar: draft.title_ar,
    body_en: draft.body_en,
    body_ar: draft.body_ar,
    category: draft.category ? Number(draft.category) : null,
    status: draft.status,
  });

  const save = (status: KBStatus, andLeave = true) => {
    const payload = { ...body(), status };

    const onSuccess = (article: { slug: string }) => {
      setDirty(false);
      toast.success(t(status === "published" ? "editor.published" : "editor.draftSaved"));
      if (andLeave) navigate(`/app/kb/${article.slug}`);
    };
    const onError = () => toast.error(t("tickets.actionFailed"));

    if (isEditing && editingSlug) {
      update.mutate({ ...payload, slug: editingSlug }, { onSuccess, onError });
    } else {
      create.mutate(payload, { onSuccess, onError });
    }
  };

  const onPublish = () => {
    const arabicComplete = completeness(draft.title_ar, draft.body_ar) === "complete";
    if (!arabicComplete) {
      setConfirmPublish(true);
      return;
    }
    save("published");
  };

  const copyEnglishToArabic = () => {
    setDraft((d) => ({ ...d, body_ar: d.body_en }));
    setDirty(true);
  };

  const saving = create.isPending || update.isPending;

  if (isEditing && loadingExisting) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const enState = completeness(draft.title_en, draft.body_en);
  const arState = completeness(draft.title_ar, draft.body_ar);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col p-5">
      <div className="flex items-center gap-2.5">
        <p className="text-[12px] text-muted-foreground">
          <Link to="/app/kb" className="hover:text-brand">
            {t("kb.title")}
          </Link>{" "}
          <span className="text-faint">/</span>{" "}
          {isEditing ? t("editor.editTitle") : t("editor.newTitle")}
        </p>
        <span className="flex-1" />
        {dirty ? <span className="text-[11.5px] text-faint">{t("editor.unsaved")}</span> : null}
        <Button variant="outline" size="sm" onClick={() => save("draft")} disabled={saving}>
          {t("editor.saveDraft")}
        </Button>
        <Button size="sm" onClick={onPublish} disabled={saving} data-testid="publish-button">
          {t("editor.publish")}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <select
          value={draft.category}
          onChange={(event) => {
            change("category", event.target.value);
          }}
          aria-label={t("editor.category")}
          className="h-[38px] flex-1 rounded-lg border border-line bg-background px-2.5 text-[13px]"
        >
          <option value="">{t("editor.noCategory")}</option>
          {(categories ?? []).map((category) => (
            <option key={category.slug} value={category.id}>
              {category.name_en}
            </option>
          ))}
        </select>
        <input
          value={draft.slug}
          onChange={(event) => {
            setSlugTouched(true);
            change("slug", slugify(event.target.value));
          }}
          readOnly={isEditing}
          disabled={isEditing}
          title={isEditing ? t("editor.slugFrozen") : undefined}
          data-testid="slug-input"
          dir="ltr"
          className={cn(
            "mono-ltr h-[38px] w-[280px] rounded-lg border border-line bg-background px-2.5 text-[12px]",
            isEditing && "cursor-not-allowed bg-surface-2 text-muted-foreground",
          )}
        />
      </div>

      {/* Stacks to one column below `md` rather than compressing two 160px-wide
          editors into an unusable strip — a two-column grid with no responsive
          variant is exactly the failure mode story 10's 375px pass checks for. */}
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex min-h-0 flex-col rounded-[9px] border border-line bg-background">
          <div className="flex items-center gap-2.5 border-b border-line px-[15px] py-3">
            <span className="text-[13px] font-bold">{t("editor.english")}</span>
            <CompletenessPill state={enState} />
            <span className="flex-1" />
            <span className="text-[11px] text-faint">
              {t("editor.characterCount", { count: draft.body_en.length })}
            </span>
          </div>
          <div className="border-b border-line-2 p-[14px_15px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">{t("editor.titleLabel")}</p>
            <input
              value={draft.title_en}
              onChange={(event) => change("title_en", event.target.value)}
              data-testid="title-en"
              className="mt-1.5 w-full text-[16px] font-bold leading-[1.35] outline-none"
            />
          </div>
          <div className="min-h-0 flex-1 p-[14px_15px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">{t("editor.bodyLabel")}</p>
            <textarea
              value={draft.body_en}
              onChange={(event) => change("body_en", event.target.value)}
              data-testid="body-en"
              className="mt-2 h-full w-full resize-none text-[12.5px] leading-[1.75] text-ink-2 outline-none"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-[9px] border border-line bg-background">
          <div className="flex items-center gap-2.5 border-b border-line px-[15px] py-3">
            <span className="text-[13px] font-bold">العربية</span>
            <CompletenessPill state={arState} />
            <span className="flex-1" />
            <span className="text-[11px] text-faint">
              {t("editor.characterCount", { count: draft.body_ar.length })}
            </span>
          </div>
          <div className="border-b border-line-2 p-[14px_15px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">العنوان</p>
            <input
              value={draft.title_ar}
              onChange={(event) => change("title_ar", event.target.value)}
              dir="rtl"
              data-testid="title-ar"
              className="mt-1.5 w-full text-[16px] font-bold leading-[1.5] outline-none"
              style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
            />
          </div>
          <div className="min-h-0 flex-1 p-[14px_15px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">النص</p>
            {draft.body_ar ? (
              <textarea
                value={draft.body_ar}
                onChange={(event) => change("body_ar", event.target.value)}
                dir="rtl"
                data-testid="body-ar"
                className="mt-2 h-full w-full resize-none text-[12.5px] leading-[1.75] text-ink-2 outline-none"
                style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
              />
            ) : (
              <div
                dir="rtl"
                className="mt-2 flex flex-col items-center gap-3 rounded-[9px] border border-dashed border-line bg-surface-2 p-5 text-center"
              >
                <p className="text-[12.5px] text-muted-foreground" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
                  لم تتم إضافة النص العربي بعد.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyEnglishToArabic}
                  disabled={!draft.body_en}
                  data-testid="copy-english"
                >
                  {t("editor.copyEnglish")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {arState !== "complete" ? (
        <div
          className="mt-3.5 flex items-center gap-2.5 rounded-[9px] border border-[#f0d9ae] bg-[#fffbf0] px-3.5 py-3"
          data-testid="missing-arabic-warning"
        >
          <p className="flex-1 text-[12.5px] leading-[1.5] text-[#7a4d0a]">{t("editor.arabicEmptyWarning")}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => save("published")}
            disabled={saving}
            className="border-[#e5cb9e] bg-transparent text-[#7a4d0a]"
          >
            {t("editor.publishAnyway")}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title={t("editor.publishWarningTitle")}
        description={t("editor.arabicEmptyWarning")}
        confirmLabel={t("editor.publishAnyway")}
        onConfirm={() => save("published")}
      />

      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
        title={t("editor.unsavedGuardTitle")}
        description={t("editor.unsavedGuardBody")}
        confirmLabel={t("editor.discard")}
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}

function CompletenessPill({ state }: { state: "empty" | "titleOnly" | "complete" }) {
  const { t } = useTranslation();
  if (state === "complete") {
    return <Pill className="bg-priority-low-bg text-priority-low">{t("editor.complete")}</Pill>;
  }
  if (state === "titleOnly") {
    return <Pill className="bg-priority-high-bg text-priority-high">{t("editor.titleOnly")}</Pill>;
  }
  return <Pill className="bg-surface-3 text-slate-600">{t("editor.empty")}</Pill>;
}
