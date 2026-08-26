"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formatYen, formatMonth } from "@/lib/format";
import { formatMinutesAsHM } from "@/lib/csv/parseValue";

type Candidate = { id: string; name: string; status: string };

type PreviewRow = {
  rowNumber: number;
  rawName: string;
  normalizedName: string;
  workDays: number | null;
  workMinutes: number | null;
  overtimeMinutes: number | null;
  nightMinutes: number | null;
  hourlyWage: number | null;
  baseSalary: number | null;
  overtimeAllowance: number | null;
  nightAllowance: number | null;
  commuteAllowance: number | null;
  otherAllowance: number | null;
  totalAllowanceCsv: number | null;
  computedTotal: number | null;
  amountMismatch: boolean;
  amountMismatchDiff: number;
  errors: string[];
  isDuplicateName: boolean;
  candidates: Candidate[];
  suggestedEmployeeId: string | null;
  alreadyExistsForMonth: boolean;
};

type Resolution = { type: "existing" | "new" | "skip"; employeeId?: string };

type PreviewResponse = {
  headerValid: boolean;
  headerErrors: string[];
  encoding?: string;
  fileName?: string;
  fileSize?: number;
  targetMonth?: string;
  payDate?: string;
  totalRowCount?: number;
  errorRowCount?: number;
  duplicateNameCount?: number;
  rows: PreviewRow[];
};

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [targetMonth, setTargetMonth] = useState(todayMonth());
  const [payDate, setPayDate] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, Resolution>>({});
  const [mismatchAck, setMismatchAck] = useState<Record<number, boolean>>({});
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<null | {
    created: number;
    updated: number;
    skipped: number;
    conflicts: number;
  }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  async function handleUpload() {
    if (!file) {
      setError("ファイルを選択してください");
      return;
    }
    if (!targetMonth) {
      setError("対象年月を入力してください");
      return;
    }
    if (!payDate) {
      setError("支給日を入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    setPreview(null);
    setCommitResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("targetMonth", targetMonth);
      fd.append("payDate", payDate);
      const res = await fetch("/api/import/preview", { method: "POST", body: fd });
      const data: PreviewResponse & { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "取込プレビューに失敗しました");
        setLoading(false);
        return;
      }
      setPreview(data);
      const initialResolutions: Record<number, Resolution> = {};
      const initialAck: Record<number, boolean> = {};
      for (const row of data.rows) {
        if (row.errors.length > 0 || row.isDuplicateName) {
          initialResolutions[row.rowNumber] = { type: "skip" };
        } else if (row.suggestedEmployeeId) {
          initialResolutions[row.rowNumber] = {
            type: "existing",
            employeeId: row.suggestedEmployeeId,
          };
        } else {
          initialResolutions[row.rowNumber] = { type: "new" };
        }
        initialAck[row.rowNumber] = false;
      }
      setResolutions(initialResolutions);
      setMismatchAck(initialAck);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!preview) return;
    setCommitting(true);
    setError(null);
    try {
      const rows = preview.rows.map((row) => ({
        ...row,
        resolution: resolutions[row.rowNumber] ?? { type: "skip" as const },
        amountMismatchAck: mismatchAck[row.rowNumber] ?? false,
      }));
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMonth: preview.targetMonth,
          payDate: preview.payDate,
          fileName: preview.fileName,
          fileSize: preview.fileSize,
          encoding: preview.encoding,
          rows,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "取込確定に失敗しました");
        return;
      }
      const summary = { created: 0, updated: 0, skipped: 0, conflicts: 0 };
      for (const r of data.results as { status: string }[]) {
        if (r.status === "created") summary.created++;
        else if (r.status === "updated") summary.updated++;
        else if (r.status === "skipped") summary.skipped++;
        else if (r.status === "conflict_confirmed") summary.conflicts++;
      }
      setCommitResult(summary);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setCommitting(false);
    }
  }

  const canCommit =
    preview?.headerValid &&
    Object.values(resolutions).some((r) => r.type !== "skip") &&
    preview.rows.every((row) => {
      const res = resolutions[row.rowNumber];
      if (!res || res.type === "skip") return true;
      if (row.errors.length > 0) return false;
      if (row.amountMismatch && !mismatchAck[row.rowNumber]) return false;
      if (row.isDuplicateName && res.type !== "existing") return false;
      if (res.type === "existing" && !res.employeeId) return false;
      return true;
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>対象年月</Label>
            <Input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>支給日</Label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
        </div>

        <div
          className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
            dragOver ? "border-primary bg-secondary" : "border-border"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="text-sm text-muted-foreground">
            CSVファイルをドラッグ＆ドロップ、またはクリックして選択
          </p>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            ファイルを選択
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="text-sm font-medium text-navy">
              選択中: {file.name} ({Math.ceil(file.size / 1024)} KB)
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={handleUpload} disabled={loading || !file}>
            {loading ? "読み込み中..." : "CSVを読み込んでプレビュー"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {preview && !preview.headerValid && (
        <Alert variant="error">
          <AlertTitle>CSVのヘッダーが不正です</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {preview.headerErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {preview && preview.headerValid && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline">文字コード: {encodingLabel(preview.encoding)}</Badge>
            <Badge variant="outline">対象年月: {formatMonth(preview.targetMonth ?? "")}</Badge>
            <Badge variant="outline">件数: {preview.totalRowCount}件</Badge>
            {!!preview.errorRowCount && (
              <Badge variant="error">エラー行: {preview.errorRowCount}件</Badge>
            )}
            {!!preview.duplicateNameCount && (
              <Badge variant="warn">重複氏名: {preview.duplicateNameCount}組</Badge>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>氏名(CSV)</TableHead>
                  <TableHead>出勤日数</TableHead>
                  <TableHead>労働時間</TableHead>
                  <TableHead>基本給</TableHead>
                  <TableHead>合計(CSV)</TableHead>
                  <TableHead>内訳合計</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>照合先</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => {
                  const res = resolutions[row.rowNumber] ?? { type: "skip" as const };
                  const hasError = row.errors.length > 0;
                  return (
                    <TableRow
                      key={row.rowNumber}
                      className={hasError ? "bg-error-field" : row.isDuplicateName ? "bg-warn-field" : undefined}
                    >
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell className="font-medium">{row.rawName}</TableCell>
                      <TableCell>{row.workDays ?? "-"}</TableCell>
                      <TableCell>
                        {row.workMinutes !== null ? formatMinutesAsHM(row.workMinutes) : "-"}
                      </TableCell>
                      <TableCell>{row.baseSalary !== null ? formatYen(row.baseSalary) : "-"}</TableCell>
                      <TableCell className={row.amountMismatch ? "text-error-text font-semibold" : ""}>
                        {row.totalAllowanceCsv !== null ? formatYen(row.totalAllowanceCsv) : "-"}
                      </TableCell>
                      <TableCell>
                        {row.computedTotal !== null ? formatYen(row.computedTotal) : "-"}
                      </TableCell>
                      <TableCell>
                        {hasError && (
                          <div className="flex flex-col gap-0.5">
                            {row.errors.map((e, i) => (
                              <span key={i} className="text-xs text-error-text">
                                {e}
                              </span>
                            ))}
                          </div>
                        )}
                        {row.isDuplicateName && (
                          <Badge variant="warn">CSV内重複</Badge>
                        )}
                        {row.amountMismatch && (
                          <div className="mt-1 flex flex-col gap-1">
                            <Badge variant="error">支給額不一致(差額{formatYen(row.amountMismatchDiff)})</Badge>
                            <label className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={mismatchAck[row.rowNumber] ?? false}
                                onChange={(e) =>
                                  setMismatchAck((prev) => ({
                                    ...prev,
                                    [row.rowNumber]: e.target.checked,
                                  }))
                                }
                              />
                              確認済み(このまま取り込む)
                            </label>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <ResolutionPicker
                          row={row}
                          resolution={res}
                          onChange={(next) =>
                            setResolutions((prev) => ({ ...prev, [row.rowNumber]: next }))
                          }
                        />
                        {res.type === "existing" &&
                          res.employeeId &&
                          row.candidates.find((c) => c.id === res.employeeId)?.status !==
                            "active" && (
                            <Badge variant="warn" className="mt-1">
                              在籍状況に注意
                            </Badge>
                          )}
                        {res.type === "existing" && row.alreadyExistsForMonth && (
                          <Badge variant="warn" className="mt-1">
                            当月データ既存(上書き)
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {commitResult ? (
            <Alert variant="success">
              <AlertTitle>取込が完了しました</AlertTitle>
              <AlertDescription>
                新規作成 {commitResult.created}件 / 更新 {commitResult.updated}件 / 取込対象外{" "}
                {commitResult.skipped}件
                {commitResult.conflicts > 0 && (
                  <> / 確定済みのため反映できなかったもの {commitResult.conflicts}件(確定解除が必要です)</>
                )}
                <div className="mt-2">
                  <a href="/payroll" className="underline text-primary">
                    給与計算確認画面で確認する →
                  </a>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex justify-end">
              <Button onClick={handleCommit} disabled={!canCommit || committing}>
                {committing ? "取込中..." : "この内容で取り込む"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function encodingLabel(enc?: string) {
  if (enc === "utf-8-bom") return "UTF-8 (BOM付き)";
  if (enc === "shift_jis") return "Shift_JIS";
  if (enc === "utf-8") return "UTF-8";
  return enc ?? "不明";
}

function ResolutionPicker({
  row,
  resolution,
  onChange,
}: {
  row: PreviewRow;
  resolution: Resolution;
  onChange: (r: Resolution) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Select
        value={resolution.type}
        onValueChange={(v) => {
          if (v === "existing") {
            onChange({ type: "existing", employeeId: row.suggestedEmployeeId ?? row.candidates[0]?.id });
          } else {
            onChange({ type: v as "new" | "skip" });
          }
        }}
      >
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="existing">既存従業員に紐付け</SelectItem>
          <SelectItem value="new">新規従業員</SelectItem>
          <SelectItem value="skip">取込対象外</SelectItem>
        </SelectContent>
      </Select>
      {resolution.type === "existing" && (
        <Select
          value={resolution.employeeId ?? ""}
          onValueChange={(v) => onChange({ type: "existing", employeeId: v })}
        >
          <SelectTrigger className="w-40"><SelectValue placeholder="従業員を選択" /></SelectTrigger>
          <SelectContent>
            {row.candidates.length === 0 && (
              <SelectItem value="__none__" disabled>
                候補なし
              </SelectItem>
            )}
            {row.candidates.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
