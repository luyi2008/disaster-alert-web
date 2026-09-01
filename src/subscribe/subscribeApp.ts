import { bindAlertRules } from "./alerts";
import { targetCoordinates, validateLocations } from "./geo";
import {
  draftFromSavedSubscription,
  draftSignature,
  selectSavedSubscription,
} from "./draft";
import { bindLocations } from "./locations";
import { animateHeight } from "./motion";
import { createRuntime } from "./runtime";
import { bindStatus } from "./status";
import { bindToast } from "./toast";
import type { MountSubscribeOptions, SubscribeAppHandle } from "./types";
import { deleteDeviceSubscription, fetchDeviceSubscription, saveDeviceSubscription } from "../api";

export function mountSubscribeApp(root: HTMLElement, options: MountSubscribeOptions): SubscribeAppHandle {
  const ctx = createRuntime(root, options);
  const toast = bindToast(ctx);
  const { el } = ctx;

  function currentDestinationIdentity(): string {
    return ctx.deviceId;
  }

  function updateDraftStatus(): void {
    if (!ctx.instanceTermsAccepted) {
      el.draftStatus.textContent = "当前实例未确认部署责任，不能新增或保存订阅；仍可取消已有订阅。";
    } else if (!ctx.lastSubmittedSignature) {
      el.draftStatus.textContent = "";
    } else if (draftSignature(ctx.subscriptionDraft) === ctx.lastSubmittedSignature && currentDestinationIdentity() === ctx.lastSubmittedIdentity) {
      el.draftStatus.textContent = "本浏览器中的配置已提交。";
    } else {
      el.draftStatus.textContent = "有尚未提交的配置更改。";
    }
  }

  function persistDraft(): void {
    updateDraftStatus();
  }

  const locations = bindLocations(ctx, { persistDraft, show: toast.show });
  const alerts = bindAlertRules(ctx, { persistDraft, show: toast.show });
  const status = bindStatus(ctx);

  function setSubscriptionRequestInFlight(inFlight: boolean): void {
    ctx.subscriptionRequestInFlight = inFlight;
    el.submit.disabled = inFlight || !ctx.configurationReady || !ctx.instanceTermsAccepted;
    el.submit.title = ctx.instanceTermsAccepted ? "" : "实例部署者确认责任声明后才能保存订阅";
    el.unsubscribe.disabled = inFlight;
    el.resetAlertRules.disabled = inFlight || !ctx.configurationReady;
    el.startAddLocation.disabled = inFlight || !ctx.configurationReady || ctx.subscriptionDraft.targets.length >= 3 || ctx.uiState.locationMode !== "overview";
    el.finishLocation.disabled = inFlight || !ctx.configurationReady || (ctx.uiState.locationMode !== "overview" && !targetCoordinates(locations.activeTarget()));
    el.discardLocationEdit.disabled = inFlight || !ctx.configurationReady;
    if (ctx.locate) ctx.locate.disabled = inFlight || !ctx.configurationReady;
  }

  root.querySelectorAll("details.config-disclosure").forEach((node) => {
    const details = node as HTMLDetailsElement;
    const summary = details.querySelector(":scope > summary");
    const body = details.querySelector(":scope > .config-disclosure-body") as HTMLElement | null;
    if (!summary || !body) return;
    ctx.cleanup.listen(summary, "click", (event) => {
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

  function initializeConfiguration(): Promise<void> {
    const generation = ++ctx.initializationGeneration;
    ctx.configurationReady = false;
    setSubscriptionRequestInFlight(false);
    return fetchDeviceSubscription(ctx.deviceId)
      .catch(
        (): Awaited<ReturnType<typeof fetchDeviceSubscription>> => ({
          status: 0,
          body: { success: false, message: "" },
        }),
      )
      .then(async (saved) => {
        if (generation !== ctx.initializationGeneration) return;
        if (saved.status === 401) {
          options.onUnauthorized?.();
          return;
        }
        if (saved.status === 404) {
          options.onMissingDevice?.();
          return;
        }
        let savedRowApplied = false;
        if (saved.status === 200 && saved.body.success) {
          const row = selectSavedSubscription(saved.body.data?.subscriptions);
          if (row) {
            const mapped = draftFromSavedSubscription(row);
            ctx.subscriptionDraft = mapped;
            if (mapped.bark_url) ctx.barkUrl = mapped.bark_url;
            savedRowApplied = true;
          }
        } else if (saved.status !== 200) {
          toast.show(saved.body.message || "无法加载已保存的订阅", "error");
        }
        await alerts.loadSubscriptionOptions(ctx.subscriptionDraft, generation, {
          missingEnabled: !savedRowApplied,
        });
        if (generation !== ctx.initializationGeneration) return;
        ctx.configurationReady = true;
        setSubscriptionRequestInFlight(false);
        locations.renderLocations();
        locations.fitTargetMarkers();
        if (savedRowApplied && ctx.lastSubmittedSignature === "") {
          ctx.lastSubmittedSignature = draftSignature(ctx.subscriptionDraft);
          ctx.lastSubmittedIdentity = currentDestinationIdentity();
        }
        updateDraftStatus();
        toast.dismissPersistentToasts();
      })
      .catch((error: { message?: string }) => {
        if (generation !== ctx.initializationGeneration) return;
        ctx.configurationReady = false;
        setSubscriptionRequestInFlight(false);
        toast.show(error.message || "无法加载订阅配置", "error");
      });
  }

  ctx.cleanup.listen(el.form, "submit", async (event) => {
    event.preventDefault();
    if (!ctx.instanceTermsAccepted) {
      toast.show("当前实例尚未确认部署责任，不能新增或保存订阅", "error");
      return;
    }
    if (!ctx.configurationReady) {
      toast.show("订阅配置尚未加载完成", "error");
      return;
    }
    if (alerts.alertEntry("earthquake_warning")?.enabled && !alerts.commitBands()) {
      toast.show("请修正通知级别规则", "error");
      return;
    }
    const alertRuleError = alerts.validateAlertRules();
    if (alertRuleError) {
      toast.show(alertRuleError, "error");
      return;
    }
    if (!ctx.subscriptionDraft.targets.length) {
      toast.show("请至少添加一个监测地点", "error");
      return;
    }
    const locationError = validateLocations(ctx.subscriptionDraft.targets);
    if (locationError) {
      toast.show(locationError, "error");
      return;
    }
    const submittedSignature = draftSignature(ctx.subscriptionDraft);
    const payload = {
      targets: ctx.subscriptionDraft.targets.map((target) => ({
        label: target.label.trim(),
        point: { latitude: Number(target.point.latitude), longitude: Number(target.point.longitude) },
        region: {
          province: target.region.province.trim(), city: target.region.city.trim(), district: target.region.district.trim(),
        },
      })),
      alerts: alerts.enabledAlertRules().map(alerts.alertRuleForPayload),
    };
    setSubscriptionRequestInFlight(true);
    toast.show("正在保存订阅...", "info");
    try {
      const { status: httpStatus, body } = await saveDeviceSubscription(ctx.deviceId, payload);
      if (httpStatus === 401) {
        options.onUnauthorized?.();
        return;
      }
      if (httpStatus === 404) {
        options.onMissingDevice?.();
        return;
      }
      if (httpStatus >= 400 || !body.success) {
        throw new Error(body.message || "保存失败");
      }
      ctx.lastSubmittedSignature = submittedSignature;
      ctx.lastSubmittedIdentity = currentDestinationIdentity();
      updateDraftStatus();
      if (body.data?.saved === true) {
        toast.show("订阅已保存，Bark 确认通知已发送", "success");
        void status.refreshStatus();
      } else {
        toast.show(body.message || "Bark 服务暂时不可用，订阅确认将在后台重试", "warning");
      }
    } catch (error) {
      toast.show((error as { message?: string }).message || "网络请求失败", "error");
    } finally {
      setSubscriptionRequestInFlight(false);
    }
  });

  ctx.cleanup.listen(el.unsubscribe, "click", async () => {
    if (!confirm("确定删除该设备对应的服务端订阅？")) return;
    if (ctx.subscriptionRequestInFlight) return;
    setSubscriptionRequestInFlight(true);
    toast.show("正在取消订阅...", "info");
    try {
      const { status: httpStatus, body } = await deleteDeviceSubscription(ctx.deviceId);
      if (httpStatus === 401) {
        options.onUnauthorized?.();
        return;
      }
      if (httpStatus === 404) {
        options.onMissingDevice?.();
        return;
      }
      if (httpStatus >= 400 || !body.success) throw new Error(body.message || "取消失败");
      ctx.lastSubmittedSignature = "";
      ctx.lastSubmittedIdentity = "";
      updateDraftStatus();
      toast.show("已删除服务端订阅", "success");
      void status.refreshStatus();
    } catch (error) {
      toast.show((error as { message?: string }).message || "网络请求失败", "error");
    } finally {
      setSubscriptionRequestInFlight(false);
    }
  });

  locations.renderLocations();
  locations.renderLocationEditor();
  void initializeConfiguration();
  void status.refreshStatus();

  return {
    teardown() {
      ctx.initializationGeneration += 1;
      locations.cancelAllGeocode();
      ctx.cleanup.run();
    },
  };
}
