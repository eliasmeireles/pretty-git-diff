import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from '../services/GitService';
import { DirectoryComparisonService } from '../services/DirectoryComparisonService';
import { ReferenceSelectionService } from '../services/ReferenceSelectionService';
import { ValidationUtils } from '../utils/ValidationUtils';
import { DirectoryFile } from '../types';

export class CompareDirectoryCommand {
    private readonly referenceSelectionService: ReferenceSelectionService;
    private readonly directoryComparisonService: DirectoryComparisonService;

    constructor(private readonly gitService: GitService) {
        this.referenceSelectionService = new ReferenceSelectionService(gitService);
        this.directoryComparisonService = new DirectoryComparisonService(gitService);
    }

    async execute(): Promise<void> {
        try {
            const workspaceFolder = ValidationUtils.validateWorkspaceFolder();
            
            // Select directory to compare
            const selectedFolder = await this.selectDirectory(workspaceFolder.uri.fsPath);
            if (!selectedFolder) return;

            const gitRoot = await this.gitService.getGitRoot(selectedFolder);
            
            // Ask user to choose between branches or commits
            const comparisonType = await this.referenceSelectionService.selectComparisonType();
            if (!comparisonType) return;

            // Select reference to compare with
            const reference = await this.referenceSelectionService.selectReference(
                gitRoot,
                comparisonType,
                `Select ${comparisonType} to compare directory with`
            );
            
            if (!reference) return;

            // Show loading message
            const progress = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Comparing directory with ${reference.name}...`,
                cancellable: false
            }, async () => {
                return await this.directoryComparisonService.compareDirectoryWithReference(
                    selectedFolder,
                    reference.name
                );
            });

            // Show results
            await this.showComparisonResults(progress, gitRoot);

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to compare directory: ${error.message}`);
        }
    }

    private async selectDirectory(workspacePath: string): Promise<string | undefined> {
        const options = [
            {
                label: '📁 Current Workspace Root',
                description: 'Compare entire workspace',
                path: workspacePath
            },
            {
                label: '📁 Select Folder...',
                description: 'Choose specific folder to compare',
                path: 'SELECT'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select directory to compare'
        });

        if (!selected) return undefined;

        if (selected.path === 'SELECT') {
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Folder'
            });
            
            return folderUri?.[0]?.fsPath;
        }

        return selected.path;
    }

    private async showComparisonResults(
        comparison: any,
        gitRoot: string
    ): Promise<void> {
        interface FileItem {
            label: string;
            description: string;
            detail: string;
            file: DirectoryFile;
        }

        const items: FileItem[] = comparison.files.map((file: DirectoryFile) => ({
            label: `${this.directoryComparisonService.getStatusIcon(file)} ${file.relativePath}`,
            description: this.directoryComparisonService.getStatusDescription(file),
            detail: file.path,
            file
        }));

        if (items.length === 0) {
            vscode.window.showInformationMessage('No differences found between directory and reference');
            return;
        }

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Directory comparison results (${items.length} items)`,
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selected) return;

        await this.handleFileAction(selected.file, comparison, gitRoot);
    }

    private async handleFileAction(
        file: DirectoryFile,
        comparison: any,
        gitRoot: string
    ): Promise<void> {
        if (file.isDirectory) {
            vscode.window.showInformationMessage('Directory selected. No actions available for directories.');
            return;
        }

        const actions = [];

        if (file.exists.local && file.exists.remote) {
            actions.push({
                label: '👁️ View Diff',
                action: 'diff'
            });
        }

        if (!file.exists.local && file.exists.remote) {
            actions.push({
                label: '⬇️ Retrieve File',
                action: 'retrieve'
            });
        }

        if (file.exists.local) {
            actions.push({
                label: '📖 Open Local File',
                action: 'open'
            });
        }

        if (actions.length === 0) {
            vscode.window.showInformationMessage('No actions available for this file');
            return;
        }

        const selectedAction = await vscode.window.showQuickPick(actions, {
            placeHolder: `What would you like to do with ${file.relativePath}?`
        });

        if (!selectedAction) return;

        switch (selectedAction.action) {
            case 'diff':
                await this.showFileDiff(file, comparison.reference, gitRoot);
                break;
            case 'retrieve':
                await this.retrieveFile(file, comparison.reference, gitRoot);
                break;
            case 'open':
                await this.openLocalFile(file);
                break;
        }
    }

    private async showFileDiff(file: DirectoryFile, reference: string, gitRoot: string): Promise<void> {
        try {
            const relativePath = path.relative(gitRoot, file.path).replace(/\\/g, '/');
            const remoteContent = await this.gitService.getFileContentFromBranch(gitRoot, relativePath, reference);
            
            const remoteDoc = await vscode.workspace.openTextDocument({
                content: remoteContent,
                language: this.getLanguageFromExtension(file.relativePath)
            });
            
            const localDoc = await vscode.workspace.openTextDocument(file.path);
            const title = `${path.basename(file.relativePath)} (${reference} ↔ Local)`;
            
            await vscode.commands.executeCommand('vscode.diff', remoteDoc.uri, localDoc.uri, title);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to show diff: ${error.message}`);
        }
    }

    private async retrieveFile(file: DirectoryFile, reference: string, gitRoot: string): Promise<void> {
        const relativePath = path.relative(gitRoot, file.path).replace(/\\/g, '/');
        await this.directoryComparisonService.retrieveRemoteFile(gitRoot, reference, relativePath, file.path);
    }

    private async openLocalFile(file: DirectoryFile): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(file.path);
        await vscode.window.showTextDocument(doc);
    }

    private getLanguageFromExtension(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const languageMap: { [key: string]: string } = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'javascriptreact',
            '.tsx': 'typescriptreact',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.json': 'json',
            '.md': 'markdown',
            '.txt': 'plaintext'
        };
        
        return languageMap[ext] || 'plaintext';
    }
}
