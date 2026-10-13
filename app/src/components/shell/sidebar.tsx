"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Home, CalendarDays, FileAudio, Users, CircleDollarSign, ShieldPlus, ClipboardList, FileText, MessageSquare,
  BarChart3, Video, Mic, ShieldCheck, Settings, Plus, Search, PanelLeftClose, PanelLeftOpen, ChevronRight,
  User, Monitor, PenLine, Upload, Phone, CalendarPlus, LogOut, ChevronDown,
} from "lucide-react";
import { Logo } from "../logo";
import { cn } from "../ui";
import { logout } from "@/app/(auth)/actions";

const MAIN = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/sessions", label: "Sessions", icon: FileAudio },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/billing", label: "Payments", icon: CircleDollarSign },
  { href: "/insurance", label: "Insurance", icon: ShieldPlus },
  { href: "/forms", label: "Practice forms", icon: ClipboardList },
  { href: "/templates", label: "Note templates", icon: FileText },
  { href: "/inbox", label: "Messaging", icon: MessageSquare, badge: "unread" as const },
  { href: "/reports", label: "Reports", icon: BarChart3, tag: "Beta" },
];

const TOOLS = [
  { href: "/telehealth", label: "Telehealth", icon: Video },
  { href: "/capture", label: "Session capture", icon: Mic },
  { href: "/compliance", label: "Compliance checker", icon: ShieldCheck },
];

const NEW_SESSION = [
  { group: "Session capture" },
  { href: "/capture/record?mode=IN_PERSON", label: "In-person", icon: User },
  { href: "/capture/record?mode=VIRTUAL", label: "Virtual", icon: Monitor },
  { group: "Note from past session" },
  { href: "/capture/write", label: "Write or dictate", icon: PenLine },
  { href: "/capture/upload", label: "Upload recording", icon: Upload },
  { group: "Telehealth" },
  { href: "/telehealth", label: "Start call", icon: Phone },
  { group: "Calendar" },
  { href: "/calendar?new=1", label: "Schedule", icon: CalendarPlus },
] as const;

export function Sidebar({ user, practiceName, unreadMessages }: { user: { name: string; role: string; email: string }; practiceName: string; unreadMessages: number }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(true);
  const newRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);
  useEffect(() => {
    setNewOpen(false);
    setUserOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!newOpen) return;
    const close = (e: MouseEvent) => !newRef.current?.contains(e.target as Node) && setNewOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [newOpen]);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  };
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const item = (n: { href: string; label: string; icon: typeof Home; tag?: string; badge?: "unread" }) => (
    <Link
      key={n.href}
      href={n.href}
      title={collapsed ? n.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors",
        isActive(n.href) ? "bg-sidebar-active text-white" : "text-white/75 hover:bg-sidebar-hover hover:text-white",
        collapsed && "justify-center px-0",
      )}
    >
      <n.icon className="size-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
      {!collapsed && n.tag && <span className="rounded border border-brand-400/50 px-1.5 text-[11px] text-brand-200">{n.tag}</span>}
      {!collapsed && n.badge === "unread" && unreadMessages > 0 && (
        <span className="rounded-full bg-brand-500 px-1.5 text-[11px] text-white">{unreadMessages}</span>
      )}
    </Link>
  );

  return (
    <aside className={cn("no-print flex shrink-0 flex-col bg-sidebar text-white transition-[width]", collapsed ? "w-[68px]" : "w-64")}>
      <div className={cn("flex h-14 items-center border-b border-white/10 px-4", collapsed ? "justify-center" : "justify-between")}>
        <Link href="/home">
          <Logo light compact={collapsed} />
        </Link>
        {!collapsed && (
          <button onClick={toggle} className="rounded p-1 text-white/60 hover:bg-sidebar-hover hover:text-white" aria-label="Collapse sidebar">
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <div className="space-y-2 px-3 pt-4">
        <div className="relative" ref={newRef}>
          <button
            onClick={() => setNewOpen((o) => !o)}
            className={cn("flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 font-medium text-white hover:bg-brand-400", collapsed && "px-0")}
          >
            <Plus className="size-4" />
            {!collapsed && "New session"}
          </button>
          {newOpen && (
            <div className="absolute left-0 top-11 z-50 w-60 rounded-xl border border-line bg-white py-2 text-ink shadow-xl">
              {NEW_SESSION.map((n, i) =>
                "group" in n ? (
                  <div key={i} className="px-4 pb-1 pt-2 text-xs font-medium text-muted">
                    {n.group}
                  </div>
                ) : (
                  <Link key={i} href={n.href} className="flex items-center gap-3 px-4 py-2 text-sm font-medium hover:bg-canvas">
                    <n.icon className="size-4 text-brand-700" />
                    {n.label}
                  </Link>
                ),
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event("open-search"))}
          className={cn("flex h-9 w-full items-center gap-2 rounded-lg border border-white/15 px-3 text-sm text-white/70 hover:bg-sidebar-hover", collapsed && "justify-center px-0")}
        >
          <Search className="size-4" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search</span>
              <kbd className="rounded bg-white/10 px-1.5 text-[11px]">Ctrl K</kbd>
            </>
          )}
        </button>
      </div>

      <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {MAIN.map(item)}
        <div className="my-3 border-t border-white/10" />
        {!collapsed && (
          <button onClick={() => setToolsOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/45">
            Tools <ChevronDown className={cn("size-3 transition-transform", !toolsOpen && "-rotate-90")} />
          </button>
        )}
        {(toolsOpen || collapsed) && TOOLS.map(item)}
        <div className="my-3 border-t border-white/10" />
        {item({ href: "/settings", label: "Settings", icon: Settings })}
      </nav>

      <div className="relative border-t border-white/10 p-3">
        {collapsed ? (
          <button onClick={toggle} className="flex w-full justify-center rounded p-2 text-white/60 hover:bg-sidebar-hover" aria-label="Expand sidebar">
            <PanelLeftOpen className="size-4" />
          </button>
        ) : (
          <>
            <button onClick={() => setUserOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-left hover:bg-sidebar-hover">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold">
                {user.name
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-xs text-white/55">{practiceName}</span>
              </span>
              <ChevronRight className="size-4 text-white/50" />
            </button>
            {userOpen && (
              <div className="absolute bottom-16 left-3 right-3 z-50 rounded-xl border border-line bg-white py-1 text-ink shadow-xl">
                <div className="border-b border-line px-4 py-2 text-xs text-muted">{user.email}</div>
                <Link href="/settings/profile" className="block px-4 py-2 text-sm hover:bg-canvas">
                  My profile
                </Link>
                <Link href="/settings/ai" className="block px-4 py-2 text-sm hover:bg-canvas">
                  AI providers
                </Link>
                <form action={logout}>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-canvas">
                    <LogOut className="size-4" /> Log out
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
