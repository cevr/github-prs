import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"

interface ExtensionManifest {
  readonly manifest_version: number
  readonly version: string
  readonly description: string
  readonly background: { readonly service_worker: string }
  readonly side_panel: { readonly default_path: string }
  readonly options_page: string
  readonly icons: Readonly<Record<string, string>>
  readonly action: { readonly default_icon: Readonly<Record<string, string>> }
}

interface PackageManifest {
  readonly version: string
}

interface ListingImage {
  readonly path: string
  readonly width: number
  readonly height: number
}

const projectRoot = resolve(import.meta.dir, "..")
const manifest = JSON.parse(
  await readFile(join(projectRoot, "manifest.json"), "utf8"),
) as ExtensionManifest
const packageManifest = JSON.parse(
  await readFile(join(projectRoot, "package.json"), "utf8"),
) as PackageManifest
const zipPath = join(projectRoot, "release", "github-pr-tracker-" + manifest.version + ".zip")

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function listZipEntries(path: string): Promise<ReadonlySet<string>> {
  const command = Bun.spawn(["unzip", "-Z1", path], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "inherit",
  })
  const output = await new Response(command.stdout).text()
  const exitCode = await command.exited
  invariant(exitCode === 0, "Unable to inspect the Chrome Web Store ZIP.")
  return new Set(output.split("\n").filter(Boolean))
}

async function readPngDimensions(path: string) {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer())
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  invariant(bytes.length >= 24, "PNG is empty or truncated: " + path)
  invariant(
    signature.every((value, index) => bytes[index] === value),
    "Listing asset is not a PNG: " + path,
  )
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

invariant(manifest.manifest_version === 3, "Chrome Web Store package must use Manifest V3.")
invariant(manifest.version === packageManifest.version, "Manifest and package versions differ.")
invariant(manifest.description.length <= 132, "Manifest description exceeds 132 characters.")

const entries = await listZipEntries(zipPath)
const requiredEntries: string[] = [
  "manifest.json",
  manifest.background.service_worker,
  manifest.side_panel.default_path,
  manifest.options_page,
]
for (const path of Object.values(manifest.icons)) requiredEntries.push(path)
for (const path of Object.values(manifest.action.default_icon)) requiredEntries.push(path)
for (const path of new Set(requiredEntries)) {
  invariant(entries.has(path), "Chrome Web Store ZIP is missing: " + path)
}
for (const entry of entries) {
  invariant(!entry.startsWith("/") && !entry.includes(".."), "Unsafe ZIP entry: " + entry)
  invariant(
    entry === "manifest.json" || entry.startsWith("dist/") || entry.startsWith("icons/"),
    "Unexpected file in Chrome Web Store ZIP: " + entry,
  )
}

const listingImages: readonly ListingImage[] = [
  { path: "store/assets/settings-1280x800.png", width: 1280, height: 800 },
  { path: "store/assets/privacy-controls-1280x800.png", width: 1280, height: 800 },
  { path: "store/assets/sidepanel-640x400.png", width: 640, height: 400 },
  { path: "store/assets/promo-440x280.png", width: 440, height: 280 },
]

await Promise.all(
  listingImages.map(async (image) => {
    const actual = await readPngDimensions(join(projectRoot, image.path))
    invariant(
      actual.width === image.width && actual.height === image.height,
      image.path +
        " must be " +
        image.width +
        "x" +
        image.height +
        ", received " +
        actual.width +
        "x" +
        actual.height +
        ".",
    )
  }),
)

console.log(
  "Marketplace release validated: " +
    manifest.version +
    ", " +
    entries.size +
    " ZIP entries, " +
    listingImages.length +
    " listing images.",
)
