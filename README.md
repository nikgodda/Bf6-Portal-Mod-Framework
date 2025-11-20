# 🚀 BF6 Portal Mod Framework
A build and tooling system for creating Battlefield 6 Portal mods using TypeScript

This framework provides:

- ⚙️ Automatic merge system that produces a single __MERGED.ts
- 📦 Portal SDK and modlib integration
- 🧰 CLI commands for building and updating SDK
- 📁 Recommended project structure
- 🛠 Zero configuration setup for BF6 mod development

---

## 📥 Installation

Install as a development dependency:

```bash
npm install --save-dev bf6-portal-mod-framework
```

Update to latest version:

```bash
npm install bf6-portal-mod-framework@latest
```

---

## 🧵 CLI Usage

The framework provides a command line tool called bf6mod

### 🔨 Build the mod

```bash
bf6mod build
```

This generates:

```
__MERGED.ts
```

Paste its contents into the BF6 Portal Rules Editor

### 🔄 Update the Portal SDK

```bash
bf6mod update-sdk
```

This downloads the official Portal SDK typings into:

```
code/mod/
code/modlib/
```

---

## 📁 Recommended Project Structure

```
src/
  main.ts
  GameModes/
  Core/

code/
  mod/
  modlib/

__MERGED.ts
```

---

## 🧩 Merge System

The build process:

1. Reads your entire TypeScript project
2. Resolves and inlines all imports
3. Removes export keywords
4. Injects required modlib import
5. Adds file headers
6. Outputs a single __MERGED.ts file

---

## 🛠 Integration Example

```
npm run update-sdk
npm run build
```

---

## 📌 Notes

- The framework does not emit JavaScript files into the template
- All output is handled by the bf6mod CLI
- Do not edit __MERGED.ts manually

---

## 📄 License

MIT
