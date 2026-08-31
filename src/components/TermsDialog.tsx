import { useEffect, useRef } from "react";

type TermsDialogProps = {
  open: boolean;
};

export function TermsDialog({ open }: TermsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) {
      return;
    }
    const onCancel = (event: Event) => event.preventDefault();
    dialog.addEventListener("cancel", onCancel);
    const dismiss = dialog.querySelector("#dismiss-instance-terms");
    const onDismiss = () => {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    };
    dismiss?.addEventListener("click", onDismiss);
    if (typeof dialog.showModal === "function") {
      dialog.removeAttribute("open");
      try {
        dialog.showModal();
        dialog.classList.add("is-modal");
      } catch {
        dialog.setAttribute("open", "");
      }
    }
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dismiss?.removeEventListener("click", onDismiss);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <dialog
      id="instance-terms-dialog"
      ref={dialogRef}
      className="instance-terms-dialog"
      aria-labelledby="instance-terms-title"
      aria-describedby="instance-terms-summary"
      open
    >
      <div className="instance-terms-heading">
        <span className="instance-terms-icon" aria-hidden="true">
          !
        </span>
        <div>
          <span className="instance-terms-eyebrow">实例配置提醒</span>
          <h2 id="instance-terms-title">当前实例尚未确认部署责任声明</h2>
        </div>
      </div>
      <p id="instance-terms-summary">
        此实例未设置 <code>INSTANCE_TERMS_ACCEPTED=true</code>
        。服务仍在运行，但新增和保存订阅已在服务端禁用。
      </p>
      <ul>
        <li>
          项目维护者仅提供可自部署的软件，不运营、控制或认可本实例提供的实时灾害信息、订阅或通知服务。
        </li>
        <li>
          启用实时数据或向他人提供服务前，部署者应自行核查适用法律法规，并取得所需许可、数据授权和个人信息处理依据；自部署不等于获准公开发布预警。
        </li>
        <li>信息可能延迟、缺失或误报，不属于官方预警，也不应作为唯一的安全决策依据。</li>
        <li>已有订阅仍可取消；实例中已有的订阅和后台任务不会因本提示自动删除或停止。</li>
      </ul>
      <p className="instance-terms-note">
        本提示只反映环境变量状态，不能替代法律评估、主管部门许可或数据提供方授权。
      </p>
      <div className="instance-terms-actions">
        <a
          href="https://github.com/luyi2008/disaster-alert#使用与部署责任"
          target="_blank"
          rel="noopener noreferrer"
        >
          查看完整声明
        </a>
        <button id="dismiss-instance-terms" className="primary" type="button">
          继续查看
        </button>
      </div>
    </dialog>
  );
}
