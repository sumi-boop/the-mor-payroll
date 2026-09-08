import { prisma } from "@/lib/db";
import { formatMonth, formatDateJp, formatYen } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export default async function HistoryPage() {
  const [imports, confirmedRecords, auditLogs] = await Promise.all([
    prisma.payrollImport.findMany({
      include: { importedBy: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.payrollRecord.findMany({
      where: { isConfirmed: true },
      include: { employee: true, confirmedBy: true },
      orderBy: { confirmedAt: "desc" },
      take: 30,
    }),
    prisma.auditLog.findMany({
      where: { action: { in: ["payroll_confirm", "payroll_unconfirm", "csv_import"] } },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-navy">履歴</h1>
        <p className="text-sm text-muted-foreground">
          CSV取込履歴・給与明細の確定履歴・修正履歴を確認できます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV取込履歴</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>取込日時</TableHead>
                <TableHead>対象年月</TableHead>
                <TableHead>ファイル名</TableHead>
                <TableHead>文字コード</TableHead>
                <TableHead>件数</TableHead>
                <TableHead>支給日</TableHead>
                <TableHead>担当者</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((imp) => (
                <TableRow key={imp.id}>
                  <TableCell>{formatDateJp(imp.createdAt)}</TableCell>
                  <TableCell>{formatMonth(imp.targetMonth)}</TableCell>
                  <TableCell>{imp.fileName}</TableCell>
                  <TableCell>{imp.encoding}</TableCell>
                  <TableCell>{imp.rowCount}件</TableCell>
                  <TableCell>{formatDateJp(imp.payDate)}</TableCell>
                  <TableCell>{imp.importedBy.name}</TableCell>
                </TableRow>
              ))}
              {imports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    取込履歴はありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>確定済み給与明細</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>対象年月</TableHead>
                <TableHead>氏名</TableHead>
                <TableHead>差引支給額</TableHead>
                <TableHead>確定日時</TableHead>
                <TableHead>確定担当者</TableHead>
                <TableHead>PDF作成日時</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {confirmedRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatMonth(r.targetMonth)}</TableCell>
                  <TableCell className="font-medium">{r.employee.name}</TableCell>
                  <TableCell className="tabular-nums">{formatYen(r.netPayment)}</TableCell>
                  <TableCell>{r.confirmedAt ? formatDateJp(r.confirmedAt) : "-"}</TableCell>
                  <TableCell>{r.confirmedBy?.name ?? "-"}</TableCell>
                  <TableCell>{r.pdfGeneratedAt ? formatDateJp(r.pdfGeneratedAt) : "未作成"}</TableCell>
                </TableRow>
              ))}
              {confirmedRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    確定済みの明細はありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>操作履歴(監査ログ)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>担当者</TableHead>
                <TableHead>詳細</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateJp(log.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{actionLabel(log.action)}</Badge>
                  </TableCell>
                  <TableCell>{log.user?.name ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{log.detail ?? "-"}</TableCell>
                </TableRow>
              ))}
              {auditLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    履歴はありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    payroll_confirm: "給与明細確定",
    payroll_unconfirm: "確定解除",
    csv_import: "CSV取込",
  };
  return labels[action] ?? action;
}
