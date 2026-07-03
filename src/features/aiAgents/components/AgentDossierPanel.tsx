import { useState } from 'react';
import { HiSparkles } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { aiAgentTheme } from '../aiAgentTheme';
import { useAgentChat } from '../hooks/useAgentChat';
import type { AgentDossierTab, AiAgent } from '../types';

interface Props {
  agent: AiAgent | null;
}

export function AgentDossierPanel({ agent }: Props) {
  const [tab, setTab] = useState<AgentDossierTab>('profile');
  const [chatInput, setChatInput] = useState('');
  const { messages: chatMessages, isLoading: isChatLoading, sendMessage } = useAgentChat(agent);

  if (!agent) {
    return (
      <div className={`flex flex-1 min-h-0 items-center justify-center p-6 ${aiAgentTheme.panel}`}>
        <p className="text-xs text-slate-500 font-bold text-center">
          เลือก Agent จากรายชื่อ<br />เพื่อดูรายละเอียด
        </p>
      </div>
    );
  }

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || isChatLoading) return;
    setChatInput('');
    await sendMessage(text);
  };

  const isGeminiAgent = agent.llmProvider === 'gemini';

  return (
    <div className={`flex flex-1 min-h-0 flex-col overflow-hidden ${aiAgentTheme.panel}`}>
      <div className="px-3 py-2.5 border-b border-black/[0.06] bg-white/80 rounded-t-3xl">
        <p className={`text-[10px] font-black tracking-wider ${aiAgentTheme.accent}`}>+ Employee Dossier</p>
        <div className="flex items-center gap-2 min-w-0">
          <p className={`${aiAgentTheme.title} truncate`}>{agent.name}</p>
          {isGeminiAgent && (
            <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-black uppercase text-blue-600">
              <HiSparkles className="h-3 w-3" />
              Gemini
            </span>
          )}
        </div>
      </div>

      <div className="flex border-b border-black/[0.06] bg-white/50">
        {(['profile', 'tasks', 'chat'] as AgentDossierTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-[9px] font-black tracking-wide uppercase transition-colors',
              tab === t ? aiAgentTheme.tabActive : aiAgentTheme.tabIdle,
            )}
          >
            {t === 'profile' ? 'Profile' : t === 'tasks' ? 'Tasks' : 'Chat'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[11px]">
        {tab === 'profile' && (
          <>
            <div>
              <p className={`${aiAgentTheme.label} mb-0.5`}>Role</p>
              <p className="text-slate-800 font-black">{agent.role}</p>
              <p className="text-slate-500">{agent.roleTh}</p>
            </div>
            {isGeminiAgent && (
              <div className={`${aiAgentTheme.panelInset} p-3`}>
                <p className={`${aiAgentTheme.label} mb-1`}>LLM Connection</p>
                <p className="text-slate-700 font-bold">Google Gemini 2.5 Flash</p>
                <p className="text-slate-500 text-[10px] mt-1 leading-relaxed">
                  เชื่อมต่อคลังข้อสอบจริงจาก Firestore และตอบคำถามวิเคราะห์ผ่านแท็บ Chat
                </p>
              </div>
            )}
            <div>
              <p className={`${aiAgentTheme.label} mb-1`}>Current Task</p>
              <p className="text-slate-600 leading-relaxed">{agent.currentTask}</p>
              <div className={`mt-2 ${aiAgentTheme.progressTrack}`}>
                <div
                  className="h-full bg-[#0056FF] transition-all"
                  style={{ width: `${agent.progress}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-500 mt-0.5">{agent.progress}%</p>
            </div>
            <div>
              <p className={`${aiAgentTheme.label} mb-1`}>Capacity</p>
              <div className={aiAgentTheme.progressTrack}>
                <div className="h-full bg-emerald-500" style={{ width: `${agent.capacity}%` }} />
              </div>
              <p className={`text-[9px] mt-0.5 ${aiAgentTheme.success}`}>{agent.capacity}%</p>
            </div>
            <div className={`${aiAgentTheme.panelInset} p-3 text-center`}>
              <p className={`${aiAgentTheme.label} mb-0`}>KPI Score</p>
              <p className="text-4xl font-black text-[#0056FF] tabular-nums">{agent.kpiScore}</p>
              <div className="mt-2 space-y-1 text-left">
                {agent.kpiMetrics.map((m) => (
                  <div key={m.label} className="flex justify-between text-[9px]">
                    <span className="text-slate-500">{m.label} ({m.weight}%)</span>
                    <span className={`font-bold ${aiAgentTheme.success}`}>{m.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'tasks' && (
          <ul className="space-y-2">
            {agent.tasks.map((task) => (
              <li key={task.id} className={`${aiAgentTheme.panelInset} p-2`}>
                <p className="text-slate-800 font-bold leading-snug">{task.title}</p>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn(
                      'h-full',
                      task.status === 'done' ? 'bg-emerald-500' : task.status === 'blocked' ? 'bg-rose-500' : 'bg-[#0056FF]',
                    )}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <p className="text-[8px] text-slate-400 mt-1 uppercase font-black">{task.status}</p>
              </li>
            ))}
          </ul>
        )}

        {tab === 'chat' && (
          <div className="flex flex-col h-full min-h-[200px]">
            <p className="text-slate-500 text-[10px] leading-relaxed mb-2">{agent.chatIntro}</p>
            {isGeminiAgent && (
              <p className="text-[9px] text-blue-600 font-bold mb-2">
                ขับเคลื่อนด้วย Gemini · อ่านข้อมูลคลังข้อสอบจากระบบ
              </p>
            )}
            <div className="flex-1 space-y-2 mb-2 max-h-[180px] overflow-y-auto">
              {chatMessages.length === 0 && !isChatLoading && (
                <p className="text-slate-400 text-[10px] italic">ยังไม่มีข้อความ</p>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-2xl px-2.5 py-1.5 text-[10px] leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-[#0056FF] text-white ml-4'
                      : 'bg-white border border-black/10 text-slate-700 mr-2 shadow-sm',
                  )}
                >
                  {msg.text}
                </div>
              ))}
              {isChatLoading && (
                <div className="rounded-2xl px-2.5 py-1.5 text-[10px] bg-white border border-black/10 text-slate-500 mr-2 shadow-sm inline-flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                  QB Analyst กำลังวิเคราะห์...
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSendChat()}
                disabled={isChatLoading}
                placeholder={isGeminiAgent ? 'ถามเรื่องคลังข้อสอบ...' : 'พิมพ์คำสั่ง...'}
                className="flex-1 min-w-0 rounded-xl bg-white border border-black/10 px-2 py-1.5 text-[10px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#0056FF] focus:ring-1 focus:ring-[#0056FF]/20 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void handleSendChat()}
                disabled={isChatLoading || !chatInput.trim()}
                className="px-2 py-1.5 rounded-xl bg-[#0056FF] text-white text-[10px] font-black hover:bg-[#2277FF] disabled:opacity-50"
              >
                ส่ง
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
