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

<<<<<<< HEAD
Only regenerates __SCRIPT.ts.
=======
Regenerates __SCRIPT.ts on changes.  
Does **not** update __STRINGS.json.
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

### Update SDK

```bash
bf6mod update-sdk
```
<<<<<<< HEAD
=======

Downloads the latest Portal SDK typings.
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

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

<<<<<<< HEAD
Output:
=======
Outputs go to project root:
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

```
__SCRIPT.ts
__STRINGS.json
```

---

# 🛠 Merge Behavior

<<<<<<< HEAD
- merges all TypeScript under src  
- resolves import order  
- strips imports/exports  
- writes a single game script  

Paste __SCRIPT.ts into Portal Web Editor.
=======
The merge tool:

- scans all .ts under src/  
- resolves import order  
- strips import/export  
- merges everything into a single output:

```
__SCRIPT.ts
```

Paste this file into the Portal Web Editor.
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

---

# 💬 Strings System (Updated)

<<<<<<< HEAD
Generates:
=======
During build, the framework scans __SCRIPT.ts and generates:
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

```
__STRINGS.json
```
<<<<<<< HEAD

Supports:

- static keys  
- parameter counting  
- mod.stringkeys  
- dynamic template literal references  
- annotation-controlled dynamic values  

Dynamic template literals **never** generate keys — only annotations do.
=======

Extracts:

- static message keys  
- static parameters  
- mod.stringkeys.*  
- dynamic template literal calls (as references)  
- annotation-based dynamic expansions  

Only `bf6mod build` performs string extraction.
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

---

# 🎯 Static Strings

### Basic

```ts
mod.Message("hello")
```

<<<<<<< HEAD
Produces:

```json
{
  "hello": "hello"
}
```

---

### With Parameters

```ts
mod.Message("debug.player", x, y, z)
```

Produces:
=======
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
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

```json
{
  "debug": {
    "player": "debug.player {} {} {}"
  }
}
```

<<<<<<< HEAD
---

### Using stringkeys

```ts
mod.stringkeys.ui.menu.Start
```

Produces:

```json
{
  "ui": {
    "menu": {
      "Start": "ui.menu.Start"
    }
  }
}
```

---

# 🔥 Dynamic Strings (Correct Behavior)

Dynamic message keys:

```ts
mod.Message(`ai.bots.${i}`)
```

Produce **no keys** by themselves.

They only mark a namespace as "used" for unused-string warnings.

To generate keys, use annotations:

```ts
// @stringkeys ai.bots: 0..3
mod.Message(`ai.bots.${i}`)
```

Produces:
=======
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
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

```json
{
  "ai": {
    "bots": {
      "0": "ai.bots.0",
      "1": "ai.bots.1",
      "2": "ai.bots.2",
      "3": "ai.bots.3"
    }
  }
}
```

Keys come **exclusively** from the annotation.

---

# 📝 @stringkeys Annotation

Format:

```ts
// @stringkeys <namespace>: <values>
```

Supports:

<<<<<<< HEAD
- lists  
- numeric ranges  
- alphabet ranges  
- mixed sets  

Always produces nested structure.

Example:

```ts
// @stringkeys ui.buttons: OK, Cancel, Retry
```

Produces:

```json
{
  "ui": {
    "buttons": {
      "OK": "ui.buttons.OK",
      "Cancel": "ui.buttons.Cancel",
      "Retry": "ui.buttons.Retry"
    }
  }
}
```
=======
```ts
// @stringkeys ui.buttons: OK, Cancel, Retry
// @stringkeys ai.bots: 0..3
// @stringkeys grade: A..F
// @stringkeys ai.state: Idle, Roam, Fight, A..C, 10..12
```

Annotations ALWAYS generate dynamic values.
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

---

# 🔍 Parameter Counting

<<<<<<< HEAD
=======
Handles nested expressions:

>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec
```ts
mod.Message(
  "debug.loc",
  mod.X(pos),
  mod.Y(pos),
  mod.Z(pos)
)
```

<<<<<<< HEAD
Produces:

```json
{
  "debug": {
    "loc": "debug.loc {} {} {}"
  }
}
=======
Becomes:

```
debug.loc {} {} {}
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec
```

---

# ⚙ Optional Warning Mode

<<<<<<< HEAD
=======
Enable in package.json:

>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec
```json
{
  "bf6mod": {
    "warnUnusedStrings": true
  }
}
```
<<<<<<< HEAD
=======

Dynamic calls mark namespaces as “used”.
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

---

# 🧩 Template Integration

<<<<<<< HEAD
Official Template:

https://github.com/nikgodda/bf6-portal-mod-template

Provides:

- complete project structure  
- base AGameMode  
- entry main.ts  
- SDK folder included  
- npm scripts mapped to framework:
=======
Official BF6 Portal Mod Template:

https://github.com/nikgodda/bf6-portal-mod-template

The template provides:

- ready project layout  
- base `AGameMode` class  
- starter `main.ts`  
- SDK folder included  
- npm scripts mapped directly to framework commands:
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

```
npm run build       → bf6mod build  
npm run watch       → bf6mod watch  
npm run update-sdk  → bf6mod update-sdk  
```
<<<<<<< HEAD
=======

Use the template if you want a fully configured project already wired to this framework.
>>>>>>> d50576f079c2b7f68f03a53fed30f6c7532593ec

---

# 📜 License

MIT
