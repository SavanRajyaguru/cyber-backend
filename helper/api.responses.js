const status = {
  OK: 200,
  Create: 201,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  Gone: 410,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
  InternalServerError: 500
}

const jsonStatus = {
  OK: 200,
  Create: 201,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  Gone: 410,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
  InternalServerError: 500
}

const messages = {
  English: {
    success: 'Success',
    err_unauthorized: 'Unauthorized access',
    access_denied: 'Access denied',
    err_internal: 'Something went wrong. Please try again later.',
    not_found: '## not found',
    invalid: 'Invalid ##',
    required: '## is required',
    otp_sent: 'OTP sent successfully',
    otp_verified: 'OTP verified successfully',
    otp_invalid: 'Invalid or expired OTP',
    otp_expired: 'OTP has expired',
    otp_max_attempts: 'Maximum OTP verification attempts exceeded',
    otp_rate_limit: 'Too many OTP requests. Please try again later.',
    email_not_configured: 'Email service is not configured',
    login_success: 'Logged in successfully',
    logout_success: 'Logged out successfully',
    token_refreshed: 'Token refreshed successfully',
    invalid_token: 'Invalid or expired token',
    invalid_refresh_token: 'Invalid or expired refresh token',
    google_auth_failed: 'Google authentication failed',
    guest_login_success: 'Guest session created successfully',
    user_blocked: 'Your account is inactive',
    guest_access_denied: 'Guest users cannot perform this action',
    scan_queued: 'Scan queued successfully',
    scan_not_found: 'Scan not found or expired',
    scan_in_progress: 'Scan is still in progress',
    scan_invalid_url: 'Invalid URL. Provide a valid http/https URL, domain, or IP address',
    scan_progress: 'Scan progress retrieved successfully',
    scan_result: 'Scan result retrieved successfully',
    scan_list: 'Scan list retrieved successfully'
  }
}

module.exports = {
  status,
  jsonStatus,
  messages
}
