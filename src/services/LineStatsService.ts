import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { LineChangeStats } from '../types';

const execFileAsync = promisify(execFile);
const NUMSTAT_LINE = /^(-|\d+)\t(-|\d+)\t/;
const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Computes how many lines were added and removed in a working-tree file
 * when compared with a git reference (branch, tag or commit).
 */
export class LineStatsService {
    /**
     * Returns the line change stats between `ref` and the working copy of `filePath`.
     * Untracked files are compared against the reference content (or an empty file
     * when the reference does not contain them).
     */
    async getFileStats(filePath: string, ref: string): Promise<LineChangeStats> {
        const cwd = path.dirname(filePath);
        const gitRoot = (await this.git(cwd, ['rev-parse', '--show-toplevel'])).trim();
        const relativePath = path.relative(gitRoot, filePath).split(path.sep).join('/');

        if (await this.isTracked(gitRoot, relativePath)) {
            const output = await this.git(gitRoot, ['diff', '--numstat', ref, '--', relativePath]);
            return LineStatsService.parseNumstat(output);
        }

        return this.getUntrackedFileStats(gitRoot, relativePath, filePath, ref);
    }

    /**
     * Parses `git diff --numstat` output, summing every reported entry.
     * Binary entries (`-\t-`) set the `binary` flag.
     */
    static parseNumstat(output: string): LineChangeStats {
        return output
            .split('\n')
            .map(line => NUMSTAT_LINE.exec(line))
            .filter((match): match is RegExpExecArray => match !== null)
            .reduce<LineChangeStats>((stats, [, added, removed]) => {
                if (added === '-' || removed === '-') {
                    return { ...stats, binary: true };
                }
                return {
                    added: stats.added + Number(added),
                    removed: stats.removed + Number(removed),
                    binary: stats.binary
                };
            }, { added: 0, removed: 0, binary: false });
    }

    /**
     * Formats stats for display, e.g. `+12 −3`, `no changes` or `binary`.
     */
    static format(stats: LineChangeStats): string {
        if (stats.binary) {
            return 'binary';
        }
        if (stats.added === 0 && stats.removed === 0) {
            return 'no changes';
        }
        return `+${stats.added} −${stats.removed}`;
    }

    private async getUntrackedFileStats(
        gitRoot: string,
        relativePath: string,
        filePath: string,
        ref: string
    ): Promise<LineChangeStats> {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pretty-git-diff-'));
        const refCopy = path.join(tmpDir, path.basename(filePath));
        try {
            await fs.writeFile(refCopy, await this.showFromRef(gitRoot, relativePath, ref));
            const output = await this.gitNoIndex(gitRoot, refCopy, filePath);
            return LineStatsService.parseNumstat(output);
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    }

    private async showFromRef(gitRoot: string, relativePath: string, ref: string): Promise<Buffer> {
        try {
            const { stdout } = await execFileAsync('git', ['show', `${ref}:${relativePath}`], {
                cwd: gitRoot,
                encoding: 'buffer',
                maxBuffer: MAX_BUFFER
            });
            return stdout;
        } catch {
            return Buffer.alloc(0);
        }
    }

    private async isTracked(gitRoot: string, relativePath: string): Promise<boolean> {
        try {
            await this.git(gitRoot, ['ls-files', '--error-unmatch', '--', relativePath]);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * `git diff --no-index` exits with code 1 when files differ, so the
     * output is read from the error in that case.
     */
    private async gitNoIndex(cwd: string, left: string, right: string): Promise<string> {
        try {
            return await this.git(cwd, ['diff', '--no-index', '--numstat', '--', left, right]);
        } catch (error: any) {
            if (error.code === 1 && typeof error.stdout === 'string') {
                return error.stdout;
            }
            throw error;
        }
    }

    private async git(cwd: string, args: string[]): Promise<string> {
        const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: MAX_BUFFER });
        return stdout;
    }
}
