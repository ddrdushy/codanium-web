'use client';

import { useMemo } from 'react';
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
} from '@codesandbox/sandpack-react';
import { detectTemplate, type ProjectTemplate } from '@/lib/preview/template-detector';

// Map our template names to Sandpack template names
const SANDPACK_TEMPLATE_MAP: Record<ProjectTemplate, string> = {
  'react': 'react',
  'react-ts': 'react-ts',
  'nextjs': 'nextjs',
  'vanilla': 'vanilla',
  'vanilla-ts': 'vanilla-ts',
  'vue': 'vue',
  'vue-ts': 'vue-ts',
  'node': 'node',
  'static': 'static',
};

interface SandpackPreviewAdapterProps {
  files: Record<string, string>;
}

export function SandpackPreviewAdapter({ files }: SandpackPreviewAdapterProps) {
  // Detect the project template
  const detection = useMemo(() => detectTemplate(files), [files]);
  const sandpackTemplate = SANDPACK_TEMPLATE_MAP[detection.template] || 'react';

  // Build Sandpack-compatible file map
  const sandpackFiles = useMemo(() => {
    const result: Record<string, { code: string; active?: boolean }> = {};

    for (const [path, content] of Object.entries(files)) {
      result[path] = {
        code: content,
        active: path === detection.entryFile,
      };
    }

    return result;
  }, [files, detection.entryFile]);

  // If no files, show empty state
  if (Object.keys(files).length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--surface)] text-muted-foreground text-sm">
        No files to preview
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <SandpackProvider
        template={sandpackTemplate as any}
        files={sandpackFiles}
        theme="dark"
        options={{
          externalResources: [],
          recompileMode: 'delayed',
          recompileDelay: 500,
        }}
      >
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          style={{ height: '100%', width: '100%' }}
        />
      </SandpackProvider>
    </div>
  );
}
