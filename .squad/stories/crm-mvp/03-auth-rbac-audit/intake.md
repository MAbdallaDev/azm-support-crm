> **Title hint (from CLI):** Auth, roles & permissions, audit log

# Story intake

- Folder: `.squad/stories/crm-mvp/03-auth-rbac-audit/intake.md`
- Project: **AZM Squad Customer Support CRM** — a 2-day MVP skills-assessment build.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** CRM MVP
- **Feature slug (folder under `plans/`):** `crm-mvp`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `03-auth-rbac-audit`
- **Work item type:** Story

---

## Title

```
Auth, roles & permissions, audit log
```

---

## Description

Add JWT authentication, role-based access control, and an automatic audit trail.

This is the story where the Odoo developer's instincts transfer most directly, and the plan should
lean on that. Odoo enforces access in two layers: `ir.model.access` decides *whether you may touch
this model at all*, and record rules decide *which rows you may see*. Django REST Framework splits
along the same seam — permission classes are the model layer, `get_queryset()` filtering is the record
layer — and both layers are needed here. Getting only the first is the classic mistake: an agent who
is correctly denied the ability to delete customers can still list every customer in the database.

Four roles: **admin** sees everything and reaches Django admin; **manager** sees their whole
department, reassigns tickets, and reads reports; **agent** sees tickets in their department plus any
ticket assigned to or watched by them; **customer** sees only tickets belonging to their own linked
Customer record, and only public messages within them.

The audit log must be automatic. If it depends on developers remembering to call it, it will be
incomplete by story 05.

---

## Acceptance criteria

```
1.  POST /api/v1/auth/login/ with email + password returns access and refresh tokens.
    POST /api/v1/auth/refresh/ exchanges a refresh token. Tokens carry the user id and role.
2.  GET /api/v1/auth/me/ returns id, email, full name, role, department, branch, tier,
    language, and avatar. 401 without a token.
3.  Permission classes in apps/accounts/permissions.py: IsAdmin, IsManager, IsAgent,
    IsCustomer, IsAgentOrAbove, IsOwnerOrAgentOrAbove. Each is unit-tested directly.
4.  Row-level scoping is implemented in get_queryset(), not in the view body, so it cannot be
    bypassed by a detail route:
      admin     -> everything
      manager   -> tickets and customers in their department
      agent     -> tickets in their department, plus assigned-to-me and watched-by-me
      customer  -> tickets whose customer == request.user.customer, and within those,
                   only TicketMessage rows where is_internal is False
5.  A customer requesting another customer's ticket by id gets 404, not 403 — do not confirm
    the existence of records they cannot see.
6.  AuditLog is written automatically by post_save and post_delete signals for Ticket,
    Customer, KBArticle and User. Each row records the actor, the action, and a JSON diff of
    changed fields only. The actor is resolved from the request via thread-local middleware.
7.  Password changes, token issuance and failed logins are audited. Password values never
    appear in the changes JSON — assert this in a test.
8.  Audit rows are immutable: readonly in Django admin, no update or delete endpoint.
9.  Tests cover every role against every scoped endpoint, both the allowed and the denied
    direction. The internal-note leak in criterion 4 has its own explicit regression test.
```

---

## Attachments

None.

---

## Dependencies

- **Blocked by / related ids:** `02-models-admin-seed`
- **Depends on code areas or other stories:** `accounts.User` and `accounts.AuditLog` from story 02.
  The four seeded logins from `seed_demo` are the fixtures the tests should authenticate as.

## Technical hints

**Stack — fixed, do not re-litigate.** Backend: Python 3.12, Django 5, Django REST Framework 3.15,
`djangorestframework-simplejwt`, `django-filter`, `django-cors-headers`, `drf-spectacular`,
PostgreSQL 16, `pytest-django`. Frontend: React 19 + TypeScript + Vite, Tailwind CSS, shadcn/ui,
TanStack Query, React Router, react-hook-form + zod, i18next, Recharts, axios, Vitest.
Infra: Docker Compose services `db`, `api`, `web`.

**Repository layout.**
```
backend/{manage.py,requirements.txt,pytest.ini,Dockerfile,config/,apps/{accounts,customers,tickets,kb,ai,reports,portal}}
frontend/src/{api,components/ui,features,i18n,routes,lib}
docs/{00-project-brief.md,design/,AI_USAGE.md,DEMO.md,SUMMARY.md}
```

**Author background.** The developer is an Odoo developer learning Django. Where a Django concept has
a direct Odoo equivalent, name it in a short code comment: `ir.model.access` / record rules → DRF
permission classes and `get_queryset()` scoping; `mail.thread` chatter → `TicketMessage` +
`TicketEvent`; Odoo backend list/form views → Django admin; `ir.cron` → management command.

**Bilingual convention.** User-facing content models carry paired `_en` / `_ar` columns
(`name_en`/`name_ar`, `title_en`/`title_ar`, `body_en`/`body_ar`). No translation library.

**Journal rule — applies to every story.** This story is not complete until an entry is appended to
`docs/AI_USAGE.md` using the plain-language template in `docs/00-project-brief.md` section 5:
what was asked for, what the AI built, what it decided on its own, what had to be corrected, what
was learned. Record elapsed time.

## Out of scope

- Ticket and customer endpoints themselves — story 04. This story delivers the permission
  classes and the scoping helpers; story 04 attaches them to viewsets.
- Portal-specific endpoints — story 05.
- Any login screen. The React login page is story 06.
- Password reset by email, 2FA, and SSO. All Phase 2.
