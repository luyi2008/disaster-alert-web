import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { CircleUser, LogOut, Settings } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
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
          <NavigationMenu viewport={false}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <NavLink to="/devices">设备管理</NavLink>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="gap-2">
                  <CircleUser className="size-4" data-icon="account" />
                  {label}
                </NavigationMenuTrigger>
                <NavigationMenuContent className="left-auto right-0">
                  <ul className="grid w-[200px]">
                    <li>
                      <NavigationMenuLink asChild className="flex flex-row items-center gap-2 p-2">
                        <Link to="/settings">
                          <Settings />
                          账号设置
                        </Link>
                      </NavigationMenuLink>
                      <NavigationMenuLink asChild className="flex w-full flex-row items-center gap-2 p-2">
                        <button
                          type="button"
                          onClick={() => {
                            void signOut().then(() => navigate("/login", { replace: true }));
                          }}
                        >
                          <LogOut />
                          登出
                        </button>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
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
