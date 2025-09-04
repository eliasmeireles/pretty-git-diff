import * as path from 'path';

export class LanguageUtils {
    private readonly languageMap: { [key: string]: string } = {
        '.js': 'javascript',
        '.ts': 'typescript',
        '.jsx': 'javascriptreact',
        '.tsx': 'typescriptreact',
        '.py': 'python',
        '.java': 'java',
        '.go': 'go',
        '.rs': 'rust',
        '.cpp': 'cpp',
        '.c': 'c',
        '.cs': 'csharp',
        '.php': 'php',
        '.rb': 'ruby',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.sh': 'shellscript',
        '.bash': 'shellscript',
        '.zsh': 'shellscript',
        '.fish': 'fish',
        '.ps1': 'powershell',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.less': 'less',
        '.xml': 'xml',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.toml': 'toml',
        '.md': 'markdown',
        '.txt': 'plaintext'
    };

    getLanguageFromExtension(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        return this.languageMap[ext] || 'plaintext';
    }
}
