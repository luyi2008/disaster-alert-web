type PhoneInputProps = {
  id: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
};

export function PhoneInput({ id, value, invalid = false, onChange }: PhoneInputProps) {
  return (
    <div className={`ds-phone${invalid ? " is-invalid" : ""}`}>
      <span className="ds-phone-dial" aria-hidden="true">
        +86
      </span>
      <input
        id={id}
        className="ds-phone-number"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="11 位大陆手机号"
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
    <input
      id={id}
      className={`ds-input ds-otp${invalid ? " is-invalid" : ""}`}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="6 位验证码"
      maxLength={6}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}
