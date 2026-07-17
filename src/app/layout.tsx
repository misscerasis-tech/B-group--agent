import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 内容增长 Agent",
  description: "面向新品品牌和多产品团队的中文 AI 内容增长工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

