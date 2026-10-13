import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from './GitService';
import { VscodeGitService } from './VscodeGitService';
import { LineStatsService } from './LineStatsService';
import { LanguageUtils } from '../utils';

export class DiffService {
    private readonly vscodeGitService: VscodeGitService;

    constructor(
        private readonly gitService: GitService,
        private readonly languageUtils: LanguageUtils,
        private readonly lineStatsService: LineStatsService = new LineStatsService()
    ) {
        this.vscodeGitService = new VscodeGitService();
    }

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
            await this.vscodeGitService.initialize();
            
            const currentFileUri = vscode.Uri.file(filePath);
            const gitUri = this.vscodeGitService.createGitUri(currentFileUri, branch);
            const fileName = path.basename(filePath);
            const stats = await this.describeLineChanges(filePath, branch);
            const title = `${fileName} (${branch} ↔ Working)${stats}`;
            
            await vscode.commands.executeCommand('vscode.diff', gitUri, currentFileUri, title);
            
        } catch (error: any) {
            throw new Error(`Failed to compare with branch: ${error.message}`);
        }
    }

    /**
     * Returns a title suffix such as ` · +12 −3`, or an empty string when the
     * stats cannot be computed, so the diff view still opens.
     */
    private async describeLineChanges(filePath: string, ref: string): Promise<string> {
        try {
            const stats = await this.lineStatsService.getFileStats(filePath, ref);
            return ` · ${LineStatsService.format(stats)}`;
        } catch {
            return '';
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
