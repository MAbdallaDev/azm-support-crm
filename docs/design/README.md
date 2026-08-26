# Design — AZM Squad Customer Support CRM

Twelve artboards specifying every screen in the MVP. Published canvas:
**https://claude.ai/code/artifact/217bc985-1f5c-4817-af6c-4aaacbda09a9**

## Files

Each `.dc.html` is a self-contained HTML artboard — open it in a browser, or read the source, where
the inline styles carry the exact specification (colours, sizes, spacing, radii). `canvas.json` lays
them out on the published canvas. `support-crm-design.html` is the generated canvas; it is a build
output, not a source file — edit the `.dc.html` files and re-seed.

| Artboard | Screen | Built by |
|---|---|---|
| `DesignSystem.dc.html` | Palette, type scale, badges, SLA states, buttons, inputs | Story 06 |
| `Login.dc.html` | Agent sign-in | Story 06 |
| `Main.dc.html` | **Ticket workspace** — queue / conversation / context | Story 07 |
| `Dashboard.dc.html` | Agent dashboard | Story 07 |
| `Customer360.dc.html` | Customer detail | Story 08 |
| `KnowledgeBase.dc.html` | KB browse + article reader | Story 08 |
| `KBEditor.dc.html` | Bilingual article editor | Story 08 |
| `Reports.dc.html` | Manager reports | Story 09 |
| `PortalHome.dc.html` | Portal home | Story 09 |
| `PortalSubmit.dc.html` | Submit a request | Story 09 |
| `PortalTicket.dc.html` | Portal request detail + CSAT | Story 09 |
| `TicketWorkspaceRTL.dc.html` | The workspace in Arabic/RTL | Stories 06, 07, 10 |

## Decisions this design settles

- **Type**: IBM Plex Sans, IBM Plex Sans Arabic, IBM Plex Mono. Chosen because Arabic is a hard
  requirement and Plex has a real Arabic cut in the same grotesque register as the Latin.
- **Arabic flips completely**, top chrome included. This was the open question in the first draft.
  Latin fragments stay LTR inside Arabic text — ticket numbers, phone numbers, email addresses,
  SLA policy names — using `dir="ltr"` on those spans.
- **Numerals stay Western** (0–9) in both languages.
- **Priority, status and channel are three separate badge families** and must never share a colour.
  SLA has its own three-state colour scale: ok, approaching, breached.
- **The portal is visually a different product** — its own header, no agent navigation, no global
  search, no Admin link — because it is a different trust boundary, not a filtered view.

## Rule for implementation

Where an artboard and a story's acceptance criteria disagree, the **artboard wins on layout and
visual detail**; the **criteria win on behaviour**.

## Regenerating the canvas

The artboards are the source. After editing any of them, re-seed and republish the canvas with the
`/design` skill rather than editing `support-crm-design.html` directly.
