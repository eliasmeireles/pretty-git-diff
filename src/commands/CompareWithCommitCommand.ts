import * as vscode from 'vscode';
import { DiffService } from '../services/DiffService';
import { VscodeGitService } from '../services/VscodeGitService';

export class CompareWithCommitCommand {
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

            const commitHistoryLength = vscode.workspace
                .getConfiguration("pretty-git-diff")
                .get<number>("commitHistoryLength", 100);

            const commits = await this.vscodeGitService.getCommits(uri, uri.fsPath, commitHistoryLength);
            const quickPickItems = this.vscodeGitService.generateCommitQuickPickItems(commits);

            const selectedCommit = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: "Select a commit to compare with or search commit hash",
            });

            if (!selectedCommit) {
                vscode.window.showErrorMessage("No commit selected");
                return;
            }

            const selectedCommitHash = selectedCommit.label;
            await this.diffService.openCurrentFileDiff(uri.fsPath, selectedCommitHash);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Pretty Git Diff: ${error.message}`);
        }
    }
}
