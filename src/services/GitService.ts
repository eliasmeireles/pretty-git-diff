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
        const seenBranches = new Set<string>();
        
        stdout.split('\n')
            .filter(line => line.trim())
            .forEach(line => {
                const cleanLine = line.replace(/^\*?\s*/, ''); // Remove * and spaces
                if (!cleanLine.includes('->') && cleanLine) {
                    const isRemote = cleanLine.startsWith('remotes/');
                    
                    if (isRemote) {
                        // For remote branches, extract remote and branch name
                        const fullRef = cleanLine; // e.g., "remotes/origin/branch-name"
                        const remotePart = cleanLine.replace(/^remotes\//, ''); // "origin/branch-name"
                        const displayName = remotePart; // Show as "origin/branch-name"
                        
                        if (!seenBranches.has(displayName)) {
                            seenBranches.add(displayName);
                            branches.push({
                                name: fullRef, // Use full reference for git commands
                                type: 'branch',
                                displayName: displayName,
                                description: 'Remote branch',
                                label: `🌐 ${displayName}`,
                                detail: 'Remote branch'
                            });
                        }
                    } else {
                        // For local branches, prefix with "local/"
                        const branchName = cleanLine;
                        const displayName = `local/${branchName}`;
                        
                        if (!seenBranches.has(displayName)) {
                            seenBranches.add(displayName);
                            branches.push({
                                name: branchName,
                                type: 'branch',
                                displayName: displayName,
                                description: 'Local branch',
                                label: `📁 ${displayName}`,
                                detail: 'Local branch'
                            });
                        }
                    }
                }
            });

        return branches.sort((a, b) => a.displayName.localeCompare(b.displayName));
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
                    displayName: `${shortHash} - ${message.length > 40 ? 
                        message.substring(0, 40) + '...' : message} (${author})`
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
            .filter(line => {
                // Only include files that have actual changes (exclude identical files)
                const [status] = line.split('\t');
                return status && status !== 'U'; // Exclude unmerged files and ensure status exists
            })
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
            // Try different branch reference formats
            let gitRef = branch;
            
            // If it's a remote branch reference, try with origin/ prefix
            if (!branch.includes('/') && !branch.startsWith('origin/')) {
                try {
                    // First try as-is
                    const { stdout } = await execAsync(`git show ${branch}:${filePath}`, { cwd: gitRoot });
                    return stdout;
                } catch {
                    // If that fails, try with origin/ prefix
                    gitRef = `origin/${branch}`;
                }
            }
            
            const { stdout } = await execAsync(`git show ${gitRef}:${filePath}`, { cwd: gitRoot });
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
