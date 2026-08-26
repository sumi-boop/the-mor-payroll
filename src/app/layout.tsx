import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const notoSansJP = localFont({
  src: [
    {
      path: "../../assets/fonts/NotoSansJP-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../assets/fonts/NotoSansJP-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "THE MOR 給与明細作成システム",
  description: "THE MOR 給与明細自動作成Webアプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
