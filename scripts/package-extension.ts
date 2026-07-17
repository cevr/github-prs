import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"

interface ExtensionManifest {
  readonly version: string
  readonly background: { readonly service_worker: string }
  readonly side_panel: { readonly default_path: string }
  readonly chrome_url_overrides: { readonly newtab: string }
  readonly options_page: string
  readonly icons: Readonly<Record<string, string>>
  readonly action: { readonly default_icon: Readonly<Record<string, string>> }
}

const projectRoot = resolve(import.meta.dir, "..")
const manifest = JSON.parse(
  await readFile(join(projectRoot, "manifest.json"), "utf8"),
) as ExtensionManifest
const releaseDirectory = join(projectRoot, "release")
const output = join(releaseDirectory, "github-pr-tracker-" + manifest.version + ".zip")
const stagingDirectory = await mkdtemp(join(tmpdir(), "github-pr-tracker-"))

async function run(command: readonly string[], cwd: string) {
  const process = Bun.spawn(Array.from(command), { cwd, stdout: "inherit", stderr: "inherit" })
  const exitCode = await process.exited
  if (exitCode !== 0) throw new Error(command[0] + " exited with code " + exitCode + ".")
}

try {
  await mkdir(join(stagingDirectory, "icons"), { recursive: true })
  await cp(join(projectRoot, "manifest.json"), join(stagingDirectory, "manifest.json"))
  await cp(join(projectRoot, "dist"), join(stagingDirectory, "dist"), { recursive: true })

  const iconPaths = new Set<string>()
  for (const path of Object.values(manifest.icons)) iconPaths.add(path)
  for (const path of Object.values(manifest.action.default_icon)) iconPaths.add(path)
  await Promise.all(
    Array.from(iconPaths, (iconPath) =>
      cp(join(projectRoot, iconPath), join(stagingDirectory, iconPath)),
    ),
  )

  const requiredPaths: string[] = [
    manifest.background.service_worker,
    manifest.side_panel.default_path,
    manifest.chrome_url_overrides.newtab,
    manifest.options_page,
  ]
  for (const path of iconPaths) requiredPaths.push(path)
  await Promise.all(
    requiredPaths.map(async (path) => {
      const file = Bun.file(join(stagingDirectory, path))
      if (!(await file.exists()) || file.size === 0) {
        throw new Error("Packaged manifest target is missing or empty: " + path)
      }
    }),
  )

  await mkdir(releaseDirectory, { recursive: true })
  await rm(output, { force: true })
  await run(["zip", "-q", "-r", output, "."], stagingDirectory)
  await run(["unzip", "-t", output], projectRoot)
  console.log("Chrome Web Store package: release/" + basename(output))
} finally {
  await rm(stagingDirectory, { force: true, recursive: true })
}
