import { App, Plugin, TFile, PluginSettingTab, Setting, Modal, Notice } from 'obsidian';

interface GitignorePluginSettings {
    gitignorePath: string;
    enabled: boolean;
    showHiddenCount: boolean;
    previewMode: boolean;
}

const DEFAULT_SETTINGS: GitignorePluginSettings = {
    gitignorePath: '.gitignore',
    enabled: true,
    showHiddenCount: true,
    previewMode: false
}

interface GitignoreRule {
    pattern: string;
    isInclude: boolean;
    isFolder: boolean;
}

class PreviewModal extends Modal {
    private previewContent: string;
    private affectedFiles: {path: string; willBeHidden: boolean}[];

    constructor(app: App, previewContent: string, affectedFiles: {path: string; willBeHidden: boolean}[]) {
        super(app);
        this.previewContent = previewContent;
        this.affectedFiles = affectedFiles;
    }

    onOpen() {
        const {contentEl} = this;
        
        contentEl.createEl('h2', {text: 'Prévisualisation des fichiers affectés'});
        
        const statsEl = contentEl.createEl('div', {
            text: `Total: ${this.affectedFiles.length} fichiers (${this.affectedFiles.filter(f => f.willBeHidden).length} seront masqués)`
        });
        statsEl.style.marginBottom = '1em';

        const listEl = contentEl.createEl('div');
        listEl.style.maxHeight = '400px';
        listEl.style.overflow = 'auto';

        this.affectedFiles.forEach(file => {
            const fileEl = listEl.createEl('div');
            fileEl.style.display = 'flex';
            fileEl.style.alignItems = 'center';
            fileEl.style.marginBottom = '0.5em';

            const icon = fileEl.createEl('span', {
                text: file.willBeHidden ? '🔴' : '🟢'
            });
            icon.style.marginRight = '0.5em';

            fileEl.createEl('span', {
                text: file.path,
                cls: file.willBeHidden ? 'will-be-hidden' : 'will-be-visible'
            });
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

export default class GitignoreExplorerPlugin extends Plugin {
    settings: GitignorePluginSettings;
    private statusBarEl: HTMLElement;
    private hiddenCount: number = 0;
    private previewMode: boolean = false;

    async onload() {
        await this.loadSettings();

        // Ajouter l'onglet des paramètres
        this.addSettingTab(new GitignoreSettingTab(this.app, this));

        // Créer l'élément de la barre de statut
        this.statusBarEl = this.addStatusBarItem();
        this.updateStatusBar();

        // Attendre que l'app soit chargée
        this.app.workspace.onLayoutReady(() => {
            if (this.settings.enabled) {
                this.filterExplorer();
            }
        });

        // Surveiller les changements de fichiers
        this.registerEvent(this.app.vault.on('create', () => {
            if (this.settings.enabled) this.filterExplorer();
        }));
        this.registerEvent(this.app.vault.on('delete', () => {
            if (this.settings.enabled) this.filterExplorer();
        }));
        this.registerEvent(this.app.vault.on('rename', () => {
            if (this.settings.enabled) this.filterExplorer();
        }));

        // Ajouter les commandes
        this.addCommand({
            id: 'refresh-gitignore-filter',
            name: 'Rafraîchir le filtre .gitignore',
            callback: () => {
                if (this.settings.enabled) this.filterExplorer();
            },
        });

        this.addCommand({
            id: 'toggle-gitignore-filter',
            name: 'Activer/Désactiver le filtre .gitignore',
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
    }

    public updateStatusBar() {
        if (this.settings.showHiddenCount && this.settings.enabled) {
            this.statusBarEl.setText(`${this.hiddenCount} fichiers masqués`);
            this.statusBarEl.style.display = 'block';
        } else {
            this.statusBarEl.style.display = 'none';
        }
    }

    public showAllFiles() {
        const explorer = document.querySelector('.nav-files-container');
        if (!explorer) return;

        const items = Array.from(explorer.querySelectorAll('.nav-file, .nav-folder'));
        items.forEach(item => {
            (item as HTMLElement).style.display = 'flex';
        });
        
        this.hiddenCount = 0;
        this.updateStatusBar();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Modifier la méthode filterExplorer pour utiliser les paramètres
    public async filterExplorer() {
        // Obtenir le chemin absolu du vault
        const adapter = this.app.vault.adapter;
        if (!('getFullPath' in adapter)) {
            new Notice('Impossible d\'obtenir le chemin du vault');
            return;
        }

        const vaultPath = (adapter as any).getBasePath();
        const gitignorePath = this.settings.gitignorePath.startsWith('/') 
            ? this.settings.gitignorePath.slice(1) 
            : this.settings.gitignorePath;

        const gitignoreFile = this.app.vault.getAbstractFileByPath(gitignorePath);
        
        if (!(gitignoreFile instanceof TFile)) {
            console.log(`Fichier ${gitignorePath} non trouvé`);
            return;
        }
        
        try {
            const content = await this.app.vault.read(gitignoreFile);
            const rules = this.parseGitignore(content);
            
            if (this.settings.previewMode) {
                const affectedFiles = await this.getAffectedFiles(rules);
                new PreviewModal(this.app, content, affectedFiles).open();
            } else {
                this.applyRulesToExplorer(rules);
            }
        } catch (error) {
            console.error('Erreur lors de la lecture du .gitignore:', error);
            new Notice('Erreur lors de la lecture du .gitignore');
        }
    }

    private async getAffectedFiles(rules: GitignoreRule[]): Promise<{path: string; willBeHidden: boolean}[]> {
        const files: {path: string; willBeHidden: boolean}[] = [];
        const explorer = document.querySelector('.nav-files-container');
        if (!explorer) return files;

        const items = Array.from(explorer.querySelectorAll('.nav-file, .nav-folder'));
        
        items.forEach(item => {
            const path = item.getAttribute('data-path');
            if (!path) return;

            const isFile = item.classList.contains('nav-file');
            const isFolder = item.classList.contains('nav-folder');
            
            const shouldShow = this.shouldShowItem(path, isFile, isFolder, rules);
            files.push({
                path,
                willBeHidden: !shouldShow
            });
        });

        return files.sort((a, b) => a.path.localeCompare(b.path));
    }

    private normalizePattern(pattern: string): string {
        // Amélioration de la conversion des patterns .gitignore en regex
        return `^${pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
            .replace(/\/$/, '')}$`;
    }

    private parseGitignore(content: string): GitignoreRule[] {
        const rules: GitignoreRule[] = [];
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) continue;

            const isInclude = trimmedLine.startsWith('!');
            const pattern = isInclude ? trimmedLine.substring(1) : trimmedLine;
            const isFolder = pattern.includes('/');

            rules.push({
                pattern: this.normalizePattern(pattern),
                isInclude,
                isFolder
            });
        }

        return rules;
    }

    // Modifier applyRulesToExplorer pour compter les éléments masqués
    private applyRulesToExplorer(rules: GitignoreRule[]) {
        const explorer = document.querySelector('.nav-files-container');
        if (!explorer) return;

        const items = Array.from(explorer.querySelectorAll('.nav-file, .nav-folder'));
        this.hiddenCount = 0;
        
        items.forEach(item => {
            const path = item.getAttribute('data-path');
            if (!path) return;

            const isFile = item.classList.contains('nav-file');
            const isFolder = item.classList.contains('nav-folder');
            
            const shouldShow = this.shouldShowItem(path, isFile, isFolder, rules);
            
            (item as HTMLElement).style.display = shouldShow ? 'flex' : 'none';
            if (!shouldShow) this.hiddenCount++;
        });

        this.updateStatusBar();
    }

    private shouldShowItem(path: string, isFile: boolean, isFolder: boolean, rules: GitignoreRule[]): boolean {
        let defaultVisibility = true;
        
        for (const rule of rules) {
            const regex = new RegExp(rule.pattern);
            const matches = regex.test(path);
            
            if (matches) {
                // Règles d'exclusion
                if (!rule.isInclude) {
                    if ((isFile && !rule.isFolder) || (isFolder && rule.isFolder)) {
                        defaultVisibility = false;
                    }
                }
                // Règles d'inclusion
                else {
                    if ((isFile && !rule.isFolder) || (isFolder && rule.isFolder)) {
                        return true;
                    }
                }
            }
        }
        
        return defaultVisibility;
    }
}

class GitignoreSettingTab extends PluginSettingTab {
    plugin: GitignoreExplorerPlugin;

    constructor(app: App, plugin: GitignoreExplorerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: 'Paramètres du filtre .gitignore'});

        // Ajouter un bouton pour la prévisualisation
        const previewButton = containerEl.createEl('button', {
            text: 'Prévisualiser les changements',
            cls: 'mod-cta'
        });
        previewButton.style.marginBottom = '2em';
        previewButton.addEventListener('click', () => {
            this.plugin.settings.previewMode = true;
            this.plugin.filterExplorer().then(() => {
                this.plugin.settings.previewMode = false;
            });
        });

        new Setting(containerEl)
            .setName('Activer le plugin')
            .setDesc('Active ou désactive le filtrage des fichiers')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.enabled = value;
                    await this.plugin.saveSettings();
                    if (value) {
                        this.plugin.filterExplorer();
                    } else {
                        this.plugin.showAllFiles();
                    }
                }));

        new Setting(containerEl)
            .setName('Chemin du .gitignore')
            .setDesc('Chemin relatif vers le fichier .gitignore')
            .addText(text => text
                .setPlaceholder('.gitignore')
                .setValue(this.plugin.settings.gitignorePath)
                .onChange(async (value) => {
                    this.plugin.settings.gitignorePath = value;
                    await this.plugin.saveSettings();
                    if (this.plugin.settings.enabled) {
                        this.plugin.filterExplorer();
                    }
                }));

        new Setting(containerEl)
            .setName('Afficher le nombre de fichiers masqués')
            .setDesc('Affiche le nombre de fichiers masqués dans la barre de statut')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showHiddenCount)
                .onChange(async (value) => {
                    this.plugin.settings.showHiddenCount = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStatusBar();
                }));

        new Setting(containerEl)
            .setName('Mode de prévisualisation')
            .setDesc('Active le mode de prévisualisation pour voir les fichiers affectés')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.previewMode)
                .onChange(async (value) => {
                    this.plugin.settings.previewMode = value;
                    await this.plugin.saveSettings();
                    if (value && this.plugin.settings.enabled) {
                        this.plugin.filterExplorer();
                    }
                }));
    }
}