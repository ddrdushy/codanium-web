'use client';

import { usePresence, type OnlineUser } from '@/lib/hooks/use-presence';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';

interface PresenceBarProps {
  projectId: string | null;
}

/**
 * Avatar stack showing online team members for a project.
 * Green dot = online, Yellow dot = idle (>30s no heartbeat).
 */
export function PresenceBar({ projectId }: PresenceBarProps) {
  const { onlineUsers, isConnected } = usePresence(projectId);

  if (!projectId || onlineUsers.length === 0) return null;

  const displayUsers = onlineUsers.slice(0, 5);
  const remainingCount = onlineUsers.length - displayUsers.length;

  return (
    <div className="flex items-center gap-2">
      {/* Avatar Stack */}
      <div className="flex items-center -space-x-2">
        {displayUsers.map((user) => (
          <Tooltip key={user.id}>
            <TooltipTrigger>
              <div className="relative">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full border-2 border-[var(--surface)]',
                    'flex items-center justify-center text-[10px] font-bold text-white',
                    'transition-transform hover:scale-110 hover:z-10'
                  )}
                  style={{ backgroundColor: user.avatarColor || '#6366f1' }}
                >
                  {getInitials(user.name)}
                </div>
                {/* Status dot */}
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--surface)]',
                    user.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                  )}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <div className="font-semibold">{user.name}</div>
              <div className="text-muted-foreground capitalize">{user.status}</div>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Overflow indicator */}
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger>
              <div className="w-7 h-7 rounded-full border-2 border-[var(--surface)] bg-foreground/[0.08] flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                +{remainingCount}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {remainingCount} more {remainingCount === 1 ? 'person' : 'people'} online
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Online label */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="w-3 h-3" />
        <span>{onlineUsers.length} online</span>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
