import { readFileSync } from "node:fs";

// Run: node --experimental-strip-types reconcile-tables.ts

type Order = {
  order_id: string;
  created_at: string;
  channel: string;
  gross: number;
  refund: number;
  currency: string;
  status: string;
  is_test_order: boolean;
};

const seenIds = new Set<string>();

// Orders which are mark as cancelled should never appear on a finance export. Neither should test orders.
// An order id that already appeared is the same order exported twice, so only the first copy counts.
function isValid(order: Order): boolean {
  if (order.status === "cancelled") {
    return false;
  }

  if (order.is_test_order) {
    return false;
  }

  if (seenIds.has(order.order_id)) {
    return false;
  }

  seenIds.add(order.order_id);
  return true;
}

// CAD orders are converted at a flat rate. Solved from Email on 2026-01-06 and confirmed on the other channels.
const CAD_TO_USD = 0.74;

// Storefront channel label -> channel name used in the finance export.
const CHANNEL_MAP: Record<string, string> = {
  "(direct)": "Direct",
  email: "Email",
  google: "Paid Search",
  facebook: "Paid Social",
  fb: "Paid Social",
  "Facebook Ads": "Paid Social",
  affiliate: "Other",
  tiktok: "Other",
};

// Revenue is gross minus refund, in USD.
function netRevenueUsd(order: Order): number {
  const net = order.gross - order.refund;

  if (order.currency === "USD") {
    return net;
  }

  if (order.currency === "CAD") {
    return net * CAD_TO_USD;
  }

  throw new Error(`Unknown currency ${order.currency} on ${order.order_id}`);
}

function financeChannel(order: Order): string {
  const channel = CHANNEL_MAP[order.channel];

  if (!channel) {
    throw new Error(`Unknown channel ${order.channel} on ${order.order_id}`);
  }

  return channel;
}

function main() {
  const lines: string[] = readFileSync("orders.csv", "utf8")
    .trim()
    .split("\n")
    .slice(1);

  const orders: Order[] = lines.map((line) => {
    const [
      order_id,
      created_at,
      channel,
      gross,
      refund,
      currency,
      status,
      is_test_order,
    ] = line.split(",").map((value) => value.replace(/"/g, ""));

    return {
      order_id,
      created_at,
      channel,
      gross: Number(gross),
      refund: Number(refund),
      currency,
      status,
      is_test_order: is_test_order === "true",
    };
  });

  const validOrders = orders.filter(isValid);

  console.log(`rows in file: ${orders.length}`);
  console.log(`valid orders: ${validOrders.length}`);

  // Sum revenue per day and channel. Key looks like "2026-01-06|Direct".
  const ourTotals = new Map<string, number>();

  for (const order of validOrders) {
    const day = order.created_at.slice(0, 10);
    const key = `${day}|${financeChannel(order)}`;
    ourTotals.set(key, (ourTotals.get(key) ?? 0) + netRevenueUsd(order));
  }

  // Read the finance export into the same shape.
  const financeLines: string[] = readFileSync("finance_export.csv", "utf8")
    .trim()
    .split("\n")
    .slice(1);

  const financeTotals = new Map<string, number>();

  for (const line of financeLines) {
    const [date, channel, revenueUsd] = line.split(",");
    financeTotals.set(`${date}|${channel}`, Number(revenueUsd));
  }

  // Compare every day/channel that appears on either side.
  const keys = [...new Set([...ourTotals.keys(), ...financeTotals.keys()])].sort();
  let matched = 0;

  for (const key of keys) {
    const ours = ourTotals.get(key) ?? 0;
    const theirs = financeTotals.get(key) ?? 0;
    const diff = ours - theirs;

    if (Math.abs(diff) < 0.005) {
      matched += 1;
    } else {
      console.log(`${key.padEnd(23)} ours ${ours.toFixed(2).padStart(9)}  finance ${theirs.toFixed(2).padStart(9)}  diff ${diff.toFixed(2).padStart(9)}`);
    }
  }

  console.log(`\n${keys.length} day/channel cells, ${matched} match, ${keys.length - matched} do not`);
}

main();
