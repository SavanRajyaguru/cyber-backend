const { SECRET_PATTERNS } = require('../patterns/secret.patterns')
const { runPatterns } = require('./base.analyzer')

const API_KEY_TYPES = new Set([
  'google_api_key',
  'firebase_config',
  'openai_api_key',
  'anthropic_api_key',
  'gemini_api_key',
  'huggingface_token',
  'aws_access_key',
  'aws_secret_key',
  'azure_key',
  'stripe_publishable_key',
  'stripe_secret_key',
  'paypal_client_id',
  'twilio_key',
  'mailgun_key',
  'sendgrid_key',
  'cloudinary_key',
  'supabase_key'
])

const PATTERNS = SECRET_PATTERNS.filter((p) => API_KEY_TYPES.has(p.type))

/**
 * @param {string} content
 * @param {string} resource
 */
const analyzeApiKeys = (content, resource) => runPatterns(content, resource, PATTERNS)

module.exports = { analyzeApiKeys }
