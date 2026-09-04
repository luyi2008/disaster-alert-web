import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { getSession, sessionLabel, signOut } from "../../auth/session";

function AccountCaret() {
  return (
    <svg className="shell-account-caret" width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M3.2 5.2a1 1 0 0 1 1.4 0L8 8.6l3.4-3.4a1 1 0 1 1 1.4 1.4L8.7 10.7a1 1 0 0 1-1.4 0L3.2 6.6a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

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
  const [label, setLabel] = useState("账号");

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((session) => {
        if (!cancelled) {
          setLabel(sessionLabel(session));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLabel("账号");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          灾害预警
        </Link>
        <div className="shell-top-end">
          <NavLink
            to="/devices"
            className={({ isActive }) => `shell-top-link${isActive ? " is-active" : ""}`}
          >
            设备管理
          </NavLink>
          <span className="shell-top-rule" aria-hidden="true" />
          <div className="shell-account">
            <button
              type="button"
              className="shell-account-btn"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {label}
              <AccountCaret />
            </button>
            {menuOpen ? (
              <div className="shell-menu" role="menu">
                <p className="shell-menu-label">账号</p>
                <Link className="shell-menu-item" to="/settings" role="menuitem">
                  账号设置
                </Link>
                <button
                  type="button"
                  className="shell-menu-item"
                  role="menuitem"
                  onClick={() => {
                    void signOut().then(() => navigate("/login", { replace: true }));
                  }}
                >
                  登出
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
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
