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

            // Create options with "Retrieve All" as first option if multiple files
            const options = [];
            
            if (diffFiles.length > 1) {
                options.push({
                    label: '📥 Retrieve All Files',
                    description: `Download all ${diffFiles.length} changed files`,
                    path: '__RETRIEVE_ALL__',
                    status: 'RETRIEVE_ALL'
                });
            }
            
            // Add individual files
            options.push(...diffFiles);

            // Show file selection
            const selectedOption = await vscode.window.showQuickPick(options, {
                placeHolder: `Select file to compare between ${this.getDisplayName(ref1)} and ${this.getDisplayName(ref2)}`
            });

            if (selectedOption) {
                if (selectedOption.path === '__RETRIEVE_ALL__') {
                    await this.retrieveAllFiles(gitRoot, diffFiles, ref1.name, ref2.name);
                } else {
                    await this.diffService.openBranchDiff(gitRoot, selectedOption.path, ref1.name, ref2.name);
                }
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to compare references: ${error.message}`);
        }
    }

    private async retrieveAllFiles(gitRoot: string, diffFiles: any[], ref1Name: string, ref2Name: string): Promise<void> {
        const progress = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Retrieving ${diffFiles.length} files...`,
            cancellable: false
        }, async (progress) => {
            let completed = 0;
            
            for (const file of diffFiles) {
                progress.report({
                    message: `Processing ${file.path}...`,
                    increment: (100 / diffFiles.length)
                });
                
                try {
                    await this.diffService.openBranchDiff(gitRoot, file.path, ref1Name, ref2Name);
                    completed++;
                    
                    // Small delay to prevent overwhelming VS Code
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Failed to retrieve ${file.path}: ${error.message}`);
                }
            }
            
            return completed;
        });
        
        vscode.window.showInformationMessage(`Successfully retrieved ${progress} of ${diffFiles.length} files`);
    }

    private getDisplayName(ref: any): string {
        return ref.type === 'commit' ? ref.name.substring(0, 8) : ref.name;
    }
}
