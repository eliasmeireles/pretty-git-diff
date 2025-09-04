import * as vscode from 'vscode';

export class ValidationUtils {
    static validateWorkspaceFolder(): vscode.WorkspaceFolder {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open');
        }
        return workspaceFolder;
    }

    static validateActiveEditor(): vscode.TextEditor {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor');
        }
        return editor;
    }

    static validateBranchesCount(branches: string[]): void {
        if (branches.length < 2) {
            throw new Error('At least 2 branches are required for comparison');
        }
    }

    static validateUserInput(input: string | undefined, fieldName: string): string {
        if (!input) {
            throw new Error(`${fieldName} is required`);
        }
        return input;
    }
}
