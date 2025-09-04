import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitService } from './GitService';
import { DirectoryFile, DirectoryComparison } from '../types';

export class DirectoryComparisonService {
    constructor(private readonly gitService: GitService) {}

    async compareDirectoryWithReference(
        localDirPath: string, 
        reference: string, 
        relativePath: string = ''
    ): Promise<DirectoryComparison> {
        const gitRoot = await this.gitService.getGitRoot(localDirPath);
        const relativeToRepo = path.relative(gitRoot, localDirPath).replace(/\\/g, '/');
        
        const [localFiles, remoteFiles] = await Promise.all([
            this.getLocalFiles(localDirPath, relativePath),
            this.getRemoteFiles(gitRoot, reference, relativeToRepo)
        ]);

        const allFiles = this.mergeFileLists(localFiles, remoteFiles, localDirPath);
        
        return {
            localPath: localDirPath,
            reference,
            files: allFiles
        };
    }

    private async getLocalFiles(dirPath: string, relativePath: string): Promise<string[]> {
        const fullPath = path.join(dirPath, relativePath);
        
        try {
            if (!fs.existsSync(fullPath)) {
                return [];
            }
            
            const items = fs.readdirSync(fullPath, { withFileTypes: true });
            const files: string[] = [];
            
            for (const item of items) {
                if (item.name.startsWith('.git')) continue;
                
                const itemPath = path.join(relativePath, item.name);
                files.push(itemPath);
                
                if (item.isDirectory()) {
                    const subFiles = await this.getLocalFiles(dirPath, itemPath);
                    files.push(...subFiles);
                }
            }
            
            return files;
        } catch (error: any) {
            console.warn(`Failed to read local directory: ${error.message}`);
            return [];
        }
    }

    private async getRemoteFiles(gitRoot: string, reference: string, basePath: string): Promise<string[]> {
        try {
            const { stdout } = await this.gitService.execAsync(
                `git ls-tree -r --name-only ${reference} ${basePath}`,
                { cwd: gitRoot }
            );
            
            return stdout
                .split('\n')
                .filter(line => line.trim())
                .map(line => path.relative(basePath, line).replace(/\\/g, '/'))
                .filter(line => line && !line.startsWith('../'));
        } catch (error: any) {
            console.warn(`Failed to get remote files: ${error.message}`);
            return [];
        }
    }

    private mergeFileLists(
        localFiles: string[], 
        remoteFiles: string[], 
        localDirPath: string
    ): DirectoryFile[] {
        const allPaths = new Set([...localFiles, ...remoteFiles]);
        const result: DirectoryFile[] = [];

        for (const relativePath of allPaths) {
            const localExists = localFiles.includes(relativePath);
            const remoteExists = remoteFiles.includes(relativePath);
            const fullLocalPath = path.join(localDirPath, relativePath);
            
            let status: 'local' | 'remote' | 'both' | 'modified';
            if (localExists && !remoteExists) {
                status = 'local';
            } else if (!localExists && remoteExists) {
                status = 'remote';
            } else {
                status = 'both'; // Could be 'modified' if we check content
            }

            const isDirectory = localExists ? 
                fs.existsSync(fullLocalPath) && fs.statSync(fullLocalPath).isDirectory() :
                false;

            result.push({
                path: fullLocalPath,
                relativePath,
                status,
                exists: {
                    local: localExists,
                    remote: remoteExists
                },
                isDirectory
            });
        }

        return result.sort((a, b) => {
            // Directories first, then files
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.relativePath.localeCompare(b.relativePath);
        });
    }

    async retrieveRemoteFile(
        gitRoot: string, 
        reference: string, 
        relativePath: string, 
        localPath: string
    ): Promise<void> {
        try {
            const content = await this.gitService.getFileContentFromBranch(gitRoot, relativePath, reference);
            
            // Create directory if it doesn't exist
            const dir = path.dirname(localPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(localPath, content);
            vscode.window.showInformationMessage(`Retrieved file: ${path.basename(localPath)}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to retrieve file: ${error.message}`);
        }
    }

    getStatusIcon(file: DirectoryFile): string {
        if (file.isDirectory) return '📁';
        
        switch (file.status) {
            case 'local': return '📄'; // Only in local
            case 'remote': return '🆕'; // Only in remote (can be retrieved)
            case 'both': return '✅'; // In both
            case 'modified': return '📝'; // Modified
            default: return '📄';
        }
    }

    getStatusDescription(file: DirectoryFile): string {
        if (file.isDirectory) return 'Directory';
        
        switch (file.status) {
            case 'local': return 'Local only';
            case 'remote': return 'Available in reference (can retrieve)';
            case 'both': return 'Present in both';
            case 'modified': return 'Modified';
            default: return 'Unknown';
        }
    }
}
