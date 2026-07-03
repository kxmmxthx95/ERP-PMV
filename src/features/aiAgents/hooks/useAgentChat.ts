import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { AiAgent } from '../types';
import { sendQbAnalystMessage, type AgentChatTurn } from '../services/qbAnalystApi';

export type AgentChatMessage = {
  role: 'user' | 'agent';
  text: string;
};

function getCallableMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export function useAgentChat(agent: AiAgent | null) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMessages([]);
    setIsLoading(false);
  }, [agent?.id]);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || !agent || isLoading) return;

      setMessages((prev) => [...prev, { role: 'user', text }]);
      setIsLoading(true);

      try {
        if (agent.llmProvider === 'gemini' && agent.id === 'question-bank-analyst') {
          const history: AgentChatTurn[] = messages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            text: msg.text,
          }));

          const reply = await sendQbAnalystMessage(text, history);
          setMessages((prev) => [...prev, { role: 'agent', text: reply }]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'agent',
            text: `${agent.name}: ฟังก์ชัน Chat จะเชื่อมต่อ LLM ใน Phase ถัดไป — ตอนนี้ Agent กำลัง "${agent.currentTask}"`,
          },
        ]);
      } catch (error: unknown) {
        toast.error(getCallableMessage(error, 'ส่งข้อความไม่สำเร็จ'));
        setMessages((prev) => [
          ...prev,
          {
            role: 'agent',
            text: getCallableMessage(error, 'ไม่สามารถเชื่อมต่อ Gemini ได้ กรุณาลองใหม่'),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [agent, isLoading, messages],
  );

  return { messages, isLoading, sendMessage };
}
