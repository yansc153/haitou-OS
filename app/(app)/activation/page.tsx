'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { AgentBadge, AgentBadgeDropIn, type AgentInfo } from '@/components/agents/agent-badge';
import { BlurText } from '@/components/ui/blur-text';

const AGENT_ROSTER: AgentInfo[] = [
  { id: '1', role_code: 'opportunity_research', title_zh: '岗位研究员', persona_name: 'Scout', status: 'ready' },
  { id: '2', role_code: 'matching_review', title_zh: '匹配审核员', persona_name: 'Reviewer', status: 'ready' },
  { id: '3', role_code: 'materials_advisor', title_zh: '简历顾问', persona_name: 'Advisor', status: 'ready' },
  { id: '4', role_code: 'orchestrator', title_zh: '调度官', persona_name: 'Commander', status: 'ready' },
  { id: '5', role_code: 'profile_intelligence', title_zh: '履历分析师', persona_name: 'Analyst', status: 'ready' },
  { id: '6', role_code: 'application_executor', title_zh: '投递专员', persona_name: 'Executor', status: 'ready' },
  { id: '7', role_code: 'relationship_manager', title_zh: '招聘关系经理', persona_name: 'Liaison', status: 'ready' },
];

export default function ActivationPage() {
  const [activated, setActivated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [serverAgents, setServerAgents] = useState<AgentInfo[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/activation-get`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data?.team?.status === 'ready' || json.data?.team?.status === 'active') {
        setActivated(true);
      }
      if (json.data?.agents?.length > 0) {
        setServerAgents(json.data.agents.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          role_code: a.template_role_code as string,
          title_zh: a.role_title_zh as string,
          persona_name: a.persona_name as string,
          status: 'ready' as const,
        })));
      }
    }
    load();
  }, [supabase]);

  const handleConfirm = async () => {
    setConfirming(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/activation-confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      setActivated(true);
      setTimeout(() => router.push('/readiness'), 2500);
    }
    setConfirming(false);
  };

  const agents = serverAgents.length > 0 ? serverAgents : AGENT_ROSTER;

  return (
    <div className="min-h-screen bg-foreground text-background flex flex-col items-center justify-center px-6 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <p className="text-xs text-white/30 uppercase tracking-[0.2em] font-label mb-4">
          ACTIVATION SEQUENCE | 团队激活
        </p>
        <h1 className="text-4xl lg:text-5xl font-display font-bold text-white leading-tight">
          <BlurText text="Ready to Deploy." delay={100} />
          <br />
          <span className="text-white/70">
            <BlurText text="Your Digital Atelier." delay={120} />
          </span>
        </h1>
        <p className="mt-4 text-sm text-white/40 max-w-md mx-auto">
          Seven specialized AI agents have synchronized with your goals. Hover to inspect their operational core.
        </p>
      </div>

      {/* Agent Grid — Hanging Badges */}
      <div className="grid grid-cols-4 gap-5 mb-16 max-w-4xl">
        {agents.slice(0, 4).map((agent, i) => (
          <AgentBadgeDropIn key={agent.id} agent={agent} index={i} />
        ))}
        {/* Second row: 3 centered */}
        <div className="col-start-1 col-span-4 flex justify-center gap-5">
          {agents.slice(4).map((agent, i) => (
            <AgentBadgeDropIn key={agent.id} agent={agent} index={i + 4} />
          ))}
        </div>
      </div>

      {/* CTA */}
      {!activated ? (
        <div className="text-center">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="px-10 py-4 bg-white text-[#1a1a1a] rounded-xl text-base font-display font-bold hover:bg-white/90 transition-opacity disabled:opacity-50"
          >
            {confirming ? '激活中...' : '激活团队 · Initiate First Wave'}
          </button>
          <p className="mt-4 text-xs text-white/30">
            激活后可前往就绪检查，连接目标平台
          </p>
        </div>
      ) : (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white/80 text-sm">
            <div className="w-2 h-2 rounded-full bg-status-active animate-pulse" />
            团队已激活 · Redirecting to readiness...
          </div>
        </div>
      )}
    </div>
  );
}
