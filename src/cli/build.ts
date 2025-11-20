import chokidar from "chokidar"
import path from "path"

// dynamic merge loader with no TS errors
async function loadMerge() {
  const mod: any = await import("../merger/merge.js")
  const mergeFn = mod.default ?? mod.merge

  if (!mergeFn) {
    console.error("ERROR: merge.js has no merge function")
    return null
  }

  return mergeFn
}

export default async function run(args: string[]) {
  const cmd = args[0]

  // build
  if (cmd === "build") {
    const mergeFn = await loadMerge()
    if (mergeFn) await mergeFn()
    return
  }

  // update-sdk
  if (cmd === "update-sdk") {
    await import("../scripts/update-sdk.js") // runs automatically
    return
  }

  // watch
  if (cmd === "watch") {
    const projectSrc = path.join(process.cwd(), "src")
    console.log("Watching:", projectSrc)

    // load merge function once
    const mergeFn = await loadMerge()

    // watch real project source folder
    chokidar.watch(projectSrc, { ignoreInitial: true }).on("change", async file => {
      console.log("Changed:", file)
      if (mergeFn) await mergeFn()
    })

    return
  }

  // help
  console.log("Usage:")
  console.log("  bf6mod build")
  console.log("  bf6mod update-sdk")
  console.log("  bf6mod watch")
}
