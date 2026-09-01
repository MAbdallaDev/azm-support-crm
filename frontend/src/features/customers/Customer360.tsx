import { Loader2 } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  useAddContact,
  useCustomer,
  useCustomerAttachments,
  useUpdateContact,
  useUpdateCustomer,
} from "@/api/customers";
import { useTicketList } from "@/api/tickets";
import type { Contact } from "@/api/types";
import { initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { useAddCustomerNote, useCustomerNotes } from "@/api/customers";

/**
 * `/app/customers/:id` — the screen an agent opens mid-conversation to
 * answer "who am I talking to, and what has happened before?" in one place.
 *
 * **The stats strip is three cells, not five.** `Customer.dc.html` draws
 * Open / Lifetime / Avg resolution / SLA met / CSAT. Open and Lifetime come
 * straight off `CustomerDetailSerializer` and are exact. The other three do
 * not exist as an aggregate for a single customer — no endpoint computes
 * them. Avg resolution needs `resolved_at`, which `TicketListSerializer`
 * does not carry, and CSAT needs a per-ticket score the list serializer also
 * omits; getting either honestly would mean a ticket-detail request per row,
 * the N+1 story 04's own queue test exists to forbid. **SLA met** *can* be
 * computed honestly from the ticket history this screen already loads
 * (`resolution_sla.state`, frozen at resolution), so it stays — labelled
 * with the count it is based on, per the rule that a stat silently
 * describing a subset is worse than no stat at all.
 */

const HISTORY_PAGE_SIZE = "100";

function StatCell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-background p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">{label}</p>
      <p className="mt-1 text-[19px] font-bold">{value}</p>
      {sub ? <p className="mt-1 text-[11px] text-faint">{sub}</p> : null}
    </div>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  const { t } = useTranslation();
  const update = useUpdateContact();
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    position: contact.position,
  });

  const save = () => {
    update.mutate(
      { id: contact.id, customer: contact.customer, ...form },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success(t("customers.contactSaved"));
        },
        onError: () => toast.error(t("tickets.actionFailed")),
      },
    );
  };

  if (editing) {
    return (
      <div className="border-b border-line-2 p-3.5 last:border-b-0" data-testid={`contact-edit-${contact.id}`}>
        <div className="space-y-1.5">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t("customers.contactName")}
            className="w-full rounded-md border border-line px-2 py-1 text-[12.5px]"
          />
          <input
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
            placeholder={t("customers.contactPosition")}
            className="w-full rounded-md border border-line px-2 py-1 text-[12.5px]"
          />
          <input
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder={t("context.email")}
            dir="ltr"
            className="mono-ltr w-full rounded-md border border-line px-2 py-1 text-[12.5px]"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder={t("context.phone")}
            dir="ltr"
            className="mono-ltr w-full rounded-md border border-line px-2 py-1 text-[12.5px]"
          />
        </div>
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : null}
            {t("common.confirm")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-line-2 p-3.5 last:border-b-0" data-testid={`contact-${contact.id}`}>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#3f5a7d] text-[11px] font-semibold text-white"
        >
          {initials(contact.name)}
        </span>
        <div className="min-w-0 flex-1 leading-[1.4]">
          <p className="truncate text-[12.5px] font-semibold">{contact.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{contact.position}</p>
        </div>
        {contact.is_primary ? <Pill className="bg-priority-low-bg text-priority-low">{t("customers.primary")}</Pill> : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[12px] font-semibold text-brand hover:text-brand-strong"
        >
          {t("customers.editContact")}
        </button>
      </div>
      <p className="mono-ltr mt-2 text-[11.5px] leading-[1.7] text-muted-foreground">
        {contact.email}
        <br />
        {contact.phone}
      </p>
    </div>
  );
}

function AddContactForm({ customerId, onDone }: { customerId: number; onDone: () => void }) {
  const { t } = useTranslation();
  const add = useAddContact();
  const [form, setForm] = React.useState({ name: "", email: "", phone: "", position: "", is_primary: false });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    add.mutate(
      { customer: customerId, ...form },
      {
        onSuccess: () => {
          toast.success(t("customers.contactSaved"));
          onDone();
        },
        onError: () => toast.error(t("tickets.actionFailed")),
      },
    );
  };

  return (
    <form onSubmit={submit} className="border-b border-line-2 p-3.5 space-y-1.5" data-testid="add-contact-form">
      <input
        autoFocus
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder={t("customers.contactName")}
        className="w-full rounded-md border border-line px-2 py-1 text-[12.5px]"
      />
      <input
        value={form.position}
        onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
        placeholder={t("customers.contactPosition")}
        className="w-full rounded-md border border-line px-2 py-1 text-[12.5px]"
      />
      <input
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        placeholder={t("context.email")}
        dir="ltr"
        className="mono-ltr w-full rounded-md border border-line px-2 py-1 text-[12.5px]"
      />
      <input
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        placeholder={t("context.phone")}
        dir="ltr"
        className="mono-ltr w-full rounded-md border border-line px-2 py-1 text-[12.5px]"
      />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" disabled={!form.name.trim() || add.isPending}>
          {add.isPending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : null}
          {t("common.confirm")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

export default function Customer360() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const customerId = id ? Number(id) : null;

  const { data: customer, isPending, isError } = useCustomer(customerId);
  const { data: attachments } = useCustomerAttachments(customerId);
  const { data: notes } = useCustomerNotes(customerId);
  const addNote = useAddCustomerNote();

  const historyParams = React.useMemo(() => {
    const params = new URLSearchParams({ ordering: "-created_at", page_size: HISTORY_PAGE_SIZE });
    if (customerId) params.set("customer", String(customerId));
    return params;
  }, [customerId]);
  const { data: history, isPending: historyPending } = useTicketList(historyParams);

  const [historyTab, setHistoryTab] = React.useState<"all" | "open" | "closed">("all");
  const [addingContact, setAddingContact] = React.useState(false);
  const [noteBody, setNoteBody] = React.useState("");
  const [editingCustomer, setEditingCustomer] = React.useState(false);
  const updateCustomer = useUpdateCustomer();

  const rows = history?.results ?? [];
  const OPEN_STATUSES = new Set(["new", "open", "pending", "on_hold", "escalated", "reopened"]);
  const filteredRows = rows.filter((row) => {
    if (historyTab === "open") return OPEN_STATUSES.has(row.status);
    if (historyTab === "closed") return !OPEN_STATUSES.has(row.status);
    return true;
  });

  const resolved = rows.filter((row) => row.status === "resolved" || row.status === "closed");
  const met = resolved.filter((row) => row.resolution_sla.state !== "breached");
  const slaMetPercent = resolved.length > 0 ? Math.round((met.length / resolved.length) * 100) : null;

  if (isPending) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="p-6">
        <EmptyState title={t("customers.notFound")} description="" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <p className="text-[12px] text-muted-foreground">
        <Link to="/app/customers" className="hover:text-brand">
          {t("customers.title")}
        </Link>{" "}
        <span className="text-faint">/</span> {customer.name}
      </p>

      <div className="mt-3 rounded-[9px] border border-line bg-background p-[18px_20px]">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="flex h-12 w-12 flex-none items-center justify-center rounded-[11px] bg-[#3f5a7d] text-[16px] font-semibold text-white"
          >
            {initials(customer.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[19px] font-bold tracking-[-0.01em]">{customer.name}</span>
              <Pill className="bg-tier-bg uppercase tracking-[0.07em] text-tier">
                {t(`customers.tier.${customer.tier}`)}
              </Pill>
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {[customer.company, customer.branch_name, t(customer.preferred_language === "ar" ? "customers.prefersArabic" : "customers.prefersEnglish")]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Button variant="outline" data-testid="edit-customer-button" onClick={() => setEditingCustomer((v) => !v)}>
            {t("common.edit")}
          </Button>
          <Button onClick={() => navigate(`/app/tickets/new?customer=${customer.id}`)}>
            {t("customers.newTicket")}
          </Button>
        </div>

        {editingCustomer ? (
          <div className="mt-4 flex flex-wrap items-end gap-2.5 border-t border-line pt-3.5" data-testid="customer-edit-form">
            <label className="text-[12px]">
              <span className="block text-muted-foreground">{t("customers.colTier")}</span>
              <select
                defaultValue={customer.tier}
                id="edit-tier"
                className="mt-1 h-8 rounded-md border border-line px-2"
              >
                <option value="standard">{t("customers.tier.standard")}</option>
                <option value="premium">{t("customers.tier.premium")}</option>
                <option value="enterprise">{t("customers.tier.enterprise")}</option>
              </select>
            </label>
            <Button
              size="sm"
              disabled={updateCustomer.isPending}
              onClick={() => {
                const select = document.getElementById("edit-tier") as HTMLSelectElement;
                updateCustomer.mutate(
                  { id: customer.id, tier: select.value as never },
                  {
                    onSuccess: () => {
                      setEditingCustomer(false);
                      toast.success(t("customers.customerSaved"));
                    },
                    onError: () => toast.error(t("tickets.actionFailed")),
                  },
                );
              }}
            >
              {t("common.confirm")}
            </Button>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[9px] border border-line-2 bg-line-2">
          <StatCell label={t("customers.statOpen")} value={customer.open_ticket_count} />
          <StatCell label={t("customers.statLifetime")} value={customer.total_ticket_count} />
          <StatCell
            label={t("customers.statSlaMet")}
            value={slaMetPercent === null ? "—" : `${slaMetPercent}%`}
            sub={
              resolved.length === 0
                ? t("customers.statNoResolved")
                : t("customers.statBasedOn", { count: resolved.length })
            }
          />
        </div>
      </div>

      {/* Below `md` a fixed 330px sidebar plus a flex-1 ticket-history table
          squeezes the table into an unreadable sliver — the two panels stack
          instead, same shape as every other fixed-two-pane screen. */}
      <div className="mt-4 flex flex-col gap-4 md:flex-row">
        <div className="w-full space-y-4 md:w-[330px] md:flex-none">
          <div className="rounded-[9px] border border-line bg-background">
            <div className="flex items-center justify-between border-b border-line px-[15px] py-3">
              <span className="text-[13.5px] font-bold">{t("customers.contacts")}</span>
              <button
                type="button"
                onClick={() => setAddingContact(true)}
                className="text-[12px] font-semibold text-brand hover:text-brand-strong"
              >
                {t("customers.add")}
              </button>
            </div>
            {addingContact ? (
              <AddContactForm customerId={customer.id} onDone={() => setAddingContact(false)} />
            ) : null}
            {customer.contacts.length === 0 && !addingContact ? (
              <EmptyState title={t("customers.noContacts")} description="" />
            ) : (
              customer.contacts.map((contact) => <ContactCard key={contact.id} contact={contact} />)
            )}
          </div>

          <div className="rounded-[9px] border border-line bg-background">
            <div className="flex items-center justify-between border-b border-line px-[15px] py-3">
              <span className="text-[13.5px] font-bold">{t("context.notes")}</span>
            </div>
            <div className="p-[15px] space-y-2">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder={t("context.addNote")}
                rows={2}
                className="w-full resize-y rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                size="sm"
                disabled={!noteBody.trim() || addNote.isPending}
                onClick={() =>
                  customerId &&
                  addNote.mutate(
                    { id: customerId, body: noteBody.trim() },
                    { onSuccess: () => setNoteBody("") },
                  )
                }
              >
                {t("context.saveNote")}
              </Button>
            </div>
            {(notes ?? []).length === 0 ? (
              <EmptyState title={t("context.noNotes")} description={t("context.noNotesBody")} />
            ) : (
              (notes ?? []).map((note) => (
                <div key={note.id} className="border-t border-line-2 px-[15px] py-3">
                  <p className="text-[12.5px] leading-[1.6] text-ink-2">{note.body}</p>
                  <p className="mt-1.5 text-[11px] text-faint">
                    {note.author_name} · {formatDate(note.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 rounded-[9px] border border-line bg-background">
          <div className="flex items-center justify-between border-b border-line px-[15px] py-3">
            <span className="text-[13.5px] font-bold">{t("customers.ticketHistory")}</span>
            <div className="flex gap-1.5">
              {(["all", "open", "closed"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setHistoryTab(tab)}
                  aria-pressed={historyTab === tab}
                  data-testid={`history-tab-${tab}`}
                  className={
                    historyTab === tab
                      ? "flex h-7 items-center rounded-full bg-ink px-3 text-[12px] font-semibold text-white"
                      : "flex h-7 items-center rounded-full border border-line px-3 text-[12px] text-ink-2"
                  }
                >
                  {t(`customers.historyTab.${tab}`)}
                </button>
              ))}
            </div>
          </div>

          {historyPending ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState title={t("customers.noTickets")} description="" />
          ) : (
            // Unlike CustomerList's shared `DataTable` (which already wraps its
            // own `<table>` this way), this is a bespoke table — without its
            // own `overflow-x-auto` the five `whitespace-nowrap` columns
            // overflow the card and leak into `<main>`'s own scroll area,
            // becoming reachable only by scrolling the whole page sideways.
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap border-b border-line px-3 py-[9px] text-start text-[11px] font-semibold text-muted-foreground">
                      {t("customers.colTicket")}
                    </th>
                    <th className="border-b border-line px-3 py-[9px] text-start text-[11px] font-semibold text-muted-foreground">
                      {t("customers.colSubject")}
                    </th>
                    <th className="whitespace-nowrap border-b border-line px-3 py-[9px] text-start text-[11px] font-semibold text-muted-foreground">
                      {t("customers.colChannel")}
                    </th>
                    <th className="whitespace-nowrap border-b border-line px-3 py-[9px] text-start text-[11px] font-semibold text-muted-foreground">
                      {t("customers.colStatus")}
                    </th>
                    <th className="whitespace-nowrap border-b border-line px-3 py-[9px] text-start text-[11px] font-semibold text-muted-foreground">
                      {t("customers.colCreated")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-line-2 last:border-b-0">
                      <td className="px-3 py-[11px]">
                        <Link to={`/app/tickets/${row.id}`} className="mono-ltr text-[12.5px] text-muted-foreground hover:text-brand">
                          {row.number}
                        </Link>
                      </td>
                      <td className="px-3 py-[11px] text-[12.5px] font-medium">
                        <Link to={`/app/tickets/${row.id}`} className="hover:text-brand">
                          {row.subject}
                        </Link>
                      </td>
                      <td className="px-3 py-[11px]">
                        <ChannelBadge channel={row.channel} />
                      </td>
                      <td className="px-3 py-[11px]">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-[11px] text-[12.5px] text-muted-foreground">
                        {formatDate(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-line-2 px-[15px] py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">
              {t("customers.attachments")}
            </p>
            {(attachments ?? []).length === 0 ? (
              <p className="mt-2 text-[12px] text-muted-foreground">{t("customers.noAttachments")}</p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {(attachments ?? []).map((file) => (
                  <Link
                    key={file.id}
                    to={`/app/tickets/${file.ticket}`}
                    title={`${file.ticket_number} · ${formatDate(file.created_at)}`}
                    className="flex h-7 items-center rounded-full border border-line px-2.5 text-[12px] text-ink-2 hover:bg-surface-2"
                  >
                    {file.filename}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
