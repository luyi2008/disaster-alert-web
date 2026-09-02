import { COUNTRY_DIALS, formatNationalNumber } from "../../auth/phone";

type PhoneInputProps = {
  id: string;
  dial: string;
  national: string;
  invalid?: boolean;
  onDialChange: (dial: string) => void;
  onNationalChange: (value: string) => void;
};

export function PhoneInput({
  id,
  dial,
  national,
  invalid = false,
  onDialChange,
  onNationalChange,
}: PhoneInputProps) {
  return (
    <div className={`ds-phone${invalid ? " is-invalid" : ""}`}>
      <label className="visually-hidden" htmlFor={`${id}-dial`}>
        国家/地区区号
      </label>
      <select
        id={`${id}-dial`}
        className="ds-phone-dial"
        value={dial}
        onChange={(event) => onDialChange(event.target.value)}
      >
        {COUNTRY_DIALS.map((country) => (
          <option key={country.iso} value={country.dial}>
            +{country.dial} {country.name}
          </option>
        ))}
      </select>
      <input
        id={id}
        className="ds-phone-number"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={COUNTRY_DIALS.find((item) => item.dial === dial)?.example ?? "手机号码"}
        value={national}
        onChange={(event) => onNationalChange(formatNationalNumber(dial, event.target.value))}
      />
    </div>
  );
}

type OtpInputProps = {
  id: string;
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
};

export function OtpInput({ id, value, disabled, invalid, onChange }: OtpInputProps) {
  return (
    <input
      id={id}
      className={`ds-input ds-otp${invalid ? " is-invalid" : ""}`}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="请输入验证码"
      maxLength={6}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}
