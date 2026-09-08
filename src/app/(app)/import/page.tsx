import { ImportWizard } from "./import-wizard";

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-navy">CSV取込</h1>
        <p className="text-sm text-muted-foreground">
          人件費CSVをアップロードして、従業員ごとの勤怠・支給データを取り込みます。
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
