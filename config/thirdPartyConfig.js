const thirdPartyCred = {

  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || 'your aws access key',
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY || 'your aws secretAccessKey',
  AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
  AWS_BUCKET_ENDPOINT: process.env.AWS_BUCKET_ENDPOINT,

  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'yudiz-fantasy-media',
  S3_BUCKET_URL: process.env.S3_BUCKET_URL || 'https://yudiz-fantasy-media.s3.ap-south-1.amazonaws.com/',
  S3_BUCKET_KYC_URL: process.env.S3_BUCKET_KYC_URL || '',
  S3_KYC_PAN: process.env.S3_KYC_PAN_PATH || 'kyc/pan/',
  S3_KYC_AADHAAR: process.env.S3_KYC_AADHAAR_PATH || 'kyc/aadhaar/',
  S3_KYC_BUCKET_NAME: process.env.S3_KYC_BUCKET_NAME || 'predi-kyc',
  S3_COMPLAINT: process.env.S3_COMPLAINTS_PATH || 'complaint/',

  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBbVb54ZxgNwG-c3ImBDBRS2OZrlVO_23s',
  GOOGLE_CLIENT_ID_W: process.env.GOOGLE_CLIENT_ID_W || '218538323308-p1bf5od94pbdfna1rstq3s1kea8gpgfr.apps.googleusercontent.com',
  GOOGLE_CLIENT_ID_A: process.env.GOOGLE_CLIENT_ID_A || '̌',
  GOOGLE_CLIENT_ID_I: process.env.GOOGLE_CLIENT_ID_I || '',
  CLOUD_STORAGE_PROVIDER: process.env.CLOUD_STORAGE_PROVIDER || 'AWS',
  SENTRY_DSN: process.env.SENTRY_DSN || 'https://public@sentry.example.com/',
  OTP_PROVIDER: process.env.OTP_PROVIDER || 'TEST',
  TEST_OTP: process.env.TEST_OTP || 123456,

  GCS_PROJECT_ID: process.env.GCS_PROJECT_ID || 'eleven-wicket',
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'yudiz-fantasy-media',

  AZURE_ACCOUNT_NAME: process.env.AZURE_ACCOUNT_NAME || 'fantasywl',
  AZURE_ACCOUNT_KEY: process.env.AZURE_ACCOUNT_KEY || '',
  AZURE_STORAGE_CONTAINER_NAME: process.env.AZURE_STORAGE_CONTAINER_NAME || 'yudiz-fantasy-media',

  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID,
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,

  KYC_DIRECT_VALIDATE: process.env.KYC_DIRECT_VALIDATE ? JSON.parse(process.env.KYC_DIRECT_VALIDATE) : false,
  KYC_CASHFREE_VERIFICATION: process.env.KYC_CASHFREE_VERIFICATION ? JSON.parse(process.env.KYC_CASHFREE_VERIFICATION) : false,
  CASHFREE_VERIFICATION_URL: process.env.CASHFREE_VERIFICATION_URL || 'https://sandbox.cashfree.com/verification',
  CASHFREE_CLIENTID: process.env.CASHFREE_CLIENTID,
  CASHFREE_CLIENTSECRET: process.env.CASHFREE_CLIENTSECRET,
  CASHFREE_AADHAAR_VERIFY_PATH: 'offline-aadhaar/verify',
  CASHFREE_AADHAAR_SENDOTP_PATH: 'offline-aadhaar/otp',
  CASHFREE_PAN_VERIFY_PATH: 'pan',

  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5aa',
  RAZORPAY_SECRET: process.env.RAZORPAY_SECRET || 'f4d8a0f3e1b1d7c4e5e6e5e6',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || 'razorpay_webhook_secret',

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OPENAI_KEY: process.env.OPENAI_KEY || '',
  MATCH_OPENAI_KEY: process.env.MATCH_OPENAI_KEY || '',
  AI_PROVIDER: process.env.AI_PROVIDER || 'GEMINI',
  GOOGLE_API: process.env.GOOGLE_API || 'https://www.googleapis.com',
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || 'AIzaSyAu_2ijVgzQBPdTdaL2pIXibgS2MaMYMYI',
  YOUTUBE_API_KEYS: process.env.YOUTUBE_API_KEYS || 'AIzaSyBBzklKVT-6UhoQ0F56B8Y2ondv613LOtY,AIzaSyBciOFbc03pkBNCQkWtTd5z2N2L4Q57KdY,AIzaSyAzVcozh108lOBqL3C1w0OWzJix7iQYtEI',
  YOUTUBE_URL: process.env.YOUTUBE_URL || 'https://www.youtube.com',
  X_API_BASE_URL: process.env.X_API_BASE_URL || 'https://api.x.com',
  X_TOKEN: process.env.X_TOKEN || 'AAAAAAAAAAAAAAAAAAAAAKhm0wEAAAAAqHYSH5x4SnVynVmv7R4YnxgDmNg%3DFqgYA3udId1ZHpJQhy57q6CAgCImcfzhxrqjDYd8DvOiFLqj4o',
  X_URL: process.env.X_URL || 'https://x.com',
  CRICTRACKER_API_TOKEN: process.env.CRICTRACKER_API_TOKEN || 'uYqYR0HBl1anohS8TWfw7g4H89MH6yHK2u2FhkfBvvdCZP1McW',
  CRICTRACKER_API_BASE_URL: process.env.CRICTRACKER_API_BASE_URL || 'https://article.crictracker.com/api/fetch-x-posts',
  CRICTRACKER_S3_BASE_URL: process.env.CRICTRACKER_S3_BASE_URL || 'https://media.crictracker.com/',

  SEND_EMAIL_PROVIDER: process.env.SEND_EMAIL_PROVIDER || 'oneSignal', // oneSignal or nodeMailer
  ONE_SIGNAL_BASE_URL: process.env.ONE_SIGNAL_BASE_URL || 'https://api.onesignal.com',
  ONE_SIGNAL_APP_ID: process.env.ONE_SIGNAL_APP_ID || '0',
  ONE_SIGNAL_AUTH_KEY: process.env.ONE_SIGNAL_AUTH_KEY || '0',
  EMAIL_SUBJECT_FOR_SEND_OTP: process.env.EMAIL_SUBJECT_FOR_SEND_OTP || 'OTP For Email Verification',

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '7835296815:AAGbHueaS4D74NGVPvc2_hstOSpA8wEDow8',
  TELEGRAM_URL: process.env.TELEGRAM_URL || 'https://api.telegram.org',
  TELEGRAM_CHAT_IDS: process.env.TELEGRAM_CHAT_IDS || ['-1002854094525', '-4833224444'],

  // Twitch API Configuration
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID || '',
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET || '',
  TWITCH_API_BASE_URL: process.env.TWITCH_API_BASE_URL || 'https://api.twitch.tv/helix',
  TWITCH_OAUTH_URL: process.env.TWITCH_OAUTH_URL || 'https://id.twitch.tv/oauth2/token',
  TWITCH_URL: process.env.TWITCH_URL || 'https://www.twitch.tv',

  // Llama AI Configuration
  LLAMA_API_URL: process.env.LLAMA_API_URL || 'https://llama.lc.webdevprojects.cloud/generate',
  LLAMA_AUTH_TOKEN: process.env.LLAMA_AUTH_TOKEN || 'NX6JEZ6zpxfRVnAhF0af',

  // Mistral AI Configuration (using same endpoint as Llama)
  MISTRAL_API_URL: process.env.MISTRAL_API_URL || 'https://mistral.lc.webdevprojects.cloud/generate',
  MISTRAL_AUTH_TOKEN: process.env.MISTRAL_AUTH_TOKEN || 'sDavci9tLKrDdwLnxI2G',

  LLAMA3B_API_URL: process.env.LLAMA3B_API_URL || 'https://deepseek.lc.webdevprojects.cloud/generate',
  LLAMA3B_AUTH_TOKEN: process.env.LLAMA3B_AUTH_TOKEN || 'sDavci9tLKrDdwLnxI2G',

  ENTITYSPORT_SOCCER_API_KEY: process.env.ENTITYSPORT_SOCCER_API_KEY || '0a4c76b3a2120d797c313bc5155ee2c6',

  TMDB_API_KEY: process.env.TMDB_API_KEY || '50daf4f1fc49a2fc48e8b4707e7f2e5f',
  TMDB_API_KEYS: process.env.TMDB_API_KEYS || '',
  TMDB_BASE_URL: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
  TMDB_IMG: process.env.TMDB_IMG || 'https://image.tmdb.org/t/p/original',

  CRICTRACKER_GATEWAY_URL: process.env.CRICTRACKER_GATEWAY_URL || 'https://gateway.crictracker.com/graphql',
  CRICTRACKER_SUBSCRIPTION_URL: process.env.CRICTRACKER_SUBSCRIPTION_URL || 'https://subscription.crictracker.com/graphql'
}

module.exports = thirdPartyCred
