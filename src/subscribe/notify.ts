import { toast } from "sonner";
import type { ToastType } from "./types";

const PROGRESS_ID = "subscribe-progress";

export function notify(message: string, type: ToastType = "info"): void {
  if (type === "info") {
    toast.loading(message, { id: PROGRESS_ID, duration: Number.POSITIVE_INFINITY });
    return;
  }
  toast.dismiss(PROGRESS_ID);
  if (type === "error") {
    toast.error(message, { duration: 6000 });
    return;
  }
  if (type === "success") {
    toast.success(message, { duration: 3000 });
    return;
  }
  toast.warning(message, { duration: 4500 });
}
