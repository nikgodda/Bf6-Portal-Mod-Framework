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

The framework exposes:

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

Watches src/ and regenerates:

__SCRIPT.ts

Does not update __STRINGS.json.  
Run bf6mod build when editing string annotations.

---

## 🔄 Update SDK

bf6mod update-sdk

Downloads latest BF6 Portal SDK typings:

SDK/mod/  
SDK/modlib/

---

# 🧱 Required Project Layout

SDK/  
  mod/  
  modlib/

src/  
  main.ts  
  ...

Outputs (__SCRIPT.ts, __STRINGS.json) are written to project root.

---

# 🛠 Merge Behavior

The merge tool (src/scripts/merge.js):

- scans all .ts under src/
- resolves import order
- strips import / export
- flattens code
- writes __SCRIPT.ts

This is the file you paste into the Portal Web Editor.

---

# 💬 Strings System  (UPDATED, ACCURATE)

The Strings System scans your merged __SCRIPT.ts and auto-generates:

__STRINGS.json

It extracts:

- static message keys
- message keys with parameters
- mod.stringkeys.* usages
- dynamic template literals
- annotation-driven dynamic expansion

Only the bf6mod build command generates strings.  
Watch mode does not run string extraction.

---

# 🎯 Static Strings

### Basic

mod.Message("hello")

Output:

{ "hello": "hello" }

---

### With Parameters

Parameters may be any valid expression:

mod.Message("debug.player", x, y, z)

Output:

debug.player {} {} {}

The system counts top-level commas correctly, even with nested parentheses.

---

### Using mod.stringkeys

mod.stringkeys.ui.menu.Start

Output:

ui.menu.Start

This always generates a static string key.

---

# 🔥 Dynamic Strings (important behavior)

Dynamic message keys must use template literals:

mod.Message(`ai.bots.${i}`)

However:

### ✔ Dynamic calls DO NOT generate any keys  
### ✔ Only @stringkeys annotations generate dynamic entries  
### ✔ Dynamic calls simply mark the namespace as “used” for warning mode

Example:

// @stringkeys ai.bots: 0..3  
mod.Message(`ai.bots.${i}`)

Generated keys:

ai.bots.0  
ai.bots.1  
ai.bots.2  
ai.bots.3

These come **only from the annotation**, not from the dynamic call.

Dynamic calls without annotations are completely ignored.

Supports both single-line and multi-line template literals.

---

# 📝 @stringkeys Annotation

Declares the allowed values for a dynamic namespace.

Format:

// @stringkeys <namespace>: <values>

Examples:

### Numeric Range

// @stringkeys ai.bots: 0..3

---

### Alphabet Range

// @stringkeys grade: A..F

---

### List

// @stringkeys ui.buttons: OK, Cancel, Retry

---

### Mixed

// @stringkeys ai.state: Idle, Roam, Fight, A..C, 10..12

Annotations ALWAYS generate their keys during build.

---

# 📌 Dynamic Key Rules

Dynamic keys must be shaped like:

<namespace>.<static>... .${variable}

Valid:

mod.Message(`ai.bots.${i}`)  
mod.Message(`ui.menu.buttons.${id}`)

Invalid (ignored):

mod.Message(`ai.${a}.${b}`)  
mod.Message(`bots.${p}.${x}`)  
mod.Message(`bots.` + p)  
mod.Message(`${a}.${b}`)

Only one trailing dynamic segment is supported.

---

# 🧪 Static Keys Are Always Added

mod.Message("scoreboard.title")

Always included.

---

# 🔍 Parameter Counting (latest extractor)

Correctly handles:

- nested parentheses  
- multi-line parameters  
- function calls  
- ternaries  
- chained calls  

Example:

mod.Message(
    "debug.player",
    mod.XComponent(pos),
    mod.YComponent(pos),
    mod.ZComponent(pos)
)

Output:

debug.player {} {} {}

---

# ⚙ Optional Warning Mode

Enable detection of unused keys:

{
  "bf6mod": {
    "warnUnusedStrings": true
  }
}

Dynamic calls mark namespaces as used if they appear.

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

# 🧩 Template Integration

Official template:  
https://github.com/nikgodda/bf6-portal-mod-template

Provides:

- ready src/ layout
- game mode base class
- SDK folder
- npm scripts mapped to the framework:

npm run build       → bf6mod build  
npm run watch       → bf6mod watch  
npm run update-sdk  → bf6mod update-sdk

---

# 📜 License

MIT
