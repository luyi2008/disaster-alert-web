import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RenameDialog({
  open,
  title = "修改设备名称",
  label = "设备名称",
  initialValue,
  confirmLabel = "保存",
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title?: string;
  label?: string;
  initialValue: string;
  confirmLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (value: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <RenameForm
            key={initialValue}
            title={title}
            label={label}
            initialValue={initialValue}
            confirmLabel={confirmLabel}
            onOpenChange={onOpenChange}
            onConfirm={onConfirm}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  title,
  label,
  initialValue,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: {
  title: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(value);
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="rename-value">{label}</Label>
        <Input
          id="rename-value"
          value={value}
          autoComplete="off"
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button type="submit">{confirmLabel}</Button>
      </DialogFooter>
    </form>
  );
}
