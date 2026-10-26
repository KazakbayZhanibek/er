import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist", "client");

function git(args, options = {}) {
  const result = execFileSync("git", args, { cwd: root, encoding: "utf8", ...options });
  return typeof result === "string" ? result.trim() : "";
}

for (const file of ["index.html", "media/kompas-bienvenida.mp4", "media/kompas-primer-dia.mp4"]) {
  if (!existsSync(path.join(output, file))) throw new Error(`Missing build file: ${file}. Run npm run build first.`);
}

if (git(["status", "--porcelain"])) {
  throw new Error("Commit or stash source changes before publishing GitHub Pages.");
}

const source = git(["rev-parse", "HEAD"]);
const gitDirectory = git(["rev-parse", "--absolute-git-dir"]);
const remoteRef = git(["ls-remote", "--heads", "origin", "refs/heads/gh-pages"]);
let previous;
if (remoteRef) {
  git(["fetch", "--no-tags", "origin", "refs/heads/gh-pages"]);
  previous = git(["rev-parse", "FETCH_HEAD"]);
}

// Use a separate index so publication never stages or checks out source files.
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "kompas-pages-"));
const environment = { ...process.env, GIT_INDEX_FILE: path.join(temporaryDirectory, "index") };

try {
  writeFileSync(path.join(output, ".nojekyll"), "");
  const buildGit = ["--git-dir", gitDirectory, "--work-tree", output];
  git([...buildGit, "read-tree", "--empty"], { cwd: output, env: environment });
  git([...buildGit, "add", "--all", "--force", "."], { cwd: output, env: environment });
  const tree = git([...buildGit, "write-tree"], { cwd: output, env: environment });
  const parents = previous ? ["-p", previous] : [];
  const commit = git(["commit-tree", tree, ...parents], {
    input: `Deploy Kompas from ${source}\n`,
  });
  // A normal push preserves deployment history and rejects concurrent updates.
  git(["push", "origin", `${commit}:refs/heads/gh-pages`], { stdio: "inherit" });
  console.log("Published the production build to origin/gh-pages.");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
