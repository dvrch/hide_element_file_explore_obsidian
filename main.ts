import { App, Plugin, TFile, TFolder, FileSystemAdapter } from 'obsidian';

interface GitignoreRule {
    pattern: string;
    isInclude: boolean;
    isFolder: boolean;
}

export default class GitignoreExplorerPlugin extends Plugin {
    async onload() {
        this.registerEvent(this.app.workspace.on('layout-ready', this.filterExplorer.bind(this)));
        this.registerEvent(this.app.vault.on('create', this.filterExplorer.bind(this)));
        this.registerEvent(this.app.vault.on('delete', this.filterExplorer.bind(this)));
        this.registerEvent(this.app.vault.on('rename', this.filterExplorer.bind(this)));
    }

    private async filterExplorer() {
        const gitignorePath = '.gitignore';
        const gitignoreFile = this.app.vault.getAbstractFileByPath(gitignorePath);
        
        if (!(gitignoreFile instanceof TFile)) return;
        
        const content = await this.app.vault.read(gitignoreFile);
        const rules = this.parseGitignore(content);
        
        this.applyRulesToExplorer(rules);
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

    private normalizePattern(pattern: string): string {
        // Convertir les patterns .gitignore en regex
        return pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
            .replace(/\/$/, '');
    }

    private applyRulesToExplorer(rules: GitignoreRule[]) {
        const explorer = document.querySelector('.nav-files-container');
        if (!explorer) return;

        const items = explorer.querySelectorAll('.nav-file, .nav-folder');
        
        for (const item of items) {
            const path = item.getAttribute('data-path');
            if (!path) continue;

            const isFile = item.classList.contains('nav-file');
            const isFolder = item.classList.contains('nav-folder');
            
            // Vérifier si l'élément doit être visible
            const shouldShow = this.shouldShowItem(path, isFile, isFolder, rules);
            
            // Appliquer le style
            (item as HTMLElement).style.display = shouldShow ? 'flex' : 'none';
        }
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