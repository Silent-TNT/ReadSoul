"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CloseIcon,
  ExternalIcon,
  RefreshIcon,
  LogoutIcon,
  BookIcon,
  KeyIcon,
  ShieldIcon,
  HeartIcon,
  PaletteIcon,
} from "@/components/icons";
import ThemeToggle from "@/components/ThemeToggle";
import { getWeReadOpenUrl } from "@/lib/wereadOpen";

interface Props {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onLogout: () => void;
}

function DrawerRow({
  icon,
  label,
  onClick,
  href,
  external,
  disabled,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  const inner = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/55">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      {trailing ?? (
        external ? (
          <ExternalIcon className="h-4 w-4 shrink-0 opacity-50" />
        ) : null
      )}
    </>
  );

  const cls =
    "flex w-full items-center justify-between gap-2 rounded-xl border border-transparent px-2 py-2 text-left text-sm text-white/70 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-soul-gold disabled:pointer-events-none disabled:opacity-50";

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className={cls}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} onClick={onClick} className={cls}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

function DonatePanel({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        className="animate-backdrop fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
      />
      <div className="fixed left-1/2 top-1/2 z-[70] w-[min(92vw,340px)] -translate-x-1/2 -translate-y-1/2">
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute -right-1 -top-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition hover:text-white"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
        <Image
          src="/donate-readsoul-v2.png"
          alt="阅己赞赏码"
          width={340}
          height={340}
          className="h-auto w-full rounded-2xl shadow-2xl"
          unoptimized
        />
      </div>
    </>
  );
}

export default function Sidebar({
  open,
  onClose,
  onRefresh,
  refreshing,
  onLogout,
}: Props) {
  const wereadUrl = getWeReadOpenUrl();
  const [donateOpen, setDonateOpen] = useState(false);

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="animate-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-white/10 backdrop-blur-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "var(--c-surface-solid)" }}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <p className="font-serif text-lg font-medium text-soul-cream">设置</p>
          <button
            onClick={onClose}
            aria-label="关闭设置"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/5 hover:text-soul-gold"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          <DrawerRow
            icon={<BookIcon className="h-4 w-4" />}
            label="打开微信读书"
            href={wereadUrl}
            external
            onClick={onClose}
          />

          <DrawerRow
            icon={
              <RefreshIcon
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            }
            label={refreshing ? "正在更新…" : "更新微信读书数据"}
            disabled={refreshing}
            onClick={() => {
              onRefresh();
              onClose();
            }}
          />

          <DrawerRow
            icon={<KeyIcon className="h-4 w-4" />}
            label="获取 API Key"
            href="https://weread.qq.com/r/weread-skills"
            external
            onClick={onClose}
          />

          <DrawerRow
            icon={<LogoutIcon className="h-4 w-4" />}
            label="更换 API Key"
            onClick={() => {
              onLogout();
              onClose();
            }}
          />

          <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-transparent px-2 py-2 text-sm text-white/70">
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/55">
                <PaletteIcon className="h-4 w-4" />
              </span>
              外观主题
            </span>
            <ThemeToggle />
          </div>

          <DrawerRow
            icon={<ShieldIcon className="h-4 w-4" />}
            label="隐私说明"
            href="/privacy"
            onClick={onClose}
          />

          <DrawerRow
            icon={<HeartIcon className="h-4 w-4" />}
            label="打赏支持"
            onClick={() => {
              setDonateOpen(true);
              onClose();
            }}
          />
        </div>

        <div className="border-t border-white/10 p-4">
          <p className="text-center text-[11px] soul-card-sub">
            阅己 ReadSoul · readsoul.cn
          </p>
        </div>
      </aside>

      {donateOpen && <DonatePanel onClose={() => setDonateOpen(false)} />}
    </>
  );
}
