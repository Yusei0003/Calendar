/**
 * テスト実行時に "@/..." の読み替えを有効にする。
 * Next.js は tsconfig の paths を見てくれるが、node 単体では解決できないため。
 */
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = path.resolve(import.meta.dirname, "..", "src");

function resolveAlias(specifier) {
  const base = path.join(SRC, specifier.slice(2));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const resolved = resolveAlias(specifier);
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
