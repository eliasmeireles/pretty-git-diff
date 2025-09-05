import * as vscode from 'vscode';
import { GitService, DiffService } from './services';
import { LanguageUtils } from './utils';
import { 
    CompareWithBranchCommand, 
    CompareWithCommitCommand,
    ApplyBranchChangesCommand,
    CompareDirectoryCommand
} from './commands';

export function activate(context: vscode.ExtensionContext) {
    // Initialize services
    const gitService = new GitService();
    const languageUtils = new LanguageUtils();
    const diffService = new DiffService(gitService, languageUtils);

    // Initialize commands
    const compareWithBranchCommand = new CompareWithBranchCommand(diffService);
    const compareWithCommitCommand = new CompareWithCommitCommand(diffService);
    const applyBranchChangesCommand = new ApplyBranchChangesCommand(gitService);
    const compareDirectoryCommand = new CompareDirectoryCommand(gitService);

    // Register commands
    const commands = [
        vscode.commands.registerCommand(
            'branchDiff.compareWithBranch', 
            (uri?: vscode.Uri) => compareWithBranchCommand.execute(uri)
        ),
        vscode.commands.registerCommand(
            'branchDiff.compareWithCommit', 
            (uri?: vscode.Uri) => compareWithCommitCommand.execute(uri)
        ),
        vscode.commands.registerCommand(
            'branchDiff.compareDirectory', 
            (uri?: vscode.Uri) => compareDirectoryCommand.execute(uri)
        ),
        vscode.commands.registerCommand(
            'branchDiff.applyBranchChanges', 
            (uri?: vscode.Uri) => applyBranchChangesCommand.execute(uri)
        )
    ];

    context.subscriptions.push(...commands);
}

export function deactivate() {
    // Extension cleanup if needed
}