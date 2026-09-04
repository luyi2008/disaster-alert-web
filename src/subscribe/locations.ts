import L from "leaflet";
import {
  cloneTarget,
  createTarget,
  targetCoordinates,
  targetLabel,
  targetRegion,
  validCoordinate,
  validateLocations,
} from "./geo";
import { escapeHtml } from "./html";
import { parseApiResponse } from "./http";
import { animateHeight } from "./motion";
import type { SubscribeRuntime } from "./runtime";
import type { Coordinates, SubscriptionTarget, ToastType } from "./types";

export type LocationController = {
  renderLocations: () => void;
  renderLocationEditor: () => void;
  fitTargetMarkers: () => void;
  activeTarget: () => SubscriptionTarget | null;
  cancelAllGeocode: () => void;
};

export function bindLocations(
  ctx: SubscribeRuntime,
  helpers: {
    show: (message: string, type?: ToastType) => void;
  },
): LocationController {
  const { el } = ctx;

  ctx.map = L
    ? L.map(el.mapElement, { zoomControl: true, attributionControl: false }).setView([35, 105], 4)
    : null;
  if (ctx.map) {
    const map = ctx.map;
    map.zoomControl.setPosition("topright");
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
    const MapTools = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const container = L.DomUtil.create("div", "leaflet-bar map-tool-group");
        ctx.locate = L.DomUtil.create("button", "map-tool-button", container) as HTMLButtonElement;
        ctx.locate.type = "button";
        ctx.locate.innerHTML = '<span class="map-tool-icon locate" aria-hidden="true"></span>';
        ctx.locate.title = "定位当前位置";
        ctx.locate.setAttribute("aria-label", "定位当前位置");
        const fit = L.DomUtil.create("button", "map-tool-button", container) as HTMLButtonElement;
        fit.type = "button";
        fit.innerHTML = '<span class="map-tool-icon fit" aria-hidden="true"></span>';
        fit.title = "显示全部监测地点";
        fit.setAttribute("aria-label", "显示全部监测地点");
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        L.DomEvent.on(ctx.locate, "click", locateCurrentPosition);
        L.DomEvent.on(fit, "click", () => {
          if (!ctx.subscriptionDraft.targets.some(targetCoordinates)) {
            helpers.show("尚未添加监测地点", "info");
            return;
          }
          fitTargetMarkers();
        });
        return container;
      },
    });
    new MapTools().addTo(map);
    ctx.cleanup.add(() => {
      map.remove();
      ctx.map = null;
      ctx.targetMarkers.clear();
    });
  } else {
    el.mapElement.classList.add("map-unavailable");
  }

  function nextRevision(map: Map<string, number>, id: string): number {
    const revision = (map.get(id) || 0) + 1;
    map.set(id, revision);
    return revision;
  }

  function setMapView(latitude: number, longitude: number, zoom = 12): void {
    if (ctx.map && validCoordinate(latitude, longitude)) ctx.map.setView([latitude, longitude], zoom);
  }

  function fitTargetMarkers(): void {
    if (!ctx.map) return;
    const points = ctx.subscriptionDraft.targets
      .map(targetCoordinates)
      .filter((value): value is Coordinates => Boolean(value))
      .map(({ latitude, longitude }) => [latitude, longitude] as [number, number]);
    if (points.length === 1) ctx.map.setView(points[0], 10);
    else if (points.length > 1) ctx.map.fitBounds(points, { padding: [32, 32], maxZoom: 10 });
  }

  function setRegionStatus(message: string, state = ""): void {
    el.regionStatus.textContent = message;
    el.regionStatus.className = `region-match-value${state ? ` is-${state}` : ""}`;
    if (el.regionEditor.hidden) el.editRegion.textContent = state === "ready" ? "修改" : "手动填写";
  }

  function setRegionEditorOpen(open: boolean): void {
    if (el.regionEditor.dataset.animating === "true" || el.regionEditor.hidden === !open) return;
    el.regionEditor.dataset.animating = "true";
    el.editRegion.textContent = open ? "完成" : "修改";
    el.editRegion.setAttribute("aria-expanded", String(open));
    if (open) {
      el.regionEditor.hidden = false;
      animateHeight(el.regionEditor, true, () => {
        el.regionEditor.dataset.animating = "false";
        el.provinceInput.focus();
      });
    } else {
      animateHeight(el.regionEditor, false, () => {
        el.regionEditor.hidden = true;
        el.regionEditor.dataset.animating = "false";
      });
    }
  }

  function cancelReverseGeocode(targetId: string | null): void {
    if (!targetId) return;
    const job = ctx.geocodeJobs.get(targetId);
    if (!job) return;
    if (job.timer) clearTimeout(job.timer);
    job.controller.abort();
    ctx.geocodeJobs.delete(targetId);
  }

  function cancelAllGeocode(): void {
    for (const targetId of [...ctx.geocodeJobs.keys()]) {
      cancelReverseGeocode(targetId);
    }
  }

  function targetById(id: string | null): SubscriptionTarget | null {
    if (!id) return null;
    return ctx.subscriptionDraft.targets.find((target) => target.id === id) || null;
  }

  function activeTarget(): SubscriptionTarget | null {
    return ctx.uiState.locationMode === "overview" ? targetById(ctx.uiState.activeTargetId) : ctx.uiState.editingTarget;
  }

  function workingTargetById(id: string): SubscriptionTarget | null {
    return ctx.uiState.editingTarget?.id === id ? ctx.uiState.editingTarget : targetById(id);
  }

  function scheduleReverseGeocode(targetId: string, delay = 350): void {
    const target = workingTargetById(targetId);
    const coordinates = targetCoordinates(target);
    if (!target || !coordinates) return;
    cancelReverseGeocode(targetId);
    const coordinateRevision = ctx.targetCoordinateRevisions.get(targetId) || 0;
    const regionRevision = ctx.targetRegionRevisions.get(targetId) || 0;
    if (ctx.uiState.activeTargetId === targetId) setRegionStatus("正在解析...", "loading");
    const controller = new AbortController();
    const job = { controller, timer: null as ReturnType<typeof setTimeout> | null, coordinateRevision, regionRevision };
    job.timer = setTimeout(() => {
      void reverseGeocode(targetId, coordinates, job);
    }, delay);
    ctx.geocodeJobs.set(targetId, job);
  }

  async function reverseGeocode(
    targetId: string,
    coordinates: Coordinates,
    job: { controller: AbortController; timer: ReturnType<typeof setTimeout> | null; coordinateRevision: number; regionRevision: number },
  ): Promise<void> {
    try {
      const query = new URLSearchParams({ latitude: String(coordinates.latitude), longitude: String(coordinates.longitude) });
      const res = await fetch(`${ctx.api}/api/reverse-geocode?${query}`, { signal: job.controller.signal });
      const json = await parseApiResponse(res);
      const target = workingTargetById(targetId);
      if (!target || ctx.geocodeJobs.get(targetId) !== job) return;
      if ((ctx.targetCoordinateRevisions.get(targetId) || 0) !== job.coordinateRevision) return;
      if ((ctx.targetRegionRevisions.get(targetId) || 0) !== job.regionRevision) return;
      const data = json.data as { province?: string; city?: string; district?: string } | undefined;
      if (!res.ok || !json.success || !data) throw new Error(json.message || "无法解析区域信息");
      target.region.province = data.province || "";
      target.region.city = data.city || "";
      target.region.district = data.district || "";
      const resolved = targetRegion(target);
      if (ctx.uiState.activeTargetId === targetId) {
        el.provinceInput.value = target.region.province;
        el.cityInput.value = target.region.city;
        el.districtInput.value = target.region.district;
        setRegionStatus(resolved || "未识别到行政区", resolved ? "ready" : "");
      }
      renderLocations();
    } catch (error) {
      const err = error as { name?: string; message?: string };
      if (err.name === "AbortError" || ctx.geocodeJobs.get(targetId) !== job) return;
      if (ctx.uiState.activeTargetId === targetId) setRegionStatus("自动解析失败，可手动填写");
      helpers.show(err.message || "区域信息自动解析失败", "warning");
    } finally {
      if (ctx.geocodeJobs.get(targetId) === job) ctx.geocodeJobs.delete(targetId);
    }
  }

  function renderTargetMarkers(): void {
    if (!ctx.map) return;
    const validIds = new Set<string>();
    const markerTargets = ctx.subscriptionDraft.targets.map((target) =>
      ctx.uiState.editingTarget?.id === target.id ? ctx.uiState.editingTarget : target,
    );
    if (ctx.uiState.locationMode === "adding" && ctx.uiState.editingTarget) markerTargets.push(ctx.uiState.editingTarget);
    markerTargets.forEach((target, index) => {
      const coordinates = targetCoordinates(target);
      if (!coordinates) return;
      validIds.add(target.id);
      const active = target.id === ctx.uiState.activeTargetId;
      const icon = L.divIcon({
        className: "",
        html: `<span class="target-marker${active ? " is-active" : ""}">${index + 1}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      let marker = ctx.targetMarkers.get(target.id);
      if (!marker) {
        marker = L.marker([coordinates.latitude, coordinates.longitude], { icon, keyboard: true });
        marker.on("click", () => focusTarget(target.id));
        marker.addTo(ctx.map as L.Map);
        ctx.targetMarkers.set(target.id, marker);
      } else {
        marker.setLatLng([coordinates.latitude, coordinates.longitude]);
        marker.setIcon(icon);
      }
    });
    ctx.targetMarkers.forEach((marker, targetId) => {
      if (!validIds.has(targetId)) {
        ctx.map?.removeLayer(marker);
        ctx.targetMarkers.delete(targetId);
      }
    });
  }

  function renderLocationEditor(): void {
    const target = activeTarget();
    const open = Boolean(target && ctx.uiState.locationMode !== "overview");
    el.locationEditor.hidden = !open;
    if (!open) return;
    const adding = ctx.uiState.locationMode === "adding";
    const coordinates = targetCoordinates(target);
    el.locationEditorTitle.textContent = adding ? "添加监测地点" : "编辑监测地点";
    el.locationEditorSubtitle.textContent = adding
      ? coordinates ? "位置已选择，可补充名称后保存" : "先选择需要监测的位置"
      : targetLabel(target);
    el.locationPickerHeading.textContent = coordinates ? "当前位置，可在地图点击以调整" : "在地图点击位置，或输入坐标";
    el.locationDetails.hidden = adding && !coordinates;
    el.finishLocation.disabled = ctx.subscriptionRequestInFlight || !ctx.configurationReady || !coordinates;
    el.finishLocation.textContent = adding ? "保存地点" : "保存修改";
    el.nameInput.value = target?.label || "";
    el.latInput.value = target?.point.latitude ?? "";
    el.lonInput.value = target?.point.longitude ?? "";
    el.provinceInput.value = target?.region.province || "";
    el.cityInput.value = target?.region.city || "";
    el.districtInput.value = target?.region.district || "";
    const region = targetRegion(target);
    setRegionStatus(region || "正在根据位置识别", region ? "ready" : "");
    el.mapMode.textContent = adding && !coordinates ? "点击地图选择监测位置" : adding ? "位置已选择，点击地图可调整" : "编辑中：点击地图可移动此地点";
    el.mapMode.classList.add("is-selecting");
  }

  function renderLocations(): void {
    const count = ctx.subscriptionDraft.targets.length;
    el.locationCount.textContent = `${count} / 3`;
    el.locationsSummary.textContent = count ? `共 ${count} 个，可添加 ${3 - count} 个` : "尚未添加";
    el.startAddLocation.disabled = count >= 3 || ctx.subscriptionRequestInFlight || !ctx.configurationReady || ctx.uiState.locationMode !== "overview";
    if (!count) {
      el.locationsList.innerHTML = '<div class="locations-empty">尚未添加地点。点击地图选择位置，也可以使用当前位置或手动输入坐标。</div>';
    } else {
      el.locationsList.innerHTML = ctx.subscriptionDraft.targets.map((target, index) => {
        const coordinates = targetCoordinates(target);
        const region = targetRegion(target);
        const active = target.id === ctx.uiState.activeTargetId;
        return `
        <div class="location-item${active ? " is-active" : ""}${coordinates ? "" : " is-incomplete"}" data-target-id="${escapeHtml(target.id)}">
          <span class="location-index">${index + 1}</span>
          <button class="location-focus" type="button" data-location-action="focus">
            <span class="location-name">${escapeHtml(targetLabel(target))}</span>
            <span class="location-coords">${coordinates ? `${escapeHtml(coordinates.latitude.toFixed(4))}, ${escapeHtml(coordinates.longitude.toFixed(4))}` : "尚未选择位置"}</span>
            <span class="location-region ${region ? "" : "is-missing"}">${escapeHtml(region || "区域待识别")}</span>
          </button>
          <span class="location-actions">
            <button type="button" data-location-action="edit">编辑</button>
            <button class="remove-location" type="button" data-location-action="remove" aria-label="删除地点 ${index + 1}" title="删除地点">删除</button>
          </span>
        </div>`;
      }).join("");
    }
    renderTargetMarkers();
    if (ctx.uiState.locationMode === "overview") {
      el.mapMode.textContent = count ? "点击地图继续添加，点击标记查看地点" : "点击地图添加监测地点";
      el.mapMode.classList.remove("is-selecting");
    }
  }

  function startAddingLocation(initialCoordinates: Coordinates | null = null): void {
    if (!ctx.configurationReady) return;
    if (ctx.subscriptionDraft.targets.length >= 3) {
      helpers.show("最多添加 3 个监测地点", "error");
      return;
    }
    const target = createTarget();
    ctx.uiState.activeTargetId = target.id;
    ctx.uiState.locationMode = "adding";
    ctx.uiState.editingTarget = target;
    if (initialCoordinates) {
      target.point.latitude = initialCoordinates.latitude.toFixed(4);
      target.point.longitude = initialCoordinates.longitude.toFixed(4);
      nextRevision(ctx.targetCoordinateRevisions, target.id);
      setMapView(initialCoordinates.latitude, initialCoordinates.longitude);
      scheduleReverseGeocode(target.id, 0);
    }
    setRegionEditorOpen(false);
    renderLocations();
    renderLocationEditor();
  }

  function focusTarget(targetId: string): void {
    const target = targetById(targetId);
    if (!target) return;
    if (ctx.uiState.locationMode !== "overview" && targetId !== ctx.uiState.activeTargetId) {
      helpers.show("请先完成或取消当前编辑", "warning");
      return;
    }
    ctx.uiState.activeTargetId = targetId;
    const coordinates = targetCoordinates(target);
    if (coordinates) setMapView(coordinates.latitude, coordinates.longitude);
    renderLocations();
  }

  function editTarget(targetId: string): void {
    const target = targetById(targetId);
    if (!target) return;
    if (ctx.uiState.locationMode !== "overview" && targetId !== ctx.uiState.activeTargetId) {
      helpers.show("请先完成或取消当前编辑", "warning");
      return;
    }
    ctx.uiState.activeTargetId = targetId;
    ctx.uiState.locationMode = "editing";
    ctx.uiState.editingTarget = cloneTarget(target);
    const coordinates = targetCoordinates(target);
    if (coordinates) setMapView(coordinates.latitude, coordinates.longitude);
    setRegionEditorOpen(false);
    renderLocations();
    renderLocationEditor();
  }

  function finishLocationEdit(): void {
    const target = activeTarget();
    if (!target) return;
    const adding = ctx.uiState.locationMode === "adding";
    const index = adding ? ctx.subscriptionDraft.targets.length : ctx.subscriptionDraft.targets.findIndex((item) => item.id === target.id);
    const error = validateLocations([target]);
    if (error) {
      helpers.show(error.replace("监测地点 1", `监测地点 ${index + 1}`), "error");
      return;
    }
    const duplicate = ctx.subscriptionDraft.targets.some((item) => item.id !== target.id
      && targetCoordinates(item)?.latitude.toFixed(4) === targetCoordinates(target)?.latitude.toFixed(4)
      && targetCoordinates(item)?.longitude.toFixed(4) === targetCoordinates(target)?.longitude.toFixed(4));
    if (duplicate) {
      helpers.show(`监测地点 ${index + 1} 与其他地点坐标重复`, "error");
      return;
    }
    if (adding) ctx.subscriptionDraft.targets.push(target);
    else ctx.subscriptionDraft.targets[index] = target;
    ctx.uiState.locationMode = "overview";
    ctx.uiState.editingTarget = null;
    setRegionEditorOpen(false);
    renderLocations();
    renderLocationEditor();
  }

  function discardLocationChanges(): void {
    const targetId = ctx.uiState.activeTargetId;
    cancelReverseGeocode(targetId);
    if (targetId) {
      ctx.targetCoordinateRevisions.delete(targetId);
      ctx.targetRegionRevisions.delete(targetId);
    }
    if (ctx.uiState.locationMode === "adding") ctx.uiState.activeTargetId = null;
    ctx.uiState.locationMode = "overview";
    ctx.uiState.editingTarget = null;
    setRegionEditorOpen(false);
    renderLocations();
    renderLocationEditor();
  }

  function removeTarget(targetId: string): void {
    const target = targetById(targetId);
    if (!target) return;
    if (ctx.uiState.locationMode !== "overview" && targetId !== ctx.uiState.activeTargetId) {
      helpers.show("请先完成或取消当前编辑", "warning");
      return;
    }
    cancelReverseGeocode(targetId);
    ctx.subscriptionDraft.targets = ctx.subscriptionDraft.targets.filter((item) => item.id !== targetId);
    ctx.targetCoordinateRevisions.delete(targetId);
    ctx.targetRegionRevisions.delete(targetId);
    if (ctx.uiState.activeTargetId === targetId) {
      ctx.uiState.activeTargetId = null;
      ctx.uiState.locationMode = "overview";
      ctx.uiState.editingTarget = null;
      setRegionEditorOpen(false);
    }
    renderLocations();
    renderLocationEditor();
    helpers.show("已从订阅草稿移除地点", "success");
  }

  function updateActiveTargetCoordinates(latitude: number, longitude: number, zoom = 12): void {
    const target = activeTarget();
    if (!target || !validCoordinate(latitude, longitude)) return;
    target.point.latitude = latitude.toFixed(4);
    target.point.longitude = longitude.toFixed(4);
    nextRevision(ctx.targetCoordinateRevisions, target.id);
    setMapView(latitude, longitude, zoom);
    renderLocations();
    renderLocationEditor();
    if (ctx.uiState.locationMode === "adding") el.nameInput.focus({ preventScroll: true });
    scheduleReverseGeocode(target.id);
  }

  function locateCurrentPosition(): void {
    if (!navigator.geolocation) {
      helpers.show("当前浏览器不支持定位", "error");
      return;
    }
    if (ctx.uiState.locationMode === "overview") startAddingLocation();
    if (ctx.locate) ctx.locate.disabled = true;
    helpers.show("正在获取定位...", "info");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateActiveTargetCoordinates(position.coords.latitude, position.coords.longitude);
        const target = activeTarget();
        if (target && !target.label.trim()) {
          target.label = "当前位置";
          renderLocations();
          renderLocationEditor();
        }
        helpers.show("定位成功", "success");
        if (ctx.locate) ctx.locate.disabled = false;
      },
      () => {
        helpers.show("定位失败，请点击地图或输入经纬度", "error");
        if (ctx.locate) ctx.locate.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 9000 },
    );
  }

  if (ctx.map) {
    ctx.map.on("click", (event) => {
      if (ctx.uiState.locationMode === "overview") {
        startAddingLocation({ latitude: event.latlng.lat, longitude: event.latlng.lng });
        return;
      }
      updateActiveTargetCoordinates(event.latlng.lat, event.latlng.lng);
    });
  }

  ctx.cleanup.listen(el.startAddLocation, "click", () => startAddingLocation());
  ctx.cleanup.listen(el.finishLocation, "click", () => finishLocationEdit());
  ctx.cleanup.listen(el.discardLocationEdit, "click", () => discardLocationChanges());

  el.editRegion.setAttribute("aria-controls", "region-editor");
  el.editRegion.setAttribute("aria-expanded", "false");
  ctx.cleanup.listen(el.editRegion, "click", () => setRegionEditorOpen(Boolean(el.regionEditor.hidden)));

  ctx.cleanup.listen(el.locationsList, "click", (event) => {
    const row = (event.target as HTMLElement | null)?.closest(".location-item") as HTMLElement | null;
    if (!row) return;
    const targetId = row.dataset.targetId || "";
    const action = (event.target as HTMLElement | null)?.closest("[data-location-action]") as HTMLElement | null;
    const locationAction = action?.dataset.locationAction;
    if (locationAction === "remove") {
      removeTarget(targetId);
      return;
    }
    if (locationAction === "edit") {
      editTarget(targetId);
      return;
    }
    if (locationAction === "focus") focusTarget(targetId);
  });

  ctx.cleanup.listen(el.nameInput, "input", () => {
    const target = activeTarget();
    if (!target) return;
    target.label = el.nameInput.value;
    renderLocations();
  });
  for (const input of [el.provinceInput, el.cityInput, el.districtInput]) {
    ctx.cleanup.listen(input, "input", () => {
      const target = activeTarget();
      if (!target) return;
      target.region.province = el.provinceInput.value;
      target.region.city = el.cityInput.value;
      target.region.district = el.districtInput.value;
      nextRevision(ctx.targetRegionRevisions, target.id);
      cancelReverseGeocode(target.id);
      const region = targetRegion(target);
      setRegionStatus(region ? "已手动修改" : "可手动填写行政区", region ? "ready" : "");
      renderLocations();
    });
  }
  for (const input of [el.latInput, el.lonInput]) {
    ctx.cleanup.listen(input, "input", () => {
      const target = activeTarget();
      if (!target) return;
      target.point.latitude = el.latInput.value;
      target.point.longitude = el.lonInput.value;
      nextRevision(ctx.targetCoordinateRevisions, target.id);
      cancelReverseGeocode(target.id);
      renderLocations();
      renderLocationEditor();
    });
    ctx.cleanup.listen(input, "change", () => {
      const target = activeTarget();
      if (!target) return;
      const coordinates = targetCoordinates(target);
      if (coordinates) {
        setMapView(coordinates.latitude, coordinates.longitude);
        scheduleReverseGeocode(target.id);
      }
    });
  }

  ctx.cleanup.add(() => cancelAllGeocode());

  return {
    renderLocations,
    renderLocationEditor,
    fitTargetMarkers,
    activeTarget,
    cancelAllGeocode,
  };
}
