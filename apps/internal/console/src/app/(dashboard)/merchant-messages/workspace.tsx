"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { z } from "zod";
import { Button, Input, Select, Textarea, Checkbox } from "@letbuyy/ui";
import {
  MerchantMessageSchema,
  MerchantMessageAccountSchema,
  MerchantMessageContentSchema,
  MerchantMessageCategorySchema,
  MerchantMessageReviewSchema,
  type MerchantMessage,
  type MerchantMessageAccount,
  type MerchantMessageReview,
  MerchantMessageCommandSchema,
} from "@letbuyy/shared-types";
import { StatusPill } from "@/components/_local-ui/console-workspace";
type Command = z.infer<typeof MerchantMessageCommandSchema>;
type Content = z.infer<typeof MerchantMessageContentSchema>;
const initial: Content = {
  title: "",
  body: "",
  category: "platform_updates",
  action_url: null,
  expires_at: null,
  audience_mode: "all",
  target_user_ids: [],
};
const label = (value: string) => value.replaceAll("_", " ");
class MessageFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export function MerchantMessageWorkspace() {
  const params = useSearchParams(),
    router = useRouter(),
    selected = params.get("message");
  const [items, setItems] = useState<MerchantMessage[]>([]),
    [page, setPage] = useState(1),
    [hasNext, setHasNext] = useState(false),
    [query, setQuery] = useState(""),
    [applied, setApplied] = useState("");
  const [record, setRecord] = useState<MerchantMessage | null>(null),
    [content, setContent] = useState<Content>(initial),
    [reason, setReason] = useState(""),
    [review, setReview] = useState<MerchantMessageReview | null>(null),
    [dirty, setDirty] = useState(false);
  const [accounts, setAccounts] = useState<MerchantMessageAccount[]>([]),
    [accountPage, setAccountPage] = useState(1),
    [accountNext, setAccountNext] = useState(false),
    [accountInput, setAccountInput] = useState(""),
    [accountSearch, setAccountSearch] = useState("");
  const [pending, setPending] = useState<Command | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [listFailed, setListFailed] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [denied, setDenied] = useState(false);
  const version = useRef(0),
    locked = useRef(false),
    listVersion = useRef(0);
  const [recordLoading, setRecordLoading] = useState(false);
  const invalidate = useCallback(() => {
    version.current++;
  }, []);
  const request = useCallback(async (path: string, command?: Command) => {
    const response = await fetch("/api/v1/merchant-messages" + path, {
      cache: "no-store",
      ...(command
        ? {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Idempotency-Key": command.request_key,
            },
            body: JSON.stringify(command),
          }
        : {}),
    });
    const body = await response.json();
    if (!response.ok)
      throw new MessageFailure(
        typeof body.error === "string"
          ? body.error
          : body.error?.message || "Merchant messages unavailable.",
        response.status,
      );
    return body.data;
  }, []);
  const list = useCallback(async () => {
    const n = ++listVersion.current;
    const result = await request(
      "?page=" + page + "&q=" + encodeURIComponent(applied),
    );
    if (n !== listVersion.current) return;
    setItems(MerchantMessageSchema.array().parse(result.items));
    setHasNext(result.has_next);
  }, [request, page, applied]);
  function adopt(message: MerchantMessage) {
    setRecord(message);
    const {
      title,
      body,
      category,
      action_url,
      expires_at,
      audience_mode,
      target_user_ids,
    } = message;
    setContent({
      title,
      body,
      category,
      action_url,
      expires_at,
      audience_mode,
      target_user_ids,
    });
    setDirty(false);
    setReview(null);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setListFailed(false);
    setError("");
    void list()
      .catch((e) => {
        if (active) {
          setListFailed(true);
          setError(e.message);
          setDenied(e.status === 403);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [list]);
  useEffect(() => {
    const n = ++version.current;
    setRecordLoading(!!selected);
    if (!selected) {
      setRecord(null);
      setContent(initial);
      setDirty(false);
      setReview(null);
      return;
    }
    setError("");
    void request("/" + selected)
      .then((data) => {
        if (n === version.current)
          adopt(MerchantMessageSchema.parse(data.message));
      })
      .catch((e) => {
        if (n === version.current) setError(e.message);
      })
      .finally(() => {
        if (n === version.current) setRecordLoading(false);
      });
    return invalidate;
  }, [request, selected, invalidate]);
  useEffect(() => {
    if (content.audience_mode !== "selected" || record?.status === "published")
      return;
    let active = true;
    setAccounts([]);
    void request(
      "/accounts?page=" +
        accountPage +
        "&q=" +
        encodeURIComponent(accountSearch),
    )
      .then((data) => {
        if (active) {
          setAccounts(MerchantMessageAccountSchema.array().parse(data.items));
          setAccountNext(data.has_next);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [
    request,
    accountPage,
    accountSearch,
    content.audience_mode,
    record?.status,
  ]);
  function change(update: Partial<Content>) {
    setContent((old) => ({ ...old, ...update }));
    setDirty(true);
    setReview(null);
  }
  async function send(command: Command) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setPending(command);
    setError("");
    const n = version.current;
    try {
      const data = await request("/commands", command);
      if (n !== version.current) return;
      const saved = MerchantMessageSchema.parse(data.message);
      setPending(null);
      adopt(saved);
      setStatus(
        command.operation === "publish"
          ? "Published to " +
              saved.published_count +
              " merchant account inboxes."
          : "Draft saved. Nothing has been published.",
      );
      if (command.operation === "publish") setReason("");
      router.replace("/merchant-messages?message=" + saved.id);
      await list();
    } catch (e) {
      if (n === version.current) {
        setError(e instanceof Error ? e.message : "Action unavailable.");
        if (e instanceof MessageFailure && e.status < 500) {
          setPending(null);
          setStatus("Action refused. Your draft is retained.");
        } else
          setStatus(
            "Outcome unconfirmed. Check the original request before retrying.",
          );
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function recover() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const data = await request("/commands", {
        operation: "recover",
        id: pending.id,
        request_key: pending.request_key,
      });
      if (data.state === "completed") {
        const message = MerchantMessageSchema.parse(data.result.message);
        adopt(message);
        setPending(null);
        setStatus("Original action recovered.");
        router.replace("/merchant-messages?message=" + message.id);
        await list();
      } else
        setStatus(
          "Original request not recorded. Retry the same action safely.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recovery unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    if (!record || dirty || busy) return;
    setBusy(true);
    setError("");
    try {
      setReview(
        MerchantMessageReviewSchema.parse(
          await request("/" + record.id + "/review"),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review unavailable.");
    } finally {
      setBusy(false);
    }
  }
  const readonly = record?.status === "published",
    disabled = busy || recordLoading || !!pending || denied;
  return (
    <div className="space-y-5">
      {error && (
        <p role="alert">
          {error}{" "}
          <a className="underline" href="/mfa?step_up=1">
            Verify a fresh authenticator code
          </a>
        </p>
      )}
      <p role="status" aria-live="polite">
        {status}
      </p>
      <div className="console-message-authoring">
        <section aria-label="Merchant message directory" className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setApplied(query);
            }}
            className="space-y-3"
          >
            <Input
              label="Search message titles"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={120}
            />
            <Button type="submit">Search messages</Button>
          </form>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => {
              version.current++;
              setRecord(null);
              setContent(initial);
              setDirty(false);
              setReview(null);
              router.push("/merchant-messages");
              setReason("");
              setStatus("");
            }}
          >
            New message
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setLoading(true);
              setListFailed(false);
              void list()
                .catch((e) => {
                  setListFailed(true);
                  setError(e.message);
                })
                .finally(() => setLoading(false));
            }}
          >
            Refresh message directory
          </Button>
          {loading ? (
            <p>Loading messages…</p>
          ) : listFailed ? (
            <p>Message directory unavailable. Retry loading.</p>
          ) : items.length === 0 ? (
            <p>No message drafts or publications match.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <Button
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      router.push("/merchant-messages?message=" + item.id)
                    }
                  >
                    {item.title}
                  </Button>{" "}
                  <StatusPill value={item.status} />
                  <p className="text-xs text-subdued">
                    {label(item.category)} ·{" "}
                    {new Date(item.created_at).toLocaleDateString("en-IN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={page === 1 || disabled}
              onClick={() => setPage(page - 1)}
            >
              Previous messages
            </Button>
            <span>Page {page}</span>
            <Button
              variant="secondary"
              disabled={!hasNext || disabled}
              onClick={() => setPage(page + 1)}
            >
              More messages
            </Button>
          </div>
        </section>
        {!denied && (
          <section aria-label="Message authoring" className="space-y-5">
            <h2>
              {readonly
                ? "Published message"
                : record
                  ? "Edit saved draft"
                  : "New draft"}
            </h2>
            {readonly && (
              <p>
                Published content is retained as sent. Create a new message for
                a correction.
              </p>
            )}
            <p className="text-sm text-subdued">
              Eligible recipients have an active merchant identity or an
              undeleted owned store. Each account receives one copy.
            </p>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const command = MerchantMessageCommandSchema.safeParse({
                  operation: "save",
                  id: record?.id || crypto.randomUUID(),
                  request_key: crypto.randomUUID(),
                  expected_revision: record?.revision || 0,
                  content,
                  reason,
                });
                if (!command.success) {
                  setError(
                    command.error.issues[0]?.message ||
                      "Check the draft fields.",
                  );
                  return;
                }
                void send(command.data);
              }}
            >
              <Input
                label="Message title"
                value={content.title}
                onChange={(e) => change({ title: e.target.value })}
                maxLength={160}
                required
                disabled={disabled || readonly}
              />
              <Select
                label="Message category"
                value={content.category}
                onChange={(e) =>
                  change({
                    category: MerchantMessageCategorySchema.parse(
                      e.target.value,
                    ),
                  })
                }
                options={MerchantMessageCategorySchema.options.map((value) => ({
                  value,
                  label: label(value),
                }))}
                disabled={disabled || readonly}
              />
              <Textarea
                label="Message body"
                value={content.body}
                onChange={(e) => change({ body: e.target.value })}
                maxLength={8000}
                rows={9}
                required
                disabled={disabled || readonly}
              />
              <Input
                label="Optional HTTPS details link"
                type="url"
                value={content.action_url || ""}
                onChange={(e) => change({ action_url: e.target.value || null })}
                disabled={disabled || readonly}
              />
              <Input
                label="Optional offer or notice expiry"
                type="datetime-local"
                value={
                  content.expires_at
                    ? new Date(
                        Date.parse(content.expires_at) -
                          new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  change({
                    expires_at: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
                disabled={disabled || readonly}
              />
              <Select
                label="Recipient audience"
                value={content.audience_mode}
                onChange={(e) =>
                  change({
                    audience_mode: e.target.value as "all" | "selected",
                    target_user_ids: [],
                  })
                }
                options={[
                  { value: "all", label: "All eligible merchant accounts" },
                  { value: "selected", label: "Selected merchant accounts" },
                ]}
                disabled={disabled || readonly}
              />
              {content.audience_mode === "selected" && !readonly && (
                <fieldset className="space-y-3">
                  <legend>
                    Select merchant accounts · {content.target_user_ids.length}{" "}
                    selected
                  </legend>
                  <Input
                    label="Find merchant accounts"
                    value={accountInput}
                    onChange={(e) => setAccountInput(e.target.value)}
                    maxLength={120}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setAccountPage(1);
                      setAccountSearch(accountInput);
                    }}
                  >
                    Search accounts
                  </Button>
                  {accounts.map((account) => (
                    <Checkbox
                      key={account.id}
                      label={account.full_name || account.email}
                      description={account.email}
                      checked={content.target_user_ids.includes(account.id)}
                      disabled={disabled}
                      onCheckedChange={(checked) =>
                        change({
                          target_user_ids: checked
                            ? [...content.target_user_ids, account.id]
                            : content.target_user_ids.filter(
                                (id) => id !== account.id,
                              ),
                        })
                      }
                    />
                  ))}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={accountPage === 1 || disabled}
                      onClick={() => setAccountPage(accountPage - 1)}
                    >
                      Previous accounts
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!accountNext || disabled}
                      onClick={() => setAccountPage(accountPage + 1)}
                    >
                      More accounts
                    </Button>
                  </div>
                </fieldset>
              )}
              {!readonly && (
                <>
                  <Textarea
                    label="Reason for this message"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={8}
                    maxLength={1000}
                    required
                    disabled={disabled}
                  />
                  <Button type="submit" disabled={disabled}>
                    Save draft
                  </Button>
                </>
              )}
            </form>
            {record && (
              <Button
                variant="secondary"
                disabled={disabled || dirty}
                onClick={() => void preview()}
              >
                {readonly
                  ? "Inspect publication"
                  : "Review saved draft and audience"}
              </Button>
            )}
            {dirty && record && (
              <p>Save your changes before reviewing the audience.</p>
            )}
            {review && (
              <section
                aria-label="Publication review"
                className="console-message-preview space-y-3"
              >
                <h3>{review.message.title}</h3>
                <p className="whitespace-pre-wrap break-words">
                  {review.message.body}
                </p>
                <p>
                  {label(review.message.category)} ·{" "}
                  {review.message.audience_mode === "all"
                    ? "All eligible merchant accounts"
                    : "Selected merchant accounts"}
                </p>
                <p>
                  {review.message.status === "published"
                    ? review.message.published_count
                    : review.recipient_count}{" "}
                  account inboxes · {review.marked_read} marked read
                </p>
                <p className="text-xs text-subdued">
                  Reviewed{" "}
                  {new Date(review.observed_at).toLocaleString("en-IN")} ·
                  Marked read does not establish legal acceptance.
                </p>
                {review.sample.length > 0 && (
                  <p>
                    Recipient sample:{" "}
                    {review.sample
                      .map((a) => a.full_name || a.email)
                      .join(", ")}
                  </p>
                )}
                {review.message.status === "draft" && (
                  <Button
                    disabled={
                      disabled ||
                      dirty ||
                      review.recipient_count === 0 ||
                      reason.trim().length < 8
                    }
                    onClick={() =>
                      void send({
                        operation: "publish",
                        id: review.message.id,
                        request_key: crypto.randomUUID(),
                        expected_revision: review.message.revision,
                        audience_hash: review.audience_hash,
                        reason,
                      })
                    }
                  >
                    Publish to {review.recipient_count} account inboxes
                  </Button>
                )}
              </section>
            )}
            {pending && (
              <div className="flex flex-wrap gap-3">
                <Button disabled={busy} onClick={() => void recover()}>
                  Check original message action
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void send(pending)}
                >
                  Retry same message action
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
