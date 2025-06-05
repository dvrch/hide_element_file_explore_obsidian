var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GitignoreExplorerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  gitignorePath: ".gitignore",
  enabled: true,
  showHiddenCount: true,
  previewMode: false
};
var PreviewModal = class extends import_obsidian.Modal {
  constructor(app, previewContent, affectedFiles) {
    super(app);
    this.previewContent = previewContent;
    this.affectedFiles = affectedFiles;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Pr\xE9visualisation des fichiers affect\xE9s" });
    const statsEl = contentEl.createEl("div", {
      text: `Total: ${this.affectedFiles.length} fichiers (${this.affectedFiles.filter((f) => f.willBeHidden).length} seront masqu\xE9s)`
    });
    statsEl.style.marginBottom = "1em";
    const listEl = contentEl.createEl("div");
    listEl.style.maxHeight = "400px";
    listEl.style.overflow = "auto";
    this.affectedFiles.forEach((file) => {
      const fileEl = listEl.createEl("div");
      fileEl.style.display = "flex";
      fileEl.style.alignItems = "center";
      fileEl.style.marginBottom = "0.5em";
      const icon = fileEl.createEl("span", {
        text: file.willBeHidden ? "\u{1F534}" : "\u{1F7E2}"
      });
      icon.style.marginRight = "0.5em";
      fileEl.createEl("span", {
        text: file.path,
        cls: file.willBeHidden ? "will-be-hidden" : "will-be-visible"
      });
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var GitignoreExplorerPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.hiddenCount = 0;
    this.previewMode = false;
  }
  onload() {
    return __async(this, null, function* () {
      yield this.loadSettings();
      this.addSettingTab(new GitignoreSettingTab(this.app, this));
      this.statusBarEl = this.addStatusBarItem();
      this.updateStatusBar();
      this.app.workspace.onLayoutReady(() => {
        if (this.settings.enabled) {
          this.filterExplorer();
        }
      });
      this.registerEvent(this.app.vault.on("create", () => {
        if (this.settings.enabled)
          this.filterExplorer();
      }));
      this.registerEvent(this.app.vault.on("delete", () => {
        if (this.settings.enabled)
          this.filterExplorer();
      }));
      this.registerEvent(this.app.vault.on("rename", () => {
        if (this.settings.enabled)
          this.filterExplorer();
      }));
      this.addCommand({
        id: "refresh-gitignore-filter",
        name: "Rafra\xEEchir le filtre .gitignore",
        callback: () => {
          if (this.settings.enabled)
            this.filterExplorer();
        }
      });
      this.addCommand({
        id: "toggle-gitignore-filter",
        name: "Activer/D\xE9sactiver le filtre .gitignore",
        callback: () => {
          this.settings.enabled = !this.settings.enabled;
          this.saveSettings();
          if (this.settings.enabled) {
            this.filterExplorer();
          } else {
            this.showAllFiles();
          }
        }
      });
    });
  }
  updateStatusBar() {
    if (this.settings.showHiddenCount && this.settings.enabled) {
      this.statusBarEl.setText(`${this.hiddenCount} fichiers masqu\xE9s`);
      this.statusBarEl.style.display = "block";
    } else {
      this.statusBarEl.style.display = "none";
    }
  }
  showAllFiles() {
    const explorer = document.querySelector(".nav-files-container");
    if (!explorer)
      return;
    const items = Array.from(explorer.querySelectorAll(".nav-file, .nav-folder"));
    items.forEach((item) => {
      item.style.display = "flex";
    });
    this.hiddenCount = 0;
    this.updateStatusBar();
  }
  loadSettings() {
    return __async(this, null, function* () {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
    });
  }
  saveSettings() {
    return __async(this, null, function* () {
      yield this.saveData(this.settings);
    });
  }
  // Modifier la méthode filterExplorer pour utiliser les paramètres
  filterExplorer() {
    return __async(this, null, function* () {
      const adapter = this.app.vault.adapter;
      if (!("getFullPath" in adapter)) {
        new import_obsidian.Notice("Impossible d'obtenir le chemin du vault");
        return;
      }
      const vaultPath = adapter.getBasePath();
      const gitignorePath = this.settings.gitignorePath.startsWith("/") ? this.settings.gitignorePath.slice(1) : this.settings.gitignorePath;
      const gitignoreFile = this.app.vault.getAbstractFileByPath(gitignorePath);
      if (!(gitignoreFile instanceof import_obsidian.TFile)) {
        console.log(`Fichier ${gitignorePath} non trouv\xE9`);
        return;
      }
      try {
        const content = yield this.app.vault.read(gitignoreFile);
        const rules = this.parseGitignore(content);
        if (this.settings.previewMode) {
          const affectedFiles = yield this.getAffectedFiles(rules);
          new PreviewModal(this.app, content, affectedFiles).open();
        } else {
          this.applyRulesToExplorer(rules);
        }
      } catch (error) {
        console.error("Erreur lors de la lecture du .gitignore:", error);
        new import_obsidian.Notice("Erreur lors de la lecture du .gitignore");
      }
    });
  }
  getAffectedFiles(rules) {
    return __async(this, null, function* () {
      const files = [];
      const explorer = document.querySelector(".nav-files-container");
      if (!explorer)
        return files;
      const items = Array.from(explorer.querySelectorAll(".nav-file, .nav-folder"));
      items.forEach((item) => {
        const path = item.getAttribute("data-path");
        if (!path)
          return;
        const isFile = item.classList.contains("nav-file");
        const isFolder = item.classList.contains("nav-folder");
        const shouldShow = this.shouldShowItem(path, isFile, isFolder, rules);
        files.push({
          path,
          willBeHidden: !shouldShow
        });
      });
      return files.sort((a, b) => a.path.localeCompare(b.path));
    });
  }
  normalizePattern(pattern) {
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(2);
      return `.*\\.${ext.replace(/\./g, "\\.")}$`;
    }
    let normalized = pattern.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\?/g, ".").replace(/\/$/, "");
    if (!pattern.startsWith("/")) {
      normalized = `.*${normalized}`;
    }
    return normalized;
  }
  parseGitignore(content) {
    const rules = [];
    const lines = content.split("\n");
    console.log("[DEBUG] Parsing du fichier .gitignore:");
    console.log(content);
    console.log("\n[DEBUG] R\xE8gles analys\xE9es:");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        console.log(`[DEBUG] Ligne ignor\xE9e: ${line}`);
        continue;
      }
      const isInclude = trimmedLine.startsWith("!");
      const pattern = isInclude ? trimmedLine.substring(1) : trimmedLine;
      const isFolder = pattern.includes("/");
      rules.push({
        pattern: this.normalizePattern(pattern),
        isInclude,
        isFolder
      });
    }
    return rules;
  }
  // Modifier applyRulesToExplorer pour compter les éléments masqués
  applyRulesToExplorer(rules) {
    const explorer = document.querySelector(".nav-files-container");
    if (!explorer)
      return;
    const items = Array.from(explorer.querySelectorAll(".nav-file, .nav-folder"));
    this.hiddenCount = 0;
    items.forEach((item) => {
      const path = item.getAttribute("data-path");
      if (!path)
        return;
      const isFile = item.classList.contains("nav-file");
      const isFolder = item.classList.contains("nav-folder");
      const shouldShow = this.shouldShowItem(path, isFile, isFolder, rules);
      item.style.display = shouldShow ? "flex" : "none";
      if (!shouldShow)
        this.hiddenCount++;
    });
    this.updateStatusBar();
  }
  shouldShowItem(path, isFile, isFolder, rules) {
    let defaultVisibility = true;
    console.log(`
[DEBUG] V\xE9rification du fichier: ${path}`);
    console.log(`[DEBUG] Type: ${isFile ? "Fichier" : "Dossier"}`);
    for (const rule of rules) {
      const regex = new RegExp(rule.pattern);
      const matches = regex.test(path);
      console.log(`[DEBUG] R\xE8gle test\xE9e: ${rule.pattern}`);
      console.log(`[DEBUG] Est une r\xE8gle d'inclusion: ${rule.isInclude}`);
      console.log(`[DEBUG] Match: ${matches}`);
      if (matches) {
        if (!rule.isInclude) {
          if (isFile && !rule.isFolder || isFolder && rule.isFolder) {
            console.log(`[DEBUG] \u27A1\uFE0F Le fichier sera masqu\xE9 par la r\xE8gle: ${rule.pattern}`);
            defaultVisibility = false;
          }
        } else {
          if (isFile && !rule.isFolder || isFolder && rule.isFolder) {
            console.log(`[DEBUG] \u27A1\uFE0F Le fichier sera inclus par la r\xE8gle: ${rule.pattern}`);
            return true;
          }
        }
      }
    }
    console.log(`[DEBUG] Visibilit\xE9 finale: ${defaultVisibility ? "Visible" : "Masqu\xE9"}
`);
    return defaultVisibility;
  }
};
var GitignoreSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Param\xE8tres du filtre .gitignore" });
    const previewButton = containerEl.createEl("button", {
      text: "Pr\xE9visualiser les changements",
      cls: "mod-cta"
    });
    previewButton.style.marginBottom = "2em";
    previewButton.addEventListener("click", () => {
      this.plugin.settings.previewMode = true;
      this.plugin.filterExplorer().then(() => {
        this.plugin.settings.previewMode = false;
      });
    });
    new import_obsidian.Setting(containerEl).setName("Activer le plugin").setDesc("Active ou d\xE9sactive le filtrage des fichiers").addToggle((toggle) => toggle.setValue(this.plugin.settings.enabled).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.enabled = value;
      yield this.plugin.saveSettings();
      if (value) {
        this.plugin.filterExplorer();
      } else {
        this.plugin.showAllFiles();
      }
    })));
    new import_obsidian.Setting(containerEl).setName("Chemin du .gitignore").setDesc("Chemin relatif vers le fichier .gitignore").addText((text) => text.setPlaceholder(".gitignore").setValue(this.plugin.settings.gitignorePath).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.gitignorePath = value;
      yield this.plugin.saveSettings();
      if (this.plugin.settings.enabled) {
        this.plugin.filterExplorer();
      }
    })));
    new import_obsidian.Setting(containerEl).setName("Afficher le nombre de fichiers masqu\xE9s").setDesc("Affiche le nombre de fichiers masqu\xE9s dans la barre de statut").addToggle((toggle) => toggle.setValue(this.plugin.settings.showHiddenCount).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.showHiddenCount = value;
      yield this.plugin.saveSettings();
      this.plugin.updateStatusBar();
    })));
    new import_obsidian.Setting(containerEl).setName("Mode de pr\xE9visualisation").setDesc("Active le mode de pr\xE9visualisation pour voir les fichiers affect\xE9s").addToggle((toggle) => toggle.setValue(this.plugin.settings.previewMode).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.previewMode = value;
      yield this.plugin.saveSettings();
      if (value && this.plugin.settings.enabled) {
        this.plugin.filterExplorer();
      }
    })));
  }
};
