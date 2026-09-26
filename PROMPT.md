# Prompt: 1-Year Buydown Mortgage Amortization Calculator

Build a single-page web application that calculates the amortization schedule of a
mortgage with a 1-2 year buydown, starting from the loan's **current outstanding
principal** (i.e., it must work for a loan already in progress, not just a new loan).
The app must run locally in a browser with no backend and be deployable to any
static hosting platform at zero or near-zero monthly cost. All computation happens
client-side; no user data leaves the page.

## Inputs

1. **Current Outstanding Principal ($)** — the balance owed today.
2. **Note Interest Rate (% per year)** — the rate on the mortgage note, which applies
   after the buydown period ends.
3. **Buydown Reduction (%)** — the rate discount during the buydown (a "1-0 buydown"
   = 1%). Default 1%.
4. **Buydown Months Left** — how many buydown months remain (0–12, default 12).
5. **Remaining Term** — years + additional months (e.g., 30 years 0 months).
6. **First Payment Month** — a month/year picker; defaults to next month. Used to
   label every schedule row with a real calendar month.
7. **Current Monthly Payment ($)** — what the borrower actually pays today (P&I).
   Optional; blank/0 means "use the scheduled payment".
8. **Extra Payments Toward Principal** — a list of user-defined rules, each with:
   - Amount ($)
   - Frequency: one-time, monthly, quarterly, or yearly
   - Start month (payment number)
   - End month (optional; blank = until payoff; disabled for one-time)
   Rules can be added and removed dynamically; multiple rules combine.
9. **Mode toggle** — two options:
   - **Keep payment, pay off early** (default)
   - **Recast — lower payment**: selecting this reveals a **Recast Starting Month**
     date picker (defaults to the month after the buydown ends).

## Calculation rules

### Scheduled payments (buydown structure)
- During the buydown months, the monthly payment amortizes the principal at the
  reduced rate (note rate − buydown reduction) over the full remaining term.
- A real buydown fixes both payments at origination: compute the **projected**
  balance at the end of the buydown (assuming no extra payments), then compute the
  post-buydown payment as the amount that amortizes that projected balance at the
  note rate over the remaining months. This contractual post-buydown payment does
  **not** change when extra payments are made during year 1 — extras shorten the
  loan instead.
- Handle a 0% rate (payment = balance / months) and reject invalid input
  (buydown reduction ≥ note rate, term < 1 month, buydown months > term).

### Interest and principal per month
- Interest for a month = current balance × (applicable annual rate / 12). The
  applicable rate is the reduced rate during buydown months and the note rate after.
- Scheduled principal = payment − interest (never negative).

### Current Monthly Payment overage
- Each month, any amount by which the entered Current Monthly Payment exceeds the
  scheduled payment is automatically applied as extra principal
  (`overage = max(0, currentPayment − scheduledPayment)`).
- If the entered payment is below the scheduled payment, no overage is applied and
  the scheduled payment is used.

### Extra payments
- Each month, total extra principal = sum of all matching extra-payment rules
  (per their frequency and start/end months) + the current-payment overage.
- Final month cap: scheduled principal is capped at the remaining balance, and the
  extra payment fills only what remains — the balance never goes negative and any
  unused extra is not charged.

### Recast (one-time, dated event)
- When recast mode is selected and a recast month is chosen: from that month, the
  remaining balance is re-amortized over the remaining term at the then-current
  rate. The payment changes **once**, on that date, and stays fixed afterward.
- Before the recast month, the schedule is identical to "keep payment" mode.
- A recast invalidates the Current Monthly Payment: the overage stops applying from
  the recast month onward. After the recast, only the explicit extra-payment rules
  are applied to principal.
- If no recast date is chosen, or the date falls outside the loan term, the recast
  simply never happens (behavior identical to keep-payment mode, overage applies
  throughout).
- A recast date before the first payment recasts at month 1.
- The recast month is visually marked in the schedule.

### Baseline comparison
- Always also compute a baseline schedule: same loan, no extra-payment rules, no
  current-payment overage, no recast. Use it to derive interest saved and time saved.

## Outputs

1. **A summary of the key figures**, animated on change:
   - Payment · Year 1 (with the buydown rate and the monthly saving vs. the note
     rate; if a current payment is entered, show the resulting monthly amount going
     to principal)
   - Payment · After Buydown (at the note rate)
   - Payoff In (months, calendar month of payoff, and months sooner vs. baseline)
   - Total Interest (with the baseline total for comparison)
   - Interest Saved (vs. baseline, from early/extra payments)
   - Extra Principal Paid (total)
2. **Amortization table**, one row per month until the balance reaches zero:
   month number, calendar month, annual rate, scheduled payment, interest,
   principal, extra payment, ending balance. Buydown rows and the recast month are
   visually marked; extra payments are highlighted; the final row is marked.
3. **Balance-over-time chart**: two lines — the actual schedule and the
   no-extras baseline.
4. **CSV export** of the full schedule (month #, month, rate, payment, interest,
   principal, extra payment, ending balance).

## Behavior

- **Automatic recalculation on every input change** (debounced), plus an explicit
  Recalculate button.
- The Rate column and all rate labels must show the **annual** rate (e.g., 5.375%
  during the buydown for a 6.375% note with a 1% reduction), not the monthly
  periodic rate used internally.
- Input validation with clear error messages; no negative balances, no NaN output.

## UI/UX

- The layout and controls are entirely up to the implementer — choose whatever
  modern UX patterns fit the functionality; nothing here prescribes placement.
- Prefer **lightweight frameworks and libraries** for styling, charts, and visual
  effects. The app should stay fast to load and simple to host; avoid heavy
  toolchains or build steps unless they clearly earn their keep.
- The experience must be **modern, simple, and genuinely attractive**:
  - Clean, readable typography with a clear visual hierarchy — the key numbers
    (payments, interest saved, payoff date) should draw the eye first.
  - Generous whitespace and an uncluttered layout; group related controls so the
    form never feels overwhelming.
  - Subtle, purposeful motion (e.g., animated number transitions, smooth
    highlight changes) that makes recalculation feel alive without being flashy.
  - Thoughtful touches: sensible defaults, inline hints, disabled states that
    explain themselves, highlighted buydown/recast/extra rows, and empty states
    that guide the user.
  - Fully responsive — comfortable on a phone as well as a wide desktop, with no
    overlapping or clipped content.
  - Accessible basics: labeled inputs, keyboard-friendly controls, and sufficient
    contrast.

## Acceptance checks (must all pass)

For principal $350,000, note rate 6.5%, 1% buydown for 12 months, 30-year term:
- Year-1 payment = $1,987.26; post-buydown payment = $2,207.11; month-1 interest =
  $1,604.17; balance reaches exactly $0.00 at month 360 with no extras.
- Payment formula sanity: PMT($350,000, 5.5%/12, 360) = $1,987.26;
  PMT($350,000, 6.5%/12, 360) = $2,212.24.
- A one-time $10,000 extra at month 6 in keep mode shortens the loan (payments
  unchanged); in recast mode with a recast date after month 6, the payment changes
  once at the recast month and the loan still ends at the original term.
- Current Monthly Payment of $2,500 applies $512.74/mo extra during year 1 and
  $292.89/mo after the buydown; with a recast date set, the overage stops exactly
  at the recast month and only explicit extra rules apply afterward.
- An extra payment larger than the balance pays the loan off that month with no
  negative balance and no overcharge.
- Frequency rules: a quarterly rule starting month 3 hits months 3, 6, 9, …;
  a yearly rule starting month 12 hits 12, 24, 36, …; rules respect their end month.
