export type NotifyLevel = "passive" | "active" | "critical";

export type LocationMode = "overview" | "adding" | "editing";

export type ToastType = "info" | "error" | "warning" | "success";

export type SubscriptionPoint = {
  latitude: string;
  longitude: string;
};

export type SubscriptionRegion = {
  province: string;
  city: string;
  district: string;
};

export type SubscriptionTarget = {
  id: string;
  label: string;
  point: SubscriptionPoint;
  region: SubscriptionRegion;
};

export type SourceSelection = {
  mode: "all" | "include";
  ids?: string[];
};

export type IntensityBand = {
  min: number | string;
  max: number | string;
  interruption_level?: string;
  level?: string;
  label?: string;
};

export type AlertRuleDraft = {
  category: string;
  sources?: SourceSelection;
  estimated_intensity_bands?: IntensityBand[];
  min_magnitude?: number | string;
  min_severity?: number | string;
  fallback_radius_km?: number | string;
  max_center_distance_km?: number | string;
};

export type AlertEntry = {
  enabled: boolean;
  rule: AlertRuleDraft;
};

export type SubscriptionDraft = {
  schema_version: 3;
  bark_url: string;
  targets: SubscriptionTarget[];
  alerts_by_category: Record<string, AlertEntry>;
  legacy_alerts?: AlertRuleDraft[];
  legacy_disabled_alerts?: AlertRuleDraft[];
};

export type SourceOption = {
  id: string;
  label: string;
};

export type SourceGroup = {
  id: string;
  label: string;
  sources: SourceOption[];
};

export type CategoryOption = {
  id: string;
  label: string;
  source_groups: SourceGroup[];
  default_alert: AlertRuleDraft;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type GeocodeJob = {
  controller: AbortController;
  timer: ReturnType<typeof setTimeout> | null;
  coordinateRevision: number;
  regionRevision: number;
};

export type MountSubscribeOptions = {
  api?: string;
  instanceTermsAccepted?: boolean;
  initialBarkKey?: string;
};

export type SubscribeElements = {
  form: HTMLFormElement;
  barkInput: HTMLInputElement;
  barkUrlInput: HTMLSelectElement;
  barkUrlField: HTMLElement;
  nameInput: HTMLInputElement;
  provinceInput: HTMLInputElement;
  cityInput: HTMLInputElement;
  districtInput: HTMLInputElement;
  regionStatus: HTMLElement;
  editRegion: HTMLButtonElement;
  regionEditor: HTMLElement;
  latInput: HTMLInputElement;
  lonInput: HTMLInputElement;
  locationsList: HTMLElement;
  locationCount: HTMLElement;
  locationsSummary: HTMLElement;
  locationEditor: HTMLElement;
  locationEditorTitle: HTMLElement;
  locationEditorSubtitle: HTMLElement;
  locationPickerHeading: HTMLElement;
  locationDetails: HTMLElement;
  mapMode: HTMLElement;
  startAddLocation: HTMLButtonElement;
  finishLocation: HTMLButtonElement;
  discardLocationEdit: HTMLButtonElement;
  draftStatus: HTMLElement;
  toastStack: HTMLElement;
  retryConfig: HTMLButtonElement;
  submit: HTMLButtonElement;
  unsubscribe: HTMLButtonElement;
  statusShell: HTMLElement;
  serviceStatus: HTMLButtonElement;
  statusLabel: HTMLElement;
  statusDot: HTMLElement;
  statusUpdated: HTMLElement;
  statusWolfxDot: HTMLElement;
  statusWolfxState: HTMLElement;
  statusWolfxMeta: HTMLElement;
  statusFanstudioDot: HTMLElement;
  statusFanstudioState: HTMLElement;
  statusFanstudioMeta: HTMLElement;
  statusHuaniaDot: HTMLElement;
  statusHuaniaState: HTMLElement;
  statusHuaniaMeta: HTMLElement;
  statusSubscriptions: HTMLElement;
  statusPending: HTMLElement;
  statusDelivered: HTMLElement;
  statusFailed: HTMLElement;
  statusBacklog: HTMLElement;
  disasterGroupsEl: HTMLElement;
  resetAlertRules: HTMLButtonElement;
  mapElement: HTMLElement;
};
