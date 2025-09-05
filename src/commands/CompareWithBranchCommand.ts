import * as vscode from 'vscode';
import { DiffService } from '../services/DiffService';
import { VscodeGitService } from '../services/VscodeGitService';

export class CompareWithBranchCommand {
    private readonly vscodeGitService: VscodeGitService;

    constructor(private readonly diffService: DiffService) {
        this.vscodeGitService = new VscodeGitService();
    }

    async execute(uri?: vscode.Uri): Promise<void> {
        try {
            uri ??= vscode.window.activeTextEditor?.document.uri;
            if (!uri) {
                vscode.window.showErrorMessage("No file selected");
                return;
            }

            await this.vscodeGitService.initialize();

            const localOnly = vscode.workspace
                .getConfiguration("pretty-git-diff")
                .get<boolean>("localOnly", false);

            const branches = await this.vscodeGitService.getBranches(uri, !localOnly);
            const quickPickItems = this.vscodeGitService.generateBranchQuickPickItems(branches, localOnly);

            const selectedBranch = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: "Select a branch to compare with",
            });

            if (!selectedBranch) {
                vscode.window.showErrorMessage("No branch selected");
                return;
            }

            const branch = branches.find((branch) => branch.name === selectedBranch.label);
            if (!branch) {
                vscode.window.showErrorMessage(`Branch not found: ${selectedBranch.label}`);
                return;
            }

            if (branch.name === undefined) {
                vscode.window.showErrorMessage(`Branch Name is undefined: ${selectedBranch.label}`);
                return;
            }

            await this.diffService.openCurrentFileDiff(uri.fsPath, branch.name);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Pretty Git Diff: ${error.message}`);
        }
    }
}
