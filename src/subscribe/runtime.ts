import type { Map as LeafletMap, Marker } from "leaflet";
import type {
  CategoryOption,
  GeocodeJob,
  LocationMode,
  MountSubscribeOptions,
  SubscribeElements,
  SubscriptionDraft,
  SubscriptionTarget,
} from "./types";
import { createEmptyDraft } from "./draft";

export type Cleanup = () => void;

export class CleanupRegistry {
  private readonly fns: Cleanup[] = [];

  add(fn: Cleanup): void {
    this.fns.push(fn);
  }

  listen(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.add(() => target.removeEventListener(type, listener, options));
  }

  run(): void {
    while (this.fns.length > 0) {
      const fn = this.fns.pop();
      try {
        fn?.();
      } catch {
        // Continue remaining teardown even if one listener fails.
      }
    }
  }
}

export function requiredQuery<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector(selector);
  if (!node) {
    throw new Error(`subscribe shell missing ${selector}`);
  }
  return node as T;
}

export function queryElements(root: HTMLElement): SubscribeElements {
  return {
    form: requiredQuery(root, "#subscribe-form"),
    barkInput: requiredQuery(root, "#bark-id"),
    barkUrlInput: requiredQuery(root, "#bark-url"),
    barkUrlField: requiredQuery(root, "#bark-url-field"),
    nameInput: requiredQuery(root, "#location-name"),
    provinceInput: requiredQuery(root, "#province"),
    cityInput: requiredQuery(root, "#city"),
    districtInput: requiredQuery(root, "#district"),
    regionStatus: requiredQuery(root, "#region-status"),
    editRegion: requiredQuery(root, "#edit-region"),
    regionEditor: requiredQuery(root, "#region-editor"),
    latInput: requiredQuery(root, "#latitude"),
    lonInput: requiredQuery(root, "#longitude"),
    locationsList: requiredQuery(root, "#locations-list"),
    locationCount: requiredQuery(root, "#location-count"),
    locationsSummary: requiredQuery(root, "#locations-summary"),
    locationEditor: requiredQuery(root, "#location-editor"),
    locationEditorTitle: requiredQuery(root, "#location-editor-title"),
    locationEditorSubtitle: requiredQuery(root, "#location-editor-subtitle"),
    locationPickerHeading: requiredQuery(root, "#location-picker-heading"),
    locationDetails: requiredQuery(root, "#location-details"),
    mapMode: requiredQuery(root, "#map-mode"),
    startAddLocation: requiredQuery(root, "#start-add-location"),
    finishLocation: requiredQuery(root, "#finish-location"),
    discardLocationEdit: requiredQuery(root, "#discard-location-edit"),
    draftStatus: requiredQuery(root, "#draft-status"),
    toastStack: requiredQuery(root, "#toast-stack"),
    retryConfig: requiredQuery(root, "#retry-config"),
    submit: requiredQuery(root, "#submit"),
    unsubscribe: requiredQuery(root, "#unsubscribe"),
    statusShell: requiredQuery(root, "#status-shell"),
    serviceStatus: requiredQuery(root, "#service-status"),
    statusLabel: requiredQuery(root, "#status-label"),
    statusDot: requiredQuery(root, "#status-dot"),
    statusUpdated: requiredQuery(root, "#status-updated"),
    statusWolfxDot: requiredQuery(root, "#status-wolfx-dot"),
    statusWolfxState: requiredQuery(root, "#status-wolfx-state"),
    statusWolfxMeta: requiredQuery(root, "#status-wolfx-meta"),
    statusFanstudioDot: requiredQuery(root, "#status-fanstudio-dot"),
    statusFanstudioState: requiredQuery(root, "#status-fanstudio-state"),
    statusFanstudioMeta: requiredQuery(root, "#status-fanstudio-meta"),
    statusHuaniaDot: requiredQuery(root, "#status-huania-dot"),
    statusHuaniaState: requiredQuery(root, "#status-huania-state"),
    statusHuaniaMeta: requiredQuery(root, "#status-huania-meta"),
    statusSubscriptions: requiredQuery(root, "#status-subscriptions"),
    statusPending: requiredQuery(root, "#status-pending"),
    statusDelivered: requiredQuery(root, "#status-delivered"),
    statusFailed: requiredQuery(root, "#status-failed"),
    statusBacklog: requiredQuery(root, "#status-backlog"),
    disasterGroupsEl: requiredQuery(root, "#disaster-groups"),
    resetAlertRules: requiredQuery(root, "#reset-alert-rules"),
    mapElement: requiredQuery(root, "#map"),
  };
}

export type SubscribeRuntime = {
  root: HTMLElement;
  ownerDocument: Document;
  api: string;
  instanceTermsAccepted: boolean;
  el: SubscribeElements;
  cleanup: CleanupRegistry;
  subscriptionDraft: SubscriptionDraft;
  uiState: {
    activeTargetId: string | null;
    locationMode: LocationMode;
    editingTarget: SubscriptionTarget | null;
  };
  lastSubmittedSignature: string;
  lastSubmittedIdentity: string;
  persistTimer: ReturnType<typeof setTimeout> | null;
  optionCategories: CategoryOption[];
  barkUrls: string[];
  configurationReady: boolean;
  subscriptionRequestInFlight: boolean;
  initializationGeneration: number;
  targetMarkers: Map<string, Marker>;
  targetCoordinateRevisions: Map<string, number>;
  targetRegionRevisions: Map<string, number>;
  geocodeJobs: Map<string, GeocodeJob>;
  expandedDisasterCategories: Set<string>;
  map: LeafletMap | null;
  locate: HTMLButtonElement | null;
  notifyBandsEl: HTMLElement | null;
  notifyWarning: HTMLElement | null;
};

export function createRuntime(root: HTMLElement, options: MountSubscribeOptions): SubscribeRuntime {
  return {
    root,
    ownerDocument: root.ownerDocument,
    api: String(options.api || "").replace(/\/$/, ""),
    instanceTermsAccepted: Boolean(options.instanceTermsAccepted),
    el: queryElements(root),
    cleanup: new CleanupRegistry(),
    subscriptionDraft: createEmptyDraft(),
    uiState: {
      activeTargetId: null,
      locationMode: "overview",
      editingTarget: null,
    },
    lastSubmittedSignature: "",
    lastSubmittedIdentity: "",
    persistTimer: null,
    optionCategories: [],
    barkUrls: [],
    configurationReady: false,
    subscriptionRequestInFlight: false,
    initializationGeneration: 0,
    targetMarkers: new Map(),
    targetCoordinateRevisions: new Map(),
    targetRegionRevisions: new Map(),
    geocodeJobs: new Map(),
    expandedDisasterCategories: new Set(),
    map: null,
    locate: null,
    notifyBandsEl: null,
    notifyWarning: null,
  };
}
