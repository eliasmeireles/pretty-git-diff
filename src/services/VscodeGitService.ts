import * as vscode from 'vscode';
import { API, GitExtension, Repository, Ref } from '../git';

export class VscodeGitService {
    private gitApi: API | null = null;

    async initialize(): Promise<void> {
        const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
        if (!gitExtension) {
            throw new Error('Git extension not found');
        }

        if (!gitExtension.enabled) {
            throw new Error('Git extension is not enabled');
        }

        this.gitApi = gitExtension.getAPI(1);
        
        if (this.gitApi.state !== 'initialized') {
            await new Promise<void>((resolve) => {
                if (this.gitApi!.state === 'initialized') {
                    resolve();
                    return;
                }
                
                const disposable = this.gitApi!.onDidChangeState((state) => {
                    if (state === 'initialized') {
                        disposable.dispose();
                        resolve();
                    }
                });
            });
        }
    }

    getRepository(uri: vscode.Uri): Repository | null {
        if (!this.gitApi) {
            throw new Error('Git API not initialized');
        }
        return this.gitApi.getRepository(uri);
    }

    async getBranches(uri: vscode.Uri, includeRemote: boolean = true): Promise<Ref[]> {
        const repo = this.getRepository(uri);
        if (!repo) {
            throw new Error(`Repository not found for URI: ${uri.toString()}`);
        }

        const branches = await repo.getBranches({ remote: includeRemote });
        const tags = await repo.getRefs({ pattern: "refs/tags/*" });

        return branches.map((branch) => {
            const branchTags = tags.filter((tag) => tag.commit === branch.commit);
            return {
                ...branch,
                tags: branchTags.map((tag) => tag.name),
            } as Ref & { tags: (string | undefined)[] };
        });
    }

    async getCommits(uri: vscode.Uri, filePath?: string, maxEntries: number = 20): Promise<any[]> {
        const repo = this.getRepository(uri);
        if (!repo) {
            throw new Error(`Repository not found for URI: ${uri.toString()}`);
        }

        let relativePath: string | undefined;
        if (filePath) {
            relativePath = repo.rootUri.fsPath 
                ? filePath.replace(repo.rootUri.fsPath + "/", "")
                : filePath;
        }

        const commits = await repo.log({ 
            maxEntries, 
            path: relativePath 
        });

        return commits.sort((a, b) => {
            if (a.commitDate === undefined) return -1;
            if (b.commitDate === undefined) return 1;
            return b.commitDate.getTime() - a.commitDate.getTime();
        });
    }

    createGitUri(uri: vscode.Uri, ref: string): vscode.Uri {
        if (!this.gitApi) {
            throw new Error('Git API not initialized');
        }
        return this.gitApi.toGitUri(uri, ref);
    }

    generateBranchQuickPickItems(branches: Ref[], localOnly: boolean = false): vscode.QuickPickItem[] {
        const localBranches = branches.filter(branch => !branch.remote);
        const remoteBranches = branches.filter(branch => branch.remote);

        const toQuickPickItems = (branches: Ref[], iconId: string): vscode.QuickPickItem[] => {
            return branches.map(branch => ({
                label: branch.name || "unknown",
                description: (branch as any).tags?.length ? `Tags: ${(branch as any).tags.join(", ")}` : "",
            }));
        };

        const localBranchesItems = toQuickPickItems(localBranches, "git-branch");
        const remoteBranchesItems = toQuickPickItems(remoteBranches, "cloud");

        const divider = (label: string): vscode.QuickPickItem => ({
            label,
            kind: -1,
        } as vscode.QuickPickItem);

        if (localOnly) {
            return [divider("local branches"), ...localBranchesItems];
        }

        return [
            divider("local branches"), 
            ...localBranchesItems, 
            divider("remote branches"), 
            ...remoteBranchesItems
        ];
    }

    generateCommitQuickPickItems(commits: any[]): vscode.QuickPickItem[] {
        return commits.map(commit => ({
            label: commit.hash,
            description: commit.commitDate?.toUTCString(),
            detail: `${commit.authorName}: ${commit.message}`,
        }));
    }
}
