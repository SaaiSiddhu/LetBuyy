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
  mode?: 'mock' | 'live' | string | null;
  provider?: string | null;
  model?: string | null;
}

export interface AiCapabilitySeam {
  mode: 'mock' | 'live';
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
  const mode = input.mode === 'live' ? 'live' : 'mock';
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
