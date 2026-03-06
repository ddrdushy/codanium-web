'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TerminalOutputProps {
  lines: string[];
  type: 'console' | 'terminal';
}

export function TerminalOutput({ lines, type }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'h-full overflow-auto font-mono text-[11px] leading-relaxed p-3',
        type === 'terminal'
          ? 'bg-[#0d1117] text-green-400/80'
          : 'bg-[#0d1117] text-gray-300',
      )}
    >
      {lines.length === 0 ? (
        <span className="text-muted-foreground/40">
          {type === 'terminal'
            ? 'Terminal output will appear here...'
            : 'Console output will appear here...'}
        </span>
      ) : (
        lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'whitespace-pre-wrap break-all',
              // Color error lines
              line.toLowerCase().includes('error') && 'text-red-400',
              line.toLowerCase().includes('warn') && 'text-amber-400',
              line.startsWith('>') && type === 'terminal' && 'text-blue-400',
            )}
          >
            {line}
          </div>
        ))
      )}
    </div>
  );
}
