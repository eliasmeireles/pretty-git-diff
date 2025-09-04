import * as vscode from 'vscode';
import { GitService } from '../services/GitService';
import { DiffService } from '../services/DiffService';
import { ReferenceSelectionService } from '../services/ReferenceSelectionService';
import { ValidationUtils } from '../utils/ValidationUtils';

export class CompareBranchesCommand {
    private readonly referenceSelectionService: ReferenceSelectionService;

    constructor(
        private readonly gitService: GitService,
        private readonly diffService: DiffService
    ) {
        this.referenceSelectionService = new ReferenceSelectionService(gitService);
    }

    async execute(): Promise<void> {
        try {
            const workspaceFolder = ValidationUtils.validateWorkspaceFolder();
            const gitRoot = await this.gitService.getGitRoot(workspaceFolder.uri.fsPath);
            
            // Ask user to choose between branches or commits
            const comparisonType = await this.referenceSelectionService.selectComparisonType();
            if (!comparisonType) return;

            // Select two references (branches or commits)
            const references = await this.referenceSelectionService.selectTwoReferences(gitRoot, comparisonType);
            if (!references) return;

            const { ref1, ref2 } = references;

            // Get diff files between the selected references
            const diffFiles = await this.gitService.getDiffFiles(gitRoot, ref1.name, ref2.name);
            
            if (diffFiles.length === 0) {
                vscode.window.showInformationMessage(
                    `No differences found between ${this.getDisplayName(ref1)} and ${this.getDisplayName(ref2)}`
                );
                return;
            }

            // Show file selection
            const selectedFile = await vscode.window.showQuickPick(diffFiles, {
                placeHolder: `Select file to compare between ${this.getDisplayName(ref1)} and ${this.getDisplayName(ref2)}`
            });

            if (selectedFile) {
                await this.diffService.openBranchDiff(gitRoot, selectedFile.path, ref1.name, ref2.name);
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to compare references: ${error.message}`);
        }
    }

    private getDisplayName(ref: any): string {
        return ref.type === 'commit' ? ref.name.substring(0, 8) : ref.name;
    }
}
