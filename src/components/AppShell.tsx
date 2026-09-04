import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSession, sessionLabel, signOut } from "../auth/session";

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="shell-account-btn" aria-haspopup="menu">
                {label}
                <ChevronDown className="shell-account-caret size-[18px]" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>账号</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to="/settings">账号设置</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void signOut().then(() => navigate("/login", { replace: true }));
                }}
              >
                登出
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
