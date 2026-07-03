import { cn } from '@/lib/utils';
import { aiAgentTheme } from '../aiAgentTheme';
import type { AiAgent } from '../types';

interface Props {
  agents: AiAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function statusLabel(agent: AiAgent): { text: string; className: string } {
  const running = agent.tasks.some((t) => t.status === 'running');
  const blocked = agent.tasks.some((t) => t.status === 'blocked');
  if (blocked) return { text: 'Blocked', className: 'bg-rose-50 text-rose-600' };
  if (running) return { text: 'Working', className: 'bg-blue-50 text-blue-600' };
  return { text: 'Idle', className: 'bg-slate-100 text-slate-500' };
}

export function AgentListPanel({ agents, selectedId, onSelect }: Props) {
  return (
    <aside className={`flex h-full min-h-0 flex-col overflow-hidden ${aiAgentTheme.panel}`}>
      <div className="border-b border-black/[0.06] bg-white/80 px-4 py-3 rounded-t-3xl shrink-0">
        <p className={`${aiAgentTheme.label} mb-0.5`}>Agents</p>
        <p className={`${aiAgentTheme.title}`}>รายชื่อ Agent</p>
        <p className={`${aiAgentTheme.subtitle} mt-0.5`}>{agents.length} ตัวในระบบ</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {agents.map((agent) => {
          const active = selectedId === agent.id;
          const status = statusLabel(agent);

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelect(agent.id)}
              className={cn(
                'w-full rounded-2xl border px-3 py-3 text-left transition-all',
                active
                  ? 'border-[#0056FF] bg-white shadow-[0_4px_16px_rgba(0,86,255,0.12)]'
                  : 'border-black/[0.06] bg-white/70 hover:bg-white hover:border-black/10',
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm"
                  style={{ backgroundColor: agent.avatarColor }}
                >
                  {agent.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black text-slate-800">{agent.name}</p>
                  <p className="truncate text-[10px] font-bold text-slate-500">{agent.roleTh}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[8px] font-black uppercase', status.className)}>
                      {status.text}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 tabular-nums">{agent.progress}%</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
