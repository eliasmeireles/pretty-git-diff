import * as vscode from 'vscode';
import * as path from 'path';
import { DiffService } from '../services/DiffService';
import { GitService } from '../services/GitService';
import { ReferenceSelectionService } from '../services/ReferenceSelectionService';

export class CompareWithBranchCommand {
    private readonly gitService: GitService;
    private readonly referenceSelectionService: ReferenceSelectionService;

    constructor(private readonly diffService: DiffService) {
        this.gitService = new GitService();
        this.referenceSelectionService = new ReferenceSelectionService(this.gitService);
    }

    async execute(uri?: vscode.Uri): Promise<void> {
        try {
            let filePath: string;
            
            if (uri) {
                filePath = uri.fsPath;
            } else {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showWarningMessage(
                        'Pretty Git Diff: File - Please open a file in the editor or ' +
                        'right-click on a file in the explorer.'
                    );
                    return;
                }
                filePath = editor.document.uri.fsPath;
            }
            
            let gitRoot: string;
            try {
                gitRoot = await this.gitService.getGitRoot(path.dirname(filePath));
            } catch (gitError: any) {
                vscode.window.showErrorMessage(
                    'Pretty Git Diff: This project is not a Git repository. Please initialize Git first.'
                );
                return;
            }
            
            const comparisonType = await this.referenceSelectionService.selectComparisonType();
            if (!comparisonType) return;

            const reference = await this.referenceSelectionService.selectReference(
                gitRoot,
                comparisonType,
                `Select ${comparisonType} to compare with current file`
            );
            
            if (!reference) return;
            
            await this.diffService.openCurrentFileDiff(filePath, reference.name);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Pretty Git Diff: ${error.message}`);
        }
    }
}
