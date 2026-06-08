import test from 'node:test';

test.skip('[HUMAN-REQUIRED] HR-KMS-LIVE live KMS envelope keys must be provisioned before live field encryption assertions');
test.skip('[HUMAN-REQUIRED] HR-TURNSTILE-LIVE Cloudflare Turnstile site keys and secrets must be provisioned before live app-login challenge assertions');
test.skip('[HUMAN-REQUIRED] HR-PA-SPLIT-LIVE live PA split credentials must be provisioned before live settlement payout assertions');
test.skip('[HUMAN-REQUIRED] HR-MERCHANT-PSP-LIVE merchant PSP keys must be connected before live payment session assertions');
test.skip('[HUMAN-REQUIRED] HR-GST-IRP-LIVE GST IRP/e-way credentials and legal/provider policy must be approved before live e-invoice assertions');
test.skip('[HUMAN-REQUIRED] HR-CARRIER-LIVE carrier accounts and Shiprocket/Delhivery/Pickrr credentials must be approved before live label/rate assertions');
test.skip('[HUMAN-REQUIRED] HR-DNS-CHECKOUT checkout.letbuyy.com DNS/custom hostname/certificate cutover must be approved before live hosted-checkout assertions');
test.skip('[HUMAN-REQUIRED] HR-WHATSAPP-LIVE WABA/BSP credentials and approved HSM templates must be provisioned before live COD-confirm assertions');
test.skip('[HUMAN-REQUIRED] HR-DLT-TRAI-LIVE DLT/TRAI sender IDs, templates, and live notification provider credentials must be provisioned before live SMS/WhatsApp notification assertions');
test.skip('[HUMAN-REQUIRED] HR-ESP-LIVE ESP API credentials, sender domains, and SPF/DKIM/DMARC verification must be provisioned before live email delivery assertions');
test.skip('[HUMAN-REQUIRED] HR-AUTOPAY-LIVE UPI AutoPay/NPCI live mandate credentials and approval must be provisioned before live subscription billing assertions');
test.skip('[HUMAN-REQUIRED] HR-LEGAL-DPDP-PA RBI PA-model, DPDP consent/DSR, and GST handling require legal sign-off before production certification');
test.skip('[HUMAN-REQUIRED] HR-WAREHOUSE-LIVE external warehouse credentials and data contracts require approval before live warehouse analytics assertions');
test.skip('[HUMAN-REQUIRED] HR-AI-MODEL-LIVE AI model/provider, data policy, and credentials require approval before live model-call assertions');
test.skip('[HUMAN-REQUIRED] HR-PROD-MIGRATE-DEPLOY staging/prod migration apply and deployment require human approval');
