type SocialProvider = "wechat" | "alipay" | "google";

const PROVIDERS: Array<{ id: SocialProvider; label: string }> = [
  { id: "wechat", label: "微信" },
  { id: "alipay", label: "支付宝" },
  { id: "google", label: "Google" },
];

function SocialIcon({ id }: { id: SocialProvider }) {
  if (id === "wechat") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M9.5 7.2c-3.7 0-6.7 2.4-6.7 5.4 0 1.7.9 3.2 2.4 4.2l-.6 2.1 2.3-1.2c.8.2 1.6.4 2.4.4.3 0 .5 0 .8 0A4.7 4.7 0 0 1 9.2 16c0-3.2 3.1-5.8 7-6.3-1-1.6-3.3-2.5-6.7-2.5Zm-.9 3.1a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Zm3.7 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8ZM21.2 16c0-2.6-2.6-4.7-5.8-4.7s-5.8 2.1-5.8 4.7 2.6 4.7 5.8 4.7c.6 0 1.2-.1 1.8-.2l1.9 1-.5-1.8c1.6-.8 2.6-2.2 2.6-3.7Zm-7.5-1a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm3.4 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
        />
      </svg>
    );
  }
  if (id === "alipay") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Zm8.1 2.2H8.4V7.4h8.2v1.3h-2.3c.5 1.5 1.3 3.1 2.4 4.7-.7.3-1.4.4-2.2.4-1.3-1.5-2.2-3.2-2.4-4.1ZM7.3 16.4c1.8-.9 3.7-1.5 5.7-1.8 1.5 1.3 3.2 2.3 5.1 2.9l.7-1.3c-1.5-.5-2.9-1.3-4.1-2.3 1.1-.2 2.2-.5 3.2-1l.4-1.3c-2.2.8-4.6 1.2-7.1 1.3-1.3.3-2.6.7-3.9 1.3v2.2Z"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.43Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.62-2.42l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A9.99 9.99 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.12-1.31.31-1.92V7.5H3.07A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.07 4.5l3.34-2.58Z" />
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87C16.95 2.97 14.7 2 12 2A9.99 9.99 0 0 0 3.07 7.5l3.34 2.58C7.2 7.72 9.4 5.96 12 5.96Z" />
    </svg>
  );
}

export function SocialLogin({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: (id: SocialProvider) => void;
}) {
  return (
    <div className="ds-social">
      <p className="ds-social-rule">
        <span>或者</span>
      </p>
      <div className="ds-social-row">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            className="ds-social-btn"
            disabled={disabled}
            onClick={() => onSelect(provider.id)}
          >
            <SocialIcon id={provider.id} />
            {provider.label}
          </button>
        ))}
      </div>
    </div>
  );
}
