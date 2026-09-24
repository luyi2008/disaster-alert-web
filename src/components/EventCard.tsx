import { Bell, Clock, FlaskConical, Gauge, MapPin } from "lucide-react";
import type { IncidentListItem, PublicEvent } from "../api";
import { formatRelativeTime } from "../lib/time";

const LEVEL_COLORS = ["var(--quiet)", "var(--ok)", "var(--yellow)", "var(--warn)", "var(--destructive)"];

function levelColor(level: number): string {
  return LEVEL_COLORS[Math.max(0, Math.min(level, LEVEL_COLORS.length - 1))];
}

function formatCoordinate(latitude: number | null, longitude: number | null): string {
  if (latitude === null || longitude === null) return "位置未知";
  const latDir = latitude >= 0 ? "N" : "S";
  const lonDir = longitude >= 0 ? "E" : "W";
  return `${Math.abs(latitude).toFixed(2)}°${latDir}, ${Math.abs(longitude).toFixed(2)}°${lonDir}`;
}

function formatRegion(event: PublicEvent): string {
  if (event.affected_regions.length > 0) {
    return event.affected_regions.join(" · ");
  }
  return formatCoordinate(event.latitude, event.longitude);
}

export function EventCard({ item }: { item: IncidentListItem }) {
  const primary = item.latest[0];
  if (!primary) {
    return null;
  }
  const cancelled = item.latest.some((event) => event.cancel);
  const training = item.latest.some((event) => event.training);
  const finalReport = item.latest.some((event) => event.final_report);
  const color = cancelled ? "var(--quiet)" : levelColor(primary.level);
  const channel = primary.channel || primary.source;

  return (
    <div
      className="rounded-xl border bg-card p-5"
      style={{
        borderStyle: training ? "dashed" : "solid",
        opacity: cancelled ? 0.72 : 1,
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white"
          style={{ background: color }}
          aria-hidden="true"
        >
          <span className="text-base font-bold leading-none">
            {primary.magnitude !== null ? primary.magnitude.toFixed(1) : "-"}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-wide opacity-90">级</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-base font-semibold leading-snug">{primary.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{primary.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {formatRegion(primary)}
            </span>
            <span className="inline-flex items-center gap-1" title={primary.occurred_at}>
              <Clock className="size-3.5" aria-hidden="true" />
              {formatRelativeTime(item.updated_at_ms)}
            </span>
            {primary.depth_km !== null ? (
              <span className="inline-flex items-center gap-1">
                <Gauge className="size-3.5" aria-hidden="true" />
                震源深度 {primary.depth_km} km
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
              style={{
                background: cancelled ? "var(--err-bg)" : finalReport ? "var(--ok-bg)" : "var(--info-bg)",
                color: cancelled ? "var(--destructive)" : finalReport ? "var(--ok)" : "var(--info)",
              }}
            >
              {cancelled ? "已取消" : finalReport ? "正式报告" : "速报"}
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11.5px] font-semibold text-secondary-foreground">
              {channel}
            </span>
            {primary.report_num > 0 ? (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11.5px] font-semibold text-secondary-foreground">
                第 {primary.report_num + 1} 次通报
              </span>
            ) : null}
            {training ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
                <FlaskConical className="size-3" aria-hidden="true" />
                演练数据
              </span>
            ) : null}
            {item.has_matched_subscribers ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
              >
                <Bell className="size-3" aria-hidden="true" />
                已匹配订阅
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
