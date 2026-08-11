import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const forbiddenTrackedPaths = [
  { id: "local-data", pattern: /^(?:\.data|work|outputs)\// },
  { id: "environment-file", pattern: /^(?:.*\/)?\.env(?!\.example$)/ },
  { id: "codex-auth", pattern: /(?:^|\/)(?:auth\.json|bridge-token)$/ },
];

const contentRules = [
  { id: "private-key", pattern: new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?PRIVATE KEY-----"].join(""), "g") },
  { id: "openai-style-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { id: "github-token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g },
  { id: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { id: "absolute-user-path", pattern: /(?:\/Users\/[^/\s"']+|\/home\/[^/\s"']+|[A-Za-z]:\\Users\\[^\\\s"']+)/g },
];

function lineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

export async function scanTrackedFiles(projectRoot) {
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], { cwd: projectRoot, encoding: "utf8" });
  const files = stdout.split("\0").filter(Boolean);
  const findings = [];

  for (const relativePath of files) {
    const normalized = relativePath.replaceAll("\\", "/");
    for (const rule of forbiddenTrackedPaths) {
      if (rule.pattern.test(normalized)) findings.push({ file: normalized, line: 1, rule: rule.id });
    }

    const buffer = await readFile(path.join(projectRoot, relativePath));
    if (buffer.includes(0)) continue;
    const content = buffer.toString("utf8");
    for (const rule of contentRules) {
      rule.pattern.lastIndex = 0;
      for (const match of content.matchAll(rule.pattern)) {
        findings.push({ file: normalized, line: lineNumber(content, match.index ?? 0), rule: rule.id });
      }
    }
  }
  return { filesScanned: files.length, findings };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const report = await scanTrackedFiles(projectRoot);
  if (report.findings.length) {
    process.stderr.write(`隐私扫描失败，共发现 ${report.findings.length} 项：\n`);
    for (const finding of report.findings) {
      process.stderr.write(`- ${finding.file}:${finding.line} [${finding.rule}]\n`);
    }
    process.exitCode = 1;
  } else {
    process.stdout.write(`隐私扫描通过：已检查 ${report.filesScanned} 个 Git 跟踪文件，未发现密钥、认证文件、本机数据或用户绝对路径。\n`);
  }
}

