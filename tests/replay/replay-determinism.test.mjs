import test from "node:test";
import assert from "node:assert/strict";

function replay(events) {
  return events.reduce(
    (state, event) => {
      switch (event.type) {
        case "order.created":
          return {
            ...state,
            orders: {
              ...state.orders,
              [event.orderId]: {
                orderId: event.orderId,
                siteId: event.siteId,
                totalMinor: event.totalMinor,
                status: "created",
                version: 1,
              },
            },
          };
        case "payment.authorized": {
          const current = state.orders[event.orderId];
          return {
            ...state,
            orders: {
              ...state.orders,
              [event.orderId]: {
                ...current,
                status: "paid",
                paymentId: event.paymentId,
                version: current.version + 1,
              },
            },
          };
        }
        case "fulfillment.queued": {
          const current = state.orders[event.orderId];
          return {
            ...state,
            orders: {
              ...state.orders,
              [event.orderId]: {
                ...current,
                status: "fulfillment_queued",
                fulfillmentJobId: event.jobId,
                version: current.version + 1,
              },
            },
          };
        }
        default:
          throw new Error(`Unknown event type ${event.type}`);
      }
    },
    { orders: {} },
  );
}

test("same event stream produces identical projection state", () => {
  const events = [
    { type: "order.created", orderId: "ord_1", siteId: "site_1", totalMinor: 199900 },
    { type: "payment.authorized", orderId: "ord_1", paymentId: "pay_1" },
    { type: "fulfillment.queued", orderId: "ord_1", jobId: "job_1" },
  ];

  assert.deepEqual(replay(events), replay(structuredClone(events)));
});

test("event order remains part of replay determinism", () => {
  const ordered = [
    { type: "order.created", orderId: "ord_1", siteId: "site_1", totalMinor: 199900 },
    { type: "payment.authorized", orderId: "ord_1", paymentId: "pay_1" },
  ];
  const reversed = [...ordered].reverse();

  assert.throws(() => replay(reversed), /Cannot read/);
});
