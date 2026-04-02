import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const ONBOARDING_QUESTIONS = [
  {
    id: 'target_roles',
    label: 'Target Roles',
    label_zh: '目标岗位',
    type: 'multi_text',
    required: true,
    placeholder: 'e.g., Backend Engineer, Product Manager',
  },
  {
    id: 'target_locations',
    label: 'Target Locations',
    label_zh: '目标城市',
    type: 'multi_text',
    required: true,
    placeholder: 'e.g., Shanghai, Remote, San Francisco',
  },
  {
    id: 'work_mode',
    label: 'Work Mode',
    label_zh: '工作模式',
    type: 'single_select',
    required: true,
    options: ['remote', 'onsite', 'hybrid', 'flexible'],
  },
  {
    id: 'coverage_scope',
    label: 'Coverage Scope',
    label_zh: '覆盖范围',
    type: 'single_select',
    required: true,
    options: ['china', 'global_english', 'cross_market'],
  },
  {
    id: 'strategy_mode',
    label: 'Strategy Mode',
    label_zh: '策略模式',
    type: 'single_select',
    required: true,
    options: ['balanced', 'broad', 'precise'],
  },
  {
    id: 'salary_expectation',
    label: 'Salary Expectation',
    label_zh: '期望薪资',
    type: 'text',
    required: false,
    placeholder: 'Optional — e.g., 30-50k/month, $150-200k/year',
  },
];

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { data: draft, error: dbError } = await supabase!
    .from('onboarding_draft')
    .select('*')
    .eq('user_id', user!.id)
    .single();

  if (dbError || !draft) {
    return err(404, 'NOT_FOUND', 'No onboarding draft found');
  }

  return ok({
    draft,
    questions: ONBOARDING_QUESTIONS,
  });
});
