import { Resend } from 'resend';

let resendClient: Resend | null = null;

export interface ResendEmailInput {
  apiKey?: string;
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export function getResendClient(apiKey = process.env.RESEND_API_KEY): Resend {
  if (!resendClient) {
    if (!apiKey) throw new Error('[Resend] RESEND_API_KEY is not configured.');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendResendEmail(input: ResendEmailInput): Promise<{ success: boolean; error?: string }> {
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

  const { error } = await getResendClient(input.apiKey).emails.send(message);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
