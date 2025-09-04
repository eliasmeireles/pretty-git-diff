import { exec } from 'child_process';
import { promisify } from 'util';
import { DiffFile, GitReference, CommitInfo } from '../types';

const execAsync = promisify(exec);

export class GitService {
    // Expose execAsync for other services
    execAsync = execAsync;
    async getGitRoot(cwd: string): Promise<string> {
        const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd });
        return stdout.trim();
    }

    async getBranches(gitRoot: string): Promise<string[]> {
        const { stdout } = await execAsync('git branch -a', { cwd: gitRoot });
        return stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('*') && !line.includes('->'))
            .map(line => line.replace(/^(remotes\/)?origin\//, ''))
            .filter((branch, index, arr) => arr.indexOf(branch) === index)
            .sort((a, b) => a.localeCompare(b));
    }

    async getBranchesWithRemotes(gitRoot: string): Promise<GitReference[]> {
        const { stdout } = await execAsync('git branch -a', { cwd: gitRoot });
        const branches: GitReference[] = [];
        
        stdout.split('\n')
            .filter(line => line.trim())
            .forEach(line => {
                const cleanLine = line.replace(/^\*?\s*/, ''); // Remove * and spaces
                if (!cleanLine.includes('->') && cleanLine) {
                    const isRemote = cleanLine.startsWith('remotes/');
                    const branchName = isRemote 
                        ? cleanLine.replace(/^remotes\/origin\//, '')
                        : cleanLine;
                    const displayName = isRemote 
                        ? `🌐 ${branchName}` 
                        : `📁 ${branchName}`;
                    
                    // Avoid duplicates
                    if (!branches.find(b => b.name === branchName)) {
                        branches.push({
                            name: branchName,
                            type: 'branch',
                            displayName,
                            description: isRemote ? 'Remote branch' : 'Local branch',
                            label: displayName,
                            detail: isRemote ? 'Remote branch' : 'Local branch'
                        });
                    }
                }
            });

        return branches.sort((a, b) => a.name.localeCompare(b.name));
    }

    async getRecentCommits(gitRoot: string, limit: number = 20): Promise<CommitInfo[]> {
        const { stdout } = await execAsync(
            `git log --pretty=format:"%H|%h|%s|%an|%ad" --date=short -n ${limit}`, 
            { cwd: gitRoot }
        );
        
        return stdout
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [hash, shortHash, message, author, date] = line.split('|');
                return {
                    hash,
                    shortHash,
                    message: message.length > 50 ? message.substring(0, 50) + '...' : message,
                    author,
                    date,
                    displayName: `${shortHash} - ${message.length > 40 ? message.substring(0, 40) + '...' : message} (${author})`
                };
            });
    }

    async getGitReferences(gitRoot: string): Promise<GitReference[]> {
        const [branches, commits] = await Promise.all([
            this.getBranchesWithRemotes(gitRoot),
            this.getRecentCommits(gitRoot)
        ]);

        const commitRefs: GitReference[] = commits.map(commit => ({
            name: commit.hash,
            type: 'commit' as const,
            displayName: `📝 ${commit.displayName}`,
            description: `${commit.date} - ${commit.author}`,
            label: `📝 ${commit.displayName}`,
            detail: `${commit.date} - ${commit.author}`
        }));

        return [...branches, ...commitRefs];
    }

    async getDiffFiles(gitRoot: string, branch1: string, branch2: string): Promise<DiffFile[]> {
        const { stdout } = await execAsync(`git diff --name-status ${branch1}...${branch2}`, { cwd: gitRoot });
        
        return stdout
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [status, filePath] = line.split('\t');
                const statusLabel = this.getStatusLabel(status);
                return {
                    path: filePath,
                    status: status,
                    label: `${statusLabel} ${filePath}`
                };
            });
    }

    async getFileContentFromBranch(gitRoot: string, filePath: string, branch: string): Promise<string> {
        try {
            const { stdout } = await execAsync(`git show ${branch}:${filePath}`, { cwd: gitRoot });
            return stdout;
        } catch (error: any) {
            return `// File not found in branch '${branch}'\n// ${error.message}`;
        }
    }

    async getDiffOutput(gitRoot: string, filePath: string, branch1: string, branch2: string): Promise<string> {
        const { stdout } = await execAsync(`git diff ${branch1}..${branch2} -- ${filePath}`, { cwd: gitRoot });
        return stdout;
    }

    private getStatusLabel(status: string): string {
        switch (status) {
            case 'A': return '✅ Added';
            case 'D': return '❌ Deleted';
            case 'M': return '📝 Modified';
            case 'R': return '🔄 Renamed';
            case 'C': return '📋 Copied';
            default: return `${status}`;
        }
    }
}
