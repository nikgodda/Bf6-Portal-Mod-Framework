# BF6 Portal Mod Framework

A lightweight development framework that provides build tools, merge tooling, SDK updating, and a watcher for creating Battlefield 6 Portal Mods.

This package contains:

- `bf6mod` CLI tool  
- automatic merge script for generating `__MERGED.ts`  
- file watcher for live rebuilds  
- SDK update script (downloads official mod & modlib typings into your project)  
- does **not** include any SDK files itself  

It is designed to be used inside BF6 mod projects, such as the official template:

https://github.com/nikgodda/bf6-portal-mod-template

---

# 🚀 Installation

Inside your mod project:

```bash
npm install bf6-portal-mod-framework --save-dev
```

---

# 📦 CLI Commands

The framework exposes a CLI named `bf6mod`.

### Build merged output

```bash
bf6mod build
```

Generates:

```
__MERGED.ts
```

Paste this into the BF6 Portal Mod Editor.

---

### Watch mode (auto-merge on save)

```bash
bf6mod watch
```

Watches your project’s `src/` folder and rebuilds `__MERGED.ts` whenever files are modified.

---

### Update SDK typings

```bash
bf6mod update-sdk
```

Downloads the latest official BF6 Portal SDK files into your project:

```
SDK/mod
SDK/modlib
```

This is safe to run anytime SDK typings change.

---

# 🧱 Project Requirements

Your mod project should have:

```
SDK/
  mod/
  modlib/

src/
  main.ts
  ...
```

The framework does **not** include SDK files — they must be stored in your project.

Use:

```
npm run update-sdk
```

to refresh them.

---

# 🛠 Merge Behavior

The merge tool:

- walks all `.ts` files under your project's `src/` directory  
- resolves imports in order  
- combines them into a single `__MERGED.ts` file  
- removes TypeScript exports  
- removes import statements  
- prepends a single `import * as modlib from "modlib"`  
- flattens your entire TypeScript project into a format readable by Portal

---

# 📜 License

MIT
