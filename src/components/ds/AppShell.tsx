import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { clearAccount, readAccount } from "../../auth/session";

export function AppShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const account = readAccount();

  useEffect(() => {
    if (!account) {
      navigate("/login", { replace: true });
    }
  }, [account, navigate]);

  if (!account) {
    return null;
  }

  return (
    <div className="app-shell">
      <header className="shell-top">
        <Link className="shell-brand" to="/devices">
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
          Disaster Alert
        </Link>
        <div className="shell-account">
          <button
            type="button"
            className="shell-account-btn"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {account.label}
            <span aria-hidden="true"> ▾</span>
          </button>
          {menuOpen ? (
            <div className="shell-menu" role="menu">
              <p className="shell-menu-label">Account</p>
              <p className="shell-menu-item is-static">Settings</p>
              <button
                type="button"
                className="shell-menu-item"
                onClick={() => {
                  clearAccount();
                  navigate("/login", { replace: true });
                }}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <div className="shell-body">
        <nav className="shell-nav" aria-label="Primary">
          <NavLink to="/devices" className={({ isActive }) => `shell-nav-link${isActive ? " is-active" : ""}`}>
            Devices
          </NavLink>
        </nav>
        <main className="shell-main">
          <div className="shell-pagehead">
            <div>
              <h1>{title}</h1>
              {description ? <p>{description}</p> : null}
            </div>
            {action}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Toast({
  kind,
  children,
}: {
  kind: "success" | "error" | "info";
  children: ReactNode;
}) {
  return (
    <div className={`ds-toast is-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
