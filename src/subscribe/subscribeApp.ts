// @ts-nocheck
import L from "leaflet";

export function mountSubscribeApp(root, options) {
  const api = String(options.api || "").replace(/\/$/, "");
  const instanceTermsAccepted = Boolean(options.instanceTermsAccepted);
  const document = root.ownerDocument;

const storageKey = "disaster_subscription_draft_v3";
const legacyStorageKey = "disaster_subscription_draft_v2";
const form = document.querySelector("#subscribe-form");
const barkInput = document.querySelector("#bark-id");
const barkUrlInput = document.querySelector("#bark-url");
const barkUrlField = document.querySelector("#bark-url-field");
const nameInput = document.querySelector("#location-name");
const provinceInput = document.querySelector("#province");
const cityInput = document.querySelector("#city");
const districtInput = document.querySelector("#district");
const regionStatus = document.querySelector("#region-status");
const editRegion = document.querySelector("#edit-region");
const regionEditor = document.querySelector("#region-editor");
const latInput = document.querySelector("#latitude");
const lonInput = document.querySelector("#longitude");
const locationsList = document.querySelector("#locations-list");
const locationCount = document.querySelector("#location-count");
const locationsSummary = document.querySelector("#locations-summary");
const locationEditor = document.querySelector("#location-editor");
const locationEditorTitle = document.querySelector("#location-editor-title");
const locationEditorSubtitle = document.querySelector("#location-editor-subtitle");
const locationPickerHeading = document.querySelector("#location-picker-heading");
const locationDetails = document.querySelector("#location-details");
const mapMode = document.querySelector("#map-mode");
const startAddLocation = document.querySelector("#start-add-location");
const finishLocation = document.querySelector("#finish-location");
const discardLocationEdit = document.querySelector("#discard-location-edit");
const draftStatus = document.querySelector("#draft-status");
let notifyBandsEl = null;
let notifyWarning = null;
const toastStack = document.querySelector("#toast-stack");
const retryConfig = document.querySelector("#retry-config");
const submit = document.querySelector("#submit");
const unsubscribe = document.querySelector("#unsubscribe");
let locate = null;
const statusShell = document.querySelector("#status-shell");
const serviceStatus = document.querySelector("#service-status");
const statusLabel = document.querySelector("#status-label");
const statusDot = document.querySelector("#status-dot");
const statusUpdated = document.querySelector("#status-updated");
const statusWolfxDot = document.querySelector("#status-wolfx-dot");
const statusWolfxState = document.querySelector("#status-wolfx-state");
const statusWolfxMeta = document.querySelector("#status-wolfx-meta");
const statusFanstudioDot = document.querySelector("#status-fanstudio-dot");
const statusFanstudioState = document.querySelector("#status-fanstudio-state");
const statusFanstudioMeta = document.querySelector("#status-fanstudio-meta");
const statusHuaniaDot = document.querySelector("#status-huania-dot");
const statusHuaniaState = document.querySelector("#status-huania-state");
const statusHuaniaMeta = document.querySelector("#status-huania-meta");
const statusSubscriptions = document.querySelector("#status-subscriptions");
const statusPending = document.querySelector("#status-pending");
const statusDelivered = document.querySelector("#status-delivered");
const statusFailed = document.querySelector("#status-failed");
const statusBacklog = document.querySelector("#status-backlog");
const disasterGroupsEl = document.querySelector("#disaster-groups");
const resetAlertRules = document.querySelector("#reset-alert-rules");
const notifyLevelOrder = ["passive", "active", "critical"];
let subscriptionDraft = createEmptyDraft();
let lastSubmittedSignature = "";
let lastSubmittedIdentity = "";
let persistTimer = null;
const uiState = {
  activeTargetId: null,
  locationMode: "overview",
  editingTarget: null,
};
const targetMarkers = new Map();
const targetCoordinateRevisions = new Map();
const targetRegionRevisions = new Map();
const geocodeJobs = new Map();
const expandedDisasterCategories = new Set();
let barkUrls = [];
let optionCategories = [];
let configurationReady = false;
let subscriptionRequestInFlight = false;
let statusRefreshInFlight = false;
let lastStatusRefreshAt = 0;
let statusWasOpenOnPointerDown = false;

function setSubscriptionRequestInFlight(inFlight) {
  subscriptionRequestInFlight = inFlight;
  submit.disabled = inFlight || !configurationReady || !instanceTermsAccepted;
  submit.title = instanceTermsAccepted ? "" : "实例部署者确认责任声明后才能保存订阅";
  unsubscribe.disabled = inFlight;
  resetAlertRules.disabled = inFlight || !configurationReady;
  startAddLocation.disabled = inFlight || subscriptionDraft.targets.length >= 3 || uiState.locationMode !== "overview";
  finishLocation.disabled = inFlight || (uiState.locationMode !== "overview" && !targetCoordinates(activeTarget()));
  discardLocationEdit.disabled = inFlight;
}
let initializationGeneration = 0;

const mapElement = document.querySelector("#map");
const map = L
  ? L.map(mapElement, { zoomControl: true, attributionControl: false }).setView([35, 105], 4)
  : null;
if (map) {
  map.zoomControl.setPosition("topright");
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
  const MapTools = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const container = L.DomUtil.create("div", "leaflet-bar map-tool-group");
      locate = L.DomUtil.create("button", "map-tool-button", container);
      locate.type = "button";
      locate.innerHTML = '<span class="map-tool-icon locate" aria-hidden="true"></span>';
      locate.title = "定位当前位置";
      locate.setAttribute("aria-label", "定位当前位置");
      const fit = L.DomUtil.create("button", "map-tool-button", container);
      fit.type = "button";
      fit.innerHTML = '<span class="map-tool-icon fit" aria-hidden="true"></span>';
      fit.title = "显示全部监测地点";
      fit.setAttribute("aria-label", "显示全部监测地点");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.on(locate, "click", locateCurrentPosition);
      L.DomEvent.on(fit, "click", () => {
        if (!subscriptionDraft.targets.some(targetCoordinates)) return show("尚未添加监测地点", "info");
        fitTargetMarkers();
      });
      return container;
    },
  });
  new MapTools().addTo(map);
}
else mapElement.classList.add("map-unavailable");

function show(message, type = "info") {
  if (type !== "info") {
    const pendingToast = [...toastStack.querySelectorAll(".toast.info[data-persistent='true']")].pop();
    if (pendingToast) dismissToast(pendingToast);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.innerHTML = `
    <span class="toast-indicator" aria-hidden="true"></span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" type="button" aria-label="关闭提示">×</button>`;
  const duration = type === "info" ? 0 : type === "error" ? 6000 : type === "warning" ? 4500 : 3000;
  toast.dataset.persistent = String(!duration);
  toast.querySelector(".toast-close").addEventListener("click", () => dismissToast(toast));
  toastStack.append(toast);
  updateToastStack();
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  if (duration) toast.dismissTimer = setTimeout(() => dismissToast(toast), duration);
  while (toastStack.children.length > 5) dismissToast(toastStack.firstElementChild, true);
  return toast;
}

function updateToastStack() {
  let expandedOffset = 0;
  [...toastStack.querySelectorAll(".toast")].reverse().forEach((toast, index) => {
    toast.classList.toggle("is-current", index === 0);
    toast.style.zIndex = String(10 - index);
    toast.style.setProperty("--toast-collapsed-offset", `${-index * 7}px`);
    toast.style.setProperty("--toast-collapsed-scale", String(Math.max(.9, 1 - index * .025)));
    toast.style.setProperty("--toast-expanded-offset", `${-expandedOffset}px`);
    expandedOffset += toast.offsetHeight + 9;
  });
}

function dismissToast(toast, immediate = false) {
  if (!toast || !toast.isConnected) return;
  if (toast.dismissTimer) clearTimeout(toast.dismissTimer);
  if (immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    toast.remove();
    updateToastStack();
    return;
  }
  toast.classList.remove("is-visible");
  toast.classList.add("is-leaving");
  setTimeout(() => {
    toast.remove();
    updateToastStack();
  }, 210);
}

function dismissPersistentToasts() {
  toastStack.querySelectorAll(".toast[data-persistent='true']").forEach((toast) => dismissToast(toast));
}

function animateHeight(element, opening, done) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    done();
    return;
  }
  element.style.overflow = "hidden";
  element.style.height = opening ? "0px" : `${element.scrollHeight}px`;
  element.style.opacity = opening ? "0" : "1";
  element.offsetHeight;
  element.style.transition = "height .22s cubic-bezier(.2, .75, .2, 1), opacity .16s ease";
  element.style.height = opening ? `${element.scrollHeight}px` : "0px";
  element.style.opacity = opening ? "1" : "0";
  const finish = () => {
    element.style.removeProperty("height");
    element.style.removeProperty("opacity");
    element.style.removeProperty("overflow");
    element.style.removeProperty("transition");
    done();
  };
  const onTransitionEnd = (event) => {
    if (event.propertyName !== "height") return;
    element.removeEventListener("transitionend", onTransitionEnd);
    finish();
  };
  element.addEventListener("transitionend", onTransitionEnd);
}

document.querySelectorAll("details.config-disclosure").forEach((details) => {
  const summary = details.querySelector(":scope > summary");
  const body = details.querySelector(":scope > .config-disclosure-body");
  summary.addEventListener("click", (event) => {
    event.preventDefault();
    if (details.dataset.animating === "true") return;
    details.dataset.animating = "true";
    if (details.open) {
      animateHeight(body, false, () => {
        details.open = false;
        details.dataset.animating = "false";
      });
    } else {
      details.open = true;
      animateHeight(body, true, () => { details.dataset.animating = "false"; });
    }
  });
});

function setNotifyWarning(message = "") {
  if (!notifyWarning) return;
  notifyWarning.textContent = message;
  notifyWarning.classList.toggle("show", Boolean(message));
}

function createEmptyDraft() {
  return {
    schema_version: 3,
    bark_url: "",
    targets: [],
    alerts_by_category: {},
  };
}

function createTarget() {
  const id = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    label: "",
    point: { latitude: "", longitude: "" },
    region: { province: "", city: "", district: "" },
  };
}

function parseCoordinate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function validCoordinate(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function targetCoordinates(target) {
  const latitude = parseCoordinate(target?.point?.latitude);
  const longitude = parseCoordinate(target?.point?.longitude);
  return validCoordinate(latitude, longitude) ? { latitude, longitude } : null;
}

function targetById(id) {
  return subscriptionDraft.targets.find((target) => target.id === id) || null;
}

function activeTarget() {
  return uiState.locationMode === "overview" ? targetById(uiState.activeTargetId) : uiState.editingTarget;
}

function workingTargetById(id) {
  return uiState.editingTarget?.id === id ? uiState.editingTarget : targetById(id);
}

function cloneTarget(target) {
  return {
    id: target.id,
    label: String(target.label || ""),
    point: {
      latitude: String(target.point?.latitude ?? ""),
      longitude: String(target.point?.longitude ?? ""),
    },
    region: {
      province: String(target.region?.province || ""),
      city: String(target.region?.city || ""),
      district: String(target.region?.district || ""),
    },
  };
}

function targetLabel(target) {
  const label = String(target?.label || "").trim();
  if (label) return label;
  const coordinates = targetCoordinates(target);
  return coordinates ? `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}` : "未命名地点";
}

function formatCoordinate(value) {
  const number = parseCoordinate(value);
  return number === null ? "" : number.toFixed(4);
}

function targetRegion(target) {
  return [target?.region?.province, target?.region?.city, target?.region?.district]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" · ");
}

function nextRevision(map, id) {
  const revision = (map.get(id) || 0) + 1;
  map.set(id, revision);
  return revision;
}

function setMapView(latitude, longitude, zoom = 12) {
  if (map && validCoordinate(latitude, longitude)) map.setView([latitude, longitude], zoom);
}

function fitTargetMarkers() {
  if (!map) return;
  const points = subscriptionDraft.targets
    .map(targetCoordinates)
    .filter(Boolean)
    .map(({ latitude, longitude }) => [latitude, longitude]);
  if (points.length === 1) map.setView(points[0], 10);
  else if (points.length > 1) map.fitBounds(points, { padding: [32, 32], maxZoom: 10 });
}

function setRegionStatus(message, state = "") {
  regionStatus.textContent = message;
  regionStatus.className = `region-match-value${state ? ` is-${state}` : ""}`;
  if (regionEditor.hidden) editRegion.textContent = state === "ready" ? "修改" : "手动填写";
}

function setRegionEditorOpen(open) {
  if (regionEditor.dataset.animating === "true" || regionEditor.hidden === !open) return;
  regionEditor.dataset.animating = "true";
  editRegion.textContent = open ? "完成" : "修改";
  editRegion.setAttribute("aria-expanded", String(open));
  if (open) {
    regionEditor.hidden = false;
    animateHeight(regionEditor, true, () => {
      regionEditor.dataset.animating = "false";
      provinceInput.focus();
    });
  } else {
    animateHeight(regionEditor, false, () => {
      regionEditor.hidden = true;
      regionEditor.dataset.animating = "false";
    });
  }
}

function cancelReverseGeocode(targetId) {
  const job = geocodeJobs.get(targetId);
  if (!job) return;
  if (job.timer) clearTimeout(job.timer);
  job.controller?.abort();
  geocodeJobs.delete(targetId);
}

function scheduleReverseGeocode(targetId, delay = 350) {
  const target = workingTargetById(targetId);
  const coordinates = targetCoordinates(target);
  if (!target || !coordinates) return;
  cancelReverseGeocode(targetId);
  const coordinateRevision = targetCoordinateRevisions.get(targetId) || 0;
  const regionRevision = targetRegionRevisions.get(targetId) || 0;
  if (uiState.activeTargetId === targetId) setRegionStatus("正在解析...", "loading");
  const controller = new AbortController();
  const job = { controller, timer: null, coordinateRevision, regionRevision };
  job.timer = setTimeout(() => {
    reverseGeocode(targetId, coordinates, job).catch(() => {});
  }, delay);
  geocodeJobs.set(targetId, job);
}

async function reverseGeocode(targetId, coordinates, job) {
  try {
    const query = new URLSearchParams({ latitude: String(coordinates.latitude), longitude: String(coordinates.longitude) });
    const res = await fetch(`${api}/api/reverse-geocode?${query}`, { signal: job.controller.signal });
    const json = await parseApiResponse(res);
    const target = workingTargetById(targetId);
    if (!target || geocodeJobs.get(targetId) !== job) return;
    if ((targetCoordinateRevisions.get(targetId) || 0) !== job.coordinateRevision) return;
    if ((targetRegionRevisions.get(targetId) || 0) !== job.regionRevision) return;
    if (!res.ok || !json.success || !json.data) throw new Error(json.message || "无法解析区域信息");
    target.region.province = json.data.province || "";
    target.region.city = json.data.city || "";
    target.region.district = json.data.district || "";
    const resolved = targetRegion(target);
    if (uiState.activeTargetId === targetId) {
      provinceInput.value = target.region.province;
      cityInput.value = target.region.city;
      districtInput.value = target.region.district;
      setRegionStatus(resolved || "未识别到行政区", resolved ? "ready" : "");
    }
    renderLocations();
    persistDraft();
  } catch (error) {
    if (error.name === "AbortError" || geocodeJobs.get(targetId) !== job) return;
    if (uiState.activeTargetId === targetId) setRegionStatus("自动解析失败，可手动填写");
    show(error.message || "区域信息自动解析失败", "warning");
  } finally {
    if (geocodeJobs.get(targetId) === job) geocodeJobs.delete(targetId);
  }
}

function renderTargetMarkers() {
  if (!map) return;
  const validIds = new Set();
  const markerTargets = subscriptionDraft.targets.map((target) =>
    uiState.editingTarget?.id === target.id ? uiState.editingTarget : target
  );
  if (uiState.locationMode === "adding" && uiState.editingTarget) markerTargets.push(uiState.editingTarget);
  markerTargets.forEach((target, index) => {
    const coordinates = targetCoordinates(target);
    if (!coordinates) return;
    validIds.add(target.id);
    const active = target.id === uiState.activeTargetId;
    const icon = L.divIcon({
      className: "",
      html: `<span class="target-marker${active ? " is-active" : ""}">${index + 1}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    let marker = targetMarkers.get(target.id);
    if (!marker) {
      marker = L.marker([coordinates.latitude, coordinates.longitude], { icon, keyboard: true });
      marker.on("click", () => focusTarget(target.id));
      marker.addTo(map);
      targetMarkers.set(target.id, marker);
    } else {
      marker.setLatLng([coordinates.latitude, coordinates.longitude]);
      marker.setIcon(icon);
    }
  });
  targetMarkers.forEach((marker, targetId) => {
    if (!validIds.has(targetId)) {
      map.removeLayer(marker);
      targetMarkers.delete(targetId);
    }
  });
}

function renderLocationEditor() {
  const target = activeTarget();
  const open = Boolean(target && uiState.locationMode !== "overview");
  locationEditor.hidden = !open;
  if (!open) return;
  const adding = uiState.locationMode === "adding";
  const coordinates = targetCoordinates(target);
  locationEditorTitle.textContent = adding ? "添加监测地点" : "编辑监测地点";
  locationEditorSubtitle.textContent = adding
    ? coordinates ? "位置已选择，可补充名称后保存" : "先选择需要监测的位置"
    : targetLabel(target);
  locationPickerHeading.textContent = coordinates ? "当前位置，可在地图点击以调整" : "在地图点击位置，或输入坐标";
  locationDetails.hidden = adding && !coordinates;
  finishLocation.disabled = subscriptionRequestInFlight || !coordinates;
  finishLocation.textContent = adding ? "保存地点" : "保存修改";
  nameInput.value = target.label || "";
  latInput.value = target.point.latitude ?? "";
  lonInput.value = target.point.longitude ?? "";
  provinceInput.value = target.region.province || "";
  cityInput.value = target.region.city || "";
  districtInput.value = target.region.district || "";
  const region = targetRegion(target);
  setRegionStatus(region || "正在根据位置识别", region ? "ready" : "");
  mapMode.textContent = adding && !coordinates ? "点击地图选择监测位置" : adding ? "位置已选择，点击地图可调整" : "编辑中：点击地图可移动此地点";
  mapMode.classList.add("is-selecting");
}

function renderLocations() {
  const count = subscriptionDraft.targets.length;
  locationCount.textContent = `${count} / 3`;
  locationsSummary.textContent = count ? `共 ${count} 个，可添加 ${3 - count} 个` : "尚未添加";
  startAddLocation.disabled = count >= 3 || subscriptionRequestInFlight || uiState.locationMode !== "overview";
  if (!count) {
    locationsList.innerHTML = '<div class="locations-empty">尚未添加地点。点击地图选择位置，也可以使用当前位置或手动输入坐标。</div>';
  } else {
    locationsList.innerHTML = subscriptionDraft.targets.map((target, index) => {
      const coordinates = targetCoordinates(target);
      const region = targetRegion(target);
      const active = target.id === uiState.activeTargetId;
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
            <button class="remove-location" type="button" data-location-action="remove" aria-label="删除地点 ${index + 1}" title="删除地点">×</button>
          </span>
        </div>`;
    }).join("");
  }
  renderTargetMarkers();
  if (uiState.locationMode === "overview") {
    mapMode.textContent = count ? "点击地图继续添加，点击标记查看地点" : "点击地图添加监测地点";
    mapMode.classList.remove("is-selecting");
  }
}

function startAddingLocation(initialCoordinates = null) {
  if (subscriptionDraft.targets.length >= 3) return show("最多添加 3 个监测地点", "error");
  const target = createTarget();
  uiState.activeTargetId = target.id;
  uiState.locationMode = "adding";
  uiState.editingTarget = target;
  if (initialCoordinates) {
    target.point.latitude = initialCoordinates.latitude.toFixed(4);
    target.point.longitude = initialCoordinates.longitude.toFixed(4);
    nextRevision(targetCoordinateRevisions, target.id);
    setMapView(initialCoordinates.latitude, initialCoordinates.longitude);
    scheduleReverseGeocode(target.id, 0);
  }
  setRegionEditorOpen(false);
  renderLocations();
  renderLocationEditor();
}

function focusTarget(targetId) {
  const target = targetById(targetId);
  if (!target) return;
  if (uiState.locationMode !== "overview" && targetId !== uiState.activeTargetId) {
    return show("请先完成或取消当前编辑", "warning");
  }
  uiState.activeTargetId = targetId;
  const coordinates = targetCoordinates(target);
  if (coordinates) setMapView(coordinates.latitude, coordinates.longitude);
  renderLocations();
}

function editTarget(targetId) {
  const target = targetById(targetId);
  if (!target) return;
  if (uiState.locationMode !== "overview" && targetId !== uiState.activeTargetId) {
    return show("请先完成或取消当前编辑", "warning");
  }
  uiState.activeTargetId = targetId;
  uiState.locationMode = "editing";
  uiState.editingTarget = cloneTarget(target);
  const coordinates = targetCoordinates(target);
  if (coordinates) setMapView(coordinates.latitude, coordinates.longitude);
  setRegionEditorOpen(false);
  renderLocations();
  renderLocationEditor();
}

function finishLocationEdit() {
  const target = activeTarget();
  if (!target) return;
  const adding = uiState.locationMode === "adding";
  const index = adding ? subscriptionDraft.targets.length : subscriptionDraft.targets.findIndex((item) => item.id === target.id);
  const error = validateLocations([target]);
  if (error) return show(error.replace("监测地点 1", `监测地点 ${index + 1}`), "error");
  const duplicate = subscriptionDraft.targets.some((item) => item.id !== target.id
    && targetCoordinates(item)?.latitude.toFixed(4) === targetCoordinates(target)?.latitude.toFixed(4)
    && targetCoordinates(item)?.longitude.toFixed(4) === targetCoordinates(target)?.longitude.toFixed(4));
  if (duplicate) return show(`监测地点 ${index + 1} 与其他地点坐标重复`, "error");
  if (adding) subscriptionDraft.targets.push(target);
  else subscriptionDraft.targets[index] = target;
  uiState.locationMode = "overview";
  uiState.editingTarget = null;
  setRegionEditorOpen(false);
  renderLocations();
  renderLocationEditor();
  persistDraft();
}

function discardLocationChanges() {
  const targetId = uiState.activeTargetId;
  cancelReverseGeocode(targetId);
  targetCoordinateRevisions.delete(targetId);
  targetRegionRevisions.delete(targetId);
  if (uiState.locationMode === "adding") uiState.activeTargetId = null;
  uiState.locationMode = "overview";
  uiState.editingTarget = null;
  setRegionEditorOpen(false);
  renderLocations();
  renderLocationEditor();
}

function removeTarget(targetId) {
  const target = targetById(targetId);
  if (!target) return;
  if (uiState.locationMode !== "overview" && targetId !== uiState.activeTargetId) {
    return show("请先完成或取消当前编辑", "warning");
  }
  cancelReverseGeocode(targetId);
  subscriptionDraft.targets = subscriptionDraft.targets.filter((item) => item.id !== targetId);
  targetCoordinateRevisions.delete(targetId);
  targetRegionRevisions.delete(targetId);
  if (uiState.activeTargetId === targetId) {
    uiState.activeTargetId = null;
    uiState.locationMode = "overview";
    uiState.editingTarget = null;
    setRegionEditorOpen(false);
  }
  renderLocations();
  renderLocationEditor();
  persistDraft();
  show("已从订阅草稿移除地点", "success");
}

function updateActiveTargetCoordinates(latitude, longitude, zoom = 12) {
  const target = activeTarget();
  if (!target || !validCoordinate(latitude, longitude)) return;
  target.point.latitude = latitude.toFixed(4);
  target.point.longitude = longitude.toFixed(4);
  nextRevision(targetCoordinateRevisions, target.id);
  setMapView(latitude, longitude, zoom);
  renderLocations();
  renderLocationEditor();
  if (uiState.locationMode === "adding") nameInput.focus({ preventScroll: true });
  scheduleReverseGeocode(target.id);
  persistDraft();
}

function defaultNotifyBands() {
  return [
    { min: 1, max: 1, level: "passive", label: "低烈度" },
    { min: 2, max: 2, level: "active", label: "中等烈度" },
    { min: 3, max: 7, level: "critical", label: "高烈度" },
  ];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sourceIds(category) {
  const option = optionCategories.find((item) => item.id === category);
  return (option?.source_groups || []).flatMap((group) => group.sources.map((source) => source.id));
}

function alertEntry(category) {
  return subscriptionDraft.alerts_by_category[category] || null;
}

function alertRule(category) {
  return alertEntry(category)?.rule || null;
}

function enabledAlertRules() {
  return Object.values(subscriptionDraft.alerts_by_category)
    .filter((entry) => entry.enabled)
    .map((entry) => entry.rule);
}

function alertRuleForPayload(rule) {
  const result = cloneJson(rule);
  if (result.category === "earthquake_report") result.min_magnitude = Number(result.min_magnitude);
  if (result.category === "weather_warning") {
    result.min_severity = Number(result.min_severity);
    result.fallback_radius_km = Number(result.fallback_radius_km);
  }
  if (result.category === "tsunami") result.min_severity = Number(result.min_severity);
  if (result.category === "typhoon") result.max_center_distance_km = Number(result.max_center_distance_km);
  return result;
}

function intensityBands() {
  return alertRule("earthquake_warning")?.estimated_intensity_bands || [];
}

function sourceEnabled(category, source) {
  const selection = alertRule(category)?.sources;
  return selection?.mode === "all"
    || selection?.mode === "include" && Array.isArray(selection.ids) && selection.ids.includes(source);
}

function setSelectedSources(category, ids) {
  const allIds = sourceIds(category);
  const selected = allIds.filter((id) => Array.isArray(ids) && ids.includes(id));
  alertRule(category).sources = selected.length === allIds.length
    ? { mode: "all" }
    : { mode: "include", ids: selected };
}

function sanitizeAlertRule(category, candidate) {
  const fallback = cloneJson(category.default_alert);
  if (!candidate || typeof candidate !== "object" || candidate.category !== category.id) return fallback;
  const knownSources = new Set(sourceIds(category.id));
  const selection = candidate.sources;
  if (selection?.mode === "all") {
    fallback.sources = { mode: "all" };
  } else if (selection?.mode === "include" && Array.isArray(selection.ids)) {
    fallback.sources = {
      mode: "include",
      ids: [...new Set(selection.ids.filter((id) => typeof id === "string" && knownSources.has(id)))],
    };
  }
  const numberInRange = (value, defaultValue, min, max, integer = false) => {
    if ((typeof value !== "number" && typeof value !== "string")
      || (typeof value === "string" && !value.trim())) return defaultValue;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number))
      ? number
      : defaultValue;
  };
  if (category.id === "earthquake_warning") {
    fallback.estimated_intensity_bands = normalizeBands(candidate.estimated_intensity_bands)
      .map((band) => ({ min: band.min, max: band.max, interruption_level: band.level }));
  } else if (category.id === "earthquake_report") {
    fallback.min_magnitude = numberInRange(candidate.min_magnitude, fallback.min_magnitude, 0, 10);
  } else if (category.id === "weather_warning") {
    fallback.min_severity = numberInRange(candidate.min_severity, fallback.min_severity, 1, 4, true);
    fallback.fallback_radius_km = numberInRange(candidate.fallback_radius_km, fallback.fallback_radius_km, 1, 2000);
  } else if (category.id === "tsunami") {
    fallback.min_severity = numberInRange(candidate.min_severity, fallback.min_severity, 1, 4, true);
  } else if (category.id === "typhoon") {
    fallback.max_center_distance_km = numberInRange(candidate.max_center_distance_km, fallback.max_center_distance_km, 1, 3000);
  }
  return fallback;
}

function thresholdFields(category, disabled) {
  const state = disabled ? "disabled" : "";
  const alert = alertRule(category) || optionCategories.find((item) => item.id === category)?.default_alert || {};
  if (category === "earthquake_report") return `
    <label class="rule-field">
      <span class="rule-field-title">最低震级</span>
      <input data-rule="min_magnitude" type="number" min="0" max="10" step="0.1" value="${escapeHtml(alert.min_magnitude)}" ${state}>
      <small>仅筛选地震信息，不影响地震预警。</small>
    </label>`;
  if (category === "weather_warning") return `
    <label class="rule-field">
      <span class="rule-field-title">最低严重度</span>
      <select data-rule="min_severity" ${state}>${levelOptions(alert.min_severity)}</select>
      <small>低于此级别的气象预警不推送。</small>
    </label>
    <label class="rule-field">
      <span class="rule-field-title">坐标回退半径</span>
      <input data-rule="fallback_radius_km" type="number" min="1" max="2000" step="1" value="${escapeHtml(alert.fallback_radius_km)}" ${state}>
      <small>行政区未命中时，按地点周边公里数匹配。</small>
    </label>`;
  if (category === "tsunami") return `
    <label class="rule-field">
      <span class="rule-field-title">最低严重度</span>
      <select data-rule="min_severity" ${state}>${levelOptions(alert.min_severity)}</select>
      <small>结合监测地点的行政区进行匹配。</small>
    </label>`;
  if (category === "typhoon") return `
    <label class="rule-field">
      <span class="rule-field-title">中心最大距离</span>
      <input data-rule="max_center_distance_km" type="number" min="1" max="3000" step="1" value="${escapeHtml(alert.max_center_distance_km)}" ${state}>
      <small>台风中心距离任一监测地点不超过此公里数。</small>
    </label>`;
  return "";
}

function levelOptions(selected) {
  return [[1,"蓝色/信息"],[2,"黄色"],[3,"橙色"],[4,"红色"]].map(([value,label]) => `<option value="${value}" ${Number(selected) === value ? "selected" : ""}>${label}</option>`).join("");
}

function categoryRuleSummary(category) {
  const alert = alertRule(category);
  if (!alert || !alertEntry(category)?.enabled) return "";
  if (category === "earthquake_warning") return `${intensityBands().length} 段烈度规则`;
  if (category === "earthquake_report") return `M ≥ ${Number(alert.min_magnitude).toFixed(1)}`;
  if (category === "weather_warning") return `≥ ${severityLabel(alert.min_severity)} · 回退 ${Number(alert.fallback_radius_km)} km`;
  if (category === "tsunami") return `≥ ${severityLabel(alert.min_severity)}`;
  if (category === "typhoon") return `中心 ${Number(alert.max_center_distance_km)} km 内`;
  return "";
}

function severityLabel(value) {
  return ({ 1: "蓝色/信息", 2: "黄色", 3: "橙色", 4: "红色" })[Number(value)] || `级别 ${value}`;
}

function intensityRuleEditor(disabled) {
  const state = disabled ? "disabled" : "";
  return `
    <div class="rule-section">
      <div class="rule-section-header">
        <span class="rule-section-title">通知规则</span>
        <span class="intensity-actions">
          <button type="button" data-intensity-action="add" ${state}>添加规则</button>
          <button type="button" data-intensity-action="reset" ${state}>恢复默认</button>
        </span>
      </div>
      <small>按预估烈度决定通知级别，未包含在规则中的烈度不会推送。</small>
      <div id="notify-bands" class="intensity-rules"></div>
      <div id="notify-warning" class="notify-warning"></div>
    </div>`;
}

function renderDisasterGroups() {
  disasterGroupsEl.innerHTML = optionCategories.map((category) => {
    const disabled = !alertEntry(category.id)?.enabled;
    const sourceCount = category.source_groups.reduce((total, group) => total + group.sources.length, 0);
    const enabledCount = category.source_groups.reduce((total, group) => total + group.sources.filter((source) => sourceEnabled(category.id, source.id)).length, 0);
    const expanded = expandedDisasterCategories.has(category.id);
    const filters = thresholdFields(category.id, disabled);
    const sourceMode = alertRule(category.id)?.sources?.mode;
    const sourceSummary = sourceMode === "all" ? `全部 ${sourceCount} 个来源` : `已选 ${enabledCount}/${sourceCount} 个来源`;
    const ruleSummary = categoryRuleSummary(category.id);
    return `
    <section class="disaster-category ${disabled ? "is-disabled" : ""}" data-category-card="${escapeHtml(category.id)}">
      <div class="disaster-category-header">
        <button class="category-expand" type="button" data-expand-category="${escapeHtml(category.id)}" aria-expanded="${expanded}">
          <span class="category-chevron">›</span>
          <span class="category-copy">
            <span class="category-title">${escapeHtml(category.label)}</span>
            <span class="category-meta">${disabled ? "已关闭" : `${escapeHtml(sourceSummary)}${ruleSummary ? ` · ${escapeHtml(ruleSummary)}` : ""}`}</span>
          </span>
        </button>
        <label class="switch" aria-label="${escapeHtml(disabled ? `启用${category.label}` : `停用${category.label}`)}">
          <input class="category-toggle" data-category="${escapeHtml(category.id)}" type="checkbox" ${disabled ? "" : "checked"}>
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="disaster-detail" ${expanded ? "" : "hidden"}>
        <div class="source-overview">
          ${category.source_groups.map((group) => `
            <div class="source-section" data-source-group="${escapeHtml(group.id)}">
              <div class="source-section-header">
                <span class="source-section-title">${escapeHtml(category.source_groups.length === 1 ? "数据来源" : group.label)}</span>
                ${group.sources.length > 1 ? `<span class="source-bulk-actions">
                  <button type="button" data-source-action="enable" ${disabled ? "disabled" : ""}>全选</button>
                  <button type="button" data-source-action="disable" ${disabled ? "disabled" : ""}>清空</button>
                </span>` : ""}
              </div>
              <div class="source-list">${group.sources.map((source) => `<label class="source-row"><input class="source-toggle" data-source="${escapeHtml(source.id)}" type="checkbox" ${sourceEnabled(category.id, source.id) ? "checked" : ""} ${disabled ? "disabled" : ""}><span>${escapeHtml(source.label)}</span></label>`).join("")}</div>
            </div>`).join("")}
        </div>
        ${category.id === "earthquake_warning" ? intensityRuleEditor(disabled) : filters ? `<div class="rule-section"><div class="rule-section-header"><span class="rule-section-title">匹配规则</span></div><div class="rule-grid">${filters}</div></div>` : ""}
      </div>
    </section>`;
  }).join("");
  notifyBandsEl = document.querySelector("#notify-bands");
  notifyWarning = document.querySelector("#notify-warning");
  if (notifyBandsEl) renderNotifyBands();
}

async function loadSubscriptionOptions(draft, generation) {
  const res = await fetch(api + "/api/subscription-options");
  const json = await parseApiResponse(res);
  if (generation !== initializationGeneration) return;
  if (!res.ok || !json.success || !Array.isArray(json.data?.categories)) throw new Error(json.message || "无法获取灾害来源");
  optionCategories = json.data.categories;
  const legacyConfigured = Array.isArray(draft.legacy_alerts) ? draft.legacy_alerts : Array.isArray(draft.alerts) ? draft.alerts : [];
  const configuredByCategory = new Map(legacyConfigured
    .filter((alert) => alert && typeof alert === "object" && typeof alert.category === "string")
    .map((alert) => [alert.category, alert]));
  const legacyDisabled = Array.isArray(draft.legacy_disabled_alerts) ? draft.legacy_disabled_alerts : Array.isArray(draft.disabled_alerts) ? draft.disabled_alerts : [];
  const disabledByCategory = new Map(legacyDisabled
    .filter((alert) => alert && typeof alert === "object" && typeof alert.category === "string")
    .map((alert) => [alert.category, alert]));
  const savedEntries = draft.alerts_by_category && typeof draft.alerts_by_category === "object"
    ? draft.alerts_by_category
    : {};
  subscriptionDraft.alerts_by_category = Object.fromEntries(optionCategories.map((category) => {
    const savedEntry = savedEntries[category.id];
    const legacyRule = configuredByCategory.get(category.id) || disabledByCategory.get(category.id);
    const candidate = savedEntry?.rule || legacyRule || category.default_alert;
    const enabled = savedEntry && typeof savedEntry.enabled === "boolean"
      ? savedEntry.enabled
      : legacyConfigured.length || legacyDisabled.length
        ? configuredByCategory.has(category.id)
        : true;
    return [category.id, { enabled, rule: sanitizeAlertRule(category, candidate) }];
  }));
  delete subscriptionDraft.legacy_alerts;
  delete subscriptionDraft.legacy_disabled_alerts;
  renderDisasterGroups();
}

function validateAlertRules() {
  const alerts = enabledAlertRules();
  if (!alerts.length) return "请至少启用一种灾害类别";
  const numeric = (value) => String(value ?? "").trim() ? Number(value) : NaN;
  const magnitude = numeric(alertRule("earthquake_report")?.min_magnitude);
  const weatherRadius = numeric(alertRule("weather_warning")?.fallback_radius_km);
  const typhoonRadius = numeric(alertRule("typhoon")?.max_center_distance_km);
  const weatherLevel = numeric(alertRule("weather_warning")?.min_severity);
  const tsunamiLevel = numeric(alertRule("tsunami")?.min_severity);
  if (alertEntry("earthquake_report")?.enabled && (!Number.isFinite(magnitude) || magnitude < 0 || magnitude > 10)) return "最低震级必须在 0 到 10 之间";
  if (alertEntry("weather_warning")?.enabled && (!Number.isFinite(weatherRadius) || weatherRadius < 1 || weatherRadius > 2000)) return "气象预警回退半径必须在 1 到 2000 公里之间";
  if (alertEntry("typhoon")?.enabled && (!Number.isFinite(typhoonRadius) || typhoonRadius < 1 || typhoonRadius > 3000)) return "台风中心最大距离必须在 1 到 3000 公里之间";
  if (alertEntry("weather_warning")?.enabled && ![1, 2, 3, 4].includes(weatherLevel)) return "气象预警最低级别必须在 1 到 4 之间";
  if (alertEntry("tsunami")?.enabled && ![1, 2, 3, 4].includes(tsunamiLevel)) return "海啸预警最低级别必须在 1 到 4 之间";
  for (const category of optionCategories) {
    const entry = alertEntry(category.id);
    if (entry?.enabled && entry.rule.sources?.mode === "include" && !entry.rule.sources.ids.length) return `${category.label}请至少启用一个来源`;
  }
  return "";
}

function levelLabel(level) {
  return level === "critical" ? "Critical" : level === "active" ? "Active" : "Passive";
}

function normalizeBands(bands) {
  const result = [];
  const usedLevels = new Set();
  for (const band of bands || []) {
    const levelValue = band.interruption_level ?? band.level;
    const level = notifyLevelOrder.includes(String(levelValue || "").toLowerCase()) ? String(levelValue).toLowerCase() : "passive";
    if (usedLevels.has(level)) continue;
    usedLevels.add(level);
    let min = clampInt(band.min, 0, 7, 0);
    let max = clampInt(band.max, 0, 7, level === "critical" ? 7 : min);
    result.push({ min, max, level, label: String(band.label || levelLabel(level)).trim() });
    if (result.length >= 3) break;
  }
  return result.length ? result.sort((a, b) => a.min - b.min) : defaultNotifyBands();
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function validateLocations(locations) {
  const used = new Set();
  for (const [index, location] of locations.entries()) {
    const coordinates = targetCoordinates(location);
    if (!coordinates) return `监测地点 ${index + 1} 尚未选择有效位置`;
    const coordinateKey = `${coordinates.latitude.toFixed(4)},${coordinates.longitude.toFixed(4)}`;
    if (used.has(coordinateKey)) return `监测地点 ${index + 1} 与其他地点坐标重复`;
    used.add(coordinateKey);
    for (const [label, value] of [
      ["名称", location.label], ["省/州", location.region?.province],
      ["城市", location.region?.city], ["区/县", location.region?.district],
    ]) {
      if ([...String(value || "").trim()].length > 80) return `监测地点 ${index + 1} 的${label}最多 80 个字符`;
    }
  }
  return "";
}

function validateBands(bands) {
  if (!bands.length) return "请至少保留一条通知级别规则";
  const levels = new Set();
  const used = new Set();
  for (const band of bands) {
    if (!notifyLevelOrder.includes(band.level)) return "通知级别无效";
    if (levels.has(band.level)) return "每个通知级别只能添加一条规则";
    levels.add(band.level);
    if (!Number.isInteger(band.min) || !Number.isInteger(band.max) || band.min > band.max || band.min < 0 || band.max > 7) return "烈度范围无效";
    if (band.level === "critical" && band.max !== 7) return "Critical 规则上限必须覆盖烈度 7";
    if (String(band.label || "").trim().length > 32) return "通知级别标签最多 32 个字符";
    for (let value = band.min; value <= band.max; value++) {
      if (used.has(value)) return "烈度范围不能重叠";
      used.add(value);
    }
  }
  return "";
}

function renderNotifyBands() {
  if (!notifyBandsEl) return;
  const bands = intensityBands().map((band) => ({
    min: band.min ?? "",
    max: band.max ?? "",
    level: String(band.interruption_level ?? band.level ?? "passive").toLowerCase(),
  }));
  const state = alertEntry("earthquake_warning")?.enabled ? "" : "disabled";
  notifyBandsEl.innerHTML = bands.map((band, index) => `
    <div class="intensity-rule" data-index="${escapeHtml(index)}">
      <div class="intensity-rule-header">
        <span class="intensity-rule-name">规则 ${escapeHtml(index + 1)}</span>
      </div>
      <div class="intensity-rule-fields">
        <label class="rule-field">
          <span class="rule-field-title">预估烈度范围</span>
          <span class="intensity-range">
            <input class="band-min" type="number" min="0" max="7" step="1" value="${escapeHtml(band.min)}" aria-label="起始烈度" ${state}>
            <span>至</span>
            <input class="band-max" type="number" min="0" max="7" step="1" value="${escapeHtml(band.max)}" aria-label="最高烈度" ${state}>
          </span>
        </label>
        <label class="rule-field">
          <span class="rule-field-title">通知级别</span>
          <select class="band-select level-${escapeHtml(band.level)}" ${state}>
            ${notifyLevelOrder.map((level) => `<option value="${escapeHtml(level)}" ${level === band.level ? "selected" : ""}>${escapeHtml(levelLabel(level))}</option>`).join("")}
          </select>
        </label>
      </div>
      <button class="remove-intensity-rule" type="button" data-action="remove-rule" aria-label="删除规则 ${escapeHtml(index + 1)}" title="删除规则" ${state}>×</button>
    </div>
  `).join("");
}

function collectBands() {
  return intensityBands().map((band) => {
    const level = String(band.interruption_level ?? band.level ?? "").toLowerCase();
    const minRaw = String(band.min ?? "").trim();
    const maxRaw = String(band.max ?? "").trim();
    const min = minRaw ? Number(minRaw) : NaN;
    const max = maxRaw ? Number(maxRaw) : NaN;
    return { min, max, level, label: levelLabel(level) };
  });
}

function updateBandDraft(control) {
  const row = control.closest(".intensity-rule");
  const band = intensityBands()[Number(row?.dataset.index)];
  if (!band) return;
  if (control.classList.contains("band-min")) band.min = control.value;
  if (control.classList.contains("band-max")) band.max = control.value;
  if (control.classList.contains("band-select")) band.interruption_level = control.value;
  setNotifyWarning(validateBands(collectBands()));
  persistDraft();
}

function commitBands(showWarning = false) {
  const bands = collectBands();
  const error = validateBands(bands);
  setNotifyWarning(error || "");
  if (error) return false;
  const rule = alertRule("earthquake_warning");
  if (rule) {
    rule.estimated_intensity_bands = bands.sort((left, right) => left.min - right.min).map((band) => ({
      min: band.min, max: band.max, interruption_level: band.level,
    }));
  }
  renderNotifyBands();
  if (showWarning && !error) persistDraft();
  return true;
}

function draftForStorage() {
  return {
    schema_version: 3,
    bark_url: subscriptionDraft.bark_url,
    targets: subscriptionDraft.targets.map((target) => ({
      id: target.id,
      label: String(target.label || ""),
      point: {
        latitude: String(target.point?.latitude ?? ""),
        longitude: String(target.point?.longitude ?? ""),
      },
      region: {
        province: String(target.region?.province || ""),
        city: String(target.region?.city || ""),
        district: String(target.region?.district || ""),
      },
    })),
    alerts_by_category: cloneJson(subscriptionDraft.alerts_by_category),
  };
}

function draftSignature() {
  return JSON.stringify(draftForStorage());
}

function updateDraftStatus() {
  if (!instanceTermsAccepted) {
    draftStatus.textContent = "当前实例未确认部署责任，不能新增或覆盖订阅；仍可取消已有订阅。";
  } else if (!lastSubmittedSignature) {
    draftStatus.textContent = "配置草稿保存在当前浏览器；Bark Key 不会保存。";
  } else if (draftSignature() === lastSubmittedSignature && currentDestinationIdentity() === lastSubmittedIdentity) {
    draftStatus.textContent = "本浏览器中的配置已提交。";
  } else {
    draftStatus.textContent = "有尚未提交的配置更改。";
  }
}

function persistDraft() {
  updateDraftStatus();
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try { localStorage.setItem(storageKey, draftSignature()); } catch {}
    persistTimer = null;
  }, 150);
}

function flushDraft() {
  if (persistTimer) clearTimeout(persistTimer);
  try { localStorage.setItem(storageKey, draftSignature()); } catch {}
  persistTimer = null;
}

function currentDestinationIdentity() {
  return `${barkUrlInput.value}\n${barkInput.value.trim()}`;
}

function restoreDraft() {
  const current = safeJson(localStorage.getItem(storageKey));
  const legacy = safeJson(localStorage.getItem(legacyStorageKey));
  const source = current?.schema_version === 3 ? current : legacy || {};
  const draft = createEmptyDraft();
  draft.bark_url = typeof source.bark_url === "string" ? source.bark_url : "";
  const legacyCurrent = source.current && typeof source.current === "object" ? source.current : null;
  const sourceTargets = Array.isArray(source.targets) && source.targets.length
    ? source.targets
    : legacyCurrent && validCoordinate(Number(legacyCurrent.latitude), Number(legacyCurrent.longitude))
      ? [{
          label: legacyCurrent.name,
          point: { latitude: legacyCurrent.latitude, longitude: legacyCurrent.longitude },
          region: { province: legacyCurrent.province, city: legacyCurrent.city, district: legacyCurrent.district },
        }]
      : [];
  draft.targets = sourceTargets.slice(0, 3)
    .filter((target) => target && typeof target === "object")
    .map((target) => ({
      id: typeof target.id === "string" && target.id ? target.id : createTarget().id,
      label: String(target.label || ""),
      point: {
        latitude: String(target.point?.latitude ?? ""),
        longitude: String(target.point?.longitude ?? ""),
      },
      region: {
        province: String(target.region?.province || ""),
        city: String(target.region?.city || ""),
        district: String(target.region?.district || ""),
      },
    }));
  draft.alerts_by_category = source.alerts_by_category && typeof source.alerts_by_category === "object"
    ? cloneJson(source.alerts_by_category)
    : {};
  draft.legacy_alerts = Array.isArray(source.alerts) ? cloneJson(source.alerts) : [];
  draft.legacy_disabled_alerts = Array.isArray(source.disabled_alerts) ? cloneJson(source.disabled_alerts) : [];
  subscriptionDraft = draft;
  const incompleteTarget = draft.targets.find((target) => !targetCoordinates(target));
  if (incompleteTarget) {
    uiState.activeTargetId = incompleteTarget.id;
    uiState.locationMode = "editing";
    uiState.editingTarget = cloneTarget(incompleteTarget);
  }
  renderLocations();
  renderLocationEditor();
  return { ...source, ...draft };
}

async function loadBarkUrls(draft, generation) {
  const res = await fetch(api + "/api/bark-urls");
  const json = await parseApiResponse(res);
  if (generation !== initializationGeneration) return;
  if (!res.ok || !json.success || !Array.isArray(json.data?.bark_urls) || !json.data.bark_urls.length) {
    throw new Error(json.message || "没有可用的 Bark URL");
  }
  barkUrls = json.data.bark_urls.filter((value) => typeof value === "string" && value);
  if (!barkUrls.length) throw new Error("没有可用的 Bark URL");
  const savedUrl = typeof draft.bark_url === "string" ? draft.bark_url : "";
  const removedSavedUrl = savedUrl && !barkUrls.includes(savedUrl);
  barkUrlInput.innerHTML = `${removedSavedUrl ? '<option value="">请选择 Bark URL</option>' : ""}${barkUrls.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  barkUrlInput.value = removedSavedUrl ? "" : savedUrl && barkUrls.includes(savedUrl) ? savedUrl : barkUrls[0];
  subscriptionDraft.bark_url = barkUrlInput.value;
  barkUrlInput.disabled = false;
  barkUrlField.style.display = "";
}

function initializeConfiguration(draft) {
  const generation = ++initializationGeneration;
  configurationReady = false;
  retryConfig.classList.remove("visible");
  barkUrlInput.disabled = true;
  setSubscriptionRequestInFlight(false);
  return Promise.all([loadBarkUrls(draft, generation), loadSubscriptionOptions(draft, generation)])
    .then(() => {
      if (generation !== initializationGeneration) return;
      configurationReady = true;
      setSubscriptionRequestInFlight(false);
      fitTargetMarkers();
      updateDraftStatus();
      persistDraft();
      dismissPersistentToasts();
    })
    .catch((error) => {
      if (generation !== initializationGeneration) return;
      configurationReady = false;
      barkUrlInput.disabled = true;
      retryConfig.classList.add("visible");
      setSubscriptionRequestInFlight(false);
      show(error.message || "无法加载订阅配置", "error");
    });
}

function safeJson(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

function cleanApiMessage(value) {
  if (typeof value !== "string") return "";
  const message = value.replace(/\s+/g, " ").trim();
  if (!message || /<\s*(?:!doctype|html|head|body)\b/i.test(message)) return "";
  return message.length > 240 ? `${message.slice(0, 239)}…` : message;
}

function httpFailureMessage(res) {
  if (res.ok) return "服务返回了无法识别的响应";
  if ([502, 503, 504].includes(res.status)) return "服务暂时不可用，请稍后重试";
  if (res.status >= 500) return "服务器处理请求时发生错误，请稍后重试";
  if (res.status === 429) return "请求过于频繁，请稍后重试";
  if (res.status === 404) return "请求的服务不存在";
  if (res.status === 413) return "提交的内容过大";
  if (res.status === 400) return "提交内容无效，请检查后重试";
  return `请求失败（HTTP ${res.status || "未知"}）`;
}

async function parseApiResponse(res, fallbackMessage = "") {
  const text = await res.text();
  const json = safeJson(text);
  if (json && typeof json === "object" && !Array.isArray(json)) {
    return {
      ...json,
      success: json.success === true,
      message: cleanApiMessage(json.message) || cleanApiMessage(fallbackMessage) || httpFailureMessage(res),
    };
  }
  return {
    success: false,
    message: cleanApiMessage(fallbackMessage) || httpFailureMessage(res),
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

if (map) map.on("click", (event) => {
  if (uiState.locationMode === "overview") {
    return startAddingLocation({ latitude: event.latlng.lat, longitude: event.latlng.lng });
  }
  updateActiveTargetCoordinates(event.latlng.lat, event.latlng.lng);
});

startAddLocation.addEventListener("click", () => startAddingLocation());
finishLocation.addEventListener("click", finishLocationEdit);
discardLocationEdit.addEventListener("click", discardLocationChanges);

function locateCurrentPosition() {
  if (!navigator.geolocation) return show("当前浏览器不支持定位", "error");
  if (uiState.locationMode === "overview") startAddingLocation();
  if (locate) locate.disabled = true;
  show("正在获取定位...", "info");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      updateActiveTargetCoordinates(position.coords.latitude, position.coords.longitude);
      const target = activeTarget();
      if (target && !target.label.trim()) {
        target.label = "当前位置";
        renderLocations();
        renderLocationEditor();
        persistDraft();
      }
      show("定位成功", "success");
      if (locate) locate.disabled = false;
    },
    () => {
      show("定位失败，请点击地图或输入经纬度", "error");
      if (locate) locate.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 9000 }
  );
}

editRegion.setAttribute("aria-controls", "region-editor");
editRegion.setAttribute("aria-expanded", "false");
editRegion.addEventListener("click", () => setRegionEditorOpen(regionEditor.hidden));

locationsList.addEventListener("click", (event) => {
  const row = event.target.closest(".location-item");
  if (!row) return;
  const targetId = row.dataset.targetId;
  const action = event.target.closest("[data-location-action]")?.dataset.locationAction;
  if (action === "remove") return removeTarget(targetId);
  if (action === "edit") return editTarget(targetId);
  if (action === "focus") return focusTarget(targetId);
});

nameInput.addEventListener("input", () => {
  const target = activeTarget();
  if (!target) return;
  target.label = nameInput.value;
  renderLocations();
  persistDraft();
});
[provinceInput, cityInput, districtInput].forEach((input) => input.addEventListener("input", () => {
  const target = activeTarget();
  if (!target) return;
  target.region.province = provinceInput.value;
  target.region.city = cityInput.value;
  target.region.district = districtInput.value;
  nextRevision(targetRegionRevisions, target.id);
  cancelReverseGeocode(target.id);
  const region = targetRegion(target);
  setRegionStatus(region ? "已手动修改" : "可手动填写行政区", region ? "ready" : "");
  renderLocations();
  persistDraft();
}));
[latInput, lonInput].forEach((input) => input.addEventListener("input", () => {
  const target = activeTarget();
  if (!target) return;
  target.point.latitude = latInput.value;
  target.point.longitude = lonInput.value;
  nextRevision(targetCoordinateRevisions, target.id);
  cancelReverseGeocode(target.id);
  renderLocations();
  renderLocationEditor();
  persistDraft();
}));
[latInput, lonInput].forEach((input) => input.addEventListener("change", () => {
  const target = activeTarget();
  if (!target) return;
  const coordinates = targetCoordinates(target);
  if (coordinates) {
    setMapView(coordinates.latitude, coordinates.longitude);
    scheduleReverseGeocode(target.id);
  }
}));
barkUrlInput.addEventListener("change", () => {
  subscriptionDraft.bark_url = barkUrlInput.value;
  persistDraft();
});
barkInput.addEventListener("input", updateDraftStatus);
retryConfig.addEventListener("click", () => {
  show("正在重新加载订阅配置...", "info");
  initializeConfiguration(subscriptionDraft);
});

resetAlertRules.addEventListener("click", () => {
  if (!configurationReady) return show("订阅配置尚未加载完成", "error");
  if (!confirm("恢复所有预警类型和规则为默认设置？监测地点和接收设备不会改变。")) return;
  subscriptionDraft.alerts_by_category = Object.fromEntries(optionCategories.map((category) => [
    category.id, { enabled: true, rule: cloneJson(category.default_alert) },
  ]));
  setNotifyWarning("");
  renderDisasterGroups();
  persistDraft();
  show("预警规则已恢复默认设置", "success");
});

disasterGroupsEl.addEventListener("click", (event) => {
  const expand = event.target.closest("[data-expand-category]");
  if (expand) {
    const card = expand.closest("[data-category-card]");
    const detail = card?.querySelector(".disaster-detail");
    const expanded = expand.getAttribute("aria-expanded") === "true";
    if (!detail || detail.dataset.animating === "true") return;
    detail.dataset.animating = "true";
    expand.setAttribute("aria-expanded", String(!expanded));
    if (expanded) expandedDisasterCategories.delete(expand.dataset.expandCategory);
    else expandedDisasterCategories.add(expand.dataset.expandCategory);
    if (expanded) {
      animateHeight(detail, false, () => {
        detail.hidden = true;
        detail.dataset.animating = "false";
      });
    } else {
      detail.hidden = false;
      animateHeight(detail, true, () => { detail.dataset.animating = "false"; });
    }
    return;
  }

  const intensityAction = event.target.closest("[data-intensity-action]");
  if (intensityAction) {
    if (!commitBands()) return;
    const rule = alertRule("earthquake_warning");
    if (!rule) return;
    if (intensityAction.dataset.intensityAction === "reset") {
      rule.estimated_intensity_bands = defaultNotifyBands().map((band) => ({
        min: band.min, max: band.max, interruption_level: band.level,
      }));
      setNotifyWarning("");
      renderDisasterGroups();
      persistDraft();
      return;
    }
    const bands = normalizeBands(rule.estimated_intensity_bands);
    const used = new Set(bands.map((band) => band.level));
    const level = notifyLevelOrder.find((item) => !used.has(item));
    if (!level) return setNotifyWarning("通知级别规则最多 3 条");
    bands.push({ min: level === "passive" ? 0 : level === "active" ? 2 : 3, max: level === "critical" ? 7 : level === "active" ? 2 : 1, level, label: levelLabel(level) });
    rule.estimated_intensity_bands = bands.map((band) => ({ min: band.min, max: band.max, interruption_level: band.level }));
    renderDisasterGroups();
    persistDraft();
    return;
  }

  const removeRule = event.target.closest("[data-action='remove-rule']");
  if (removeRule) {
    const bands = collectBands().filter((band) => Number.isInteger(band.min) && Number.isInteger(band.max));
    bands.splice(Number(removeRule.closest(".intensity-rule").dataset.index), 1);
    const nextBands = bands.length ? bands : defaultNotifyBands();
    alertRule("earthquake_warning").estimated_intensity_bands = nextBands.map((band) => ({ min: band.min, max: band.max, interruption_level: band.level }));
    renderDisasterGroups();
    persistDraft();
    return;
  }

  const bulkAction = event.target.closest("[data-source-action]");
  if (!bulkAction) return;
  const sourceSection = bulkAction.closest("[data-source-group]");
  const enabled = bulkAction.dataset.sourceAction === "enable";
  const category = sourceSection?.closest("[data-category-card]")?.dataset.categoryCard;
  if (!category || !alertEntry(category)?.enabled) return;
  const groupIds = new Set([...sourceSection.querySelectorAll("[data-source]")].map((input) => input.dataset.source));
  const selected = sourceIds(category).filter((id) => sourceEnabled(category, id));
  setSelectedSources(category, enabled
    ? [...new Set([...selected, ...groupIds])]
    : selected.filter((id) => !groupIds.has(id)));
  renderDisasterGroups();
  persistDraft();
});
disasterGroupsEl.addEventListener("change", (event) => {
  if (event.target.closest("#notify-bands")) {
    updateBandDraft(event.target);
    return;
  }
  const category = event.target.dataset.category;
  const source = event.target.dataset.source;
  const rule = event.target.dataset.rule;
  if (category) {
    if (category === "earthquake_warning" && event.target.checked && !commitBands()) {
      event.target.checked = true;
      return;
    }
    alertEntry(category).enabled = event.target.checked;
    setNotifyWarning("");
    renderDisasterGroups();
  }
  if (source) {
    const categoryId = event.target.closest("[data-category-card]")?.dataset.categoryCard;
    if (!alertEntry(categoryId)?.enabled) return;
    const ids = sourceIds(categoryId).filter((id) => id === source ? event.target.checked : sourceEnabled(categoryId, id));
    setSelectedSources(categoryId, ids);
    renderDisasterGroups();
  }
  if (rule) {
    const categoryId = event.target.closest("[data-category-card]")?.dataset.categoryCard;
    const alert = alertRule(categoryId);
    if (alertEntry(categoryId)?.enabled && alert) {
      alert[rule] = event.target.value;
      renderDisasterGroups();
    }
  }
  persistDraft();
});
disasterGroupsEl.addEventListener("input", (event) => {
  if (event.target.closest("#notify-bands .band-min, #notify-bands .band-max")) updateBandDraft(event.target);
});
disasterGroupsEl.addEventListener("blur", (event) => {
  if (event.target.closest("#notify-bands .band-min, #notify-bands .band-max")) setNotifyWarning(validateBands(collectBands()));
}, true);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!instanceTermsAccepted) return show("当前实例尚未确认部署责任，不能新增或覆盖订阅", "error");
  if (!configurationReady) return show("订阅配置尚未加载完成", "error");
  if (alertEntry("earthquake_warning")?.enabled && !commitBands()) return show("请修正通知级别规则", "error");
  const alertRuleError = validateAlertRules();
  if (alertRuleError) return show(alertRuleError, "error");
  if (!subscriptionDraft.targets.length) return show("请至少添加一个监测地点", "error");
  const locationError = validateLocations(subscriptionDraft.targets);
  if (locationError) return show(locationError, "error");
  const barkID = barkInput.value.trim();
  if (!/^[A-Za-z0-9]{1,64}$/.test(barkID)) return show("Bark Key 只能包含字母和数字", "error");
  const barkUrl = barkUrlInput.value;
  if (!barkUrls.includes(barkUrl)) return show("请选择有效的 Bark URL", "error");
  const submittedSignature = draftSignature();
  const payload = {
    destination: { type: "bark", base_url: barkUrl, device_key: barkID },
    targets: subscriptionDraft.targets.map((target) => ({
      label: target.label.trim(),
      point: { latitude: Number(target.point.latitude), longitude: Number(target.point.longitude) },
      region: {
        province: target.region.province.trim(), city: target.region.city.trim(), district: target.region.district.trim(),
      },
    })),
    alerts: enabledAlertRules().map(alertRuleForPayload),
  };
  setSubscriptionRequestInFlight(true);
  show("正在覆盖保存订阅...", "info");
  try {
    const res = await fetch(api + "/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const fallbackMessage = res.status === 502
      ? "Bark 接收测试失败，请检查 Bark Key；若确认无误，请稍后重试"
      : "";
    const json = await parseApiResponse(res, fallbackMessage);
    if (!res.ok || !json.success) throw new Error(json.message || "保存失败");
    lastSubmittedSignature = submittedSignature;
    lastSubmittedIdentity = currentDestinationIdentity();
    updateDraftStatus();
    flushDraft();
    if (json.data?.saved === true) {
      show("订阅已保存，Bark 确认通知已发送", "success");
      refreshStatus();
    } else {
      show(json.message || "Bark 服务暂时不可用，订阅确认将在后台重试", "warning");
    }
  } catch (error) {
    show(error.message || "网络请求失败", "error");
  } finally {
    setSubscriptionRequestInFlight(false);
  }
});

unsubscribe.addEventListener("click", async () => {
  const barkID = barkInput.value.trim();
  if (!/^[A-Za-z0-9]{1,64}$/.test(barkID)) return show("请填写有效的 Bark Key", "error");
  if (!barkUrls.includes(barkUrlInput.value)) return show("请选择有效的 Bark URL", "error");
  if (!confirm("确定删除该 Bark 服务与 Key 对应的服务端订阅？当前浏览器中的配置草稿会保留。")) return;
  if (subscriptionRequestInFlight) return;
  setSubscriptionRequestInFlight(true);
  show("正在取消订阅...", "info");
  try {
    const res = await fetch(api + "/api/unsubscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: { type: "bark", base_url: barkUrlInput.value, device_key: barkID },
      }),
    });
    const json = await parseApiResponse(res);
    if (!res.ok || !json.success) throw new Error(json.message || "取消失败");
    lastSubmittedSignature = "";
    lastSubmittedIdentity = "";
    updateDraftStatus();
    show("已删除服务端订阅；浏览器配置草稿已保留", "success");
    refreshStatus();
  } catch (error) {
    show(error.message || "网络请求失败", "error");
  } finally {
    setSubscriptionRequestInFlight(false);
  }
});

function setStatusDot(dot, state = "unknown") {
  dot.classList.remove("online", "partial", "offline");
  if (state !== "unknown") dot.classList.add(state);
}

function formatStatusCount(value) {
  return new Intl.NumberFormat("zh-CN").format(Number.isInteger(value) && value >= 0 ? value : 0);
}

function statusCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function formatStatusTime(epochMs) {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return "尚无消息";
  return new Date(epochMs).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function setStatusSource(dot, stateEl, metaEl, source) {
  if (!source || typeof source !== "object") {
    setStatusDot(dot);
    stateEl.textContent = "未知";
    metaEl.textContent = "尚未获取数据";
    return { delivered: 0, failed: 0 };
  }

  const connected = source.connected === true;
  setStatusDot(dot, connected ? "online" : "offline");
  stateEl.textContent = connected ? "已连接" : "未连接";
  const messages = statusCount(source.messages);
  const reconnects = statusCount(source.reconnects);
  const lastMessage = formatStatusTime(source.last_message_epoch_ms);
  metaEl.textContent = `消息 ${formatStatusCount(messages)} 条 · 最近 ${lastMessage}${reconnects ? ` · 重连 ${formatStatusCount(reconnects)} 次` : ""}`;
  return {
    delivered: statusCount(source.notifications_succeeded),
    failed: statusCount(source.notifications_failed),
  };
}

function setServiceStatus(label, state = "unknown") {
  statusLabel.textContent = label;
  serviceStatus.setAttribute("aria-label", `${label}，查看详细服务状态`);
  setStatusDot(statusDot, state);
}

function setStatusDetailsUnknown() {
  statusUpdated.textContent = "暂时无法获取";
  setStatusSource(statusWolfxDot, statusWolfxState, statusWolfxMeta, null);
  setStatusSource(statusFanstudioDot, statusFanstudioState, statusFanstudioMeta, null);
  setStatusSource(statusHuaniaDot, statusHuaniaState, statusHuaniaMeta, null);
  statusSubscriptions.textContent = "--";
  statusPending.textContent = "--";
  statusDelivered.textContent = "--";
  statusFailed.textContent = "--";
  statusBacklog.textContent = "事件 -- · 匹配 -- · 投递 -- · 重试 -- · 订阅确认 --";
}

function openStatusDetails() {
  statusShell.classList.add("is-open");
  serviceStatus.setAttribute("aria-expanded", "true");
  if (Date.now() - lastStatusRefreshAt > 15_000) refreshStatus();
}

function closeStatusDetails() {
  statusShell.classList.remove("is-open");
  serviceStatus.setAttribute("aria-expanded", "false");
}

async function refreshStatus() {
  if (statusRefreshInFlight) return;
  statusRefreshInFlight = true;
  try {
    const res = await fetch(api + "/api/status");
    const json = await parseApiResponse(res);
    const data = res.ok && json.success ? json.data : null;
    if (!data || !Number.isInteger(data.total_subscriptions)) {
      setServiceStatus("状态未知");
      setStatusDetailsUnknown();
      return;
    }

    const sources = [data.wolfx, data.fanstudio, data.huania];
    const connectedSources = sources
      .filter((source) => source?.connected === true).length;
    const sourceLabel = connectedSources === sources.length
      ? "数据源正常"
      : connectedSources > 0 ? `数据源 ${connectedSources}/${sources.length}` : "数据源离线";
    const state = connectedSources === sources.length ? "online" : connectedSources > 0 ? "partial" : "offline";
    const pending = data.durable && typeof data.durable === "object"
      ? Object.entries(data.durable)
        .filter(([key, value]) => key.endsWith("_pending") && Number.isFinite(value))
        .reduce((sum, [, value]) => sum + value, 0)
      : 0;
    setServiceStatus(
      `${sourceLabel} · ${data.total_subscriptions} 个订阅`,
      state,
    );
    const wolfxNotifications = setStatusSource(statusWolfxDot, statusWolfxState, statusWolfxMeta, data.wolfx);
    const fanstudioNotifications = setStatusSource(statusFanstudioDot, statusFanstudioState, statusFanstudioMeta, data.fanstudio);
    const huaniaNotifications = setStatusSource(statusHuaniaDot, statusHuaniaState, statusHuaniaMeta, data.huania);
    const durable = data.durable && typeof data.durable === "object" ? data.durable : {};
    const readyQueues = data.ready_queues && typeof data.ready_queues === "object" ? data.ready_queues : {};
    const readyQueueDepth = (name) => statusCount(readyQueues[name]?.depth);
    statusUpdated.textContent = `更新于 ${formatStatusTime(Date.now())}`;
    statusSubscriptions.textContent = formatStatusCount(data.total_subscriptions);
    statusPending.textContent = formatStatusCount(pending);
    statusDelivered.textContent = formatStatusCount(wolfxNotifications.delivered + fanstudioNotifications.delivered + huaniaNotifications.delivered);
    statusFailed.textContent = formatStatusCount(wolfxNotifications.failed + fanstudioNotifications.failed + huaniaNotifications.failed);
    statusBacklog.textContent = `事件 ${formatStatusCount(durable.inbox_pending)} · 匹配 ${formatStatusCount(durable.match_jobs_pending)} · 投递 ${formatStatusCount(durable.delivery_batches_pending)} · 重试 ${formatStatusCount(durable.retries_pending)} · 订阅确认 ${formatStatusCount(durable.subscription_confirmations_pending)}；内存队列 事件 ${formatStatusCount(readyQueueDepth("inbox"))} · 匹配 ${formatStatusCount(readyQueueDepth("matching"))} · 投递 ${formatStatusCount(readyQueueDepth("delivery"))}`;
  } catch {
    setServiceStatus("状态未知");
    setStatusDetailsUnknown();
  } finally {
    lastStatusRefreshAt = Date.now();
    statusRefreshInFlight = false;
  }
}

serviceStatus.addEventListener("pointerdown", () => {
  statusWasOpenOnPointerDown = statusShell.classList.contains("is-open");
});
serviceStatus.addEventListener("click", (event) => {
  const shouldClose = event.detail === 0
    ? statusShell.classList.contains("is-open")
    : statusWasOpenOnPointerDown;
  if (shouldClose) closeStatusDetails();
  else openStatusDetails();
});
statusShell.addEventListener("mouseenter", openStatusDetails);
statusShell.addEventListener("mouseleave", () => {
  if (!statusShell.contains(document.activeElement)) closeStatusDetails();
});
statusShell.addEventListener("focusin", openStatusDetails);
statusShell.addEventListener("focusout", () => {
  window.setTimeout(() => {
    if (!statusShell.contains(document.activeElement)) closeStatusDetails();
  }, 0);
});
document.addEventListener("pointerdown", (event) => {
  if (!statusShell.contains(event.target)) closeStatusDetails();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !statusShell.classList.contains("is-open")) return;
  closeStatusDetails();
  serviceStatus.blur();
});

const draft = restoreDraft();
initializeConfiguration(draft);
refreshStatus();
  
}
