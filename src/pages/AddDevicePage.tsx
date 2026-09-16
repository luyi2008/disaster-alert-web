import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { AddDeviceForm } from "../devices/AddDeviceForm";
import "../styles/base.css";
import "../styles/ds.css";

export function AddDevicePage() {
  const navigate = useNavigate();

  return (
    <AppShell title="添加设备" description="输入这台设备的推送令牌。名称可选。">
      <Card>
        <CardContent>
          <AddDeviceForm
            cancelLabel="返回设备"
            onCancel={() => navigate("/devices")}
            onSuccess={() => navigate("/devices")}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
