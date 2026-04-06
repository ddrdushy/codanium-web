'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { SDDDashboard } from '@/components/docs/sdd-dashboard';
import { Loader2 } from 'lucide-react';

export default function ArchitecturePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [sddContent, setSddContent] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    // Fetch SDD document content + project name in parallel
    Promise.all([
      fetch(`/api/projects/${projectId}/documents`).then(r => r.json()).catch(() => []),
      fetch(`/api/projects/${projectId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([docs, project]) => {
      // Find SDD document
      const sdd = Array.isArray(docs)
        ? docs.find((d: any) => d.type === 'SDD')
        : null;
      setSddContent(sdd?.content ?? '');
      setProjectName(project?.name ?? 'Project');
    }).finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading architecture data...</span>
        </div>
      </div>
    );
  }

  return (
    <SDDDashboard
      projectId={projectId}
      sddContent={sddContent}
      projectName={projectName}
    />
  );
}
