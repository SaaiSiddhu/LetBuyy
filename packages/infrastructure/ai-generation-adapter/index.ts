export type AiGenerationProviderMode = 'sandbox' | 'live';
export type AiGenerationProvider = 'letbuyy_sandbox' | 'openai_compatible' | 'manual';

export interface AiGenerationCredentials {
  mode?: AiGenerationProviderMode | string | null;
  provider?: AiGenerationProvider | string | null;
  apiKey?: string | null;
  baseUrl?: string | null;
  model?: string | null;
  environment?: string | null;
  appEnv?: string | null;
  nodeEnv?: string | null;
}

export interface GenerateMerchantContentInput {
  storeId: string;
  feature: string;
  prompt: string;
  context?: Record<string, unknown> | null;
}

export interface AiGenerationResult {
  output: string;
  provider: AiGenerationProvider;
  providerMode: AiGenerationProviderMode;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  creditsUsed: number;
  metadata: Record<string, unknown>;
}

export interface AiGenerationAdapter {
  provider: AiGenerationProvider;
  mode: AiGenerationProviderMode;
  model: string;
  available: boolean;
  unavailableReason: string | null;
  generate(input: GenerateMerchantContentInput): Promise<AiGenerationResult>;
}

export interface AiCapabilitySeamInput {
  mode?: 'sandbox' | 'live' | string | null;
  provider?: string | null;
  model?: string | null;
}

export interface AiCapabilitySeam {
  mode: 'sandbox' | 'live';
  provider: 'none' | 'human_required';
  modelCallsEnabled: false;
  model: null;
  status: 'ready_for_interface' | 'human_required';
  capabilities: Array<'recommendation_context' | 'merchant_operator_context' | 'analytics_context'>;
  humanRequiredId?: 'HR-AI-MODEL-LIVE';
}

function isConfigured(value: string | null | undefined): value is string {
  const trimmed = value?.trim();
  return Boolean(trimmed && !trimmed.startsWith('SKIP_NEEDS_HUMAN_'));
}

function isProductionRuntime(credentials: AiGenerationCredentials): boolean {
  return [credentials.environment, credentials.appEnv, credentials.nodeEnv]
    .some((value) => value?.toLowerCase() === 'production');
}

function normalizeMode(credentials: AiGenerationCredentials): AiGenerationProviderMode {
  if (credentials.mode === 'sandbox' || credentials.mode === 'live') return credentials.mode;
  return isProductionRuntime(credentials) ? 'live' : 'sandbox';
}

function normalizeProvider(provider: AiGenerationCredentials['provider']): AiGenerationProvider {
  return provider === 'openai_compatible' || provider === 'manual' ? provider : 'letbuyy_sandbox';
}

function normalizeModel(model: string | null | undefined, mode: AiGenerationProviderMode): string {
  if (isConfigured(model)) return model.trim();
  return mode === 'sandbox' ? 'letbuyy-sandbox-copywriter' : '';
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function sandboxOutput(input: GenerateMerchantContentInput): string {
  const feature = titleCase(input.feature || 'content');
  const prompt = input.prompt.trim();
  const language = typeof input.context?.language === 'string' ? input.context.language : 'en';
  return [
    `${feature} draft`,
    '',
    prompt,
    '',
    `Tone: practical, commerce-ready. Language: ${language}.`,
  ].join('\n');
}

async function generateOpenAiCompatible(
  credentials: { apiKey: string; model: string; baseUrl?: string | null },
  input: GenerateMerchantContentInput,
): Promise<AiGenerationResult> {
  const startedAt = Date.now();
  const baseUrl = (credentials.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${credentials.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: credentials.model,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: 'You write concise, factual merchant commerce copy for LetBuyy stores. Do not invent metrics, offers, certifications, or unavailable facts.',
        },
        {
          role: 'user',
          content: `Feature: ${input.feature}\nPrompt: ${input.prompt}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed with ${response.status}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const output = payload.choices?.[0]?.message?.content?.trim();
  if (!output) throw new Error('AI provider returned an empty generation');

  const tokensInput = payload.usage?.prompt_tokens ?? estimateTokens(input.prompt);
  const tokensOutput = payload.usage?.completion_tokens ?? estimateTokens(output);
  return {
    output,
    provider: 'openai_compatible',
    providerMode: 'live',
    model: credentials.model,
    tokensInput,
    tokensOutput,
    creditsUsed: Math.max(1, Math.ceil((tokensInput + tokensOutput) / 750)),
    metadata: {
      latency_ms: Date.now() - startedAt,
    },
  };
}

export function createAiGenerationAdapter(credentials: AiGenerationCredentials): AiGenerationAdapter {
  const mode = normalizeMode(credentials);
  const provider = normalizeProvider(credentials.provider);
  const model = normalizeModel(credentials.model, mode);
  const liveConfigured = mode === 'live'
    && provider !== 'manual'
    && isConfigured(credentials.apiKey)
    && isConfigured(model);
  const available = mode === 'sandbox' || liveConfigured;
  const unavailableReason = available ? null : 'AI provider credentials and model must be configured for live generation';

  return {
    provider,
    mode,
    model,
    available,
    unavailableReason,
    async generate(input) {
      const prompt = input.prompt.trim();
      if (!prompt) throw new Error('Prompt is required');

      if (mode === 'sandbox') {
        const output = sandboxOutput({ ...input, prompt });
        const tokensInput = estimateTokens(prompt);
        const tokensOutput = estimateTokens(output);
        return {
          output,
          provider: 'letbuyy_sandbox',
          providerMode: 'sandbox',
          model: model || 'letbuyy-sandbox-copywriter',
          tokensInput,
          tokensOutput,
          creditsUsed: 1,
          metadata: {
            sandbox: true,
          },
        };
      }

      if (!liveConfigured) {
        throw new Error(unavailableReason || 'AI provider is not configured');
      }

      return generateOpenAiCompatible({
        apiKey: credentials.apiKey as string,
        baseUrl: credentials.baseUrl,
        model,
      }, { ...input, prompt });
    },
  };
}

export function createAiCapabilitySeam(input: AiCapabilitySeamInput = {}): AiCapabilitySeam {
  const mode = input.mode === 'live' ? 'live' : 'sandbox';
  if (mode === 'live') {
    return {
      mode,
      provider: 'human_required',
      modelCallsEnabled: false,
      model: null,
      status: 'human_required',
      capabilities: ['recommendation_context', 'merchant_operator_context', 'analytics_context'],
      humanRequiredId: 'HR-AI-MODEL-LIVE',
    };
  }

  return {
    mode,
    provider: 'none',
    modelCallsEnabled: false,
    model: null,
    status: 'ready_for_interface',
    capabilities: ['recommendation_context', 'merchant_operator_context', 'analytics_context'],
  };
}

// Buyer generation is explicitly separate from the merchant sandbox copywriter.
// Nothing here borrows merchant credentials, defaults a model, or enables itself.
export interface BuyerAiProfile {
  approved: true;
  purpose: 'buyer_shopping_public';
  content_scope: 'submitted_message_and_visible_chat';
  provider: 'openai_compatible';
  id: string;
  endpoint: string;
  model: string;
  requests_per_day: number;
  token_bound_per_day: number;
  max_input_bytes: number;
  max_output_tokens: number;
  timeout_ms: number;
  // Approved provider/model-specific upper bound, never reported as billed usage.
  input_token_bound_per_byte: number;
  input_framing_token_bound: number;
}
export interface BuyerAiAdapter {
  available: boolean;
  profile: BuyerAiProfile | null;
  prepare(input: { prompt: string; history: Array<{ role: 'user' | 'assistant'; text: string }> }):
    { body: string; reservedTokens: number } | null;
  generate(prepared: { body: string; reservedTokens: number }): Promise<string>;
}
const buyerInstruction = 'You are a read-only shopping assistant. Use only the message and visible chat supplied by the buyer. You have no profile, orders, support records or credentials. Do not claim current prices, stock or completed actions. Refer buyers to canonical catalog screens to verify product facts. Never request or perform purchases, payments, discounts, refunds or account actions. Output plain answer text only; no tools.';
function buyerProfile(raw: string | undefined, key: string | undefined): BuyerAiProfile | null {
  try {
    if (!isConfigured(key) || !raw) return null;
    const p = JSON.parse(raw) as BuyerAiProfile;
    if (p.approved !== true || p.purpose !== 'buyer_shopping_public' ||
        p.content_scope !== 'submitted_message_and_visible_chat' || p.provider !== 'openai_compatible' ||
        typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) ||
        typeof p.model !== 'string' || !isConfigured(p.model) || p.model.length > 150) return null;
    const url = new URL(p.endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
    const bounds: Array<[number, number, number]> = [
      [p.requests_per_day, 1, 10000], [p.token_bound_per_day, 1, 100000000],
      [p.max_input_bytes, 1, 65536], [p.max_output_tokens, 1, 2000],
      [p.timeout_ms, 1, 20000], [p.input_token_bound_per_byte, 1, 16],
      [p.input_framing_token_bound, 1, 65536],
    ];
    if (bounds.some(([value, min, max]) => !Number.isSafeInteger(value) || value < min || value > max)) return null;
    return Object.freeze({ ...p });
  } catch { return null; }
}
export function createBuyerAiAdapter(
  configuration: { profile?: string; apiKey?: string },
  transport: typeof fetch = fetch,
): BuyerAiAdapter {
  const apiKey = configuration.apiKey?.trim();
  const profile = buyerProfile(configuration.profile, apiKey);
  const issued = new WeakSet<object>();
  return {
    available: profile !== null,
    profile,
    prepare(input) {
      if (!profile) return null;
      const body = JSON.stringify({
        model: profile.model, max_tokens: profile.max_output_tokens, stream: false,
        messages: [{ role: 'system', content: buyerInstruction },
          ...input.history.map(m => ({ role: m.role, content: m.text })),
          { role: 'user', content: input.prompt }],
      });
      const bytes = new TextEncoder().encode(body).byteLength;
      if (bytes > profile.max_input_bytes) return null;
      const reservedTokens = bytes * profile.input_token_bound_per_byte +
        profile.input_framing_token_bound + profile.max_output_tokens;
      if (reservedTokens > profile.token_bound_per_day) return null;
      const prepared = Object.freeze({ body, reservedTokens });
      issued.add(prepared);
      return prepared;
    },
    async generate(prepared) {
      if (!profile || !issued.delete(prepared)) throw new Error('BUYER_AI_UNAVAILABLE');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), profile.timeout_ms);
      try {
        const response = await transport(profile.endpoint, {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: prepared.body,
        });
        if (!response.ok || !response.body) throw new Error('BUYER_AI_OUTCOME_UNKNOWN');
        // Bound the actual stream, not just an untrusted Content-Length header.
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = []; let size = 0;
        try {
          for (;;) {
            const { value, done } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > 65536) { await reader.cancel(); throw new Error('BUYER_AI_OUTCOME_UNKNOWN'); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        const data = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
        const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(data));
        const choice = payload?.choices?.[0];
        const text = choice?.message?.content;
        if (typeof text !== 'string' || !text.trim() || text.length > 8000 ||
            choice.message.tool_calls || choice.message.function_call || choice.finish_reason !== 'stop') {
          throw new Error('BUYER_AI_OUTCOME_UNKNOWN');
        }
        const usage = payload.usage;
        if (!usage || !Number.isSafeInteger(usage.prompt_tokens) || !Number.isSafeInteger(usage.completion_tokens) ||
            usage.prompt_tokens < 0 || usage.completion_tokens < 0 ||
            usage.completion_tokens > profile.max_output_tokens ||
            usage.prompt_tokens + usage.completion_tokens > prepared.reservedTokens) {
          throw new Error('BUYER_AI_OUTCOME_UNKNOWN');
        }
        return text.trim();
      } catch { throw new Error('BUYER_AI_OUTCOME_UNKNOWN'); }
      finally { clearTimeout(timer); }
    },
  };
}
