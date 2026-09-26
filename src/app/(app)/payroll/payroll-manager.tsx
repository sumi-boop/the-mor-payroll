"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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

type Warning = { code: string; message: string; severity: "error" | "warning" };

type Item = {
  record: {
    id: string;
    employeeId: string;
    targetMonth: string;
    workDays: number;
    workMinutes: number;
    overtimeMinutes: number;
    nightMinutes: number;
    baseSalary: number;
    overtimeAllowance: number;
    nightAllowance: number;
    commuteAllowance: number;
    otherAllowance: number;
    totalPayment: number;
    isConfirmed: boolean;
    remarks: string | null;
    employee: { id: string; name: string };
  };
  effectiveDeduction: {
    healthInsurance: number;
    careInsurance: number;
    pensionInsurance: number;
    employmentInsurance: number;
    incomeTax: number;
    residentTax: number;
    otherDeduction: number;
  };
  totalDeduction: number;
  netPayment: number;
  warnings: Warning[];
};

export function PayrollManager({ initialMonth }: { initialMonth: string }) {
  const router = useRouter();
  const [targetMonth, setTargetMonth] = useState(initialMonth);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [zipDialogOpen, setZipDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/payroll?targetMonth=${targetMonth}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setSelected(new Set());
    setLoading(false);
  }

  useEffect(() => {
    // 対象年月が変わるたびにサーバーから最新の給与データを取得する
    // (データ取得のためのEffectであり、意図的な同期的setStateである)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMonth]);

  const summary = useMemo(() => {
    const totalPayment = items.reduce((s, i) => s + i.record.totalPayment, 0);
    const totalDeduction = items.reduce((s, i) => s + i.totalDeduction, 0);
    const netPayment = items.reduce((s, i) => s + i.netPayment, 0);
    const errorCount = items.filter((i) => i.warnings.some((w) => w.severity === "error")).length;
    const unconfirmedCount = items.filter((i) => !i.record.isConfirmed).length;
    return { totalPayment, totalDeduction, netPayment, errorCount, unconfirmedCount };
  }, [items]);

  const selectableIds = items
    .filter((i) => !i.record.isConfirmed && !i.warnings.some((w) => w.severity === "error"))
    .map((i) => i.record.id);

  function toggleSelectAll() {
    if (selected.size === selectableIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasUnconfirmedWarnings = items.some(
    (i) => selected.has(i.record.id) && i.warnings.some((w) => w.severity === "warning")
  );

  async function doConfirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/payroll/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordIds: [...selected] }),
      });
      const data = await res.json();
      const confirmed = (data.results ?? []).filter((r: { status: string }) => r.status === "confirmed").length;
      const blocked = (data.results ?? []).filter((r: { status: string }) => r.status === "blocked").length;
      setMessage(`${confirmed}件を確定しました${blocked ? `(${blocked}件はエラーのため確定できませんでした)` : ""}`);
      setConfirmDialogOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doUnconfirm(recordId: string) {
    setBusy(true);
    try {
      await fetch("/api/payroll/unconfirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(recordId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/payroll/${recordId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "削除に失敗しました");
        return;
      }
      setMessage("削除しました");
      setDeleteTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(recordId: string) {
    const res = await fetch(`/api/pdf/${recordId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "PDF作成に失敗しました");
      return;
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename\*=UTF-8''(.+)$/.exec(disposition);
    const fileName = match ? decodeURIComponent(match[1]) : "payslip.pdf";
    triggerDownload(blob, fileName);
  }

  async function downloadZip() {
    setBusy(true);
    try {
      const res = await fetch("/api/pdf/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMonth }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "ZIP作成に失敗しました");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename\*=UTF-8''(.+)$/.exec(disposition);
      const fileName = match ? decodeURIComponent(match[1]) : "payslips.zip";
      triggerDownload(blob, fileName);
      setZipDialogOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const confirmedCount = items.filter((i) => i.record.isConfirmed).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">対象年月</label>
          <Input
            type="month"
            value={targetMonth}
            onChange={(e) => {
              setTargetMonth(e.target.value);
              rememberTargetMonth(e.target.value);
              router.replace(`/payroll?month=${e.target.value}`);
            }}
            className="w-48"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => setConfirmDialogOpen(true)}
          >
            選択した明細を確定 ({selected.size}件)
          </Button>
          <Button disabled={confirmedCount === 0} onClick={() => setZipDialogOpen(true)}>
            全員分をZIPでダウンロード
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="従業員数" value={`${items.length}人`} />
        <SummaryCard label="総支給額" value={formatYen(summary.totalPayment)} variant="result" />
        <SummaryCard label="控除合計" value={formatYen(summary.totalDeduction)} variant="result" />
        <SummaryCard label="差引支給額合計" value={formatYen(summary.netPayment)} variant="result" />
      </div>
      <div className="flex gap-3">
        {summary.errorCount > 0 && (
          <Badge variant="error">エラーあり: {summary.errorCount}件</Badge>
        )}
        {summary.unconfirmedCount > 0 && (
          <Badge variant="warn">未確定: {summary.unconfirmedCount}件</Badge>
        )}
      </div>

      {message && (
        <div className="rounded-md border border-border bg-secondary p-3 text-sm">{message}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox
                  checked={selectableIds.length > 0 && selected.size === selectableIds.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>氏名</TableHead>
              <TableHead>出勤日数</TableHead>
              <TableHead>総支給額</TableHead>
              <TableHead>控除合計</TableHead>
              <TableHead>差引支給額</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  読み込み中...
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  この月のデータがありません。CSV取込を行ってください。
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => {
              const errorWarnings = item.warnings.filter((w) => w.severity === "error");
              const softWarnings = item.warnings.filter((w) => w.severity === "warning");
              const rowClass = errorWarnings.length
                ? "bg-error-field"
                : softWarnings.length
                ? "bg-warn-field"
                : item.record.isConfirmed
                ? "bg-result-field"
                : undefined;
              return (
                <TableRow key={item.record.id} className={rowClass}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(item.record.id)}
                      disabled={item.record.isConfirmed || errorWarnings.length > 0}
                      onCheckedChange={() => toggleSelect(item.record.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{item.record.employee.name}</TableCell>
                  <TableCell>{item.record.workDays}日</TableCell>
                  <TableCell className="tabular-nums">{formatYen(item.record.totalPayment)}</TableCell>
                  <TableCell className="tabular-nums">{formatYen(item.totalDeduction)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {formatYen(item.netPayment)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {item.record.isConfirmed ? (
                        <Badge variant="success">確定済み</Badge>
                      ) : (
                        <Badge variant="secondary">未確定</Badge>
                      )}
                      {errorWarnings.map((w) => (
                        <Badge key={w.code} variant="error">
                          {w.message}
                        </Badge>
                      ))}
                      {softWarnings.map((w) => (
                        <Badge key={w.code} variant="warn">
                          {w.message}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {item.record.isConfirmed ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => downloadPdf(item.record.id)}>
                            PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => doUnconfirm(item.record.id)}
                          >
                            確定解除
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground">確定後にPDF作成可能</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={busy}
                            onClick={() => setDeleteTarget(item)}
                          >
                            削除
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>給与明細の確定確認</DialogTitle>
            <DialogDescription>
              選択した{selected.size}件の給与明細を確定します。確定後は「確定解除」を行わないと修正できません。
            </DialogDescription>
          </DialogHeader>
          {hasUnconfirmedWarnings && (
            <div className="rounded-md border border-warn-field-border bg-warn-field p-3 text-sm text-warn-text">
              未確認の項目(住民税・社会保険料・所得税など)が含まれる明細があります。内容を確認の上、確定してください。
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={doConfirm} disabled={busy}>
              {busy ? "確定中..." : "確定する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={zipDialogOpen} onOpenChange={setZipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>一括PDF作成の確認</DialogTitle>
            <DialogDescription>
              {formatMonth(targetMonth)}の確定済み明細 {confirmedCount}件をZIPファイルとしてダウンロードします。
            </DialogDescription>
          </DialogHeader>
          {summary.unconfirmedCount > 0 && (
            <div className="rounded-md border border-warn-field-border bg-warn-field p-3 text-sm text-warn-text">
              未確定の明細が{summary.unconfirmedCount}件あります。これらはZIPに含まれません。
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setZipDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={downloadZip} disabled={busy}>
              {busy ? "作成中..." : "ダウンロード"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>給与明細の削除確認</DialogTitle>
            <DialogDescription>
              {deleteTarget?.record.employee.name}さんの{formatMonth(targetMonth)}分の給与明細を削除します。
              CSV取込を間違えた場合などに使用してください。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => deleteTarget && doDelete(deleteTarget.record.id)}
            >
              {busy ? "削除中..." : "削除する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "result";
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        variant === "result"
          ? "border-result-field-border bg-result-field"
          : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-navy">{value}</p>
    </div>
  );
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
