"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatYen, formatMonth } from "@/lib/format";
import { rememberTargetMonth } from "@/lib/targetMonth";

type Row = {
  employeeId: string;
  name: string;
  bankInfo: string | null;
  netPayment: number;
};

export function TransferList({
  targetMonth,
  rows,
  totalAmount,
  unconfirmedCount,
}: {
  targetMonth: string;
  rows: Row[];
  totalAmount: number;
  unconfirmedCount: number;
}) {
  const router = useRouter();

  function handleMonthChange(month: string) {
    rememberTargetMonth(month);
    router.push(`/payroll/transfer-list?month=${month}`);
  }

  const missingBankInfoCount = rows.filter((r) => !r.bankInfo || !r.bankInfo.trim()).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">対象年月</label>
          <Input
            type="month"
            value={targetMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-48"
          />
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          印刷
        </Button>
      </div>

      <div className="hidden print:block">
        <h1 className="text-lg font-bold">
          {formatMonth(targetMonth)} 振込先一覧
        </h1>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {formatMonth(targetMonth)}に確定済みの給与明細はまだありません。「給与計算確認」画面で明細を確定すると、ここに表示されます。
        </p>
      ) : (
        <>
          {missingBankInfoCount > 0 && (
            <p className="rounded-md border border-warn-field-border bg-warn-field px-3 py-2 text-sm text-warn-text print:hidden">
              振込先情報が未登録の従業員が{missingBankInfoCount}名います(下の一覧で「未登録」と表示されている行)。従業員マスタで登録してください。
            </p>
          )}
          {unconfirmedCount > 0 && (
            <p className="text-xs text-muted-foreground print:hidden">
              ※在籍中の従業員のうち{unconfirmedCount}名は、この対象年月の給与明細がまだ確定されていないため、この一覧には含まれていません。
            </p>
          )}

          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>氏名</TableHead>
                  <TableHead>振込先情報</TableHead>
                  <TableHead className="text-right">差引支給額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const hasBankInfo = !!r.bankInfo && r.bankInfo.trim().length > 0;
                  return (
                    <TableRow key={r.employeeId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="whitespace-pre-line">
                        {hasBankInfo ? (
                          r.bankInfo
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-warn-field-border bg-warn-field text-warn-text"
                          >
                            未登録
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatYen(r.netPayment)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell className="font-bold">合計({rows.length}名)</TableCell>
                  <TableCell />
                  <TableCell className="bg-result-field text-right text-base font-bold tabular-nums">
                    {formatYen(totalAmount)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
