export function formatYen(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(amount));
  return `${sign}${abs.toLocaleString("ja-JP")}円`;
}

export function formatMonth(targetMonth: string): string {
  const [y, m] = targetMonth.split("-");
  return `${y}年${m.padStart(2, "0")}月`;
}

export function formatDateJp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
