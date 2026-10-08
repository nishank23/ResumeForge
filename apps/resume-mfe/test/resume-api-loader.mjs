import { readFileSync } from "node:fs";
import ts from "typescript";
export async function loadResumeApi() {
  const source = new URL("../src/resume-api.ts", import.meta.url);
  const compiled = ts
    .transpileModule(readFileSync(source, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
    })
    .outputText.replace(
      /from "([^"]+)"/g,
      (_match, s) =>
        `from "${s.startsWith(".") ? new URL(`${s}.ts`, source).href : import.meta.resolve(s)}"`,
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );
}
