const { SEVERITY } = require('../constants')

const looksLikeJwt = (value) => {
  const parts = String(value).split('.')
  return parts.length === 3 && parts.every((p) => p.length >= 10)
}

/**
 * Centralized secret pattern registry — compiled once.
 * @type {import('../types').SecretPattern[]}
 */
const SECRET_PATTERNS = [
  // Google / Firebase / AI
  {
    name: 'Google API Key',
    type: 'google_api_key',
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    severity: SEVERITY.HIGH,
    recommendation: 'Restrict the key by HTTP referrer/API and rotate if exposed.'
  },
  {
    name: 'Firebase Config',
    type: 'firebase_config',
    pattern: /firebaseConfig\s*=\s*\{[\s\S]{20,400}?apiKey\s*:\s*["'][^"']+["']/gi,
    severity: SEVERITY.MEDIUM,
    recommendation: 'Ensure Firebase security rules are locked down; avoid shipping admin credentials.'
  },
  {
    name: 'OpenAI API Key',
    type: 'openai_api_key',
    pattern: /\bsk-[A-Za-z0-9]{20,}\b/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Revoke the OpenAI key immediately and keep keys server-side only.'
  },
  {
    name: 'Anthropic API Key',
    type: 'anthropic_api_key',
    pattern: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Revoke the Anthropic key and store it only on the server.'
  },
  {
    name: 'Gemini / Google AI Key',
    type: 'gemini_api_key',
    pattern: /(?:gemini|generativelanguage).*?\b(AIza[0-9A-Za-z\-_]{35})\b/gi,
    severity: SEVERITY.HIGH,
    recommendation: 'Restrict/rotate the Gemini/Google API key.'
  },
  {
    name: 'Hugging Face Token',
    type: 'huggingface_token',
    pattern: /\bhf_[A-Za-z0-9]{20,}\b/g,
    severity: SEVERITY.HIGH,
    recommendation: 'Revoke the Hugging Face token and use server-side access.'
  },

  // Cloud
  {
    name: 'AWS Access Key',
    type: 'aws_access_key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Rotate the AWS access key and never embed IAM keys in frontend code.'
  },
  {
    name: 'AWS Secret Key',
    type: 'aws_secret_key',
    pattern: /(?:aws_secret_access_key|secretAccessKey)\s*[:=]\s*["']([A-Za-z0-9/+=]{30,})["']/gi,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Rotate the AWS secret immediately; secrets must never ship to browsers.'
  },
  {
    name: 'Azure Key',
    type: 'azure_key',
    pattern: /(?:AccountKey|SharedAccessSignature|azure).*?[:=]\s*["']([A-Za-z0-9+/=]{20,})["']/gi,
    severity: SEVERITY.HIGH,
    recommendation: 'Rotate Azure credentials and keep them server-side.'
  },
  {
    name: 'S3 Bucket URL',
    type: 's3_bucket_url',
    pattern: /https?:\/\/[a-z0-9.\-]+\.s3[.\-][a-z0-9.\-]*\.amazonaws\.com\/[^\s"'`]+/gi,
    severity: SEVERITY.LOW,
    recommendation: 'Ensure the bucket is not publicly listing sensitive objects.'
  },

  // VCS / chat
  {
    name: 'GitHub Token',
    type: 'github_token',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Revoke the GitHub token in settings and use short-lived tokens server-side.'
  },
  {
    name: 'GitLab Token',
    type: 'gitlab_token',
    pattern: /\bglpat-[A-Za-z0-9\-_]{20,}\b/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Revoke the GitLab personal access token immediately.'
  },
  {
    name: 'Slack Token',
    type: 'slack_token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Revoke the Slack token and regenerate from the Slack admin console.'
  },
  {
    name: 'Discord Token',
    type: 'discord_token',
    pattern: /\b[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}\b/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Reset the Discord bot/user token immediately.'
  },

  // Payments / messaging
  {
    name: 'Stripe Publishable Key',
    type: 'stripe_publishable_key',
    pattern: /\bpk_(?:live|test)_[0-9A-Za-z]{16,}\b/g,
    severity: SEVERITY.LOW,
    recommendation: 'Publishable keys are client-safe; confirm it is not a secret key and restrict in Stripe dashboard.'
  },
  {
    name: 'Stripe Secret Key',
    type: 'stripe_secret_key',
    pattern: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Revoke the Stripe secret key immediately; never expose sk_ keys in frontend.'
  },
  {
    name: 'PayPal Client ID',
    type: 'paypal_client_id',
    pattern: /(?:paypal).*?(?:client[_-]?id)\s*[:=]\s*["']([A-Za-z0-9_-]{10,})["']/gi,
    severity: SEVERITY.MEDIUM,
    recommendation: 'Confirm PayPal client configuration; keep client secrets server-side.'
  },
  {
    name: 'Twilio Key',
    type: 'twilio_key',
    pattern: /(?:SK|AC)[0-9a-fA-F]{32}\b/g,
    severity: SEVERITY.HIGH,
    recommendation: 'Rotate Twilio credentials and keep Auth Tokens server-side.'
  },
  {
    name: 'Mailgun Key',
    type: 'mailgun_key',
    pattern: /\bkey-[0-9a-zA-Z]{32}\b/g,
    severity: SEVERITY.HIGH,
    recommendation: 'Rotate the Mailgun API key.'
  },
  {
    name: 'SendGrid Key',
    type: 'sendgrid_key',
    pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Revoke the SendGrid API key immediately.'
  },
  {
    name: 'Cloudinary Key',
    type: 'cloudinary_key',
    pattern: /cloudinary:\/\/[0-9]+:[A-Za-z0-9_-]+@[A-Za-z0-9_-]+/gi,
    severity: SEVERITY.HIGH,
    recommendation: 'Rotate Cloudinary credentials; do not embed secret URLs in frontend.'
  },
  {
    name: 'Supabase Key',
    type: 'supabase_key',
    pattern: /\beyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2}\b/g,
    severity: SEVERITY.MEDIUM,
    recommendation: 'Use anon keys with RLS; never expose service_role keys in browsers.',
    validate: looksLikeJwt
  },

  // Tokens
  {
    name: 'JWT Token',
    type: 'jwt_token',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: SEVERITY.HIGH,
    recommendation: 'Do not hard-code JWTs; use short-lived tokens from authenticated APIs.',
    validate: looksLikeJwt
  },
  {
    name: 'Bearer Token',
    type: 'bearer_token',
    pattern: /Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi,
    severity: SEVERITY.HIGH,
    recommendation: 'Remove hard-coded Bearer tokens from public assets.'
  },
  {
    name: 'OAuth Token',
    type: 'oauth_token',
    pattern: /(?:access_token|refresh_token|id_token)\s*[:=]\s*["']([A-Za-z0-9\-._~+/]{20,})["']/gi,
    severity: SEVERITY.HIGH,
    recommendation: 'Never embed OAuth tokens in public frontend resources.'
  },

  // Databases / SMTP / auth
  {
    name: 'MongoDB Connection String',
    type: 'mongodb_uri',
    pattern: /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Rotate DB credentials and remove connection strings from public files.'
  },
  {
    name: 'PostgreSQL URL',
    type: 'postgres_uri',
    pattern: /postgres(?:ql)?:\/\/[^\s"'`]+/gi,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Rotate DB credentials and keep connection strings server-side only.'
  },
  {
    name: 'Redis URL',
    type: 'redis_uri',
    pattern: /rediss?:\/\/[^\s"'`]+/gi,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Rotate Redis credentials and remove URLs from public assets.'
  },
  {
    name: 'SMTP Credentials',
    type: 'smtp_credentials',
    pattern: /(?:smtp[_-]?(?:user|pass|password)|mail[_-]?pass(?:word)?)\s*[:=]\s*["']([^"']{4,})["']/gi,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Rotate SMTP credentials immediately.'
  },
  {
    name: 'Basic Auth Credentials',
    type: 'basic_auth',
    pattern: /https?:\/\/[^\/\s"'`]+:[^\/\s"'`]+@[^\s"'`]+/gi,
    severity: SEVERITY.HIGH,
    recommendation: 'Remove credentials from URLs; use proper authentication headers server-side.'
  },

  // Private keys
  {
    name: 'RSA Private Key',
    type: 'rsa_private_key',
    pattern: /-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Remove private keys from public resources and rotate affected keypairs.'
  },
  {
    name: 'Private Key (PEM)',
    type: 'pem_private_key',
    pattern: /-----BEGIN (?:EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]+?-----END (?:EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Remove PEM private keys from client-accessible files and rotate keys.'
  },
  {
    name: 'SSH Key',
    type: 'ssh_key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]+?-----END OPENSSH PRIVATE KEY-----/g,
    severity: SEVERITY.CRITICAL,
    recommendation: 'Remove SSH private keys from public assets and rotate host/user keys.'
  },

  // URLs / endpoints
  {
    name: 'Webhook URL',
    type: 'webhook_url',
    pattern: /https?:\/\/[^\s"'`]*(?:hooks\.slack\.com|discord\.com\/api\/webhooks|webhook)[^\s"'`]*/gi,
    severity: SEVERITY.HIGH,
    recommendation: 'Rotate webhook URLs; treat them as secrets.'
  },
  {
    name: 'Internal API Endpoint',
    type: 'internal_api',
    pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|internal\.[^\s"'`]+)[^\s"'`]*/gi,
    severity: SEVERITY.MEDIUM,
    recommendation: 'Remove internal/dev endpoints from production frontend bundles.'
  },
  {
    name: 'Development URL',
    type: 'dev_url',
    pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?[^\s"'`]*/gi,
    severity: SEVERITY.LOW,
    recommendation: 'Replace development URLs with environment-specific production config.'
  }
]

module.exports = {
  SECRET_PATTERNS
}
