"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";
import { HomeIcon, ChatIcon, SettingsIcon } from "./icons";

// ログイン関連の画面ではアプリ本体のナビは不要なので出さない
const HIDDEN_PATHS = ["/login", "/notion-login-popup", "/notion-logout"];

const NAV_ITEMS = [
  { href: "/", label: "ホーム", Icon: HomeIcon },
  { href: "/chat", label: "トーク", Icon: ChatIcon },
  { href: "/settings", label: "設定", Icon: SettingsIcon },
];

export default function Nav() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.includes(pathname)) return null;

  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const isActive = href === "/" ? pathname === "/" || pathname === "/home" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
          >
            <Icon size={22} color={isActive ? "#e5c158" : "#8b8d99"} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
