import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from './GitService';
import { LanguageUtils } from '../utils';

export class DiffService {
    constructor(
        private readonly gitService: GitService,
        private readonly languageUtils: LanguageUtils
    ) {}

    async openBranchDiff(gitRoot: string, filePath: string, branch1: string, branch2: string): Promise<void> {
        const fileName = path.basename(filePath);
        
        try {
            const content1 = await this.gitService.getFileContentFromBranch(gitRoot, filePath, branch1);
            const content2 = await this.gitService.getFileContentFromBranch(gitRoot, filePath, branch2);
            
            const leftDoc = await vscode.workspace.openTextDocument({
                content: content1,
                language: this.languageUtils.getLanguageFromExtension(fileName)
            });
            
            const rightDoc = await vscode.workspace.openTextDocument({
                content: content2,
                language: this.languageUtils.getLanguageFromExtension(fileName)
            });
            
            const title = `${fileName} (${branch1} ↔ ${branch2})`;
            await vscode.commands.executeCommand('vscode.diff', leftDoc.uri, rightDoc.uri, title);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to open diff view: ${error.message}`);
            await this.showFallbackDiff(gitRoot, filePath, branch1, branch2);
        }
    }

    async openCurrentFileDiff(filePath: string, branch: string): Promise<void> {
        try {
            const gitRoot = await this.gitService.getGitRoot(path.dirname(filePath));
            const relativePath = path.relative(gitRoot, filePath).replace(/\\/g, '/');
            
            const branchContent = await this.gitService.getFileContentFromBranch(gitRoot, relativePath, branch);
            
            const branchDoc = await vscode.workspace.openTextDocument({
                content: branchContent,
                language: this.languageUtils.getLanguageFromExtension(path.basename(filePath))
            });
            
            const currentDoc = await vscode.workspace.openTextDocument(filePath);
            const title = `${path.basename(filePath)} (${branch} ↔ Working)`;
            
            await vscode.commands.executeCommand('vscode.diff', branchDoc.uri, currentDoc.uri, title);
        } catch (error: any) {
            throw new Error(`Failed to compare with branch: ${error.message}`);
        }
    }

    private async showFallbackDiff(gitRoot: string, filePath: string, branch1: string, branch2: string): Promise<void> {
        try {
            const diffOutput = await this.gitService.getDiffOutput(gitRoot, filePath, branch1, branch2);
            
            if (diffOutput.trim()) {
                const doc = await vscode.workspace.openTextDocument({
                    content: diffOutput,
                    language: 'diff'
                });
                await vscode.window.showTextDocument(doc);
            } else {
                vscode.window.showInformationMessage(
                    `No differences found in ${filePath} between ${branch1} and ${branch2}`
                );
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to show diff: ${error.message}`);
        }
    }
}
