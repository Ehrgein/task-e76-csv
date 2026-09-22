# Daily revenue reconciliation: storefront orders vs finance export

We compared the storefront orders with the finance daily revenue report for 6 January to 4 February 2026. Most days agree to the cent. Where they don't, the reasons are listed below: the ones we settled ourselves, and some we are unable to decide.

The reconciled daily revenue by channel is in `reconciled_daily_revenue.csv`.

## Differences we resolved

1. **Duplicate rows.** Five order ids appear twice in the storefront export, identical on every column. Finance counted four of them twice, overstating four days by 232.16.
   **Solution:** one order id is one order. Only the first row is counted.

2. **Cancelled orders.** 27 orders are marked cancelled. Finance includes 14 of them and excludes 13.
   **Solution:** cancelled orders are not revenue. All are excluded. See question 2 for the 14.

3. **Test orders.** Ten orders are flagged as test. Finance excludes them too.
   **Solution:** test orders are not revenue.

4. **Refunds.** Some orders are partly or fully refunded. Finance reports net of refunds.
   **Solution:** revenue is gross minus refund.

5. **Currency.** Some orders are in CAD, finance reports USD, and no rate was supplied. A flat 0.74 ties every CAD order on every day (we reverse-engineered this value from totals on the exports csv file.)
   **Solution:** CAD converts at 0.74. See question 4.

6. **Channel labels.** The storefront uses eight labels, finance uses five channels. One mapping ties all 128 matching days: `(direct)` to Direct, `email` to Email, `google` to Paid Search, `facebook`, `fb` and `Facebook Ads` to Paid Social, `affiliate` and `tiktok` to Other.
   **Solution:** We require confirmation here, as we do not know if tiktok is meant to be other, or Paid Social. See question 3.

7. **Day boundary.** All storefront timestamps are between 14:00 and 23:59 UTC, so the two systems could have been on different calendars. They are not: every day except February 4 ties on the UTC date.
   **Solution:** an order belongs to the UTC date it was created (this could be different if the date is not meant to use UTC, but branch/pos time, or any other)

8. **Rounding.** Rounding each converted order to cents before summing breaks seven days that otherwise tie.
   **Solution:** sum exactly, round once at the end.

## Differences we could not resolve

The answer to each of these is not in the data. The reconciled table takes a position so the number is usable, but it should not be trusted until you confirm.

1. **February 4 is cut short in finance.** Finance has every order up to 21:35 UTC that day and none after. The storefront has five more, worth 711.75 (E76-1735, E76-1721, E76-1712, E76-1708, E76-1707).
   **Position taken:** the full day is included.
   > **Question:** Your finance export for February 4 contains no orders after 21:35 UTC. The storefront has five more that day, worth 711.75 USD. Was that export run before the day closed, and should we treat February 4 as final or re-run it?

2. **Finance includes some cancelled orders and not others.** 14 cancelled orders are in finance's totals, worth 1,389.34. 11 others are not, sometimes on the same day. Nothing in the data separates the two groups. The storefront has no cancelled-at timestamp, so late cancellations cannot be identified.
   **Position taken:** all cancelled orders are excluded.
   > **Question:** Finance includes 14 orders the storefront marks cancelled, worth 1,389.34, and excludes 11 others, sometimes on the same day. Were the 14 cancelled after finance closed the day? Should cancelled orders be reversed out of reported revenue, or left as booked?

3. **TikTok is booked under Other.** That is how finance does it, and we matched it. It may not be what the business intends.
   **Position taken:** TikTok is still considered to be under "Other" channel.
   > **Question:** Finance books TikTok under Other, not Paid Social, and we've matched that. Is that intentional?

4. **The CAD rate was reverse engineered.** 0.74 ties, but we do not know where it comes from or whether it changes.
   **Position taken:** flat 0.74.
   > **Question:** We reconciled CAD at a flat 0.74, which ties to the cent across the whole period. Is that a fixed rate you set, or does it come from an external source that changes?

5. **One cent on January 20, Other.** After the cancelled orders are accounted for, finance is still 0.01 higher. No rounding rule reproduces it. Immaterial, listed so it is not hidden.

The 14 cancelled orders in finance: E76-1229, E76-1262, E76-1301, E76-1297, E76-1341, E76-1365, E76-1362, E76-1351, E76-1370, E76-1388, E76-1469, E76-1548, E76-1574, E76-1569.
The 11 not in finance: E76-1009, E76-1095, E76-1141, E76-1121, E76-1267, E76-1440, E76-1441, E76-1448, E76-1560, E76-1642, E76-1716.

## Checks that would catch each of these next month

- Duplicate order ids in the storefront export: fail if any id appears more than once.
- Cancelled or test orders reaching finance: match finance's orders to the storefront by id and flag any cancelled or test order present.
- Unknown channel label: let it fall into Other so the run completes, but flag it so someone maps it before the numbers are reported.

## What to change about how the extracts are produced

- The storefront export should not emit the same order twice.
- Add a cancelled-at timestamp to the storefront export, so late cancellations can be identified and reversed.
- Run the finance export after the day has closed, or stamp it with the time it was run.
- Have finance record the FX rate it applied, instead of leaving it to interpretation.
- Add a `category` column to the storefront export next to the existing source label, using finance's channel names (for example category `Paid Social`, source `tiktok`). Finance then groups by category and the mapping table disappears. A new source can never land in the wrong channel, because the two are set together at the point of sale.

## Reproducing the table

`reconcile-tables.ts` applies the solutions above to `orders.csv` and writes `reconciled_daily_revenue.csv` (`date, channel, revenue_usd`). Node 22 or later, no dependencies:

```
node --experimental-strip-types reconcile-tables.ts
```
