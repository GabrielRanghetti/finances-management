# Design

The app looks like a household ledger on paper: a warm grey desk, an off-white sheet for the content of each screen, dark ink for text, and colour used only where it carries meaning. It is light only. Screens are in Brazilian Portuguese and every string lives in `src/messages/pt-BR.ts`.

The approved mock-ups are on a private canvas kept by the owner. This file is the written version of what they show and is the reference for all UI work.

## Tokens

Declared once in `src/app/globals.css`. Components use the tokens, never a literal colour or font.

| Token | Value | Use |
|---|---|---|
| `--background` (desk) | `oklch(94.3% 0.008 64)` | Page background |
| `--card` (sheet) | `oklch(98.8% 0.0045 80)` | The sheet that holds a screen's content, inputs |
| `--secondary`, `--muted` (paper) | `oklch(94.5% 0.007 55)` | Hover backgrounds, the groove of the scope toggle |
| `--accent` (paper, darker) | `oklch(91.5% 0.009 55)` | Current navigation item, loading skeletons |
| `--foreground` (ink) | `oklch(21% 0.012 38)` | Text |
| `--muted-foreground` | `oklch(47% 0.013 45)` | Labels, table heads, helper text |
| `--border` | `oklch(87% 0.009 55)` | Row rules |
| `--input` | `oklch(47% 0.013 45)` | Input borders |
| `--primary` | `oklch(22% 0.011 40)` | The one filled button on a screen |
| `--primary-foreground` | `oklch(96.5% 0.006 70)` | Text on the filled button |
| `--ring` | `oklch(54% 0.17 30)` | Focus ring |
| `--positive` | `oklch(44% 0.11 150)` | Money coming in |
| `--negative`, `--destructive` | `oklch(52% 0.19 27)` | Money going out, debts, errors |
| `--radius` | `0.5rem` | Sheets and buttons; inputs use 6px |

Spacing follows the 4px scale Tailwind already has. Controls are 36 to 40px tall on desktop and at least 44px on touch screens.

## Type

Hanken Grotesk for all text, in weights 400, 500 and 600. Geist Mono for every figure in a column, with tabular numerals, so amounts line up. Headings are sentence case at weight 600. Labels and table heads are one step smaller than body text, weight 500, in the muted colour. Never use tracked capitals or small caps.

## Money

- An amount coming in is green and starts with a plus sign.
- An amount going out, and anything owed, is red and starts with a minus sign (the character `−`).
- A balance you hold is ink, with no sign.
- A transfer between the owner's own accounts is ink, with no sign. It is neither income nor expense.
- The sign is always present when the colour is, so colour is never the only cue.
- Amounts are right aligned and formatted as `1.234,56`. The currency symbol appears once near the figure it belongs to, not on every row.

## Words

Use plain words over accounting terms.

| Say | Instead of |
|---|---|
| O que você tem | Ativos |
| O que você deve | Passivos |
| Pessoal, Empresa, Tudo | PF, PJ, Ambos |
| Entre contas suas | Transferência interna |
| Entrou, Saiu, Sobrou | Receitas, Despesas, Resultado |

## Layout

- A top bar holds the app name, the main destinations, the scope groove (on screens that filter by scope) and one filled action. Destinations that do not fit sit under "Mais". Below 60rem the bar and destinations wrap so every destination stays reachable on screen.
- A screen's content sits on one sheet. Sections inside it are separated by rules. Do not put a card inside a card.
- Lists of records are tables: sentence-case heads that do not wrap, horizontal rules only, no outer border. A wide table scrolls inside its own box on a phone.
- The scope toggle (Pessoal, Empresa, Tudo) is a groove with the chosen option raised. The choice lives in the URL.
- Filters, tabs and pagination also live in the URL.

## Overview screen

One sheet. The net worth is the largest thing on it, with the date. Below it, one sentence gives the change in the current month and over 12 months. Then a single line chart of the last 12 month ends, drawn as inline SVG with three gridlines and one ink line. When the axis does not start at zero, a caption says where it starts. Then the ledger that adds up to the figure: what you have by class, what you owe by class, and the total. No row of KPI cards, no pie or donut charts.

When a company sends money to its owner, the "Pessoal" view counts it as money in, the "Empresa" view counts it as money out, and the "Tudo" view counts it as neither.

## States

Every region that loads data has four states: full, loading (a skeleton shaped like the content), empty (what belongs here and the action that fills it) and error (what failed, what was not changed, and a retry).

## Rules that always hold

- Every interactive element has a visible `:focus-visible` ring.
- Only `transform` and `opacity` are animated, for 120 to 220ms, and `prefers-reduced-motion` turns it off.
- No gradients, no emoji as icons, no decorative status dots.
- No figure appears that the data does not support.
- Text contrast is at least 4.5:1.

## Not built yet

The "Conciliado" mark (shown when the ledger balance equals the balance the bank reports) needs the bank's reported balance to be stored first. Applying this design to every screen other than the shell and the overview is a later story.
