# Landing page: design plan (v7)

**Subject.** Packer Tools is the inventory, packing and check-out system for crews with a lot of gear: broadcast, film,
AV and events first, plus rental houses, rigging, sports and field teams. The page has to make a working crew lead think
"this is the thing that stops the missing-charger problem", then let them start free.

**Vernacular we design from (not from SaaS templates):** road/flight cases, cut-foam layouts, gaffer-tape labels written in
marker, asset tags, run sheets, load lists, ATA carnet manifests, hazard tape.

## Tokens
| Role | Value |
|---|---|
| Concrete (page) | `#DDE0DC` cool grey; raised surface `#ECEEEA` |
| Foam (dark surface) | `#202427`, cutout `#111417`, case shell `#0B0D0F` |
| Ink | `#14181B`, soft `#4A5257` (6.2:1 on concrete) |
| Tape (label surface) | `#F2F0E6` with marker ink `#1A1D20` |
| Hazard orange (brand `#FF5500`) | signal only: primary action, "out / missing". Dark ink text on it (white fails AA) |
| Check green | `#2F8F5B` on dark, `#1F6B42` on light |
| Caution yellow | `#F2C200`, one hazard-tape rule, nothing else |

Type: **Big Shoulders Display** (Chicago street-signage headlines, 800/900) + **Barlow** (highway-sign body) +
Barlow Semi Condensed for IDs/tables + **Permanent Marker** *only* on tape labels. Body 17px / 1.55, measure ≤ 68ch.

## Layout concept
Light concrete "floor" sections alternate with dark "foam" sections. Left-aligned copy, big left-aligned signage headlines.
```
HERO        [ headline + sub + CTA ]     [ OPEN CASE, top-down, cut foam, one EMPTY slot ]
PROBLEMS    dark foam wall, tape strips at slight angles, each with the fix underneath
HOW IT RUNS 4 real steps (numbered: it IS a sequence), each with a small artefact (label, list, signature, flag)
KIOSK       dark: copy + tablet you can flip through (scan / sign / receipt)
MANIFEST    "everything in the case": modules grouped by job, plan badges from LIVE plan data
WHO         industry list -> panel with the kit, what goes wrong, what Packer Tools does
VS          spreadsheet + group chat vs Packer Tools, plain rows
CLAUDE      ask Claude about your kit (connector), honest example
PRICING     live plans, real limits, USD note
FAQ         native <details>
CTA + FOOT
```

## Review against the defaults (what I changed, and why)
- *Dark page + vermilion accent* is the common look, and it was the old page. Now: light concrete + dark foam; orange is a
  **signal** (missing/out/primary action), never decoration.
- *Three identical rounded feature cards* -> a **manifest** grouped by job with live plan badges; tape strips for problems.
- *Tracked ALL-CAPS eyebrows, mono micro-labels, "->" on buttons*: none. Labels are **tape** carrying real info (asset IDs).
- *Hero = big number + gradient* -> the memorable thing is the **open case**: cut foam, every item tagged, one slot empty
  and orange. Click it and the item returns (check-in), click again to sign it out. It *is* the product in one gesture.
- *Fade-up on every section* -> none. One orchestrated moment (items settle into the foam on load) plus motion that answers
  clicks. `prefers-reduced-motion` respected.
- *Numbered markers* only on "How it runs" (a real sequence).
- *Invented proof*: none. No customer counts, logos or quotes. Sample data is labelled as sample.

## Honesty rules
Every capability claimed exists in the code today. Kiosk, signatures, projects, departments are **Pro and up**; the page says so.
Prices, limits, trial length and plan features come from `adminSettings.plans` (single source of truth). Checkout is charged in USD.
