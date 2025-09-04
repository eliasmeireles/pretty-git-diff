import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from '../services/GitService';
import { ReferenceSelectionService } from '../services/ReferenceSelectionService';
import { ValidationUtils } from '../utils/ValidationUtils';

export class ApplyBranchChangesCommand {
    private readonly referenceSelectionService: ReferenceSelectionService;

    constructor(private readonly gitService: GitService) {
        this.referenceSelectionService = new ReferenceSelectionService(gitService);
    }

    async execute(uri?: vscode.Uri): Promise<void> {
        try {
            let filePath: string;
            let document: vscode.TextDocument;
            
            if (uri) {
                // Called from explorer context menu
                filePath = uri.fsPath;
                document = await vscode.workspace.openTextDocument(uri);
            } else {
                // Called from editor context or command palette
                const editor = ValidationUtils.validateActiveEditor();
                document = editor.document;
                filePath = document.uri.fsPath;
            }
            
            const gitRoot = await this.gitService.getGitRoot(path.dirname(filePath));
            
            // Ask user to choose between branches or commits
            const comparisonType = await this.referenceSelectionService.selectComparisonType();
            if (!comparisonType) return;

            // Select reference to apply changes from
            const reference = await this.referenceSelectionService.selectReference(
                gitRoot,
                comparisonType,
                `Select ${comparisonType} to apply changes from`
            );
            
            if (!reference) return;
            
            await this.applyChangesFromReference(document, filePath, reference.name);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(error.message);
        }
    }

    private async applyChangesFromReference(
        document: vscode.TextDocument, 
        filePath: string, 
        reference: string
    ): Promise<void> {
        const gitRoot = await this.gitService.getGitRoot(path.dirname(filePath));
        const relativePath = path.relative(gitRoot, filePath).replace(/\\/g, '/');
        const content = await this.gitService.getFileContentFromBranch(gitRoot, relativePath, reference);
        
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange, content);
        
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(`Applied changes from ${reference}`);
    }
}
