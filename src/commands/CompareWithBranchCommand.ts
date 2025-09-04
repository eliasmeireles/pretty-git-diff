import * as vscode from 'vscode';
import * as path from 'path';
import { DiffService } from '../services/DiffService';
import { GitService } from '../services/GitService';
import { ReferenceSelectionService } from '../services/ReferenceSelectionService';
import { ValidationUtils } from '../utils/ValidationUtils';

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
                // Called from explorer context menu
                filePath = uri.fsPath;
            } else {
                // Called from editor context or command palette
                const editor = ValidationUtils.validateActiveEditor();
                filePath = editor.document.uri.fsPath;
            }
            
            const gitRoot = await this.gitService.getGitRoot(path.dirname(filePath));
            
            // Ask user to choose between branches or commits
            const comparisonType = await this.referenceSelectionService.selectComparisonType();
            if (!comparisonType) return;

            // Select reference to compare with
            const reference = await this.referenceSelectionService.selectReference(
                gitRoot,
                comparisonType,
                `Select ${comparisonType} to compare with current file`
            );
            
            if (!reference) return;
            
            await this.diffService.openCurrentFileDiff(filePath, reference.name);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(error.message);
        }
    }
}
