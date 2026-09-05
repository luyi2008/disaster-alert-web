import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { CircleUser, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./ThemeToggle";
import { getSession, sessionLabel, signOut } from "../auth/session";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={className ?? "app-brand-mark"} aria-hidden="true">
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
          <BrandMark />
          灾害预警
        </Link>
        <div className="shell-top-end">
          <Button asChild variant="ghost" size="sm">
            <NavLink to="/devices">设备管理</NavLink>
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2" aria-label={label}>
                <CircleUser className="size-4" data-icon="account" />
                {label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings />
                  账号设置
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  void signOut().then(() => navigate("/login", { replace: true }));
                }}
              >
                <LogOut />
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
