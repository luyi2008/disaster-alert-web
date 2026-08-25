import { escapeHtml } from "./html";
import type { SubscribeRuntime } from "./runtime";
import type { ToastType } from "./types";

type ToastElement = HTMLElement & { dismissTimer?: ReturnType<typeof setTimeout> };

export type ToastController = {
  show: (message: string, type?: ToastType) => HTMLElement;
  dismissPersistentToasts: () => void;
};

export function bindToast(ctx: SubscribeRuntime): ToastController {
  const { toastStack } = ctx.el;

  function updateToastStack(): void {
    let expandedOffset = 0;
    [...toastStack.querySelectorAll<HTMLElement>(".toast")].reverse().forEach((toast, index) => {
      toast.classList.toggle("is-current", index === 0);
      toast.style.zIndex = String(10 - index);
      toast.style.setProperty("--toast-collapsed-offset", `${-index * 7}px`);
      toast.style.setProperty("--toast-collapsed-scale", String(Math.max(0.9, 1 - index * 0.025)));
      toast.style.setProperty("--toast-expanded-offset", `${-expandedOffset}px`);
      expandedOffset += toast.offsetHeight + 9;
    });
  }

  function dismissToast(toast: ToastElement | null, immediate = false): void {
    if (!toast || !toast.isConnected) return;
    if (toast.dismissTimer) clearTimeout(toast.dismissTimer);
    if (immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      toast.remove();
      updateToastStack();
      return;
    }
    toast.classList.remove("is-visible");
    toast.classList.add("is-leaving");
    const leaveTimer = window.setTimeout(() => {
      toast.remove();
      updateToastStack();
    }, 210);
    ctx.cleanup.add(() => window.clearTimeout(leaveTimer));
  }

  function show(message: string, type: ToastType = "info"): HTMLElement {
    if (type !== "info") {
      const pendingToast = [...toastStack.querySelectorAll<ToastElement>(".toast.info[data-persistent='true']")].pop();
      if (pendingToast) dismissToast(pendingToast);
    }
    const toast = ctx.ownerDocument.createElement("div") as ToastElement;
    toast.className = `toast ${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `
    <span class="toast-indicator" aria-hidden="true"></span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" type="button" aria-label="关闭提示">×</button>`;
    const duration = type === "info" ? 0 : type === "error" ? 6000 : type === "warning" ? 4500 : 3000;
    toast.dataset.persistent = String(!duration);
    toast.querySelector(".toast-close")?.addEventListener("click", () => dismissToast(toast));
    toastStack.append(toast);
    updateToastStack();
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    if (duration) {
      toast.dismissTimer = setTimeout(() => dismissToast(toast), duration);
    }
    while (toastStack.children.length > 5) {
      dismissToast(toastStack.firstElementChild as ToastElement, true);
    }
    return toast;
  }

  function dismissPersistentToasts(): void {
    toastStack.querySelectorAll<ToastElement>(".toast[data-persistent='true']").forEach((toast) => dismissToast(toast));
  }

  ctx.cleanup.add(() => {
    toastStack.querySelectorAll<ToastElement>(".toast").forEach((toast) => dismissToast(toast, true));
  });

  return { show, dismissPersistentToasts };
}
