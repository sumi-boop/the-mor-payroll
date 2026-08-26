// vitest実行時のみ使用するダミー実装。
// "server-only" パッケージは本来Next.jsのバンドラー上でのみ有効な保護機構であり、
// vitest(プレーンなNode実行環境)からは解決できないためテスト用にno-opへ差し替える。
export {};
