import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TermsDialogProps = {
  open: boolean;
};

export function TermsDialog({ open }: TermsDialogProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!open || dismissed) {
    return null;
  }

  return (
    <Dialog open>
      <DialogContent
        id="instance-terms-dialog"
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        aria-describedby="instance-terms-summary"
      >
        <DialogHeader>
          <DialogTitle id="instance-terms-title">当前实例尚未确认部署责任声明</DialogTitle>
          <DialogDescription id="instance-terms-summary">
            此实例未设置 <code>INSTANCE_TERMS_ACCEPTED=true</code>
            。服务仍在运行，但新增和保存订阅已在服务端禁用。
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            项目维护者仅提供可自部署的软件，不运营、控制或认可本实例提供的实时灾害信息、订阅或通知服务。
          </li>
          <li>
            启用实时数据或向他人提供服务前，部署者应自行核查适用法律法规，并取得所需许可、数据授权和个人信息处理依据；自部署不等于获准公开发布预警。
          </li>
          <li>信息可能延迟、缺失或误报，不属于官方预警，也不应作为唯一的安全决策依据。</li>
          <li>已有订阅仍可取消；实例中已有的订阅和后台任务不会因本提示自动删除或停止。</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          本提示只反映环境变量状态，不能替代法律评估、主管部门许可或数据提供方授权。
        </p>
        <DialogFooter>
          <Button asChild variant="outline">
            <a
              href="https://github.com/luyi2008/disaster-alert#使用与部署责任"
              target="_blank"
              rel="noopener noreferrer"
            >
              查看完整声明
            </a>
          </Button>
          <Button type="button" onClick={() => setDismissed(true)}>
            继续查看
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
