import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchIncidentEvents, type IncidentListItem } from "../api";
import { AppShell } from "../components/AppShell";
import { EventCard } from "../components/EventCard";
import { LoadingState } from "../components/DeviceCard";
import "../styles/base.css";
import "../styles/ds.css";

type FilterKey = "all" | "matched" | "final";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "matched", label: "已匹配订阅" },
  { key: "final", label: "仅正式报告" },
];

const PAGE_SIZE = 20;

export function EventsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [items, setItems] = useState<IncidentListItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingRef = useRef(false);

  const load = useCallback(
    (activeFilter: FilterKey, beforeMs?: number) =>
      fetchIncidentEvents({
        category: "earthquake_report",
        limit: PAGE_SIZE,
        beforeMs,
        matchedOnly: activeFilter === "matched",
        finalReportOnly: activeFilter === "final",
      }).then((result) => {
        if (result.status === 401) {
          navigate("/login", { replace: true });
          return null;
        }
        return result;
      }),
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setHasMore(false);
    load(filter)
      .then((result) => {
        if (cancelled || !result) return;
        const data = result.body.data;
        setItems(data?.events ?? []);
        setHasMore(data?.has_more ?? false);
        if (!data) {
          toast.error(result.body.message || "无法加载地震信息");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          toast.error("无法加载地震信息，请稍后重试");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filter, load]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore || !items || items.length === 0) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const cursor = items[items.length - 1].updated_at_ms;
    load(filter, cursor)
      .then((result) => {
        if (!result) return;
        const data = result.body.data;
        if (data) {
          setItems((prev) => [...(prev ?? []), ...data.events]);
          setHasMore(data.has_more);
        }
      })
      .finally(() => {
        loadingRef.current = false;
        setLoadingMore(false);
      });
  }, [filter, hasMore, items, load]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  return (
    <AppShell title="地震信息" description="实时地震速报与预警">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors"
            style={
              filter === item.key
                ? { background: "var(--foreground)", color: "var(--background)", borderColor: "var(--foreground)" }
                : { background: "var(--card)", color: "var(--foreground)", borderColor: "var(--border)" }
            }
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {items === null ? (
          <LoadingState label="正在加载…" />
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            没有符合条件的地震信息
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {items.map((item) => (
              <EventCard key={item.incident_id} item={item} />
            ))}
          </div>
        )}
      </div>

      {hasMore ? <div ref={sentinelRef} aria-hidden="true" className="h-px" /> : null}
      {loadingMore ? (
        <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          正在加载更多
        </div>
      ) : null}
      {items && items.length > 0 && !hasMore ? (
        <p className="py-5 text-center text-[12.5px] text-muted-foreground">没有更多了</p>
      ) : null}
    </AppShell>
  );
}
