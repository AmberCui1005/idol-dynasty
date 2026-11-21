#!/usr/bin/env node
/**
 * 纯静态构建（Cloudflare Pages / 任意静态托管）。
 *
 * 设置 `CF_STATIC=1` 后 `vite.config.ts` 会把 TanStack Start 切到 SPA 模式、
 * 跳过 nitro（vercel preset）服务端产物，最终产出 dist/client 下的一套静态文件。
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");

const child = spawn(process.execPath, [viteBin, "build"], {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env, CF_STATIC: "1" },
});

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error("[build-static]", err.message);
  process.exit(1);
});
