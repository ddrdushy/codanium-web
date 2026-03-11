'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Terminal, MessageSquare } from 'lucide-react';

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
        'h-full overflow-auto font-mono text-[11px] leading-relaxed',
        type === 'terminal'
          ? 'bg-[#0d1117] text-green-400/80'
          : 'bg-[#0d1117] text-gray-300',
      )}
    >
      {lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 opacity-60">
          {type === 'terminal' ? (
            <Terminal className="w-4 h-4 text-muted-foreground/30" />
          ) : (
            <MessageSquare className="w-4 h-4 text-muted-foreground/30" />
          )}
          <span className="text-[10px] text-muted-foreground/30 font-sans">
            {type === 'terminal'
              ? 'Terminal output will appear here'
              : 'Console logs will appear here'}
          </span>
        </div>
      ) : (
        <div className="p-3">
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                'whitespace-pre-wrap break-all py-px',
                // Color error lines
                line.toLowerCase().includes('error') && 'text-red-400',
                line.toLowerCase().includes('warn') && 'text-amber-400',
                line.startsWith('>') && type === 'terminal' && 'text-blue-400',
                // Subtle info lines
                line.toLowerCase().includes('info') && type === 'console' && 'text-blue-300/70',
              )}
            >
              {type === 'console' && (
                <span className="text-muted-foreground/30 mr-2 select-none text-[10px]">
                  {String(i + 1).padStart(3, ' ')}
                </span>
              )}
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
