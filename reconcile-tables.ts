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

// Orders which are mark as cancelled should never appear on a finance export. Neither should test orders.
function isValid(order: Order): boolean {
  if (order.status === "cancelled") {
    return false;
  }

  if (order.is_test_order) {
    return false;
  }

  return true;
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

  console.log(orders[0], "first order");

  const validOrders = orders.filter(isValid);

  console.log(`rows in file: ${orders.length}`);
  console.log(`valid orders: ${validOrders.length}`);
}

main();
