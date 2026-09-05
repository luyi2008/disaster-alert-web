import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import L from "leaflet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { BrandMark } from "../components/AppShell";
import { ThemeToggle } from "../components/ThemeToggle";
import { useIncidentDetail } from "./useIncidentDetail";
import type {
  AlertRule,
  IncidentReportSummary,
  IncidentView,
  NotificationSnapshot,
  PublicEvent,
} from "../api";
import "../styles/base.css";
import "../styles/detail.css";
import "leaflet/dist/leaflet.css";

function categoryLabel(category: string): string {
  switch (category) {
    case "earthquake_warning":
      return "地震预警";
    case "earthquake_report":
      return "地震速报";
    case "weather_warning":
      return "气象预警";
    case "tsunami":
      return "海啸预警";
    case "typhoon":
      return "台风信息";
    default:
      return category;
  }
}

function interruptionLabel(value: string): string {
  switch (value) {
    case "critical":
      return "紧急";
    case "active":
      return "重要";
    case "passive":
      return "静默";
    default:
      return value;
  }
}

function formatEpochMs(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function StatusBadge({ text, variant }: { text: string; variant: "destructive" | "secondary" | "outline" }) {
  return <Badge variant={variant}>{text}</Badge>;
}

function statusBadgeVariant(className: string): "destructive" | "secondary" | "outline" {
  if (className.includes("cancel") || className.includes("mixed")) {
    return "destructive";
  }
  if (className.includes("final")) {
    return "secondary";
  }
  return "outline";
}

function DetailFold({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen className="detail-disclosure">
      <CollapsibleTrigger className="detail-disclosure-trigger">
        <span className="flex flex-col items-start gap-0.5 text-left">
          <span>{title}</span>
          <small className="text-muted-foreground font-normal">{hint}</small>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function interruptionBadgeVariant(value: string) {
  if (value === "critical") return "destructive" as const;
  if (value === "active") return "default" as const;
  return "secondary" as const;
}

function statusLabel(cancel: boolean, finalReport: boolean): { className: string; text: string } {
  if (cancel) {
    return { className: "status cancel", text: "已取消" };
  }
  if (finalReport) {
    return { className: "status final", text: "最终报告" };
  }
  return { className: "status active", text: "进行中" };
}

function aggregateStatus(incident: IncidentView): { className: string; text: string } {
  const cancelled = incident.latest_by_source.every((event) => event.cancel);
  const final = incident.latest_by_source.every((event) => event.final_report);
  const mixed = incident.latest_by_source.some((event) => event.cancel) && !cancelled;
  if (mixed) {
    return { className: "status mixed", text: "来源状态不一致" };
  }
  return statusLabel(cancelled, final);
}

function regionText(target: NotificationSnapshot["target"]): string {
  const region = [target.province, target.city, target.district].filter(Boolean).join(" / ");
  if (region) {
    return region;
  }
  return `${target.latitude.toFixed(4)}, ${target.longitude.toFixed(4)}`;
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

type MapPoint = {
  role: "event" | "current" | "target";
  label: string;
  latitude: number;
  longitude: number;
  radiusKm?: number;
};

function collectMapPoints(snapshot: NotificationSnapshot, incident: IncidentView | null): MapPoint[] {
  const points: MapPoint[] = [];
  const { event } = snapshot;
  if (event.latitude != null && event.longitude != null && validCoordinate(event.latitude, event.longitude)) {
    points.push({
      role: "event",
      label: "事件位置",
      latitude: event.latitude,
      longitude: event.longitude,
      radiusKm: event.radius_km ?? undefined,
    });
  }
  if (incident) {
    for (const sourceEvent of incident.latest_by_source) {
      if (
        sourceEvent.latitude != null &&
        sourceEvent.longitude != null &&
        validCoordinate(sourceEvent.latitude, sourceEvent.longitude)
      ) {
        points.push({
          role: "current",
          label: sourceEvent.source,
          latitude: sourceEvent.latitude,
          longitude: sourceEvent.longitude,
        });
      }
    }
  }
  if (validCoordinate(snapshot.target.latitude, snapshot.target.longitude)) {
    points.push({
      role: "target",
      label: snapshot.target.label || "关注地点",
      latitude: snapshot.target.latitude,
      longitude: snapshot.target.longitude,
    });
  }
  return points;
}

function ruleRows(rule: AlertRule): Array<[string, string]> {
  const rows: Array<[string, string]> = [["灾种", categoryLabel(rule.category)]];
  if (rule.sources?.mode === "all") {
    rows.push(["来源", "全部"]);
  } else if (rule.sources?.ids?.length) {
    rows.push(["来源", rule.sources.ids.join("、")]);
  }
  if (rule.estimated_intensity_bands) {
    rows.push([
      "烈度区间",
      rule.estimated_intensity_bands
        .map((band) => `${band.min}-${band.max}: ${interruptionLabel(band.interruption_level)}`)
        .join("；"),
    ]);
  }
  if (rule.min_magnitude != null) {
    rows.push(["最低震级", `M${rule.min_magnitude.toFixed(1)}`]);
  }
  if (rule.min_severity != null) {
    rows.push(["最低严重度", String(rule.min_severity)]);
  }
  if (rule.fallback_radius_km != null) {
    rows.push(["回退半径", `${rule.fallback_radius_km} km`]);
  }
  if (rule.max_center_distance_km != null) {
    rows.push(["最大中心距离", `${rule.max_center_distance_km} km`]);
  }
  return rows;
}

export function IncidentPage() {
  const { incidentId = "", token = "" } = useParams();
  const { status, detail, message } = useIncidentDetail(incidentId, token);

  useEffect(() => {
    document.documentElement.lang = "zh-CN";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow, noarchive";
    document.head.appendChild(robots);
    document.querySelector('meta[name="referrer"]')?.remove();
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.appendChild(referrer);
    return () => {
      robots.remove();
      referrer.remove();
    };
  }, []);

  if (status === "loading") {
    return (
      <MessagePage title="正在打开灾害详情" message="正在校验通知链接并加载数据。" canRetry={false} />
    );
  }
  if (status === "not_found") {
    return <MessagePage title="无法打开灾害详情" message={message} canRetry={false} />;
  }
  if (status === "unavailable") {
    return <MessagePage title="灾害详情暂不可用" message={message} canRetry />;
  }
  if (status === "error" || !detail) {
    return <MessagePage title="灾害详情加载失败" message={message} canRetry />;
  }

  return <IncidentLoaded snapshot={detail.snapshot} incident={detail.incident} />;
}

function MessagePage({
  title,
  message,
  canRetry,
}: {
  title: string;
  message: string;
  canRetry: boolean;
}) {
  useEffect(() => {
    document.title = `${title} - 灾害详情`;
  }, [title]);
  return (
    <div className="message-page message-invalid">
      <main className="message-scene">
        <div className="message-map" aria-hidden="true" />
        <div className="message-shade" aria-hidden="true" />
        <header className="message-topbar">
          <Link className="message-brand" to="/" aria-label="返回灾害态势首页">
            <BrandMark />
            <strong>灾害态势</strong>
          </Link>
          <ThemeToggle compact />
        </header>
        <section className="message-copy" aria-labelledby="message-title">
          <div className="message-state">
            <span aria-hidden="true" />
            灾害详情
          </div>
          <h1 id="message-title">{title}</h1>
          <p className="message-lead">{message}</p>
          <nav className="message-actions" aria-label="详情页操作">
            <Button asChild variant="outline">
              <Link className="message-home" to="/">
                返回灾害态势<span aria-hidden="true">→</span>
              </Link>
            </Button>
            {canRetry ? (
              <Button asChild variant="ghost">
                <a className="message-retry" href="">
                  重新尝试
                </a>
              </Button>
            ) : null}
          </nav>
        </section>
      </main>
    </div>
  );
}

function IncidentLoaded({
  snapshot,
  incident,
}: {
  snapshot: NotificationSnapshot;
  incident: IncidentView | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const points = useMemo(() => collectMapPoints(snapshot, incident), [snapshot, incident]);
  const badge = incident ? aggregateStatus(incident) : statusLabel(snapshot.event.cancel, snapshot.event.final_report);

  useEffect(() => {
    document.title = `${snapshot.event.title} - 灾害详情`;
  }, [snapshot.event.title]);

  useEffect(() => {
    const container = mapRef.current;
    if (!container || !points.length) {
      return;
    }
    const map = L.map(container, {
      attributionControl: false,
      zoomControl: false,
      scrollWheelZoom: true,
      minZoom: 2,
      maxZoom: 18,
    });
    container.classList.add("map-enhanced");
    container.closest(".map-hero")?.classList.add("map-ready");
    const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      crossOrigin: true,
    });
    tiles.once("load", () => container.classList.add("tiles-ready"));
    tiles.addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    const bounds = L.latLngBounds([]);
    let eventPoint: MapPoint | null = null;
    let targetPoint: MapPoint | null = null;
    for (const point of points) {
      const size = point.role === "current" ? 20 : 24;
      const icon = L.divIcon({
        className: "",
        html: `<span class="incident-marker ${point.role}"></span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([point.latitude, point.longitude], {
        icon,
        zIndexOffset: point.role === "target" ? 300 : point.role === "event" ? 200 : 100,
      }).addTo(map);
      marker.bindTooltip(point.label, { direction: "top", offset: [0, -14] });
      bounds.extend(marker.getLatLng());
      if (point.role === "event" && !eventPoint) {
        eventPoint = point;
      }
      if (point.role === "target" && !targetPoint) {
        targetPoint = point;
      }
      if (point.role === "event" && point.radiusKm && point.radiusKm > 0) {
        L.circle([point.latitude, point.longitude], {
          radius: point.radiusKm * 1000,
          color: "#df4b3f",
          weight: 1.5,
          opacity: 0.7,
          fillColor: "#df4b3f",
          fillOpacity: 0.07,
          interactive: false,
        }).addTo(map);
      }
    }
    if (eventPoint && targetPoint) {
      L.polyline(
        [
          [eventPoint.latitude, eventPoint.longitude],
          [targetPoint.latitude, targetPoint.longitude],
        ],
        { color: "#3e7063", weight: 2, dashArray: "7 8", opacity: 0.7, interactive: false },
      ).addTo(map);
    }
    const fit = () => {
      if (points.length === 1 && !points[0].radiusKm) {
        map.setView([points[0].latitude, points[0].longitude], 7);
        return;
      }
      map.fitBounds(bounds.pad(0.2), {
        paddingTopLeft: [48, 72],
        paddingBottomRight: [48, 72],
        maxZoom: 9,
      });
    };
    fit();
    const button = document.querySelector("#map-fit-button");
    button?.addEventListener("click", fit);
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      button?.removeEventListener("click", fit);
      map.remove();
    };
  }, [points]);

  const sources = incident?.latest_by_source ?? [snapshot.event];

  return (
    <div className="detail-page">
      <header className="map-hero">
        <div className="map-stage">
          <div id="incident-map" className="incident-map" ref={mapRef} aria-label="灾害事件与关注地点地图">
            <div className="map-fallback" />
          </div>
          <div className="map-shade" aria-hidden="true" />
        </div>
        <div className="hero-topbar">
          <div className="hero-brand">
            <BrandMark />
            <span>灾害态势</span>
          </div>
          <div className="pointer-events-auto">
            <ThemeToggle compact />
          </div>
        </div>
        <div className="hero-layout">
          <Card className="floating-panel event-panel gap-0 py-5 shadow-none" aria-labelledby="overview-heading">
            <CardHeader className="panel-topline px-0">
              <div className="trust-row flex flex-wrap gap-2">
                <Badge variant="secondary">{categoryLabel(snapshot.event.category)}</Badge>
                {snapshot.event.training ? <Badge variant="outline">演练 / 测试</Badge> : null}
              </div>
              <StatusBadge variant={statusBadgeVariant(badge.className)} text={badge.text} />
            </CardHeader>
            <span className="section-kicker">事件态势</span>
            <h1 id="overview-heading">{snapshot.event.title}</h1>
            <p className="headline-meta">
              {snapshot.event.source} · 第 {snapshot.event.report_num} 报 · {snapshot.event.occurred_at}
            </p>
            <div className="hero-metrics">
              {snapshot.event.magnitude != null ? (
                <div className="hero-metric primary">
                  <span>震级</span>
                  <strong>M{snapshot.event.magnitude.toFixed(1)}</strong>
                </div>
              ) : null}
              <div className={snapshot.event.magnitude == null ? "hero-metric primary" : "hero-metric"}>
                <span>事件等级</span>
                <strong>{snapshot.event.level}</strong>
              </div>
              {snapshot.event.depth_km != null ? (
                <div className="hero-metric">
                  <span>深度</span>
                  <strong>{snapshot.event.depth_km.toFixed(1)} km</strong>
                </div>
              ) : null}
              {snapshot.event.radius_km != null ? (
                <div className="hero-metric">
                  <span>影响半径</span>
                  <strong>{snapshot.event.radius_km.toFixed(0)} km</strong>
                </div>
              ) : null}
            </div>
            {snapshot.event.description.trim() ? (
              <p className="hero-description">{snapshot.event.description}</p>
            ) : null}
          </Card>
          <Card className="floating-panel impact-panel gap-0 py-5 shadow-none" aria-labelledby="impact-heading">
            <CardHeader className="panel-topline px-0">
              <div>
                <span className="section-kicker">影响提示</span>
                <h2 id="impact-heading">关注地点</h2>
              </div>
              <Badge variant={interruptionBadgeVariant(snapshot.interruption_level)}>
                {interruptionLabel(snapshot.interruption_level)}
              </Badge>
            </CardHeader>
            <div className="target-summary">
              <span className="target-pin" aria-hidden="true" />
              <div>
                <span>关注地点</span>
                <strong>{snapshot.target.label}</strong>
                <small>{regionText(snapshot.target)}</small>
              </div>
            </div>
            {snapshot.timing ? (
              <dl className="impact-metrics">
                <div>
                  <dt>预计烈度</dt>
                  <dd>{snapshot.timing.estimated_intensity.toFixed(1)}</dd>
                </div>
                <div>
                  <dt>震中距离</dt>
                  <dd>{snapshot.timing.epicentral_distance_km.toFixed(1)} km</dd>
                </div>
              </dl>
            ) : (
              <p className="empty-note">暂未提供影响估算</p>
            )}
          </Card>
        </div>
        <div className="map-footer">
          <div className="map-legend">
            <span>
              <i className="legend-dot event" />
              事件位置
            </span>
            <span>
              <i className="legend-dot current" />
              最新报告
            </span>
            <span>
              <i className="legend-dot target" />
              关注地点
            </span>
          </div>
          <Button id="map-fit-button" className="map-fit-button" type="button" variant="outline" size="icon" title="显示全部位置" aria-label="显示全部位置">
            <span className="fit-icon" aria-hidden="true" />
          </Button>
        </div>
        <div className="map-attribution">
          <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">
            OpenStreetMap
          </a>
          {" · "}
          <a href="https://carto.com/attributions" rel="noreferrer">
            CARTO
          </a>
        </div>
      </header>
      <main className="detail-main">
        <section className="detail-band regions-band" aria-labelledby="regions-heading">
          <div className="section-heading">
            <div>
              <span className="section-kicker">影响范围</span>
              <h2 id="regions-heading">可能受影响区域</h2>
            </div>
            {snapshot.timing ? (
              <span className="impact-distance">距离 {snapshot.timing.epicentral_distance_km.toFixed(0)} km</span>
            ) : null}
          </div>
          {snapshot.event.affected_regions.length ? (
            <div className="region-focus">
              <ul>
                {snapshot.event.affected_regions.map((region) => (
                  <li key={region}>{region}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="empty-note">暂未划定影响区域</p>
          )}
        </section>
        <section className="detail-band current-band" aria-labelledby="current-heading">
          <div className="section-heading">
            <div>
              <span className="section-kicker">最新动态</span>
              <h2 id="current-heading">当前事件状态</h2>
            </div>
            {incident ? <span className="source-count">{incident.latest_by_source.length} 个来源</span> : null}
          </div>
          <div className="sources">
            {sources.map((event) => (
              <SourceCard key={`${event.source}-${event.event_id}`} event={event} />
            ))}
          </div>
        </section>
        <DetailFold title="事件详情" hint="通知时数据">
            <div className="disclosure-content">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">事件记录</span>
                  <h2>通知时完整信息</h2>
                </div>
                <span className="issued">签发于 {formatEpochMs(snapshot.issued_at_ms)}</span>
              </div>
              <dl className="fact-grid">
                <div>
                  <dt>灾害类别</dt>
                  <dd>{categoryLabel(snapshot.event.category)}</dd>
                </div>
                <div>
                  <dt>来源与报告</dt>
                  <dd>
                    {snapshot.event.source} · 第 {snapshot.event.report_num} 报
                  </dd>
                </div>
                <div>
                  <dt>事件等级</dt>
                  <dd>{snapshot.event.level}</dd>
                </div>
                {snapshot.event.magnitude != null ? (
                  <div>
                    <dt>震级</dt>
                    <dd>M{snapshot.event.magnitude.toFixed(1)}</dd>
                  </div>
                ) : null}
                {snapshot.event.depth_km != null ? (
                  <div>
                    <dt>深度</dt>
                    <dd>{snapshot.event.depth_km.toFixed(1)} km</dd>
                  </div>
                ) : null}
                {snapshot.event.radius_km != null ? (
                  <div>
                    <dt>影响半径</dt>
                    <dd>{snapshot.event.radius_km.toFixed(0)} km</dd>
                  </div>
                ) : null}
              </dl>
            </div>
        </DetailFold>
        <DetailFold title="预警条件" hint="地点与订阅规则">
            <div className="disclosure-content">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">预警条件</span>
                  <h2>关注地点与命中规则</h2>
                </div>
                <Badge variant={interruptionBadgeVariant(snapshot.interruption_level)}>
                  {interruptionLabel(snapshot.interruption_level)}
                </Badge>
              </div>
              <div className="detail-columns">
                <div>
                  <h3>关注地点</h3>
                  <dl className="data-list">
                    <dt>名称</dt>
                    <dd>{snapshot.target.label}</dd>
                    <dt>坐标</dt>
                    <dd>
                      {snapshot.target.latitude.toFixed(6)}, {snapshot.target.longitude.toFixed(6)}
                    </dd>
                  </dl>
                </div>
                <div>
                  <h3>影响估算</h3>
                  {snapshot.timing ? (
                    <dl className="data-list">
                      <dt>预计烈度</dt>
                      <dd>{snapshot.timing.estimated_intensity.toFixed(2)}</dd>
                      <dt>震中距离</dt>
                      <dd>{snapshot.timing.epicentral_distance_km.toFixed(2)} km</dd>
                      <dt>震源距离</dt>
                      <dd>{snapshot.timing.hypocentral_distance_km.toFixed(2)} km</dd>
                      <dt>P 波预计到达</dt>
                      <dd>{formatEpochMs(snapshot.timing.p_arrival_at_ms)}</dd>
                      <dt>S 波预计到达</dt>
                      <dd>{formatEpochMs(snapshot.timing.s_arrival_at_ms)}</dd>
                    </dl>
                  ) : (
                    <p className="empty-note">暂未提供影响估算</p>
                  )}
                </div>
              </div>
              <div className="rule-block">
                <h3>命中规则</h3>
                <dl className="data-list rule-list">
                  {ruleRows(snapshot.matched_rule).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
        </DetailFold>
          {incident ? (
            <DetailFold title="报告变更" hint={`最近 ${incident.timeline.length} 条`}>
                <ol className="timeline">
                  {[...incident.timeline].reverse().map((report) => (
                    <TimelineItem key={`${report.source}-${report.revision}-${report.observed_at_ms}`} report={report} />
                  ))}
                </ol>
            </DetailFold>
          ) : null}
      </main>
    </div>
  );
}

function SourceCard({ event }: { event: PublicEvent }) {
  const badge = statusLabel(event.cancel, event.final_report);
  return (
    <Card className="source-report gap-3 py-4 shadow-none">
      <CardHeader className="article-head px-5">
        <div>
          <span className="source-label">{event.source}</span>
          <CardTitle className="text-base">{event.title}</CardTitle>
          <CardDescription>{event.occurred_at}</CardDescription>
        </div>
        <div className="report-state">
          <StatusBadge variant={statusBadgeVariant(badge.className)} text={badge.text} />
        </div>
      </CardHeader>
      <CardContent className="source-vitals px-5">
        {event.magnitude != null ? (
          <div className="source-metric primary">
            <span>震级</span>
            <strong>M{event.magnitude.toFixed(1)}</strong>
          </div>
        ) : null}
        <div className="source-metric">
          <span>等级</span>
          <strong>{event.level}</strong>
        </div>
        {event.depth_km != null ? (
          <div className="source-metric">
            <span>深度</span>
            <strong>{event.depth_km.toFixed(1)} km</strong>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TimelineItem({ report }: { report: IncidentReportSummary }) {
  const badge = statusLabel(report.cancel, report.final_report);
  return (
    <li>
      <time>{formatEpochMs(report.observed_at_ms)}</time>
      <div className="timeline-content">
        <div className="timeline-title">
          <strong>
            {report.source} · 第 {report.report_num} 报
          </strong>
          <StatusBadge variant={statusBadgeVariant(badge.className)} text={badge.text} />
        </div>
      </div>
    </li>
  );
}
