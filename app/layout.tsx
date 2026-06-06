import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/hooks/useTheme";
import { ToastProvider } from "@/components/Toast";
import SentryInit from "@/components/SentryInit";

export const metadata: Metadata = {
  title: "阅己 ReadSoul · 见人阅己",
  description:
    "连接微信读书，把阅读绘成可凝视、可分享的灵魂图谱。见人阅己。",
  keywords: ["阅己", "ReadSoul", "微信读书", "阅读数据", "可视化", "阅读报告"],
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "阅己 ReadSoul · 见人阅己",
    description:
      "连接微信读书，把阅读绘成可凝视、可分享的灵魂图谱。",
    url: "https://readsoul.cn",
    siteName: "阅己 ReadSoul",
    locale: "zh_CN",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0f",
};

// 在首屏渲染前根据 localStorage 设置主题，避免闪烁
const themeInitScript = `(function(){try{var t=localStorage.getItem('readsoul_theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <ToastProvider>
            <SentryInit />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
