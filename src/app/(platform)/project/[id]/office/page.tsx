'use client';

import { useParams } from 'next/navigation';

export default function OfficePage() {
  const params = useParams();
  const projectId = params?.id as string || '';

  return (
    <div className="w-full h-full relative" style={{ isolation: 'isolate' }}>
      <iframe
        src={`/minecraft-office.html?projectId=${projectId}`}
        className="w-full border-0"
        style={{ height: 'calc(100vh - 56px)' }}
        title="Agent Office - Minecraft Style"
      />
    </div>
  );
}
