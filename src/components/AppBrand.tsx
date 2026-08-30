type AppBrandProps = {
  as?: "header" | "div";
};

export function AppBrand({ as = "header" }: AppBrandProps) {
  const Tag = as;
  return (
    <Tag className="app-brand">
      <span className="app-brand-mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 12h3.2l2.4 7 4.8-14 2.4 7H21"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h1>灾害预警</h1>
    </Tag>
  );
}
