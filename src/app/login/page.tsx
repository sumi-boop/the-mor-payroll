import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-navy p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-navy">THE MOR</h1>
          <p className="mt-1 text-sm text-muted-foreground">給与明細自動作成システム</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
