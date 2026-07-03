import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export type AgentChatTurn = {
  role: 'user' | 'model';
  text: string;
};

export async function sendQbAnalystMessage(
  message: string,
  history: AgentChatTurn[],
): Promise<string> {
  const callable = httpsCallable<
    { message: string; history: AgentChatTurn[] },
    { reply: string; model: string }
  >(functions, 'qbAnalystChat');

  const result = await callable({ message, history });
  return result.data.reply;
}
