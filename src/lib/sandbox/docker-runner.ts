// =============================================================================
// AI Team Studio — Docker Sandbox Runner
// =============================================================================
// Executes user/agent code in isolated Docker containers with strict security:
//   - No network access (--network=none)
//   - Memory limited (default 256MB)
//   - CPU limited (default 1 core)
//   - Read-only filesystem (except /tmp)
//   - Non-root user
//   - Automatic cleanup (--rm)
//   - Wall-clock timeout (default 30s)
//
// Uses child_process.execFile to spawn `docker run` — no SDK dependency.
// Falls back gracefully when Docker is unavailable.
// =============================================================================

import { execFile as execFileCb } from 'child_process';
import { mkdtemp, writeFile, rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutionRequest {
  /** Programming language / runtime. */
  language: string;
  /** Source code to execute. */
  code: string;
  /** Optional stdin to pipe into the process. */
  stdin?: string;
  /** Wall-clock timeout in milliseconds (default: 30_000). */
  timeoutMs?: number;
  /** Memory limit in MB (default: 256). */
  memoryMb?: number;
  /** CPU limit in cores (default: 1). */
  cpuLimit?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  memoryUsedMb: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Language → Docker Image + Command Mapping
// ---------------------------------------------------------------------------

interface LanguageConfig {
  /** Docker image to use. */
  image: string;
  /** File extension for the temp source file. */
  ext: string;
  /** Command + args to run the source file inside the container. */
  cmd: (filename: string) => string[];
}

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  typescript: {
    image: 'node:22-alpine',
    ext: 'ts',
    cmd: (f) => ['npx', '--yes', 'tsx', `/sandbox/${f}`],
  },
  javascript: {
    image: 'node:22-alpine',
    ext: 'js',
    cmd: (f) => ['node', `/sandbox/${f}`],
  },
  python: {
    image: 'python:3.12-alpine',
    ext: 'py',
    cmd: (f) => ['python3', `/sandbox/${f}`],
  },
  go: {
    image: 'golang:1.22-alpine',
    ext: 'go',
    cmd: (f) => ['go', 'run', `/sandbox/${f}`],
  },
  rust: {
    image: 'rust:1.77-alpine',
    ext: 'rs',
    // Compile and run in one shot
    cmd: (f) => ['sh', '-c', `rustc /sandbox/${f} -o /tmp/a.out && /tmp/a.out`],
  },
  bash: {
    image: 'alpine:3.19',
    ext: 'sh',
    cmd: (f) => ['sh', `/sandbox/${f}`],
  },
  shell: {
    image: 'alpine:3.19',
    ext: 'sh',
    cmd: (f) => ['sh', `/sandbox/${f}`],
  },
};

// Default limits
const DEFAULT_TIMEOUT_MS = 30_000;   // 30 seconds
const DEFAULT_MEMORY_MB = 256;        // 256 MB
const DEFAULT_CPU_LIMIT = 1;          // 1 CPU core
const MAX_OUTPUT_BYTES = 1_048_576;   // 1 MB max stdout/stderr

// ---------------------------------------------------------------------------
// Docker Availability Check
// ---------------------------------------------------------------------------

let _dockerAvailable: boolean | null = null;

export async function isDockerAvailable(): Promise<boolean> {
  if (_dockerAvailable !== null) return _dockerAvailable;

  try {
    await execFile('docker', ['info', '--format', '{{.ServerVersion}}'], {
      timeout: 5000,
    });
    _dockerAvailable = true;
  } catch {
    _dockerAvailable = false;
  }

  return _dockerAvailable;
}

/** Reset the cached Docker availability check (useful after Docker starts). */
export function resetDockerCheck(): void {
  _dockerAvailable = null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute code in a sandboxed Docker container.
 *
 * @throws Error if Docker is unavailable or the language is unsupported.
 */
export async function executeInSandbox(
  request: ExecutionRequest,
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Validate language
  const langConfig = LANGUAGE_CONFIGS[request.language.toLowerCase()];
  if (!langConfig) {
    return {
      stdout: '',
      stderr: `Unsupported language: "${request.language}". Supported: ${Object.keys(LANGUAGE_CONFIGS).join(', ')}`,
      exitCode: 1,
      durationMs: Date.now() - startTime,
      timedOut: false,
      memoryUsedMb: 0,
      error: `Unsupported language: ${request.language}`,
    };
  }

  // Check Docker
  const dockerOk = await isDockerAvailable();
  if (!dockerOk) {
    return {
      stdout: '',
      stderr: 'Docker is not available. Code execution requires Docker to be installed and running.',
      exitCode: 1,
      durationMs: Date.now() - startTime,
      timedOut: false,
      memoryUsedMb: 0,
      error: 'Docker not available',
    };
  }

  // Create temp directory with code file
  const tempDir = await mkdtemp(join(tmpdir(), 'ats-sandbox-'));
  const filename = `main.${langConfig.ext}`;
  const codePath = join(tempDir, filename);

  try {
    await writeFile(codePath, request.code, 'utf-8');

    // If there's stdin, write it to a file too
    if (request.stdin) {
      await writeFile(join(tempDir, 'stdin.txt'), request.stdin, 'utf-8');
    }

    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const memoryMb = request.memoryMb ?? DEFAULT_MEMORY_MB;
    const cpuLimit = request.cpuLimit ?? DEFAULT_CPU_LIMIT;

    // Build docker run command
    const dockerArgs = [
      'run',
      '--rm',                                    // Auto-cleanup
      '--network=none',                          // No network access
      `--memory=${memoryMb}m`,                   // Memory limit
      `--cpus=${cpuLimit}`,                      // CPU limit
      '--read-only',                             // Read-only root filesystem
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', // Writable /tmp (for compilers)
      '--user', 'nobody',                        // Non-root
      '--security-opt', 'no-new-privileges',     // Prevent privilege escalation
      '--pids-limit', '64',                      // Limit process count
      '-v', `${tempDir}:/sandbox:ro`,            // Mount code read-only
      '-w', '/sandbox',                          // Working directory
    ];

    // If stdin exists, pipe it
    if (request.stdin) {
      dockerArgs.push('-i'); // Enable stdin
    }

    // Add image and command
    dockerArgs.push(langConfig.image);
    dockerArgs.push(...langConfig.cmd(filename));

    console.log(`[DockerRunner] Executing: docker ${dockerArgs.join(' ')}`);

    // Execute with timeout
    const result = await new Promise<ExecutionResult>((resolve) => {
      const proc = require('child_process').execFile(
        'docker',
        dockerArgs,
        {
          timeout: timeoutMs,
          maxBuffer: MAX_OUTPUT_BYTES,
          encoding: 'utf-8',
        },
        (error: any, stdout: string, stderr: string) => {
          const duration = Date.now() - startTime;
          const timedOut = error?.killed === true || error?.code === 'ETIMEDOUT';

          if (timedOut) {
            resolve({
              stdout: stdout || '',
              stderr: (stderr || '') + '\n[Execution timed out]',
              exitCode: 124, // Standard timeout exit code
              durationMs: duration,
              timedOut: true,
              memoryUsedMb: 0,
            });
            return;
          }

          resolve({
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: error ? (error.code ?? 1) : 0,
            durationMs: duration,
            timedOut: false,
            memoryUsedMb: 0,
          });
        },
      );

      // Pipe stdin if provided
      if (request.stdin && proc.stdin) {
        proc.stdin.write(request.stdin);
        proc.stdin.end();
      }
    });

    console.log(
      `[DockerRunner] Completed: exitCode=${result.exitCode} duration=${result.durationMs}ms timedOut=${result.timedOut}`,
    );

    return result;
  } catch (err) {
    return {
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      exitCode: 1,
      durationMs: Date.now() - startTime,
      timedOut: false,
      memoryUsedMb: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Utility: Get supported languages
// ---------------------------------------------------------------------------

export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_CONFIGS);
}

export function getLanguageConfig(language: string): LanguageConfig | undefined {
  return LANGUAGE_CONFIGS[language.toLowerCase()];
}
