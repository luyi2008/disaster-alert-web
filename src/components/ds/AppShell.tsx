import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { getSession, sessionLabel, signOut } from "../../auth/session";

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
        <div className="shell-account">
          <button
            type="button"
            className="shell-account-btn"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {label}
            <span aria-hidden="true"> ▾</span>
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
      </header>
      <div className="shell-body">
        <nav className="shell-nav" aria-label="主导航">
          <NavLink to="/devices" end className={({ isActive }) => `shell-nav-link${isActive ? " is-active" : ""}`}>
            设备
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `shell-nav-link${isActive ? " is-active" : ""}`}>
            账号设置
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
