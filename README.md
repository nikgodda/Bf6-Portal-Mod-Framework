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

Only regenerates __SCRIPT.ts.

### Update SDK

```bash
bf6mod update-sdk
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

Output:

```
__SCRIPT.ts
__STRINGS.json
```

---

# 🛠 Merge Behavior

- merges all TypeScript under src  
- resolves import order  
- strips imports/exports  
- writes a single game script  

Paste __SCRIPT.ts into Portal Web Editor.

---

# 💬 Strings System (Updated)

Generates:

```
__STRINGS.json
```

Supports:

- static keys  
- parameter counting  
- mod.stringkeys  
- dynamic template literal references  
- annotation-controlled dynamic values  

Dynamic template literals **never** generate keys — only annotations do.

---

# 🎯 Static Strings

### Basic

```ts
mod.Message("hello")
```

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

```json
{
  "debug": {
    "player": "debug.player {} {} {}"
  }
}
```

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

---

# 🔍 Parameter Counting

```ts
mod.Message(
  "debug.loc",
  mod.X(pos),
  mod.Y(pos),
  mod.Z(pos)
)
```

Produces:

```json
{
  "debug": {
    "loc": "debug.loc {} {} {}"
  }
}
```

---

# ⚙ Optional Warning Mode

```json
{
  "bf6mod": {
    "warnUnusedStrings": true
  }
}
```

---

# 📜 License

MIT
