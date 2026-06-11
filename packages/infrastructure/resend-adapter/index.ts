import { Resend } from 'resend';

let resendClient: Resend | null = null;

function readProcessEnv(name: string): string | undefined {
  const processLike = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  return processLike?.env?.[name];
}

export interface ResendEmailInput {
  apiKey?: string;
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export function getResendClient(apiKey = readProcessEnv('RESEND_API_KEY')): Resend {
  if (!resendClient) {
    if (!apiKey) throw new Error('[Resend] RESEND_API_KEY is not configured.');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendResendEmail(input: ResendEmailInput): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const message = input.html
    ? {
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }
    : {
        from: input.from,
        to: input.to,
        subject: input.subject,
        text: input.text || '',
      };

  const response = await getResendClient(input.apiKey).emails.send(message) as {
    data?: { id?: string | null } | null;
    error?: { message?: string | null } | null;
  };
  const { data, error } = response;

  if (error) return { success: false, error: error.message || 'Resend email send failed' };
  return { success: true, messageId: data?.id || undefined };
}
