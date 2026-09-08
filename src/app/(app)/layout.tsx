import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { LogoutButton } from "./logout-button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/import", label: "CSV取込" },
  { href: "/payroll", label: "給与計算確認" },
  { href: "/payroll/transfer-list", label: "振込先一覧" },
  { href: "/deductions", label: "月別控除設定" },
  { href: "/employees", label: "従業員マスタ" },
  { href: "/history", label: "履歴" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-navy text-navy-foreground print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold tracking-wide">
              THE MOR
              <span className="ml-2 text-xs font-normal opacity-80">
                給与明細自動作成システム
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="opacity-90">{session.name} さん</span>
            <LogoutButton />
          </div>
        </div>
        <nav className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-t-md px-3 py-2 text-sm text-navy-foreground/90 hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border bg-card px-4 py-3 text-center text-xs text-muted-foreground print:hidden">
        THE MOR 給与明細自動作成システム
      </footer>
    </div>
  );
}
