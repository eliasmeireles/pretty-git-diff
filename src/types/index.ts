export interface DiffFile {
    path: string;
    status: string;
    label: string;
}

export interface GitRepository {
    root: string;
}

export interface BranchComparison {
    branch1: string;
    branch2: string;
    files: DiffFile[];
}

export interface FileContent {
    content: string;
    language: string;
}

export interface GitReference {
    name: string;
    type: 'branch' | 'commit';
    displayName: string;
    description?: string;
    label: string;
    detail?: string;
}

export interface CommitInfo {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
    displayName: string;
}

export enum ComparisonType {
    BRANCH = 'branch',
    COMMIT = 'commit'
}

export interface DirectoryFile {
    path: string;
    relativePath: string;
    status: 'local' | 'remote' | 'both' | 'modified';
    exists: {
        local: boolean;
        remote: boolean;
    };
    isDirectory: boolean;
}

export interface DirectoryComparison {
    localPath: string;
    reference: string;
    files: DirectoryFile[];
}

export interface LineChangeStats {
    added: number;
    removed: number;
    binary: boolean;
}
