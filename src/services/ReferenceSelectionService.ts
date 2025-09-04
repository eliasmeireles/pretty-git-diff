import * as vscode from 'vscode';
import { GitService } from './GitService';
import { GitReference, ComparisonType } from '../types';

export class ReferenceSelectionService {
    constructor(private readonly gitService: GitService) {}

    async selectComparisonType(): Promise<ComparisonType | undefined> {
        const options = [
            {
                label: '🌿 Compare Branches',
                description: 'Compare between different branches (local and remote)',
                value: ComparisonType.BRANCH
            },
            {
                label: '📝 Compare Commits',
                description: 'Compare between specific commits',
                value: ComparisonType.COMMIT
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'How would you like to compare?'
        });

        return selected?.value;
    }

    async selectReference(
        gitRoot: string, 
        type: ComparisonType, 
        prompt: string
    ): Promise<GitReference | undefined> {
        const references = await this.getFilteredReferences(gitRoot, type);
        
        if (references.length === 0) {
            vscode.window.showErrorMessage(`No ${type}s found in repository`);
            return undefined;
        }

        return await vscode.window.showQuickPick(references, {
            placeHolder: prompt,
            matchOnDescription: true,
            matchOnDetail: true
        });
    }

    async selectTwoReferences(
        gitRoot: string, 
        type: ComparisonType
    ): Promise<{ ref1: GitReference; ref2: GitReference } | undefined> {
        const ref1 = await this.selectReference(
            gitRoot, 
            type, 
            `Select first ${type}`
        );
        
        if (!ref1) return undefined;

        const references = await this.getFilteredReferences(gitRoot, type);
        const filteredRefs = references.filter(ref => ref.name !== ref1.name);

        if (filteredRefs.length === 0) {
            vscode.window.showErrorMessage(`Need at least 2 ${type}s for comparison`);
            return undefined;
        }

        const ref2 = await vscode.window.showQuickPick(filteredRefs, {
            placeHolder: `Select second ${type}`,
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!ref2) return undefined;

        return { ref1, ref2 };
    }

    private async getFilteredReferences(
        gitRoot: string, 
        type: ComparisonType
    ): Promise<GitReference[]> {
        if (type === ComparisonType.BRANCH) {
            return await this.gitService.getBranchesWithRemotes(gitRoot);
        } else {
            const commits = await this.gitService.getRecentCommits(gitRoot, 30);
            return commits.map(commit => ({
                name: commit.hash,
                type: 'commit' as const,
                displayName: `📝 ${commit.displayName}`,
                description: `${commit.date} - ${commit.author}`,
                label: `📝 ${commit.displayName}`,
                detail: `${commit.date} - ${commit.author}`
            }));
        }
    }
}
