import { useMemo, useState } from 'react';
import { AgentDossierPanel } from './components/AgentDossierPanel';
import { AgentListPanel } from './components/AgentListPanel';
import { AI_AGENTS } from './data/agents';

export default function AiAgentCommandPage() {
  const [selectedId, setSelectedId] = useState<string | null>(AI_AGENTS[0]?.id ?? null);

  const selectedAgent = useMemo(
    () => AI_AGENTS.find((agent) => agent.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <div className="flex flex-1 flex-col min-h-[calc(100dvh-5.5rem)] sm:min-h-[calc(100dvh-4.75rem)] -mx-1.5 sm:-mx-2 -mt-3 sm:-mt-4 -mb-3 sm:-mb-4 lg:-mb-8 overflow-hidden">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-3 lg:gap-4">
        <div className="flex flex-1 min-h-0 min-w-0 flex-col order-2 lg:order-1">
          <AgentDossierPanel agent={selectedAgent} />
        </div>

        <div className="w-full lg:w-[280px] xl:w-[300px] shrink-0 min-h-0 order-1 lg:order-2 max-h-[220px] lg:max-h-none">
          <AgentListPanel
            agents={AI_AGENTS}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </div>
  );
}
