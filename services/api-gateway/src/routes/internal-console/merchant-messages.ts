import { Hono } from "hono";
import { z } from "zod";
import {
  MerchantMessageQuerySchema,
  MerchantMessageCommandSchema,
} from "@letbuyy/shared-types";
import type { Env } from "../../index";
import { getSupabaseAdmin, success } from "../../lib/supabase";
import { AppError, ValidationError } from "../../lib/errors";
import {
  credentialArguments,
  requireConsolePermission,
  requireAcceptedConsoleResult,
} from "../../identity-foundation/console-approval-repository";
import type { Context } from "hono";
const router = new Hono<{ Bindings: Env }>();
const errors: Record<
  string,
  { status: 400 | 403 | 404 | 409; message: string }
> = {
  MESSAGE_ADMIN_REQUIRED: {
    status: 403,
    message: "Only platform super admins can manage merchant messages.",
  },
  MESSAGE_INVALID: {
    status: 400,
    message: "Check the message and recipient fields.",
  },
  MESSAGE_NOT_FOUND: { status: 404, message: "Message not found." },
  MESSAGE_CHANGED: {
    status: 409,
    message:
      "This draft changed or was already published. Reload it before continuing.",
  },
  MESSAGE_KEY_CONFLICT: {
    status: 409,
    message: "This request key belongs to a different message action.",
  },
  MESSAGE_AUDIENCE_CHANGED: {
    status: 409,
    message:
      "The recipient list changed. Review the audience again before publishing.",
  },
  MESSAGE_AUDIENCE_INVALID: {
    status: 409,
    message:
      "Choose between one and 10,000 eligible merchant accounts. Refresh selected accounts.",
  },
  MESSAGE_EXPIRED: {
    status: 409,
    message:
      "The offer expiry is already past. Update the draft before publishing.",
  },
};
async function execute(
  c: Context<{ Bindings: Env }>,
  operation: string,
  input: Record<string, unknown>,
) {
  const { credential, witness, state } = await requireConsolePermission(
    c,
    operation === "save" || operation === "publish"
      ? "support:manage"
      : "support:view",
    operation === "publish",
  );
  if (!state.is_super_admin)
    throw new AppError(
      errors.MESSAGE_ADMIN_REQUIRED.message,
      403,
      "MESSAGE_ADMIN_REQUIRED",
    );
  const { data, error } = await getSupabaseAdmin(c).rpc(
    "console_merchant_messages_v1",
    {
      ...credentialArguments(credential),
      p_permission_hash: witness,
      p_operation: operation,
      p_input: input,
    },
  );
  if (error)
    throw new AppError(
      "Merchant messaging is unavailable. Check the original request before retrying.",
      503,
      "MESSAGE_UNAVAILABLE",
    );
  if (data?.accepted !== true) {
    const known = errors[data?.code];
    if (known) throw new AppError(known.message, known.status, data.code);
    requireAcceptedConsoleResult(data);
  }
  return c.json(success(data.data, { replayed: data.replayed || false }));
}
router.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});
for (const [path, operation] of [
  ["/", "list"],
  ["/accounts", "accounts"],
] as const)
  router.get(path, async (c) => {
    const query = MerchantMessageQuerySchema.safeParse(c.req.query());
    if (!query.success)
      throw new ValidationError("Invalid merchant message filters.");
    return execute(c, operation, query.data);
  });
router.get("/:id/review", async (c) => {
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!id.success) throw new ValidationError("Invalid message ID.");
  return execute(c, "review", { id: id.data });
});
router.get("/:id", async (c) => {
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!id.success) throw new ValidationError("Invalid message ID.");
  return execute(c, "get", { id: id.data });
});
router.post("/commands", async (c) => {
  const command = MerchantMessageCommandSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!command.success)
    throw new ValidationError(
      "Check the message fields, recipients and reason.",
    );
  const key = c.req.header("X-Idempotency-Key");
  if (!key || key !== command.data.request_key)
    throw new ValidationError("Use the original request key for this action.");
  return execute(c, command.data.operation, command.data);
});
export default router;
