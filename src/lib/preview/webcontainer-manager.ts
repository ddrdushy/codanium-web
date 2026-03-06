'use client';

/**
 * WebContainer Manager
 * Singleton that manages a WebContainer instance for the Pro tier preview.
 * Runs Node.js entirely in the browser via WASM.
 */

import type { WebContainer, FileSystemTree } from '@webcontainer/api';

let _instance: WebContainer | null = null;
let _booting = false;
let _bootPromise: Promise<WebContainer> | null = null;

/**
 * Get or boot the WebContainer singleton.
 * WebContainer can only have one instance per page.
 */
export async function getWebContainer(): Promise<WebContainer> {
  if (_instance) return _instance;

  if (_bootPromise) return _bootPromise;

  _booting = true;
  _bootPromise = (async () => {
    const { WebContainer } = await import('@webcontainer/api');
    const instance = await WebContainer.boot();
    _instance = instance;
    _booting = false;
    return instance;
  })();

  return _bootPromise;
}

/**
 * Check if WebContainer is available (SharedArrayBuffer support).
 */
export function isWebContainerSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof SharedArrayBuffer !== 'undefined';
}

/**
 * Convert a flat file map to WebContainer's FileSystemTree format.
 *
 * Input:  { '/src/App.tsx': 'content', '/package.json': '{}' }
 * Output: { src: { directory: { 'App.tsx': { file: { contents: 'content' } } } }, 'package.json': { file: { contents: '{}' } } }
 */
export function toFileSystemTree(
  files: Record<string, string>,
): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const [filePath, content] of Object.entries(files)) {
    const parts = filePath.replace(/^\//, '').split('/');
    let current: any = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        // Leaf — file
        current[part] = { file: { contents: content } };
      } else {
        // Branch — directory
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }
    }
  }

  return tree;
}

/**
 * Sync artifacts to the WebContainer filesystem.
 * Mounts the entire file tree, replacing existing files.
 */
export async function syncFilesToContainer(
  files: Record<string, string>,
): Promise<void> {
  const container = await getWebContainer();
  const tree = toFileSystemTree(files);
  await container.mount(tree);
}

/**
 * Run a command in the WebContainer.
 * Returns { exitCode, output } when the process finishes.
 */
export async function runCommand(
  command: string,
  args: string[] = [],
  onOutput?: (data: string) => void,
): Promise<{ exitCode: number; output: string }> {
  const container = await getWebContainer();
  const process = await container.spawn(command, args);

  let output = '';

  const reader = process.output.getReader();

  const read = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += value;
      onOutput?.(value);
    }
  };

  await read();
  const exitCode = await process.exit;

  return { exitCode, output };
}

/**
 * Install npm dependencies in the WebContainer.
 */
export async function npmInstall(
  onOutput?: (data: string) => void,
): Promise<{ exitCode: number; output: string }> {
  return runCommand('npm', ['install', '--legacy-peer-deps'], onOutput);
}

/**
 * Start a dev server in the WebContainer.
 * Returns the server URL when ready.
 */
export async function startDevServer(
  onOutput?: (data: string) => void,
): Promise<{ url: string; port: number }> {
  const container = await getWebContainer();

  return new Promise((resolve) => {
    // Listen for the server-ready event
    container.on('server-ready', (port, url) => {
      resolve({ url, port });
    });

    // Start the dev server
    container.spawn('npm', ['run', 'dev']).then((process) => {
      const reader = process.output.getReader();

      const read = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          onOutput?.(value);
        }
      };

      read();
    });
  });
}

/**
 * Teardown the WebContainer instance.
 */
export async function teardown(): Promise<void> {
  if (_instance) {
    _instance.teardown();
    _instance = null;
    _bootPromise = null;
    _booting = false;
  }
}
