import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type PhoneInputProps = {
  id: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
};

export function PhoneInput({ id, value, invalid = false, onChange }: PhoneInputProps) {
  return (
    <InputGroup className="phone-input">
      <InputGroupAddon aria-hidden="true">+86</InputGroupAddon>
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
    </InputGroup>
  );
}

type OtpInputProps = {
  id: string;
  value: string;
  invalid?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function OtpInput({
  id,
  value,
  invalid,
  placeholder = "6 位验证码",
  onChange,
}: OtpInputProps) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder={placeholder}
      maxLength={6}
      aria-invalid={invalid || undefined}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}

type CaptchaCodeInputProps = {
  id: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
};

export function CaptchaCodeInput({ id, value, invalid = false, onChange }: CaptchaCodeInputProps) {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  return (
    <div className={cn("otp-well", invalid && "is-invalid")}>
      {Array.from({ length: 6 }, (_, index) => {
        const filled = digits[index];
        return (
          <span
            key={index}
            className={cn("otp-slot", !filled && "is-empty", digits.length === index && "is-active")}
            aria-hidden="true"
          >
            {filled ?? ""}
          </span>
        );
      })}
      <Input
        id={id}
        className="otp-hidden"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        aria-invalid={invalid || undefined}
        aria-label="图形验证码"
        value={digits}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
      />
    </div>
  );
}
