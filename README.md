# BF6 Portal Mod Framework

A development framework and CLI toolchain for creating Battlefield 6 Portal Mods using TypeScript.

It powers the official BF6 Portal Mod Template and provides:

- bf6mod CLI  
- automatic TypeScript merge (creates __SCRIPT.ts)  
- automatic string extraction (creates __STRINGS.json)  
- annotation-based dynamic string expansion  
- watch mode  
- SDK updater  
- does not include SDK files (downloaded per project)

---

# 🚀 Installation

```bash
npm install bf6-portal-mod-framework --save-dev
```

Upgrade to latest:

```bash
npm install bf6-portal-mod-framework@latest --save-dev
```

---

# 📦 CLI Commands

### Build (merge + strings)

```bash
bf6mod build
```

Produces:

```
__SCRIPT.ts
__STRINGS.json
```

### Watch (merge only)

```bash
bf6mod watch
```

Regenerates __SCRIPT.ts on changes.  
Does **not** update __STRINGS.json.

### Update SDK

```bash
bf6mod update-sdk
```

Downloads the latest Portal SDK typings.

---

# 🧱 Required Project Layout

```
SDK/
  mod/
  modlib/

src/
  main.ts
  ...
```

Outputs go to project root:

```
__SCRIPT.ts
__STRINGS.json
```

---

# 🛠 Merge Behavior

The merge tool:

- scans all .ts under src/  
- resolves import order  
- strips import/export  
- merges everything into a single output:

```
__SCRIPT.ts
```

Paste this file into the Portal Web Editor.

---

# 💬 Strings System (Updated)

During build, the framework scans __SCRIPT.ts and generates:

```
__STRINGS.json
```

Extracts:

- static message keys  
- static parameters  
- mod.stringkeys.*  
- dynamic template literal calls (as references)  
- annotation-based dynamic expansions  

Only `bf6mod build` performs string extraction.

---

# 🎯 Static Strings

### Basic

```ts
mod.Message("hello")
```

→ `"hello": "hello"`

### With Parameters

```ts
mod.Message("debug.player", x, y, z)
```

→ `"debug.player": "debug.player {} {} {}"`

### Using stringkeys

```ts
mod.stringkeys.ui.menu.Start
```

→ `"ui.menu.Start": "ui.menu.Start"`

---

# 🔥 Dynamic Strings (Correct Behavior)

Dynamic template literal usage:

```ts
mod.Message(`ai.bots.${i}`)
```

**does NOT generate keys.**

Only annotations generate dynamic entries.

Dynamic calls only mark a namespace as “used”.

Example:

```ts
// @stringkeys ai.bots: 0..3
mod.Message(`ai.bots.${i}`)
```

Generated (from annotation):

```
ai.bots.0
ai.bots.1
ai.bots.2
ai.bots.3
```

Without annotation → no dynamic keys.

Supports multi-line template literals.

---

# 📝 @stringkeys Annotation

Format:

```ts
// @stringkeys <namespace>: <values>
```

Examples:

```ts
// @stringkeys ui.buttons: OK, Cancel, Retry
// @stringkeys ai.bots: 0..3
// @stringkeys grade: A..F
// @stringkeys ai.state: Idle, Roam, Fight, A..C, 10..12
```

Annotations ALWAYS generate dynamic values.

---

# 🔍 Parameter Counting

Handles nested expressions:

```ts
mod.Message(
  "debug.loc",
  mod.X(pos),
  mod.Y(pos),
  mod.Z(pos)
)
```

Becomes:

```
debug.loc {} {} {}
```

---

# ⚙ Optional Warning Mode

Enable in package.json:

```json
{
  "bf6mod": {
    "warnUnusedStrings": true
  }
}
```

Dynamic calls mark namespaces as “used”.

---

# 🧩 Template Integration

Official BF6 Portal Mod Template:

https://github.com/nikgodda/bf6-portal-mod-template

The template provides:

- ready project layout  
- base `AGameMode` class  
- starter `main.ts`  
- SDK folder included  
- npm scripts mapped directly to framework commands:

```
npm run build       → bf6mod build  
npm run watch       → bf6mod watch  
npm run update-sdk  → bf6mod update-sdk  
```

Use the template if you want a fully configured project already wired to this framework.

---

# 📜 License

MIT
