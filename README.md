# BF6 Portal Mod Framework

A development framework and CLI toolchain for creating Battlefield 6 Portal Mods using TypeScript.

It powers the official BF6 Portal Mod Template and provides:

- bf6mod CLI
- automatic TypeScript merge (creates __SCRIPT.ts)
- automatic string extraction (creates __STRINGS.json)
- annotation-based dynamic string expansion
- live watch mode
- SDK updater
- does not include SDK files (downloaded per project)

---

# 🚀 Installation

npm install bf6-portal-mod-framework --save-dev

Upgrade to latest:

npm install bf6-portal-mod-framework@latest --save-dev

---

# 📦 CLI Commands

bf6mod

Used via npm scripts or directly.

---

## 🔨 Build (merge + strings)

bf6mod build

Produces:

__SCRIPT.ts  
__STRINGS.json

Notes:

- __STRINGS.json is generated only during build  
- Watch mode does not trigger string extraction

---

## 👁 Watch (merge only)

bf6mod watch

Regenerates __SCRIPT.ts whenever files change.

Does not update __STRINGS.json — run bf6mod build when editing annotations.

---

## 🔄 Update SDK

bf6mod update-sdk

Downloads the latest Portal SDK typings into SDK/.

---

# 🧱 Required Project Layout

SDK/  
  mod/  
  modlib/

src/  
  main.ts  
  ...

Output files are written to project root.

---

# 🛠 Merge Behavior

The merge tool:

- scans src/ recursively  
- resolves import order  
- strips import/export statements  
- merges all files into __SCRIPT.ts  

Paste __SCRIPT.ts into the Portal Web Editor.

---

# 💬 Strings System (Updated)

The framework scans __SCRIPT.ts and generates __STRINGS.json.

It extracts:

- static keys  
- message keys with parameters  
- mod.stringkeys.*  
- dynamic template literal usages  
- annotation-based dynamic values  

Only bf6mod build performs string extraction.

---

# 🎯 Static Strings

### Basic

mod.Message("hello")

→ "hello": "hello"

### With parameters

mod.Message("debug.player", x, y)

→ "debug.player": "debug.player {} {}"

### Using mod.stringkeys

mod.stringkeys.ui.menu.Start

→ "ui.menu.Start": "ui.menu.Start"

Static keys always generate entries.

---

# 🔥 Dynamic Strings (Important)

Dynamic message keys must use template literals, but:

### ✔ Dynamic Message() calls DO NOT generate keys  
### ✔ Only @stringkeys annotations generate dynamic entries  
### ✔ Dynamic calls only mark namespaces as "used" (to suppress warnings)

Example:

// @stringkeys ai.bots: 0..3  
mod.Message(`ai.bots.${i}`)

Generated keys:

ai.bots.0  
ai.bots.1  
ai.bots.2  
ai.bots.3

These come from the annotation **only**.  
The dynamic call causes **no generation**.

If annotation is missing:

mod.Message(`ai.bots.${i}`)

→ generates **nothing**.

Supports multi-line template literals.

---

# 📝 @stringkeys Annotation

Format:

// @stringkeys <namespace>: <values>

Examples:

### Numeric range
// @stringkeys ai.bots: 0..3

### Alphabet range
// @stringkeys rank: A..F

### List
// @stringkeys ui.buttons: OK, Cancel, Retry

### Mixed
// @stringkeys ai.state: Idle, Roam, Fight, A..C, 10..12

Annotations ALWAYS generate the keys.

---

# 🔍 Parameter Counting

Nested expressions supported:

mod.Message(
    "debug.coords",
    mod.X(pos),
    mod.Y(pos),
    mod.Z(pos)
)

→ "debug.coords": "debug.coords {} {} {}"

---

# ⚙ Optional Warning Mode

Add to package.json:

{
  "bf6mod": {
    "warnUnusedStrings": true
  }
}

Dynamic calls mark namespaces as used.

---

# 🧩 Example

Code:

mod.Message("static.key", x)  
mod.stringkeys.menu.start  

// @stringkeys ai.bots: 0..2  
mod.Message(`ai.bots.${i}`)

Output:

static.key {}  
menu.start  
ai.bots.0  
ai.bots.1  
ai.bots.2

---

# 📜 License

MIT
