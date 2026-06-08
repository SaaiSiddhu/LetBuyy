export type IdentityOtpChannel = 'whatsapp' | 'email' | 'dlt_sms';
export type IdentityOtpProviderMode = 'mock' | 'live';

export interface IdentityOtpMessage {
  recipient: string;
  channel: IdentityOtpChannel;
  templateId: string;
  locale: 'en-IN' | 'hi-IN';
  variables: Record<string, string>;
}

export interface IdentityOtpDeliveryResult {
  accepted: boolean;
  mode: IdentityOtpProviderMode;
  channel: IdentityOtpChannel;
  providerReference?: string;
  humanRequired?: 'HR-DLT-TRAI-LIVE' | 'HR-WHATSAPP-LIVE' | 'HR-ESP-LIVE';
}

export interface IdentityOtpAdapter {
  send(message: IdentityOtpMessage): Promise<IdentityOtpDeliveryResult>;
}

export function createMockIdentityOtpAdapter(channel: IdentityOtpChannel): IdentityOtpAdapter {
  return {
    async send() {
      return {
        accepted: true,
        mode: 'mock',
        channel,
        providerReference: `mock-${channel}`,
      };
    },
  };
}

export function createHumanRequiredIdentityOtpAdapter(
  channel: IdentityOtpChannel,
): IdentityOtpAdapter {
  const humanRequiredByChannel = {
    whatsapp: 'HR-WHATSAPP-LIVE',
    email: 'HR-ESP-LIVE',
    dlt_sms: 'HR-DLT-TRAI-LIVE',
  } as const;

  return {
    async send() {
      return {
        accepted: false,
        mode: 'live',
        channel,
        humanRequired: humanRequiredByChannel[channel],
      };
    },
  };
}

export function orderedIdentityOtpChannels(): IdentityOtpChannel[] {
  return ['whatsapp', 'email', 'dlt_sms'];
}
