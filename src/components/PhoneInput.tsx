import { Input } from "@/components/ui/input";

type PhoneInputProps = {
  id: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
};

export function PhoneInput({ id, value, invalid = false, onChange }: PhoneInputProps) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
      <span
        className="grid h-12 place-items-center rounded-md border border-input bg-muted text-sm font-semibold text-muted-foreground"
        aria-hidden="true"
      >
        +86
      </span>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="11 位大陆手机号"
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 11))}
      />
    </div>
  );
}

type OtpInputProps = {
  id: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
};

export function OtpInput({ id, value, invalid, onChange }: OtpInputProps) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="6 位验证码"
      maxLength={6}
      aria-invalid={invalid || undefined}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}
