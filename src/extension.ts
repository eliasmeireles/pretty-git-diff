import * as vscode from 'vscode';
import { GitService, DiffService } from './services';
import { LanguageUtils } from './utils';
import { 
    CompareWithBranchCommand, 
    CompareBranchesCommand, 
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
    const compareBranchesCommand = new CompareBranchesCommand(gitService, diffService);
    const applyBranchChangesCommand = new ApplyBranchChangesCommand(gitService);
    const compareDirectoryCommand = new CompareDirectoryCommand(gitService);

    // Register commands
    const commands = [
        vscode.commands.registerCommand(
            'branchDiff.compareWithBranch', 
            () => compareWithBranchCommand.execute()
        ),
        vscode.commands.registerCommand(
            'branchDiff.compareBranches', 
            () => compareBranchesCommand.execute()
        ),
        vscode.commands.registerCommand(
            'branchDiff.compareDirectory', 
            () => compareDirectoryCommand.execute()
        ),
        vscode.commands.registerCommand(
            'branchDiff.applyBranchChanges', 
            () => applyBranchChangesCommand.execute()
        )
    ];

    context.subscriptions.push(...commands);
}

export function deactivate() {
    // Extension cleanup if needed
}