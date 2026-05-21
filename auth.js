/**
 * Auth Module - Cognito Authentication
 * Manages user authentication state and Cognito SDK interactions.
 * Loaded via script tag; exposes global `Auth` object.
 */
var Auth = (function () {
  'use strict';

  // Internal state
  var _config = null;
  var _userPool = null;
  var _disabled = false;
  var _currentUser = null;
  var _currentSession = null;
  var _authState = {
    state: 'unauthenticated',
    user: null
  };

  /**
   * Dispatch a custom event on the document.
   */
  function _dispatchEvent(eventName, detail) {
    var event = new CustomEvent(eventName, { detail: detail });
    document.dispatchEvent(event);
  }

  /**
   * Extract user attributes from a Cognito user session.
   */
  function _getUserAttributes(cognitoUser, callback) {
    cognitoUser.getUserAttributes(function (err, attributes) {
      if (err) {
        callback(err, null);
        return;
      }
      var userInfo = { email: '', name: '', emailVerified: false };
      if (attributes) {
        attributes.forEach(function (attr) {
          if (attr.getName() === 'email') {
            userInfo.email = attr.getValue();
          } else if (attr.getName() === 'name') {
            userInfo.name = attr.getValue();
          } else if (attr.getName() === 'email_verified') {
            userInfo.emailVerified = attr.getValue() === 'true';
          }
        });
      }
      callback(null, userInfo);
    });
  }

  /**
   * Update internal auth state and dispatch stateChanged event.
   */
  function _setAuthState(state, user) {
    _authState = { state: state, user: user };
    _dispatchEvent('auth:stateChanged', _authState);
  }

  /**
   * Validate that the config object has all required fields.
   * Returns an error message string if invalid, or null if valid.
   */
  function _validateConfig(config) {
    if (!config || typeof config !== 'object') {
      return 'Auth config is missing or not an object';
    }
    var requiredFields = ['UserPoolId', 'ClientId', 'Region'];
    for (var i = 0; i < requiredFields.length; i++) {
      var field = requiredFields[i];
      if (!config[field] || typeof config[field] !== 'string' || config[field].trim() === '') {
        return 'Auth config is missing or has empty required field: ' + field;
      }
    }
    return null;
  }

  /**
   * Load config, initialize SDK, check existing session.
   */
  function init() {
    return fetch('auth-config.json')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to fetch auth-config.json: HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (config) {
        var validationError = _validateConfig(config);
        if (validationError) {
          throw new Error(validationError);
        }

        _config = config;

        // Check that the Cognito SDK is available
        if (typeof AmazonCognitoIdentity === 'undefined') {
          throw new Error('Amazon Cognito Identity SDK is not loaded');
        }

        // Initialize the CognitoUserPool
        var poolData = {
          UserPoolId: _config.UserPoolId,
          ClientId: _config.ClientId
        };
        _userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

        // Check for an existing session
        var cognitoUser = _userPool.getCurrentUser();
        if (cognitoUser) {
          return new Promise(function (resolve) {
            cognitoUser.getSession(function (err, session) {
              if (err || !session || !session.isValid()) {
                // No valid session, stay unauthenticated
                _currentUser = null;
                _currentSession = null;
                _setAuthState('unauthenticated', null);
                resolve();
                return;
              }

              _currentSession = session;
              // Get user attributes to populate user info
              _getUserAttributes(cognitoUser, function (attrErr, userInfo) {
                if (attrErr) {
                  // Session valid but can't get attributes - still authenticated
                  _currentUser = cognitoUser;
                  _setAuthState('authenticated', { email: '', name: '', emailVerified: false });
                } else {
                  _currentUser = cognitoUser;
                  _setAuthState('authenticated', userInfo);
                }
                resolve();
              });
            });
          });
        } else {
          _setAuthState('unauthenticated', null);
        }
      })
      .catch(function (error) {
        console.error('[Auth] Initialization failed:', error.message);
        _disabled = true;
        _currentUser = null;
        _currentSession = null;
        _setAuthState('unauthenticated', null);
      });
  }

  /**
   * Create a new user in Cognito with email and name attributes.
   */
  function register(email, password, name) {
    if (_disabled) {
      return Promise.reject(new Error('Auth is disabled due to configuration error'));
    }

    return new Promise(function (resolve, reject) {
      var attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: name })
      ];

      _userPool.signUp(email, password, attributeList, null, function (err, result) {
        if (err) {
          _dispatchEvent('auth:error', { operation: 'register', error: err });
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  /**
   * Verify email with confirmation code.
   */
  function confirmRegistration(email, code) {
    if (_disabled) {
      return Promise.reject(new Error('Auth is disabled due to configuration error'));
    }

    return new Promise(function (resolve, reject) {
      var userData = {
        Username: email,
        Pool: _userPool
      };
      var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

      cognitoUser.confirmRegistration(code, true, function (err, result) {
        if (err) {
          _dispatchEvent('auth:error', { operation: 'confirmRegistration', error: err });
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  /**
   * Resend the verification code.
   */
  function resendConfirmationCode(email) {
    if (_disabled) {
      return Promise.reject(new Error('Auth is disabled due to configuration error'));
    }

    return new Promise(function (resolve, reject) {
      var userData = {
        Username: email,
        Pool: _userPool
      };
      var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

      cognitoUser.resendConfirmationCode(function (err, result) {
        if (err) {
          _dispatchEvent('auth:error', { operation: 'resendConfirmationCode', error: err });
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  /**
   * Authenticate user against Cognito and store session tokens.
   * On success: stores session, retrieves user attributes, updates auth state.
   * On failure: dispatches auth:error event. If UserNotConfirmedException,
   * also dispatches auth:verificationRequired so UI can prompt verification.
   */
  function signIn(email, password) {
    if (_disabled) {
      return Promise.reject(new Error('Auth is disabled due to configuration error'));
    }

    return new Promise(function (resolve, reject) {
      var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: email,
        Password: password
      });

      var userData = {
        Username: email,
        Pool: _userPool
      };
      var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function (session) {
          _currentSession = session;
          _currentUser = cognitoUser;

          // Retrieve user attributes to populate user info
          _getUserAttributes(cognitoUser, function (attrErr, userInfo) {
            if (attrErr) {
              // Session valid but can't get attributes - still authenticated
              _setAuthState('authenticated', { email: email, name: '', emailVerified: false });
            } else {
              _setAuthState('authenticated', userInfo);
            }
            resolve(session);

            // Redirect to dashboard after successful sign-in
            // Avoid redirect loops if already on dashboard or admin page
            var currentPage = window.location.pathname.split('/').pop();
            if (currentPage !== 'dashboard.html' && currentPage !== 'admin.html') {
              window.location.href = 'dashboard.html';
            }
          });
        },
        onFailure: function (err) {
          if (err.code === 'UserNotConfirmedException') {
            _dispatchEvent('auth:verificationRequired', { email: email });
          }
          _dispatchEvent('auth:error', { operation: 'signIn', error: err });
          reject(err);
        }
      });
    });
  }

  /**
   * Clear all session tokens and update state.
   * Signs out the current Cognito user and resets internal state to unauthenticated.
   */
  function signOut() {
    if (_disabled) {
      return;
    }

    // Get the current user from the pool and sign them out via the SDK
    var cognitoUser = _userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }

    // Clear internal state
    _currentUser = null;
    _currentSession = null;

    // Update auth state and dispatch event
    _setAuthState('unauthenticated', null);
  }

  /**
   * Initiate password reset via Cognito.
   * Sends a reset code to the user's registered email address.
   */
  function forgotPassword(email) {
    if (_disabled) {
      return Promise.reject(new Error('Auth is disabled due to configuration error'));
    }

    return new Promise(function (resolve, reject) {
      var userData = {
        Username: email,
        Pool: _userPool
      };
      var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

      cognitoUser.forgotPassword({
        onSuccess: function (data) {
          resolve(data);
        },
        onFailure: function (err) {
          _dispatchEvent('auth:error', { operation: 'forgotPassword', error: err });
          reject(err);
        },
        inputVerificationCode: function (data) {
          resolve(data);
        }
      });
    });
  }

  /**
   * Complete password reset with code and new password.
   * Confirms the new password using the verification code sent to the user's email.
   */
  function confirmPassword(email, code, newPassword) {
    if (_disabled) {
      return Promise.reject(new Error('Auth is disabled due to configuration error'));
    }

    return new Promise(function (resolve, reject) {
      var userData = {
        Username: email,
        Pool: _userPool
      };
      var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: function () {
          resolve();
        },
        onFailure: function (err) {
          _dispatchEvent('auth:error', { operation: 'confirmPassword', error: err });
          reject(err);
        }
      });
    });
  }

  /**
   * Returns current authenticated user info or null.
   */
  function getCurrentUser() {
    return _authState.user;
  }

  /**
   * Returns current session tokens or null.
   */
  function getSession() {
    return _currentSession;
  }

  /**
   * Returns boolean indicating if user is authenticated.
   */
  function isAuthenticated() {
    return _authState.state === 'authenticated';
  }

  /**
   * Returns whether auth features are disabled.
   */
  function isDisabled() {
    return _disabled;
  }

  /**
   * Fetch all user attributes including custom attributes.
   * Returns an object with standard and custom attributes mapped to camelCase keys.
   * Missing or empty attributes are returned as null.
   * @returns {Promise<object>} Object with: email, name, emailVerified, registrationStatus, paymentStatus, paymentDate, registrationDate
   */
  function getCustomAttributes() {
    if (_disabled) {
      return Promise.reject(new Error('Auth is disabled due to configuration error'));
    }

    var cognitoUser = _userPool ? _userPool.getCurrentUser() : null;
    if (!cognitoUser) {
      return Promise.reject(new Error('No authenticated user'));
    }

    return new Promise(function (resolve, reject) {
      cognitoUser.getSession(function (sessionErr, session) {
        if (sessionErr || !session || !session.isValid()) {
          reject(new Error('No valid session'));
          return;
        }

        cognitoUser.getUserAttributes(function (err, attributes) {
          if (err) {
            reject(err);
            return;
          }

          var result = {
            email: null,
            name: null,
            emailVerified: null,
            registrationStatus: null,
            paymentStatus: null,
            paymentDate: null,
            registrationDate: null
          };

          var attrMap = {
            'email': 'email',
            'name': 'name',
            'email_verified': 'emailVerified',
            'custom:registration_status': 'registrationStatus',
            'custom:payment_status': 'paymentStatus',
            'custom:payment_date': 'paymentDate',
            'custom:registration_date': 'registrationDate'
          };

          if (attributes) {
            attributes.forEach(function (attr) {
              var attrName = attr.getName();
              var attrValue = attr.getValue();
              var key = attrMap[attrName];
              if (key) {
                if (key === 'emailVerified') {
                  result[key] = attrValue === 'true';
                } else {
                  result[key] = (attrValue && attrValue.trim() !== '') ? attrValue : null;
                }
              }
            });
          }

          resolve(result);
        });
      });
    });
  }

  // Public API
  return {
    init: init,
    register: register,
    confirmRegistration: confirmRegistration,
    resendConfirmationCode: resendConfirmationCode,
    signIn: signIn,
    signOut: signOut,
    forgotPassword: forgotPassword,
    confirmPassword: confirmPassword,
    getCurrentUser: getCurrentUser,
    getSession: getSession,
    isAuthenticated: isAuthenticated,
    isDisabled: isDisabled,
    getCustomAttributes: getCustomAttributes,
    // Exposed for testing
    _validateConfig: _validateConfig
  };
})();
