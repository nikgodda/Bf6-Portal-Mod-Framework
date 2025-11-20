import chokidar from "chokidar"
import path from "path"

async function loadMerge() {
  // Cast to ANY to avoid TS export type errors
  const mod: any = await import("../merger/merge.js")
  const mergeFn = mod.default ?? mod.merge

  if (!mergeFn) {
    console.error("ERROR: merge.js does not export a merge function")
    return null
  }

  return mergeFn
}

export default async function run(args: string[]) {
  const cmd = args[0]

  // --------------------------------------------------
  // build
  // --------------------------------------------------
  if (cmd === "build") {
    const mergeFn = await loadMerge()
    if (mergeFn) await mergeFn()
    return
  }

  // --------------------------------------------------
  // update-sdk
  // --------------------------------------------------
  if (cmd === "update-sdk") {
    await import("../scripts/update-sdk.js")  // auto-run on import
    return
  }

  // --------------------------------------------------
  // watch
  // --------------------------------------------------
  if (cmd === "watch") {
    const projectSrc = path.join(process.cwd(), "src")
    console.log("Watching:", projectSrc)

    const mergeFn = await loadMerge()
    if (!mergeFn) return

    // Run initial build immediately
    console.log("Initial build...")
    await mergeFn()

    // Watch for file changes
    chokidar.watch(projectSrc, { ignoreInitial: true }).on("change", async file => {
      console.log("Changed:", file)
      await mergeFn()
    })

    return
  }

  // --------------------------------------------------
  // help
  // --------------------------------------------------
  console.log("Usage:")
  console.log("  bf6mod build")
  console.log("  bf6mod update-sdk")
  console.log("  bf6mod watch")
}
