import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

function parseObject(source: string, label: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(source)
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(label + " must contain a JSON object.")
  }
  return Object.fromEntries(Object.entries(parsed))
}

export function synchronizeManifestVersion(packageSource: string, manifestSource: string): string {
  const packageManifest = parseObject(packageSource, "package.json")
  const extensionManifest = parseObject(manifestSource, "manifest.json")
  const version = packageManifest["version"]
  if (typeof version !== "string" || version.length === 0) {
    throw new Error("package.json must contain a non-empty version.")
  }

  extensionManifest["version"] = version
  return JSON.stringify(extensionManifest, undefined, 2) + "\n"
}

if (import.meta.main) {
  const projectRoot = resolve(import.meta.dir, "..")
  const packagePath = join(projectRoot, "package.json")
  const manifestPath = join(projectRoot, "manifest.json")
  const [packageSource, manifestSource] = await Promise.all([
    readFile(packagePath, "utf8"),
    readFile(manifestPath, "utf8"),
  ])
  await writeFile(manifestPath, synchronizeManifestVersion(packageSource, manifestSource))
  console.log("Synchronized manifest.json to package version.")
}
