/**
 * Role Manager Module - JWT Role Detection
 * Decodes Cognito ID token to determine user role based on group membership.
 * Loaded via script tag; exposes global `RoleManager` object.
 */
var RoleManager = (function () {
  'use strict';

  // Cached role for current session
  var _cachedRole = null;

  /**
   * Decode a base64url-encoded string to a regular string.
   * Handles the URL-safe base64 variant used in JWTs.
   * @param {string} str - Base64url encoded string
   * @returns {string} Decoded string
   */
  function _base64UrlDecode(str) {
    // Replace URL-safe characters with standard base64 characters
    var base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Pad with '=' to make length a multiple of 4
    var padding = base64.length % 4;
    if (padding) {
      base64 += new Array(5 - padding).join('=');
    }
    return atob(base64);
  }

  /**
   * Determine role from a decoded token payload object.
   * @param {object} payload - Decoded JWT payload
   * @returns {string} "admin" or "user"
   */
  function _getRoleFromPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return 'user';
    }
    var groups = payload['cognito:groups'];
    if (!Array.isArray(groups)) {
      return 'user';
    }
    for (var i = 0; i < groups.length; i++) {
      if (groups[i] === 'Admins') {
        return 'admin';
      }
    }
    return 'user';
  }

  /**
   * Decode a JWT ID token payload (base64url) without signature verification.
   * @param {string} idToken - The raw JWT string (header.payload.signature)
   * @returns {object|null} Decoded payload object or null if decoding fails
   */
  function decodeTokenPayload(idToken) {
    try {
      if (!idToken || typeof idToken !== 'string') {
        return null;
      }
      var parts = idToken.split('.');
      if (parts.length !== 3) {
        return null;
      }
      var payloadStr = _base64UrlDecode(parts[1]);
      return JSON.parse(payloadStr);
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract the user's role from the current session.
   * Reads the ID token from Auth.getSession(), decodes it,
   * and checks for "Admins" in cognito:groups.
   * @returns {string} "admin" or "user"
   */
  function getUserRole() {
    // Return cached role if available
    if (_cachedRole !== null) {
      return _cachedRole;
    }

    // Check if Auth module is available and has a session
    if (typeof Auth === 'undefined' || !Auth.getSession || !Auth.getSession()) {
      _cachedRole = 'user';
      return _cachedRole;
    }

    try {
      var session = Auth.getSession();
      var idToken = session.getIdToken().getJwtToken();
      var payload = decodeTokenPayload(idToken);
      _cachedRole = _getRoleFromPayload(payload);
    } catch (e) {
      _cachedRole = 'user';
    }

    return _cachedRole;
  }

  /**
   * Check if the current user has admin privileges.
   * @returns {boolean}
   */
  function isAdmin() {
    return getUserRole() === 'admin';
  }

  /**
   * Clear cached role (called on sign-out).
   */
  function clearRole() {
    _cachedRole = null;
  }

  // Public API
  return {
    decodeTokenPayload: decodeTokenPayload,
    getUserRole: getUserRole,
    isAdmin: isAdmin,
    clearRole: clearRole
  };
})();
