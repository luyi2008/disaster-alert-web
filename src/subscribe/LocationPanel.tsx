import { useEffect, useLayoutEffect, useRef, useState } from "react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "../components/Field";
import { cn } from "@/lib/utils";
import {
  cloneTarget,
  createTarget,
  targetCoordinates,
  targetLabel,
  targetRegion,
  validCoordinate,
  validateLocations,
} from "./geo";
import { parseApiResponse } from "./http";
import { notify } from "./notify";
import type { Coordinates, GeocodeJob, LocationMode, SubscriptionDraft, SubscriptionTarget } from "./types";

type LocationUi = {
  activeTargetId: string | null;
  locationMode: LocationMode;
  editingTarget: SubscriptionTarget | null;
};

export function LocationPanel({
  draft,
  setDraft,
  configurationReady,
  inFlight,
  api,
}: {
  draft: SubscriptionDraft;
  setDraft: (updater: (current: SubscriptionDraft) => SubscriptionDraft) => void;
  configurationReady: boolean;
  inFlight: boolean;
  api: string;
}) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const locateRef = useRef<HTMLButtonElement | null>(null);
  const geocodeJobs = useRef<Map<string, GeocodeJob>>(new Map());
  const coordRev = useRef<Map<string, number>>(new Map());
  const regionRev = useRef<Map<string, number>>(new Map());
  const [ui, setUi] = useState<LocationUi>({
    activeTargetId: null,
    locationMode: "overview",
    editingTarget: null,
  });
  const [regionOpen, setRegionOpen] = useState(false);
  const [regionStatus, setRegionStatus] = useState({ message: "选点后自动解析", state: "" });
  const uiRef = useRef(ui);
  const draftRef = useRef(draft);
  const readyRef = useRef(configurationReady);
  useLayoutEffect(() => {
    readyRef.current = configurationReady;
    uiRef.current = ui;
    draftRef.current = draft;
  });

  function bumpRev(map: Map<string, number>, id: string): number {
    const revision = (map.get(id) || 0) + 1;
    map.set(id, revision);
    return revision;
  }

  function targetById(id: string | null): SubscriptionTarget | null {
    if (!id) return null;
    return draftRef.current.targets.find((target) => target.id === id) || null;
  }

  function activeTarget(): SubscriptionTarget | null {
    const current = uiRef.current;
    return current.locationMode === "overview" ? targetById(current.activeTargetId) : current.editingTarget;
  }

  function workingTargetById(id: string): SubscriptionTarget | null {
    const current = uiRef.current;
    return current.editingTarget?.id === id ? current.editingTarget : targetById(id);
  }

  function setMapView(latitude: number, longitude: number, zoom = 12): void {
    if (mapRef.current && validCoordinate(latitude, longitude)) mapRef.current.setView([latitude, longitude], zoom);
  }

  function fitTargetMarkers(): void {
    const map = mapRef.current;
    if (!map) return;
    const points = draftRef.current.targets
      .map(targetCoordinates)
      .filter((value): value is Coordinates => Boolean(value))
      .map(({ latitude, longitude }) => [latitude, longitude] as [number, number]);
    if (points.length === 1) map.setView(points[0], 10);
    else if (points.length > 1) map.fitBounds(points, { padding: [32, 32], maxZoom: 10 });
  }

  function cancelReverseGeocode(targetId: string | null): void {
    if (!targetId) return;
    const job = geocodeJobs.current.get(targetId);
    if (!job) return;
    if (job.timer) clearTimeout(job.timer);
    job.controller.abort();
    geocodeJobs.current.delete(targetId);
  }

  function scheduleReverseGeocode(targetId: string, delay = 350): void {
    const target = workingTargetById(targetId);
    const coordinates = targetCoordinates(target);
    if (!target || !coordinates) return;
    cancelReverseGeocode(targetId);
    const coordinateRevision = coordRev.current.get(targetId) || 0;
    const regionRevision = regionRev.current.get(targetId) || 0;
    if (uiRef.current.activeTargetId === targetId) setRegionStatus({ message: "正在解析...", state: "loading" });
    const controller = new AbortController();
    const job = { controller, timer: null as ReturnType<typeof setTimeout> | null, coordinateRevision, regionRevision };
    job.timer = setTimeout(() => {
      void reverseGeocode(targetId, coordinates, job);
    }, delay);
    geocodeJobs.current.set(targetId, job);
  }

  async function reverseGeocode(
    targetId: string,
    coordinates: Coordinates,
    job: { controller: AbortController; timer: ReturnType<typeof setTimeout> | null; coordinateRevision: number; regionRevision: number },
  ): Promise<void> {
    try {
      const query = new URLSearchParams({ latitude: String(coordinates.latitude), longitude: String(coordinates.longitude) });
      const res = await fetch(`${api}/api/reverse-geocode?${query}`, { signal: job.controller.signal });
      const json = await parseApiResponse(res);
      const target = workingTargetById(targetId);
      if (!target || geocodeJobs.current.get(targetId) !== job) return;
      if ((coordRev.current.get(targetId) || 0) !== job.coordinateRevision) return;
      if ((regionRev.current.get(targetId) || 0) !== job.regionRevision) return;
      const data = json.data as { province?: string; city?: string; district?: string } | undefined;
      if (!res.ok || !json.success || !data) throw new Error(json.message || "无法解析区域信息");
      target.region.province = data.province || "";
      target.region.city = data.city || "";
      target.region.district = data.district || "";
      const resolved = targetRegion(target);
      if (uiRef.current.activeTargetId === targetId) {
        setRegionStatus({ message: resolved || "未识别到行政区", state: resolved ? "ready" : "" });
      }
      setUi((value) => ({ ...value }));
      setDraft((current) => ({ ...current, targets: [...current.targets] }));
    } catch (error) {
      const err = error as { name?: string; message?: string };
      if (err.name === "AbortError" || geocodeJobs.current.get(targetId) !== job) return;
      if (uiRef.current.activeTargetId === targetId) setRegionStatus({ message: "自动解析失败，可手动填写", state: "" });
      notify(err.message || "区域信息自动解析失败", "warning");
    } finally {
      if (geocodeJobs.current.get(targetId) === job) geocodeJobs.current.delete(targetId);
    }
  }

  function startAddingLocation(initialCoordinates: Coordinates | null = null): void {
    if (!readyRef.current) return;
    if (draftRef.current.targets.length >= 3) {
      notify("最多添加 3 个监测地点", "error");
      return;
    }
    const target = createTarget();
    if (initialCoordinates) {
      target.point.latitude = initialCoordinates.latitude.toFixed(4);
      target.point.longitude = initialCoordinates.longitude.toFixed(4);
      bumpRev(coordRev.current, target.id);
      setMapView(initialCoordinates.latitude, initialCoordinates.longitude);
    }
    setRegionOpen(false);
    setUi({ activeTargetId: target.id, locationMode: "adding", editingTarget: target });
    if (initialCoordinates) scheduleReverseGeocode(target.id, 0);
  }

  function updateActiveTargetCoordinates(latitude: number, longitude: number, zoom = 12): void {
    const target = activeTarget();
    if (!target || !validCoordinate(latitude, longitude)) return;
    target.point.latitude = latitude.toFixed(4);
    target.point.longitude = longitude.toFixed(4);
    bumpRev(coordRev.current, target.id);
    setMapView(latitude, longitude, zoom);
    setUi((value) => ({ ...value, editingTarget: target }));
    scheduleReverseGeocode(target.id);
  }

  useEffect(() => {
    const el = mapElRef.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, { zoomControl: true, attributionControl: false }).setView([35, 105], 4);
    map.zoomControl.setPosition("topright");
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
    const MapTools = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const container = L.DomUtil.create("div", "leaflet-bar map-tool-group");
        const locate = L.DomUtil.create("button", "map-tool-button", container) as HTMLButtonElement;
        locate.type = "button";
        locate.innerHTML = '<span class="map-tool-icon locate" aria-hidden="true"></span>';
        locate.title = "定位当前位置";
        locate.setAttribute("aria-label", "定位当前位置");
        locateRef.current = locate;
        const fit = L.DomUtil.create("button", "map-tool-button", container) as HTMLButtonElement;
        fit.type = "button";
        fit.innerHTML = '<span class="map-tool-icon fit" aria-hidden="true"></span>';
        fit.title = "显示全部监测地点";
        fit.setAttribute("aria-label", "显示全部监测地点");
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        L.DomEvent.on(locate, "click", () => {
          if (!navigator.geolocation) {
            notify("当前浏览器不支持定位", "error");
            return;
          }
          if (uiRef.current.locationMode === "overview") startAddingLocation();
          locate.disabled = true;
          notify("正在获取定位...", "info");
          navigator.geolocation.getCurrentPosition(
            (position) => {
              updateActiveTargetCoordinates(position.coords.latitude, position.coords.longitude);
              const target = activeTarget();
              if (target && !target.label.trim()) {
                target.label = "当前位置";
                setUi((value) => ({ ...value, editingTarget: { ...target } }));
              }
              notify("定位成功", "success");
              locate.disabled = false;
            },
            () => {
              notify("定位失败，请点击地图或输入经纬度", "error");
              locate.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 9000 },
          );
        });
        L.DomEvent.on(fit, "click", () => {
          if (!draftRef.current.targets.some(targetCoordinates)) {
            notify("尚未添加监测地点", "info");
            return;
          }
          fitTargetMarkers();
        });
        return container;
      },
    });
    new MapTools().addTo(map);
    map.on("click", (event) => {
      if (uiRef.current.locationMode === "overview") {
        startAddingLocation({ latitude: event.latlng.lat, longitude: event.latlng.lng });
        return;
      }
      updateActiveTargetCoordinates(event.latlng.lat, event.latlng.lng);
    });
    mapRef.current = map;
    return () => {
      for (const targetId of [...geocodeJobs.current.keys()]) cancelReverseGeocode(targetId);
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const validIds = new Set<string>();
    const markerTargets = draft.targets.map((target) =>
      ui.editingTarget?.id === target.id ? ui.editingTarget : target,
    );
    if (ui.locationMode === "adding" && ui.editingTarget) markerTargets.push(ui.editingTarget);
    markerTargets.forEach((target, index) => {
      const coordinates = targetCoordinates(target);
      if (!coordinates) return;
      validIds.add(target.id);
      const active = target.id === ui.activeTargetId;
      const icon = L.divIcon({
        className: "",
        html: `<span class="target-marker${active ? " is-active" : ""}">${index + 1}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      let marker = markersRef.current.get(target.id);
      if (!marker) {
        marker = L.marker([coordinates.latitude, coordinates.longitude], { icon, keyboard: true });
        marker.on("click", () => {
          const found = draftRef.current.targets.find((item) => item.id === target.id);
          if (!found) return;
          if (uiRef.current.locationMode !== "overview" && target.id !== uiRef.current.activeTargetId) {
            notify("请先完成或取消当前编辑", "warning");
            return;
          }
          setUi((value) => ({ ...value, activeTargetId: target.id }));
          const point = targetCoordinates(found);
          if (point) setMapView(point.latitude, point.longitude);
        });
        marker.addTo(map);
        markersRef.current.set(target.id, marker);
      } else {
        marker.setLatLng([coordinates.latitude, coordinates.longitude]);
        marker.setIcon(icon);
      }
    });
    markersRef.current.forEach((marker, targetId) => {
      if (!validIds.has(targetId)) {
        map.removeLayer(marker);
        markersRef.current.delete(targetId);
      }
    });
  }, [draft.targets, ui]);

  useEffect(() => {
    if (configurationReady) fitTargetMarkers();
  }, [configurationReady]);

  const target = ui.locationMode === "overview"
    ? draft.targets.find((item) => item.id === ui.activeTargetId) || null
    : ui.editingTarget;
  const coordinates = targetCoordinates(target);
  const count = draft.targets.length;
  const editorOpen = Boolean(target && ui.locationMode !== "overview");
  const adding = ui.locationMode === "adding";

  return (
    <section className="workspace-section">
      <div className="workspace-heading location-heading">
        <h2>监测地点</h2>
        <span id="location-count">{count} / 3</span>
      </div>
      <div className="map-shell">
        <div id="map" ref={mapElRef} />
        <div id="map-mode" className={`map-mode${editorOpen ? " is-selecting" : ""}`}>
          {adding && !coordinates
            ? "点击地图选择监测位置"
            : adding
              ? "位置已选择，点击地图可调整"
              : editorOpen
                ? "编辑中：点击地图可移动此地点"
                : count
                  ? "点击地图继续添加，点击标记查看地点"
                  : "点击地图添加监测地点"}
        </div>
      </div>
      <div className="map-actions">
        <Button
          id="start-add-location"
          type="button"
          variant="outline"
          disabled={count >= 3 || inFlight || !configurationReady || ui.locationMode !== "overview"}
          onClick={() => startAddingLocation()}
        >
          手动输入坐标
        </Button>
      </div>
      <Card id="location-editor" className="location-editor gap-4 py-4 shadow-none" hidden={!editorOpen}>
        <CardHeader className="location-editor-heading px-4">
          <CardTitle id="location-editor-title" className="location-editor-title text-base">
            {adding ? "添加监测地点" : "编辑监测地点"}
          </CardTitle>
          <CardDescription id="location-editor-subtitle" className="location-editor-subtitle">
            {adding
              ? coordinates ? "位置已选择，可补充名称后保存" : "先选择需要监测的位置"
              : targetLabel(target)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-4">
        <div className="location-picker">
          <span className="location-picker-heading">
            {coordinates ? "当前位置，可在地图点击以调整" : "在地图点击位置，或输入坐标"}
          </span>
          <div className="coordinate-grid">
            <Field label="纬度" htmlFor="latitude">
              <Input
                id="latitude"
                type="number"
                step="0.0001"
                min={-90}
                max={90}
                placeholder="例如：35.6762"
                value={target?.point.latitude ?? ""}
                onChange={(event) => {
                  const current = activeTarget();
                  if (!current) return;
                  current.point.latitude = event.target.value;
                  bumpRev(coordRev.current, current.id);
                  cancelReverseGeocode(current.id);
                  setUi((value) => ({ ...value, editingTarget: { ...current } }));
                }}
                onBlur={() => {
                  const current = activeTarget();
                  const point = targetCoordinates(current);
                  if (current && point) {
                    setMapView(point.latitude, point.longitude);
                    scheduleReverseGeocode(current.id);
                  }
                }}
              />
            </Field>
            <Field label="经度" htmlFor="longitude">
              <Input
                id="longitude"
                type="number"
                step="0.0001"
                min={-180}
                max={180}
                placeholder="例如：139.6503"
                value={target?.point.longitude ?? ""}
                onChange={(event) => {
                  const current = activeTarget();
                  if (!current) return;
                  current.point.longitude = event.target.value;
                  bumpRev(coordRev.current, current.id);
                  cancelReverseGeocode(current.id);
                  setUi((value) => ({ ...value, editingTarget: { ...current } }));
                }}
                onBlur={() => {
                  const current = activeTarget();
                  const point = targetCoordinates(current);
                  if (current && point) {
                    setMapView(point.latitude, point.longitude);
                    scheduleReverseGeocode(current.id);
                  }
                }}
              />
            </Field>
          </div>
        </div>
        <div id="location-details" className="location-details" hidden={adding && !coordinates}>
          <Field label="地点名称（可选）" htmlFor="location-name">
            <Input
              id="location-name"
              maxLength={80}
              placeholder="例如：家、公司"
              value={target?.label || ""}
              onChange={(event) => {
                const current = activeTarget();
                if (!current) return;
                current.label = event.target.value;
                setUi((value) => ({ ...value, editingTarget: { ...current } }));
              }}
            />
          </Field>
          <div className="region-match">
            <div className="region-match-copy">
              <span className="region-match-label">区域匹配</span>
              <span id="region-status" className={`region-match-value${regionStatus.state ? ` is-${regionStatus.state}` : ""}`}>
                {regionStatus.message}
              </span>
            </div>
            <Button id="edit-region" type="button" variant="ghost" size="sm" onClick={() => setRegionOpen((open) => !open)}>
              {regionOpen ? "完成" : regionStatus.state === "ready" ? "修改" : "手动填写"}
            </Button>
          </div>
          <div id="region-editor" className="region-editor" hidden={!regionOpen}>
            <div className="region-editor-inner">
              <div className="admin-grid">
                <Field label="省/州" htmlFor="province">
                  <Input id="province" maxLength={80} placeholder="可选" value={target?.region.province || ""} onChange={(event) => {
                    const current = activeTarget();
                    if (!current) return;
                    current.region.province = event.target.value;
                    bumpRev(regionRev.current, current.id);
                    cancelReverseGeocode(current.id);
                    const region = targetRegion(current);
                    setRegionStatus({ message: region ? "已手动修改" : "可手动填写行政区", state: region ? "ready" : "" });
                    setUi((value) => ({ ...value, editingTarget: { ...current } }));
                  }} />
                </Field>
                <Field label="城市" htmlFor="city">
                  <Input id="city" maxLength={80} placeholder="可选" value={target?.region.city || ""} onChange={(event) => {
                    const current = activeTarget();
                    if (!current) return;
                    current.region.city = event.target.value;
                    bumpRev(regionRev.current, current.id);
                    cancelReverseGeocode(current.id);
                    const region = targetRegion(current);
                    setRegionStatus({ message: region ? "已手动修改" : "可手动填写行政区", state: region ? "ready" : "" });
                    setUi((value) => ({ ...value, editingTarget: { ...current } }));
                  }} />
                </Field>
                <Field label="区/县" htmlFor="district">
                  <Input id="district" maxLength={80} placeholder="可选" value={target?.region.district || ""} onChange={(event) => {
                    const current = activeTarget();
                    if (!current) return;
                    current.region.district = event.target.value;
                    bumpRev(regionRev.current, current.id);
                    cancelReverseGeocode(current.id);
                    const region = targetRegion(current);
                    setRegionStatus({ message: region ? "已手动修改" : "可手动填写行政区", state: region ? "ready" : "" });
                    setUi((value) => ({ ...value, editingTarget: { ...current } }));
                  }} />
                </Field>
              </div>
              <small className="region-editor-note">填写行政区可提高气象预警覆盖，并用于海啸区域匹配。</small>
            </div>
          </div>
        </div>
        <div className="location-editor-actions">
          <Button id="discard-location-edit" type="button" variant="outline" disabled={inFlight || !configurationReady} onClick={() => {
            cancelReverseGeocode(ui.activeTargetId);
            setRegionOpen(false);
            setUi({
              activeTargetId: ui.locationMode === "adding" ? null : ui.activeTargetId,
              locationMode: "overview",
              editingTarget: null,
            });
          }}>
            取消
          </Button>
          <Button
            id="finish-location"
            type="button"
            disabled={inFlight || !configurationReady || !coordinates}
            onClick={() => {
              const current = activeTarget();
              if (!current) return;
              const isAdding = ui.locationMode === "adding";
              const index = isAdding ? draft.targets.length : draft.targets.findIndex((item) => item.id === current.id);
              const error = validateLocations([current]);
              if (error) {
                notify(error.replace("监测地点 1", `监测地点 ${index + 1}`), "error");
                return;
              }
              const duplicate = draft.targets.some((item) => item.id !== current.id
                && targetCoordinates(item)?.latitude.toFixed(4) === targetCoordinates(current)?.latitude.toFixed(4)
                && targetCoordinates(item)?.longitude.toFixed(4) === targetCoordinates(current)?.longitude.toFixed(4));
              if (duplicate) {
                notify(`监测地点 ${index + 1} 与其他地点坐标重复`, "error");
                return;
              }
              setDraft((value) => {
                const targets = [...value.targets];
                if (isAdding) targets.push(current);
                else targets[index] = current;
                return { ...value, targets };
              });
              setRegionOpen(false);
              setUi({ activeTargetId: current.id, locationMode: "overview", editingTarget: null });
            }}
          >
            {adding ? "保存地点" : "保存修改"}
          </Button>
        </div>
        </CardContent>
      </Card>
      <div className="locations-section">
        <div className="locations-section-heading">
          <span>已添加地点</span>
          <span id="locations-summary">{count ? `共 ${count} 个，可添加 ${3 - count} 个` : "尚未添加"}</span>
        </div>
        <div id="locations-list" className="locations-list">
          {count === 0 ? (
            <div className="locations-empty">尚未添加地点。点击地图选择位置，也可以使用当前位置或手动输入坐标。</div>
          ) : draft.targets.map((item, index) => {
            const point = targetCoordinates(item);
            const region = targetRegion(item);
            const active = item.id === ui.activeTargetId;
            return (
              <Card
                key={item.id}
                className={cn(
                  "location-item flex-row items-center gap-3 py-3 shadow-none",
                  active && "is-active ring-2 ring-ring/40",
                  !point && "is-incomplete",
                )}
                data-target-id={item.id}
              >
                <span className="location-index">{index + 1}</span>
                <Button
                  className="location-focus h-auto min-h-0 w-full flex-col items-start justify-start gap-0 p-0 font-normal"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                  if (ui.locationMode !== "overview" && item.id !== ui.activeTargetId) {
                    notify("请先完成或取消当前编辑", "warning");
                    return;
                  }
                  setUi((value) => ({ ...value, activeTargetId: item.id }));
                  if (point) setMapView(point.latitude, point.longitude);
                }}>
                  <span className="location-name">{targetLabel(item)}</span>
                  <span className="location-coords">{point ? `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}` : "尚未选择位置"}</span>
                  <span className={`location-region ${region ? "" : "is-missing"}`}>{region || "区域待识别"}</span>
                </Button>
                <span className="location-actions">
                  <Button type="button" variant="ghost" size="sm" onClick={() => {
                    if (ui.locationMode !== "overview" && item.id !== ui.activeTargetId) {
                      notify("请先完成或取消当前编辑", "warning");
                      return;
                    }
                    const pointToView = targetCoordinates(item);
                    if (pointToView) setMapView(pointToView.latitude, pointToView.longitude);
                    setRegionOpen(false);
                    setUi({ activeTargetId: item.id, locationMode: "editing", editingTarget: cloneTarget(item) });
                  }}>编辑</Button>
                  <Button className="remove-location" type="button" variant="ghost" size="sm" aria-label={`删除地点 ${index + 1}`} title="删除地点" onClick={() => {
                    if (ui.locationMode !== "overview" && item.id !== ui.activeTargetId) {
                      notify("请先完成或取消当前编辑", "warning");
                      return;
                    }
                    cancelReverseGeocode(item.id);
                    setDraft((value) => ({ ...value, targets: value.targets.filter((row) => row.id !== item.id) }));
                    if (ui.activeTargetId === item.id) {
                      setRegionOpen(false);
                      setUi({ activeTargetId: null, locationMode: "overview", editingTarget: null });
                    }
                    notify("已从订阅草稿移除地点", "success");
                  }}>删除</Button>
                </span>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
