/**
 * Auth Strategy Cascade — automatic strategy downgrade chain.
 *
 * Probes platform endpoints starting from simplest strategy (PUBLIC)
 * and downgrades through tiers until one works:
 *
 *   PUBLIC → COOKIE → HEADER (CSRF) → INTERCEPT → UI
 *
 * Source: Adapted from OpenCLI (jackwener/opencli) src/cascade.ts
 * Spec: PLATFORM_RULE_AND_AGENT_SPEC.md § Auth Strategy Cascade
 */

export type Strategy = 'public' | 'cookie' | 'header' | 'intercept' | 'ui';

const CASCADE_ORDER: Strategy[] = ['public', 'cookie', 'header'];

export type ProbeResult = {
  strategy: Strategy;
  success: boolean;
  statusCode?: number;
  hasData?: boolean;
  error?: string;
};

export type CascadeResult = {
  bestStrategy: Strategy;
  probes: ProbeResult[];
  confidence: number;
};

/**
 * Build fetch JS for in-page evaluation.
 * Runs inside a Playwright page context.
 */
function buildFetchProbeJs(url: string, opts: {
  credentials?: boolean;
  extractCsrf?: boolean;
}): string {
  const credentialsLine = opts.credentials ? `credentials: 'include',` : '';
  const headerSetup = opts.extractCsrf
    ? `
      const cookies = document.cookie.split(';').map(c => c.trim());
      const csrf = cookies.find(c => c.startsWith('ct0=') || c.startsWith('csrf_token=') || c.startsWith('_csrf='))?.split('=').slice(1).join('=');
      const headers = {};
      if (csrf) { headers['X-Csrf-Token'] = csrf; headers['X-XSRF-Token'] = csrf; }
    `
    : 'const headers = {};';

  return `
    (async () => {
      try {
        ${headerSetup}
        const resp = await fetch(${JSON.stringify(url)}, {
          ${credentialsLine}
          headers
        });
        const status = resp.status;
        if (!resp.ok) return { status, ok: false };
        const text = await resp.text();
        let hasData = false;
        try {
          const json = JSON.parse(text);
          hasData = !!json && (Array.isArray(json) ? json.length > 0 :
            typeof json === 'object' && Object.keys(json).length > 0);
          if (json.code !== undefined && json.code !== 0) hasData = false;
        } catch {}
        return { status, ok: true, hasData };
      } catch (e) { return { ok: false, error: e.message }; }
    })()
  `;
}

/**
 * Probe a single endpoint with a specific strategy.
 * Requires a Playwright page that is already navigated to the platform domain.
 */
export async function probeEndpoint(
  page: { evaluate: (js: string) => Promise<Record<string, unknown>> },
  url: string,
  strategy: Strategy,
): Promise<ProbeResult> {
  const result: ProbeResult = { strategy, success: false };

  try {
    switch (strategy) {
      case 'public': {
        const resp = await page.evaluate(buildFetchProbeJs(url, {}));
        result.statusCode = resp?.status as number;
        result.success = !!(resp?.ok && resp?.hasData);
        result.hasData = resp?.hasData as boolean;
        break;
      }
      case 'cookie': {
        const resp = await page.evaluate(buildFetchProbeJs(url, { credentials: true }));
        result.statusCode = resp?.status as number;
        result.success = !!(resp?.ok && resp?.hasData);
        result.hasData = resp?.hasData as boolean;
        break;
      }
      case 'header': {
        const resp = await page.evaluate(buildFetchProbeJs(url, { credentials: true, extractCsrf: true }));
        result.statusCode = resp?.status as number;
        result.success = !!(resp?.ok && resp?.hasData);
        result.hasData = resp?.hasData as boolean;
        break;
      }
      default:
        result.error = `Strategy ${strategy} requires site-specific implementation`;
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

/**
 * Run the cascade: try each strategy in order until one works.
 */
export async function cascadeProbe(
  page: { evaluate: (js: string) => Promise<Record<string, unknown>> },
  url: string,
): Promise<CascadeResult> {
  const probes: ProbeResult[] = [];

  for (let i = 0; i < CASCADE_ORDER.length; i++) {
    const strategy = CASCADE_ORDER[i];
    const probe = await probeEndpoint(page, url, strategy);
    probes.push(probe);

    if (probe.success) {
      return {
        bestStrategy: strategy,
        probes,
        confidence: 1.0 - (i * 0.1),
      };
    }
  }

  // None worked — default to COOKIE (most common for logged-in sites)
  return {
    bestStrategy: 'cookie',
    probes,
    confidence: 0.3,
  };
}
