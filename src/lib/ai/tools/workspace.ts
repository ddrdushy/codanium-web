// =============================================================================
// AI Team Studio — Project Workspace Manager
// =============================================================================
// Each project gets an isolated workspace directory where agents read/write
// real source code files. All filesystem operations are sandboxed to the
// workspace root — no path traversal allowed.
// =============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Root directory for all project workspaces
const WORKSPACES_ROOT = process.env.WORKSPACES_ROOT || path.join(process.cwd(), 'workspaces');

// Max command timeout in seconds
const MAX_COMMAND_TIMEOUT = 300;
const DEFAULT_COMMAND_TIMEOUT = 60;

/**
 * Get the absolute workspace path for a project.
 * Creates the directory if it doesn't exist.
 */
export async function getWorkspacePath(projectId: string): Promise<string> {
  const workspacePath = path.join(WORKSPACES_ROOT, projectId);
  await fs.mkdir(workspacePath, { recursive: true });
  return workspacePath;
}

/**
 * Resolve a relative path to an absolute path within the workspace.
 * Throws if the resolved path escapes the workspace root (path traversal).
 */
function resolveSecure(workspacePath: string, relativePath: string): string {
  const resolved = path.resolve(workspacePath, relativePath);
  if (!resolved.startsWith(workspacePath)) {
    throw new Error(`Path traversal blocked: "${relativePath}" resolves outside workspace`);
  }
  return resolved;
}

// ─── Filesystem Operations ────────────────────────────────────────────────────

export async function readFileInWorkspace(
  projectId: string,
  filePath: string,
): Promise<{ content: string; size: number }> {
  const workspace = await getWorkspacePath(projectId);
  const absolute = resolveSecure(workspace, filePath);

  try {
    const content = await fs.readFile(absolute, 'utf-8');
    const stat = await fs.stat(absolute);
    return { content, size: stat.size };
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }
}

export async function writeFileInWorkspace(
  projectId: string,
  filePath: string,
  content: string,
): Promise<{ path: string; size: number }> {
  const workspace = await getWorkspacePath(projectId);
  const absolute = resolveSecure(workspace, filePath);

  // Create parent directories
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, 'utf-8');

  const stat = await fs.stat(absolute);
  return { path: filePath, size: stat.size };
}

export async function editFileInWorkspace(
  projectId: string,
  filePath: string,
  oldString: string,
  newString: string,
): Promise<{ path: string; replaced: boolean }> {
  const workspace = await getWorkspacePath(projectId);
  const absolute = resolveSecure(workspace, filePath);

  const content = await fs.readFile(absolute, 'utf-8');
  if (!content.includes(oldString)) {
    throw new Error(`old_string not found in ${filePath}. Read the file first to get the exact content.`);
  }

  const updated = content.replace(oldString, newString);
  await fs.writeFile(absolute, updated, 'utf-8');
  return { path: filePath, replaced: true };
}

export async function listDirectoryInWorkspace(
  projectId: string,
  dirPath: string = '.',
  recursive: boolean = false,
): Promise<Array<{ name: string; type: 'file' | 'directory'; size: number }>> {
  const workspace = await getWorkspacePath(projectId);
  const absolute = resolveSecure(workspace, dirPath);

  const entries: Array<{ name: string; type: 'file' | 'directory'; size: number }> = [];

  async function scan(dir: string, prefix: string) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      // Skip node_modules, .git, and other large/hidden directories
      if (item.name === 'node_modules' || item.name === '.git') continue;

      const relativeName = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isDirectory()) {
        entries.push({ name: relativeName, type: 'directory', size: 0 });
        if (recursive) {
          await scan(path.join(dir, item.name), relativeName);
        }
      } else {
        const stat = await fs.stat(path.join(dir, item.name));
        entries.push({ name: relativeName, type: 'file', size: stat.size });
      }
    }
  }

  try {
    await scan(absolute, '');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return []; // Empty directory
    }
    throw err;
  }

  return entries;
}

export async function globInWorkspace(
  projectId: string,
  pattern: string,
): Promise<string[]> {
  const workspace = await getWorkspacePath(projectId);

  try {
    // Use find command for glob matching (cross-platform)
    const { stdout } = await execAsync(
      `find . -path "./${pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -100`,
      { cwd: workspace, timeout: 10000 },
    );
    return stdout.trim().split('\n').filter(Boolean).map(f => f.replace('./', ''));
  } catch {
    return [];
  }
}

export async function grepInWorkspace(
  projectId: string,
  pattern: string,
  searchPath: string = '.',
  filePattern?: string,
): Promise<Array<{ file: string; line: number; content: string }>> {
  const workspace = await getWorkspacePath(projectId);
  const targetPath = resolveSecure(workspace, searchPath);

  const includeFlag = filePattern ? `--include="${filePattern}"` : '';

  try {
    const { stdout } = await execAsync(
      `grep -rn ${includeFlag} --exclude-dir=node_modules --exclude-dir=.git "${pattern}" "${targetPath}" 2>/dev/null | head -50`,
      { cwd: workspace, timeout: 10000 },
    );
    return stdout.trim().split('\n').filter(Boolean).map(line => {
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (!match) return { file: '', line: 0, content: line };
      return {
        file: path.relative(workspace, match[1]),
        line: parseInt(match[2]),
        content: match[3].trim(),
      };
    }).filter(r => r.file);
  } catch {
    return [];
  }
}

// ─── Shell Operations ─────────────────────────────────────────────────────────

export async function runCommandInWorkspace(
  projectId: string,
  command: string,
  timeout: number = DEFAULT_COMMAND_TIMEOUT,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const workspace = await getWorkspacePath(projectId);
  const safeTimeout = Math.min(timeout, MAX_COMMAND_TIMEOUT) * 1000;

  // Security: block dangerous commands
  const blocked = ['rm -rf /', 'sudo', 'chmod 777', 'curl | sh', 'wget | sh'];
  if (blocked.some(b => command.includes(b))) {
    throw new Error(`Blocked dangerous command: ${command}`);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workspace,
      timeout: safeTimeout,
      maxBuffer: 1024 * 1024 * 10, // 10MB
      env: {
        ...process.env,
        HOME: workspace,
        NODE_ENV: 'development',
      },
    });
    return { stdout: stdout.slice(0, 50000), stderr: stderr.slice(0, 10000), exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: (err.stdout || '').slice(0, 50000),
      stderr: (err.stderr || err.message || '').slice(0, 10000),
      exitCode: err.code || 1,
    };
  }
}

// ─── Git Operations ───────────────────────────────────────────────────────────

export async function gitCommitInWorkspace(
  projectId: string,
  message: string,
  files?: string[],
): Promise<{ hash: string; filesChanged: number }> {
  const workspace = await getWorkspacePath(projectId);

  // Initialize git repo if not already
  try {
    await execAsync('git rev-parse --is-inside-work-tree', { cwd: workspace });
  } catch {
    await execAsync('git init && git config user.email "agent@ai-team-studio.dev" && git config user.name "AI Agent"', { cwd: workspace });
  }

  // Stage files
  if (files && files.length > 0) {
    for (const file of files) {
      const safePath = resolveSecure(workspace, file);
      await execAsync(`git add "${safePath}"`, { cwd: workspace });
    }
  } else {
    await execAsync('git add -A', { cwd: workspace });
  }

  // Commit
  const { stdout } = await execAsync(
    `git commit -m "${message.replace(/"/g, '\\"')}" --allow-empty 2>&1 || echo "nothing to commit"`,
    { cwd: workspace },
  );

  // Get commit hash
  try {
    const { stdout: hash } = await execAsync('git rev-parse --short HEAD', { cwd: workspace });
    const { stdout: diffStat } = await execAsync('git diff --stat HEAD~1..HEAD 2>/dev/null || echo "0"', { cwd: workspace });
    const filesChanged = (diffStat.match(/\d+ file/)?.[0] || '0').replace(' file', '');
    return { hash: hash.trim(), filesChanged: parseInt(filesChanged) || 0 };
  } catch {
    return { hash: 'unknown', filesChanged: 0 };
  }
}

export async function gitBranchInWorkspace(
  projectId: string,
  name: string,
  action: 'create' | 'switch' | 'delete',
): Promise<{ branch: string; action: string }> {
  const workspace = await getWorkspacePath(projectId);

  switch (action) {
    case 'create':
      await execAsync(`git checkout -b "${name}"`, { cwd: workspace });
      break;
    case 'switch':
      await execAsync(`git checkout "${name}"`, { cwd: workspace });
      break;
    case 'delete':
      await execAsync(`git branch -d "${name}"`, { cwd: workspace });
      break;
  }
  return { branch: name, action };
}

export async function gitDiffInWorkspace(
  projectId: string,
  file?: string,
  staged?: boolean,
): Promise<string> {
  const workspace = await getWorkspacePath(projectId);
  const stagedFlag = staged ? '--cached' : '';
  const fileArg = file ? `-- "${resolveSecure(workspace, file)}"` : '';

  try {
    const { stdout } = await execAsync(
      `git diff ${stagedFlag} ${fileArg}`,
      { cwd: workspace, maxBuffer: 1024 * 1024 * 5 },
    );
    return stdout.slice(0, 50000);
  } catch {
    return '(no git history)';
  }
}
