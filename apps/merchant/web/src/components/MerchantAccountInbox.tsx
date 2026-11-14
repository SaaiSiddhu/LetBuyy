"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button, Select, Section, Mail, RefreshCw } from "@letbuyy/ui";
import {
  MerchantInboxItemSchema,
  MerchantMessageCategorySchema,
  type MerchantInboxItem,
} from "@letbuyy/shared-types";
const label = (value: unknown) =>
  typeof value === "string" ? value.replaceAll("_", " ") : "Platform update";
export function MerchantAccountInbox() {
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname(),
    selected = params.get("message"),
    page = Number(params.get("page") || 1);
  const [rows, setRows] = useState<MerchantInboxItem[]>([]),
    [current, setCurrent] = useState<MerchantInboxItem | null>(null),
    [hasNext, setHasNext] = useState(false),
    [total, setTotal] = useState<number | null>(null),
    [unread, setUnread] = useState<number | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const generation = useRef(0),
    lock = useRef(false);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const suffix = ["category", "is_read"]
    .filter((key) => params.get(key))
    .map((key) => "&" + key + "=" + encodeURIComponent(params.get(key)!))
    .join("");
  const request = useCallback(async (path: string, method = "GET") => {
    const response = await fetch("/api/v1/inbox" + path, {
      method,
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(
        typeof body.error === "string"
          ? body.error
          : body.error?.message || "Inbox unavailable.",
      );
    return body;
  }, []);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError("");
    setRows([]);
    setCurrent(null);
    setTotal(null);
    setUnread(null);
    try {
      const [list, count, detail] = await Promise.all([
        request("?page=" + page + suffix),
        request("/count"),
        selected ? request("/" + selected) : Promise.resolve(null),
      ]);
      if (n !== generation.current) return;
      setRows(MerchantInboxItemSchema.array().parse(list.data));
      setTotal(list.meta.total);
      setHasNext(list.meta.has_next);
      setUnread(count.count);
      if (detail) setCurrent(MerchantInboxItemSchema.parse(detail.data));
    } catch (e) {
      if (n === generation.current)
        setError(e instanceof Error ? e.message : "Account inbox unavailable.");
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [request, page, suffix, selected]);
  useEffect(() => {
    setStatus("");
    void load();
    return invalidate;
  }, [load, invalidate]);
  function updateQuery(values: Record<string, string | null>) {
    const q = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) q.set(key, value);
      else q.delete(key);
    }
    router.push(pathname + "?" + q);
  }
  async function markRead() {
    if (!current || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const n = generation.current;
    try {
      await request("/" + current.id + "/read", "PATCH");
      if (n === generation.current) {
        setStatus("Marked read.");
        await load();
      }
    } catch (e) {
      if (n === generation.current)
        setError(e instanceof Error ? e.message : "Read status unavailable.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const safeLink =
    current?.action_url && /^https:\/\//i.test(current.action_url)
      ? current.action_url
      : null;
  return (
    <div className="space-y-6">
      <Section
        title="Account inbox"
        description="Messages from LetBuyy about ad campaigns, offers, regulations and platform updates. This inbox belongs to your account and is shared across your stores."
      >
        <div className="flex flex-wrap items-end gap-4">
          <Select
            label="Category"
            value={params.get("category") || ""}
            onChange={(e) =>
              updateQuery({
                category: e.target.value,
                page: "1",
                message: null,
              })
            }
            options={[
              { value: "", label: "All messages" },
              ...MerchantMessageCategorySchema.options.map((value) => ({
                value,
                label: label(value),
              })),
            ]}
          />
          <Select
            label="Read status"
            value={params.get("is_read") || ""}
            onChange={(e) =>
              updateQuery({ is_read: e.target.value, page: "1", message: null })
            }
            options={[
              { value: "", label: "All statuses" },
              { value: "false", label: "Unread" },
              { value: "true", label: "Read" },
            ]}
          />
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw size={16} /> Refresh inbox
          </Button>
        </div>
        <p className="mt-4 text-sm">
          {unread === null ? "Unread count unavailable" : unread + " unread"} ·{" "}
          {total === null
            ? "Message count unavailable"
            : total + " matching messages"}
        </p>
      </Section>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error} Use Refresh inbox to try again.</p>}
      {loading ? (
        <p role="status">Loading account messages…</p>
      ) : (
        !error && (
          <div className="merchant-account-inbox">
            <Section title="Messages from LetBuyy">
              <ul className="space-y-3">
                {rows.map((row) => (
                  <li key={row.id}>
                    <Button
                      variant="ghost"
                      className="h-auto whitespace-normal text-left"
                      onClick={() => updateQuery({ message: row.id })}
                    >
                      <Mail size={16} />
                      <span>
                        {!row.is_read && <strong>Unread · </strong>}
                        {row.title}
                      </span>
                    </Button>
                    <p className="text-sm text-subdued">
                      {label(row.data.category)} ·{" "}
                      {new Date(row.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </li>
                ))}
              </ul>
              {rows.length === 0 && <p>No messages match this view.</p>}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() =>
                    updateQuery({ page: String(page - 1), message: null })
                  }
                >
                  Previous messages
                </Button>
                <span>Page {page}</span>
                <Button
                  variant="secondary"
                  disabled={!hasNext}
                  onClick={() =>
                    updateQuery({ page: String(page + 1), message: null })
                  }
                >
                  More messages
                </Button>
              </div>
            </Section>
            {current && (
              <Section
                title={current.title}
                description={"From LetBuyy · " + label(current.data.category)}
              >
                <article aria-label="Account message">
                  <p className="text-sm text-subdued">
                    {new Date(current.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    IST · {current.is_read ? "Read" : "Unread"}
                  </p>
                  <p className="my-6 whitespace-pre-wrap break-words">
                    {current.message}
                  </p>
                  {typeof current.data.expires_at === "string" && (
                    <p className="my-3">
                      {Date.parse(current.data.expires_at) < Date.now()
                        ? "Expired"
                        : "Valid until"}{" "}
                      ·{" "}
                      {new Date(current.data.expires_at).toLocaleString(
                        "en-IN",
                        { timeZone: "Asia/Kolkata" },
                      )}{" "}
                      IST
                    </p>
                  )}
                  {safeLink && (
                    <a
                      className="inline-block underline"
                      href={safeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View details
                    </a>
                  )}
                  {!current.is_read && (
                    <div className="mt-4">
                      <Button disabled={busy} onClick={() => void markRead()}>
                        Mark as read
                      </Button>
                    </div>
                  )}
                </article>
              </Section>
            )}
          </div>
        )
      )}
    </div>
  );
}
