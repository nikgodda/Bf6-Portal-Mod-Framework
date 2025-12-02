# BF6 Portal Mod Framework

A development framework and CLI toolchain for creating Battlefield 6 Portal Mods using TypeScript.

It powers the official BF6 Portal Mod Template and provides:

- `bf6mod` CLI  
- automatic TypeScript merge (creates `__SCRIPT.ts`)  
- automatic string extraction (creates `__STRINGS.json`)  
- annotation-based dynamic string expansion  
- live watch mode  
- SDK updater  
- does **not** include SDK files (downloaded per project)

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

The framework exposes:

```
bf6mod
```

Used via npm scripts or directly.

---

## 🔨 Build (merge + strings)

```bash
bf6mod build
```

Produces:

```
__SCRIPT.ts
__STRINGS.json
```

Notes:

- `__STRINGS.json` is **generated only during build**
- Watch mode does **not** trigger string extraction

---

## 👁 Watch (merge only)

```bash
bf6mod watch
```

Watches `src/` and regenerates:

```
__SCRIPT.ts
```

Does **not** update `__STRINGS.json`.  
Run `bf6mod build` when editing string annotations.

---

## 🔄 Update SDK

```bash
bf6mod update-sdk
```

Downloads latest BF6 Portal SDK typings:

```
SDK/mod/
SDK/modlib/
```

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

Outputs (`__SCRIPT.ts`, `__STRINGS.json`) are written to project root.

---

# 🛠 Merge Behavior

The merge tool (`src/scripts/merge.js`):

- scans all `.ts` under `src/`
- resolves import order
- strips `import` / `export`
- flattens code
- writes:

```
__SCRIPT.ts
```

This is the file you paste into the Portal Web Editor.

---

# 💬 Strings System

This system extracts all string keys used in your mod and writes them into:

```
__STRINGS.json
```

It supports:

- static message keys  
- message keys with parameters  
- `mod.stringkeys.*` usages  
- dynamic keys via template literals  
- dynamic expansions through `// @stringkeys` annotations  

---

# 🎯 Static Strings

### Basic

```ts
mod.Message("hello")
```

Outputs:

```json
{ "hello": "hello" }
```

---

### With Parameters

```ts
mod.Message("killLog", killer, victim)
```

Outputs:

```json
{ "killLog": "killLog {} {}" }
```

---

### Using `mod.stringkeys`

```ts
mod.stringkeys.ui.menu.Start
```

Outputs:

```
ui.menu.Start
```

---

# 🔥 Dynamic Strings

Dynamic keys must use template literals:

```ts
mod.Message(`ai.bots.${i}`)
```

These require annotation declarations to generate all possible values.

---

# 📝 Annotations — `@stringkeys`

Format:

```ts
// @stringkeys <namespace>: <values>
```

The namespace may have multiple dot segments:

```
ui.menu.buttons
ai.bots
dynamic.range
```

---

## ✔ Numeric Range

```ts
// @stringkeys ai.bots: 0..3
mod.Message(`ai.bots.${i}`)
```

Generates:

```
ai.bots.0
ai.bots.1
ai.bots.2
ai.bots.3
```

---

## ✔ Alphabet Range

```ts
// @stringkeys grades: A..F
```

---

## ✔ List

```ts
// @stringkeys ui.buttons: OK, Cancel, Retry
```

---

## ✔ Mixed

```ts
// @stringkeys ai.states: Idle, Roam, Fight, A..C, 10..12
```

---

# 📌 Dynamic Key Rules

Dynamic keys must follow the format:

```
namespace.static.${variable}
```

### Valid

```ts
mod.Message(`ai.bots.${i}`)
mod.Message(`ui.menu.buttons.${btn}`)
mod.Message(`world.zone.ids.${zone}`)
```

### ❌ Invalid (ignored)

```ts
mod.Message(`ai.${type}.${i}`)
mod.Message(`${a}.${b}`)
mod.Message(`bots.` + p)
mod.Message(`bots.${p}.${x}`)
```

Only **one trailing dynamic part** is supported.

---

# 🧪 Static Keys Are Always Added

```ts
mod.Message("scoreboard.title")
```

→ included even without annotations.

---

# 🔥 Real Example (from Template)

### Code:

```ts
mod.Message(`test`)
        
mod.Message(`static.message`)
mod.Message(`static.messageWithParams`, 1)

mod.stringkeys.static.stringkey

// @stringkeys dynamic.range: 1..2
for (let i = 0; i < 4; i++) {
    mod.Message(`dynamic.range.${i}`)
}

// @stringkeys dynamic.list: Idle, Roam, Fight
const state = 'Idle'
mod.Message(`dynamic.list.${state}`)
```

### Output:

```json
{
  "dynamic": {
    "range": {
      "1": "dynamic.range.1",
      "2": "dynamic.range.2"
    },
    "list": {
      "Idle": "dynamic.list.Idle",
      "Roam": "dynamic.list.Roam",
      "Fight": "dynamic.list.Fight"
    }
  },
  "test": "test",
  "static": {
    "message": "static.message",
    "messageWithParams": "static.messageWithParams {}",
    "stringkey": "static.stringkey"
  }
}
```

Notes:

- Only annotated values are added  
- Looping extra values (`0` and `3`) is ignored since they’re not in annotation range  
- Lists expand exactly as declared  
- Static keys and `mod.stringkeys` always work  

---

# ⚙ Optional Warning Mode

Add to your project’s `package.json`:

```json
{
  "bf6mod": {
    "warnUnusedStrings": true
  }
}
```

When enabled, if the previous `__STRINGS.json` contained keys that no longer appear after rebuild, you will see warnings like:

```
Warning: unused string key removed: dynamic.range.3
```

This helps catch accidental typos or removed behaviors.

---

# 🧩 Template Integration

Official template:

https://github.com/nikgodda/bf6-portal-mod-template

Provides:

- ready `src/` layout  
- game mode base class  
- SDK folder  
- npm scripts mapped to the framework:

```
npm run build       → bf6mod build
npm run watch       → bf6mod watch
npm run update-sdk  → bf6mod update-sdk
```

---

# 📜 License

MIT
