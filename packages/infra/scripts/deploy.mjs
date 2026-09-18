import { spawn } from "node:child_process";
import { access, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dbRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../db"
);
const metaDir = path.join(dbRoot, "src/migrations/meta");
const stashDir = path.join(dbRoot, ".drizzle-meta-stash");

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function hideMeta() {
  const hasMeta = await pathExists(metaDir);
  const hasStash = await pathExists(stashDir);

  if (hasStash && hasMeta) {
    await rm(stashDir, { force: true, recursive: true });
  } else if (hasStash) {
    return true;
  }

  if (!hasMeta) {
    return false;
  }

  await rename(metaDir, stashDir);
  return true;
}

async function restoreMeta() {
  if (!(await pathExists(stashDir))) {
    return;
  }

  if (await pathExists(metaDir)) {
    await rm(stashDir, { force: true, recursive: true });
    return;
  }

  await rename(stashDir, metaDir);
}

const hidden = await hideMeta();
const child = spawn("alchemy", ["deploy", "--yes"], {
  stdio: "inherit",
});

try {
  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
  process.exitCode = exitCode;
} finally {
  if (hidden) {
    await restoreMeta();
  }
}
