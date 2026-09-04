import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  deleteDeviceSubscription,
  fetchDeviceSubscription,
  saveDeviceSubscription,
} from "../api";
import { AlertRulesPanel } from "./AlertRulesPanel";
import {
  alertEntry,
  alertRuleForPayload,
  cloneJson,
  commitBands,
  enabledAlertRules,
  sanitizeAlertRule,
  validateAlertRules,
} from "./alertLogic";
import { createEmptyDraft, draftFromSavedSubscription, selectSavedSubscription } from "./draft";
import { validateLocations } from "./geo";
import { parseApiResponse } from "./http";
import { LocationPanel } from "./LocationPanel";
import { mergeAlertsByCategory } from "./mergeAlerts";
import { notify } from "./notify";
import { fetchConnectedSourceLabels } from "./statusSources";
import type { CategoryOption, SubscriptionDraft } from "./types";

export function SubscribeWorkspace({
  api,
  instanceTermsAccepted,
  deviceKey,
  onUnauthorized,
  onMissingDevice,
}: {
  api: string;
  instanceTermsAccepted: boolean;
  deviceKey: string;
  onUnauthorized?: () => void;
  onMissingDevice?: () => void;
}) {
  const [draft, setDraft] = useState<SubscriptionDraft>(() => createEmptyDraft());
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [configurationReady, setConfigurationReady] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const [connectedSources, setConnectedSources] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [unsubscribeOpen, setUnsubscribeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    async function load(): Promise<void> {
      const current = ++generation;
      setConfigurationReady(false);
      try {
        const saved = await fetchDeviceSubscription(deviceKey).catch(
          (): Awaited<ReturnType<typeof fetchDeviceSubscription>> => ({
            status: 0,
            body: { success: false, message: "" },
          }),
        );
        if (cancelled || current !== generation) return;
        if (saved.status === 401) {
          onUnauthorized?.();
          return;
        }
        if (saved.status === 404) {
          onMissingDevice?.();
          return;
        }
        let nextDraft = createEmptyDraft();
        let savedRowApplied = false;
        if (saved.status === 200 && saved.body.success) {
          const row = selectSavedSubscription(saved.body.data?.subscriptions);
          if (row) {
            nextDraft = draftFromSavedSubscription(row);
            savedRowApplied = true;
          }
        } else if (saved.status !== 200) {
          notify(saved.body.message || "无法加载已保存的订阅", "error");
        }
        const res = await fetch(`${api}/api/subscription-options`);
        const json = await parseApiResponse(res);
        if (cancelled || current !== generation) return;
        const data = json.data as { categories?: CategoryOption[] } | undefined;
        if (!res.ok || !json.success || !Array.isArray(data?.categories)) {
          throw new Error(json.message || "无法获取灾害来源");
        }
        nextDraft.alerts_by_category = mergeAlertsByCategory(
          data.categories,
          nextDraft.alerts_by_category && typeof nextDraft.alerts_by_category === "object"
            ? nextDraft.alerts_by_category
            : {},
          !savedRowApplied,
          sanitizeAlertRule,
        );
        delete nextDraft.legacy_alerts;
        delete nextDraft.legacy_disabled_alerts;
        setCategories(data.categories);
        setDraft(nextDraft);
        setConfigurationReady(true);
      } catch (error) {
        if (cancelled || current !== generation) return;
        setConfigurationReady(false);
        notify((error as { message?: string }).message || "无法加载订阅配置", "error");
      }
    }
    void load();
    void fetchConnectedSourceLabels(api).then((labels) => {
      if (!cancelled) setConnectedSources(labels);
    });
    return () => {
      cancelled = true;
      generation += 1;
    };
  }, [api, deviceKey, onMissingDevice, onUnauthorized]);

  async function onSave(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!instanceTermsAccepted) {
      notify("当前实例尚未确认部署责任，不能新增或保存订阅", "error");
      return;
    }
    if (!configurationReady) {
      notify("订阅配置尚未加载完成", "error");
      return;
    }
    if (alertEntry(draft, "earthquake_warning")?.enabled) {
      const bandError = commitBands(draft);
      if (bandError) {
        notify("请修正通知级别规则", "error");
        return;
      }
    }
    const alertRuleError = validateAlertRules(draft, categories);
    if (alertRuleError) {
      notify(alertRuleError, "error");
      return;
    }
    if (!draft.targets.length) {
      notify("请至少添加一个监测地点", "error");
      return;
    }
    const locationError = validateLocations(draft.targets);
    if (locationError) {
      notify(locationError, "error");
      return;
    }
    const payload = {
      targets: draft.targets.map((target) => ({
        label: target.label.trim(),
        point: { latitude: Number(target.point.latitude), longitude: Number(target.point.longitude) },
        region: {
          province: target.region.province.trim(), city: target.region.city.trim(), district: target.region.district.trim(),
        },
      })),
      alerts: enabledAlertRules(draft).map(alertRuleForPayload),
    };
    setInFlight(true);
    notify("正在保存订阅...", "info");
    try {
      const { status: httpStatus, body } = await saveDeviceSubscription(deviceKey, payload);
      if (httpStatus === 401) {
        onUnauthorized?.();
        return;
      }
      if (httpStatus === 404) {
        onMissingDevice?.();
        return;
      }
      if (httpStatus >= 400 || !body.success) {
        throw new Error(body.message || "保存失败");
      }
      if (body.data?.saved === true) {
        notify("订阅已保存，Bark 确认通知已发送", "success");
        void fetchConnectedSourceLabels(api).then(setConnectedSources);
      } else {
        notify(body.message || "Bark 服务暂时不可用，订阅确认将在后台重试", "warning");
      }
    } catch (error) {
      notify((error as { message?: string }).message || "网络请求失败", "error");
    } finally {
      setInFlight(false);
    }
  }

  async function onUnsubscribe(): Promise<void> {
    if (inFlight) return;
    setInFlight(true);
    notify("正在取消订阅...", "info");
    try {
      const { status: httpStatus, body } = await deleteDeviceSubscription(deviceKey);
      if (httpStatus === 401) {
        onUnauthorized?.();
        return;
      }
      if (httpStatus === 404) {
        onMissingDevice?.();
        return;
      }
      if (httpStatus >= 400 || !body.success) throw new Error(body.message || "取消失败");
      notify("已删除服务端订阅", "success");
      void fetchConnectedSourceLabels(api).then(setConnectedSources);
    } catch (error) {
      notify((error as { message?: string }).message || "网络请求失败", "error");
    } finally {
      setInFlight(false);
    }
  }

  return (
    <>
      <form id="subscribe-form" onSubmit={(event) => void onSave(event)}>
        <div className="workspace">
          <div className="workspace-column">
            <LocationPanel
              draft={draft}
              setDraft={setDraft}
              configurationReady={configurationReady}
              inFlight={inFlight}
              api={api}
            />
          </div>
          <div className="workspace-column">
            <AlertRulesPanel
              draft={draft}
              setDraft={setDraft}
              categories={categories}
              configurationReady={configurationReady}
              inFlight={inFlight}
              connectedSources={connectedSources}
              onResetRequest={() => {
                if (!configurationReady) {
                  notify("订阅配置尚未加载完成", "error");
                  return;
                }
                setResetOpen(true);
              }}
            />
          </div>
        </div>
        <div className="form-actions">
          <Button asChild variant="outline">
            <Link className="btn-ghost" to="/devices">返回设备</Link>
          </Button>
          <div id="draft-status" className="form-actions-note">
            {instanceTermsAccepted ? "" : "当前实例未确认部署责任，不能新增或保存订阅；仍可取消已有订阅。"}
          </div>
          <Button id="unsubscribe" type="button" variant="secondary" disabled={inFlight} onClick={() => setUnsubscribeOpen(true)}>
            取消订阅
          </Button>
          <Button
            id="submit"
            type="submit"
            disabled={inFlight || !configurationReady || !instanceTermsAccepted}
            title={instanceTermsAccepted ? "" : "实例部署者确认责任声明后才能保存订阅"}
          >
            保存订阅
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={unsubscribeOpen}
        title="取消订阅"
        description="确定删除该设备对应的服务端订阅？"
        confirmLabel="确认取消"
        destructive
        onOpenChange={setUnsubscribeOpen}
        onConfirm={() => void onUnsubscribe()}
      />
      <ConfirmDialog
        open={resetOpen}
        title="重置规则"
        description="恢复所有预警类型和规则为默认设置？监测地点和接收设备不会改变。"
        confirmLabel="恢复默认"
        onOpenChange={setResetOpen}
        onConfirm={() => {
          setDraft((current) => ({
            ...current,
            alerts_by_category: Object.fromEntries(categories.map((category) => [
              category.id, { enabled: true, rule: cloneJson(category.default_alert) },
            ])),
          }));
          notify("预警规则已恢复默认设置", "success");
        }}
      />
    </>
  );
}
