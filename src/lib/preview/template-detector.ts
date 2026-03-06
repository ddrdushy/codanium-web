/**
 * Template Detector
 * Analyzes project artifacts to determine the project type and
 * select the appropriate Sandpack template.
 */

export type ProjectTemplate =
  | 'react'
  | 'react-ts'
  | 'nextjs'
  | 'vanilla'
  | 'vanilla-ts'
  | 'vue'
  | 'vue-ts'
  | 'node'
  | 'static';

interface DetectionResult {
  template: ProjectTemplate;
  entryFile: string;
  confidence: number;
}

/**
 * Detect the project template from a file map.
 * Returns the best matching template with a confidence score.
 */
export function detectTemplate(
  files: Record<string, string>,
): DetectionResult {
  const filenames = Object.keys(files);
  const hasFile = (pattern: string) =>
    filenames.some((f) => f.includes(pattern));
  const hasExt = (ext: string) =>
    filenames.some((f) => f.endsWith(ext));

  // Check package.json for framework deps
  const pkgJson = files['package.json'] || files['/package.json'];
  let deps: Record<string, string> = {};
  if (pkgJson) {
    try {
      const pkg = JSON.parse(pkgJson);
      deps = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch {}
  }

  // Next.js detection
  if (deps['next'] || hasFile('next.config')) {
    return {
      template: 'nextjs',
      entryFile: hasFile('app/page.tsx')
        ? '/app/page.tsx'
        : hasFile('pages/index.tsx')
          ? '/pages/index.tsx'
          : '/app/page.tsx',
      confidence: 0.95,
    };
  }

  // Vue detection
  if (deps['vue'] || hasExt('.vue')) {
    return {
      template: hasExt('.ts') ? 'vue-ts' : 'vue',
      entryFile: hasFile('App.vue') ? '/src/App.vue' : '/App.vue',
      confidence: 0.9,
    };
  }

  // React detection
  if (deps['react'] || deps['react-dom'] || hasExt('.jsx') || hasExt('.tsx')) {
    const isTs = hasExt('.tsx') || hasExt('.ts') || deps['typescript'];
    return {
      template: isTs ? 'react-ts' : 'react',
      entryFile: hasFile('App.tsx')
        ? '/src/App.tsx'
        : hasFile('App.jsx')
          ? '/src/App.jsx'
          : '/App.tsx',
      confidence: 0.9,
    };
  }

  // Node.js detection (server-side)
  if (
    deps['express'] ||
    deps['fastify'] ||
    deps['koa'] ||
    hasFile('server.js') ||
    hasFile('index.js')
  ) {
    return {
      template: 'node',
      entryFile: hasFile('server.js') ? '/server.js' : '/index.js',
      confidence: 0.8,
    };
  }

  // TypeScript vanilla
  if (hasExt('.ts') && !hasExt('.tsx')) {
    return {
      template: 'vanilla-ts',
      entryFile: hasFile('index.ts') ? '/src/index.ts' : '/index.ts',
      confidence: 0.7,
    };
  }

  // HTML detection (static site)
  if (hasFile('index.html')) {
    return {
      template: 'static',
      entryFile: '/index.html',
      confidence: 0.85,
    };
  }

  // Default to vanilla JS
  return {
    template: 'vanilla',
    entryFile: hasFile('index.js') ? '/src/index.js' : '/index.js',
    confidence: 0.5,
  };
}

/**
 * Build a Sandpack-compatible file map from artifacts.
 * Normalizes paths to start with /
 */
export function buildFileMap(
  artifacts: Array<{ name: string; content: string }>,
): Record<string, string> {
  const files: Record<string, string> = {};

  for (const art of artifacts) {
    // Normalize path: ensure it starts with /
    const path = art.name.startsWith('/') ? art.name : `/${art.name}`;
    files[path] = art.content;
  }

  return files;
}
