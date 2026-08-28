import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { useMe } from "@/api/auth";
import { useCustomer, useDepartments } from "@/api/customers";
import { useCategories } from "@/api/tickets";
import { api } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { Contact, TicketChannel, TicketPriority } from "@/api/types";
import { CHANNELS, PRIORITIES } from "@/api/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

/**
 * `/app/tickets/new` — criterion 3: creating a ticket from Customer 360
 * pre-fills the customer and returns to the new ticket.
 *
 * **No status field.** `TicketWriteSerializer` omits it deliberately — a new
 * ticket always starts `new` and moves only through the transition
 * endpoints, so offering a status picker here would be a form field the API
 * silently ignores.
 *
 * `?customer=<id>` both pre-fills and **locks** the customer field: arriving
 * from Customer 360, the whole point was "start a ticket for this person",
 * and an editable field the agent could accidentally change defeats that.
 */

const schema = z.object({
  subject: z.string().min(1),
  description: z.string(),
  contact: z.string(),
  category: z.string(),
  department: z.string(),
  priority: z.enum(PRIORITIES),
  channel: z.enum(CHANNELS),
});

type FormValues = z.infer<typeof schema>;

export default function NewTicket() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const queryClient = useQueryClient();

  const customerId = search.get("customer") ? Number(search.get("customer")) : null;
  const { data: customer } = useCustomer(customerId);
  const { data: categories } = useCategories();
  const { data: departments } = useDepartments();
  const { data: me } = useMe();

  const { data: contacts } = useQuery({
    queryKey: qk.contacts.byCustomer(customerId ?? 0),
    queryFn: () =>
      api
        .get<{ results: Contact[] } | Contact[]>("/contacts/", { params: { customer: customerId } })
        .then((r) => (Array.isArray(r.data) ? r.data : r.data.results)),
    enabled: customerId !== null,
  });

  const create = useMutation({
    // The create route responds with `TicketWriteSerializer`'s shape, not
    // the full `TicketDetailSerializer` — unlike the six transition actions
    // (assign/status/escalate/.../messages), `TicketViewSet.create()` is
    // DRF's default `CreateModelMixin`, which serialises the response with
    // whatever `get_serializer_class()` returns for "create". Only `id` is
    // trustworthy here; seeding the detail cache with the rest would leave
    // fields like `created_at` and `resolution_sla` missing until the next
    // refetch, and the detail page reads both on its very first render.
    mutationFn: (body: Record<string, unknown>) =>
      api.post<{ id: number }>("/tickets/", body).then((r) => r.data),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: qk.tickets.all });
      // Returns to the *ticket*, not the queue — "returns to the new ticket".
      // useTicket fetches the real TicketDetailSerializer payload fresh.
      navigate(`/app/tickets/${created.id}`, { replace: true });
    },
    onError: () => toast.error(t("tickets.actionFailed")),
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: "",
      description: "",
      contact: "",
      category: "",
      // Every agent belongs to a department, so their own is the sensible
      // default — set once `useMe()` resolves, below.
      department: "",
      priority: "normal",
      channel: "web",
    },
  });

  // `useMe()`'s `department` is a code string (SlugRelatedField), but the
  // write serializer's `department` field takes a primary key — this is the
  // same mismatch story 07 hit and solved with `department_code`. There is no
  // pk-from-code endpoint, so the match happens client-side against the
  // `departments/` reference list this story added.
  React.useEffect(() => {
    if (!me || !departments) return;
    const mine = departments.find((department) => department.code === me.department);
    if (mine) setValue("department", String(mine.id));
  }, [me, departments, setValue]);

  const onSubmit = handleSubmit((values) => {
    if (!customerId) return;
    create.mutate({
      subject: values.subject,
      description: values.description,
      customer: customerId,
      contact: values.contact ? Number(values.contact) : null,
      category: values.category ? Number(values.category) : null,
      department: values.department ? Number(values.department) : null,
      priority: values.priority as TicketPriority,
      channel: values.channel as TicketChannel,
    });
  });

  if (!customerId) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-priority-urgent">{t("newTicket.missingCustomer")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] p-6">
      <h1 className="text-[20px] font-bold tracking-[-0.01em]">{t("newTicket.title")}</h1>

      <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
        <div>
          <Label>{t("newTicket.customer")}</Label>
          <Input
            value={customer?.name ?? "…"}
            disabled
            data-testid="new-ticket-customer"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="subject">{t("newTicket.subject")}</Label>
          <Input id="subject" className="mt-1.5" aria-invalid={!!errors.subject} {...register("subject")} />
          {errors.subject ? <p className="mt-1 text-[11.5px] text-priority-urgent">{t("auth.required")}</p> : null}
        </div>

        <div>
          <Label htmlFor="description">{t("newTicket.description")}</Label>
          <textarea
            id="description"
            rows={4}
            className="mt-1.5 w-full resize-y rounded-lg border border-line bg-background px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register("description")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="contact">{t("newTicket.contact")}</Label>
            <select
              id="contact"
              className="mt-1.5 h-10 w-full rounded-lg border border-line bg-background px-3 text-[13px]"
              {...register("contact")}
            >
              <option value="">{t("newTicket.noContact")}</option>
              {(contacts ?? []).map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                  {contact.is_primary ? ` (${t("customers.primary")})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="category">{t("newTicket.category")}</Label>
            <select
              id="category"
              className="mt-1.5 h-10 w-full rounded-lg border border-line bg-background px-3 text-[13px]"
              {...register("category")}
            >
              <option value="">{t("newTicket.noCategory")}</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name_en}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          {/*
            Defaulted to the creating agent's own department (via useMe() and
            the departments/ reference list), because a ticket with no
            department is invisible to its own creator: scope_tickets shows an
            agent only tickets in their department, assigned to them, or
            watched by them — none of which a department-less new ticket is.
          */}
          <Label htmlFor="department">{t("newTicket.department")}</Label>
          <select
            id="department"
            data-testid="new-ticket-department"
            className="mt-1.5 h-10 w-full rounded-lg border border-line bg-background px-3 text-[13px]"
            {...register("department")}
          >
            <option value="">{t("newTicket.noDepartment")}</option>
            {(departments ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name_en}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="priority">{t("newTicket.priority")}</Label>
            <select
              id="priority"
              className="mt-1.5 h-10 w-full rounded-lg border border-line bg-background px-3 text-[13px]"
              {...register("priority")}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {t(`priority.${priority}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="channel">{t("newTicket.channel")}</Label>
            <select
              id="channel"
              className="mt-1.5 h-10 w-full rounded-lg border border-line bg-background px-3 text-[13px]"
              {...register("channel")}
            >
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {t(`channel.${channel}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button type="submit" disabled={create.isPending} data-testid="create-ticket-submit">
          {create.isPending ? t("newTicket.creating") : t("newTicket.submit")}
        </Button>
      </form>
    </div>
  );
}
