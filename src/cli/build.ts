export default async function run(args: string[]) {
    const cmd = args[0];

    if (cmd === "build") {
        const merger = await import("../merger/merge.js");
        merger.default?.();
        return;
    }

    if (cmd === "update-sdk") {
        const updater = await import("../scripts/update-sdk.js");
        return;
    }

    console.log("Usage:");
    console.log("  bf6 build");
    console.log("  bf6 update-sdk");
}
