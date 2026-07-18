const tls = require('tls')
const config = require('../../../../config/config')
const {
  ERROR_CODES,
  DEFAULT_SSL_TIMEOUT_MS,
  DEFAULT_HTTPS_PORT
} = require('./constants')

const getTimeoutMs = () =>
  Number(config.SCAN_SSL_TIMEOUT_MS) ||
  Number(config.SCAN_HTTP_TIMEOUT_MS) ||
  DEFAULT_SSL_TIMEOUT_MS

/**
 * Extract hostname and TLS port from a normalized URL.
 * Always targets TLS (default 443); http URLs still attempt HTTPS on 443 unless port set.
 * @param {string} sUrl
 * @returns {{ hostname: string, port: number }}
 */
const extractHostPort = (sUrl) => {
  const parsed = new URL(sUrl)
  const hostname = parsed.hostname
  if (!hostname) {
    const error = new Error('Invalid hostname')
    error.code = ERROR_CODES.INVALID_HOSTNAME
    throw error
  }

  let port = DEFAULT_HTTPS_PORT
  if (parsed.port) {
    port = Number(parsed.port)
  } else if (parsed.protocol === 'https:') {
    port = 443
  } else if (parsed.protocol === 'http:') {
    // Probe HTTPS on standard port even when URL was http
    port = DEFAULT_HTTPS_PORT
  }

  return { hostname, port }
}

/**
 * Map Node TLS/socket errors to structured codes.
 * @param {any} error
 * @returns {{ code: string, message: string }}
 */
const mapTlsError = (error) => {
  const code = error?.code
  const message = error?.message || 'TLS connection failed'

  if (code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    return { code: ERROR_CODES.INVALID_HOSTNAME, message: 'Hostname does not match certificate' }
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { code: ERROR_CODES.DNS_FAILURE, message: 'DNS lookup failed' }
  }
  if (code === 'ECONNREFUSED') {
    return { code: ERROR_CODES.CONNECTION_REFUSED, message: 'Connection refused' }
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || /timeout/i.test(message)) {
    return { code: ERROR_CODES.TIMEOUT, message: 'TLS connection timed out' }
  }
  if (
    code === 'EPROTO' ||
    code === 'ERR_SSL_WRONG_VERSION_NUMBER' ||
    code === 'ERR_SSL_PROTOCOL_ERROR' ||
    /unsupported protocol|wrong version number|handshake/i.test(message)
  ) {
    return { code: ERROR_CODES.UNSUPPORTED_PROTOCOL, message: 'Unsupported or failed TLS protocol' }
  }
  if (
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'CERT_HAS_EXPIRED' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    /ssl|tls|certificate/i.test(message)
  ) {
    return { code: ERROR_CODES.SSL_HANDSHAKE_FAILURE, message: 'SSL/TLS handshake failed' }
  }
  return { code: ERROR_CODES.UNKNOWN, message }
}

/**
 * Open a single TLS connection and collect certificate + negotiated protocol.
 * @param {{ hostname: string, port?: number }} params
 * @returns {Promise<import('./types').TlsConnectResult>}
 */
const connectTls = ({ hostname, port = DEFAULT_HTTPS_PORT }) => {
  const timeoutMs = getTimeoutMs()

  return new Promise((resolve, reject) => {
    let settled = false
    let socket

    const finish = (fn, value) => {
      if (settled) return
      settled = true
      try {
        if (socket && !socket.destroyed) {
          socket.destroy()
        }
      } catch (_) {}
      fn(value)
    }

    try {
      socket = tls.connect({
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: timeoutMs
      })
    } catch (error) {
      const mapped = mapTlsError(error)
      const err = new Error(mapped.message)
      err.code = mapped.code
      return reject(err)
    }

    const onTimeout = () => {
      const err = new Error('TLS connection timed out')
      err.code = ERROR_CODES.TIMEOUT
      finish(reject, err)
    }

    socket.setTimeout(timeoutMs, onTimeout)

    socket.once('secureConnect', () => {
      try {
        const peerCertificate = socket.getPeerCertificate(true)
        const hasCert = peerCertificate && Object.keys(peerCertificate).length > 0

        if (!hasCert) {
          const err = new Error('Certificate unavailable')
          err.code = ERROR_CODES.CERTIFICATE_UNAVAILABLE
          return finish(reject, err)
        }

        let rawCertificate = null
        if (peerCertificate.raw) {
          rawCertificate = Buffer.isBuffer(peerCertificate.raw)
            ? peerCertificate.raw
            : Buffer.from(peerCertificate.raw)
        }

        finish(resolve, {
          httpsEnabled: true,
          protocol: socket.getProtocol() || null,
          authorized: Boolean(socket.authorized),
          authorizationError: socket.authorizationError
            ? String(socket.authorizationError)
            : null,
          peerCertificate,
          rawCertificate,
          hostname,
          port
        })
      } catch (error) {
        const mapped = mapTlsError(error)
        const err = new Error(mapped.message)
        err.code = mapped.code
        finish(reject, err)
      }
    })

    socket.once('error', (error) => {
      const mapped = mapTlsError(error)
      const err = new Error(mapped.message)
      err.code = mapped.code === ERROR_CODES.TIMEOUT ? ERROR_CODES.TIMEOUT : mapped.code
      finish(reject, err)
    })
  })
}

module.exports = {
  extractHostPort,
  connectTls,
  mapTlsError,
  getTimeoutMs
}
