/**
 * Admin Dashboard Module
 * Manages admin dashboard initialization, access control, and widget rendering.
 * Loaded via script tag on admin.html; exposes global `AdminDashboard` object.
 */
var AdminDashboard = (function () {
  'use strict';

  // Module-level variables for announcements management
  var S3_BUCKET_NAME = 'aiproductcamp-ramji';
  var S3_ANNOUNCEMENTS_KEY = 'data/announcements.json';
  var _announcements = [];

  /**
   * Initialize the dashboard: verify admin access, render widgets, listen for session changes.
   * Called after Auth.init() resolves, so the session is already available.
   */
  function init() {
    // Verify admin role before rendering any content
    if (!RoleManager.isAdmin()) {
      window.location.href = 'index.html';
      return;
    }

    // Render all dashboard widgets
    renderUsersWidget();
    renderScheduleWidget();
    renderStatsWidget();
    renderRegistrationsManagementWidget();
    renderAnnouncementsManagementWidget();

    // Listen for auth state changes — redirect if session expires
    document.addEventListener('auth:stateChanged', function (e) {
      var detail = e.detail;
      if (!detail || detail.state !== 'authenticated') {
        window.location.href = 'index.html';
      }
    });
  }

  /**
   * Render the Registered Users widget.
   * Displays total count and recent registrations (name, email).
   * Shows an error message if data cannot be retrieved.
   */
  function renderUsersWidget() {
    var widgetEl = document.querySelector('#users-widget .widget-content');
    if (!widgetEl) return;

    try {
      // Mock/placeholder data (no backend API available)
      var data = {
        totalUsers: 24,
        recentRegistrations: [
          { name: 'Alice Johnson', email: 'alice@example.com' },
          { name: 'Bob Smith', email: 'bob@example.com' },
          { name: 'Carol Lee', email: 'carol@example.com' },
          { name: 'David Park', email: 'david@example.com' },
          { name: 'Eva Martinez', email: 'eva@example.com' }
        ]
      };

      var html = '<p><strong>Total Registered:</strong> ' + data.totalUsers + '</p>';
      html += '<h3>Recent Registrations</h3>';
      html += '<ul>';
      for (var i = 0; i < data.recentRegistrations.length; i++) {
        var user = data.recentRegistrations[i];
        html += '<li>' + user.name + ' &ndash; <span>' + user.email + '</span></li>';
      }
      html += '</ul>';

      widgetEl.innerHTML = html;
    } catch (err) {
      widgetEl.innerHTML = '<p class="widget-error">Unable to load data</p>';
    }
  }


  /**
   * Render the Camp Schedule widget.
   * Displays each day's title and deliverable, plus total number of camp days.
   */
  function renderScheduleWidget() {
    var widgetEl = document.querySelector('#schedule-widget .widget-content');
    if (!widgetEl) return;

    try {
      // Mock/placeholder data matching the camp schedule from the main site
      var data = {
        totalDays: 5,
        days: [
          { day: 1, title: 'AI & Cloud Foundations', deliverable: 'Working AI development environment on the cloud' },
          { day: 2, title: 'Building AI Products', deliverable: 'AI product prototype' },
          { day: 3, title: 'AI Programming', deliverable: 'Functional AI application' },
          { day: 4, title: 'AI Architecture', deliverable: 'Production-ready architecture plan' },
          { day: 5, title: 'Demo Day', deliverable: 'Portfolio-ready AI project' }
        ]
      };

      var html = '<p><strong>Total Camp Days:</strong> ' + data.totalDays + '</p>';
      html += '<ol>';
      for (var i = 0; i < data.days.length; i++) {
        var day = data.days[i];
        html += '<li>';
        html += '<strong>Day ' + day.day + ': ' + day.title + '</strong>';
        html += '<br><span>Deliverable: ' + day.deliverable + '</span>';
        html += '</li>';
      }
      html += '</ol>';

      widgetEl.innerHTML = html;
    } catch (err) {
      widgetEl.innerHTML = '<p class="widget-error">Unable to load data</p>';
    }
  }

  /**
   * Render the Site Statistics widget.
   * Displays admin count, pricing tier information, and FAQ count.
   * Requirements: 6.1, 6.2, 6.3, 6.4
   */
  function renderStatsWidget() {
    var widgetEl = document.querySelector('#stats-widget .widget-content');
    if (!widgetEl) return;

    try {
      // Mock/placeholder data reflecting the main site content
      var data = {
        adminCount: 2,
        pricing: { regular: 229, earlyBird: 199 },
        faqCount: 6
      };

      var html = '<dl>';
      html += '<dt>Admin Users</dt>';
      html += '<dd>' + data.adminCount + '</dd>';
      html += '<dt>Regular Price</dt>';
      html += '<dd>$' + data.pricing.regular + '</dd>';
      html += '<dt>Early Bird Price</dt>';
      html += '<dd>$' + data.pricing.earlyBird + '</dd>';
      html += '<dt>FAQ Items</dt>';
      html += '<dd>' + data.faqCount + '</dd>';
      html += '</dl>';

      widgetEl.innerHTML = html;
    } catch (err) {
      widgetEl.innerHTML = '<p class="widget-error">Unable to load data</p>';
    }
  }

  /**
   * Render the Manage Registrations widget.
   * Lists users from Cognito User Pool with inline controls to update
   * registration status and payment status.
   * Requirements: 9.1, 9.2, 9.3, 9.4
   */
  function renderRegistrationsManagementWidget() {
    var widgetEl = document.querySelector('#registrations-management-widget .widget-content');
    if (!widgetEl) return;

    widgetEl.innerHTML = '<p class="widget-loading">Loading users...</p>';

    // Get credentials from Cognito Identity Pool and list users
    _getAdminCredentials()
      .then(function (credentials) {
        var cognitoISP = new AWS.CognitoIdentityServiceProvider({
          region: 'us-east-1',
          credentials: credentials
        });

        var params = {
          UserPoolId: 'us-east-1_SwlJv7Aku',
          Limit: 60
        };

        return cognitoISP.listUsers(params).promise();
      })
      .then(function (data) {
        var users = data.Users || [];
        _renderUserList(widgetEl, users);
      })
      .catch(function (err) {
        widgetEl.innerHTML = '<p class="widget-error">Unable to load users: ' + (err.message || 'Unknown error') + '</p>';
      });
  }

  /**
   * Get AWS credentials for admin operations via Cognito Identity Pool.
   * Uses the current authenticated user's session token.
   * @returns {Promise<AWS.Credentials>}
   */
  function _getAdminCredentials() {
    return new Promise(function (resolve, reject) {
      var session = Auth.getSession ? Auth.getSession() : null;
      if (!session) {
        reject(new Error('No authenticated session'));
        return;
      }

      try {
        var idToken = session.getIdToken().getJwtToken();
        var loginKey = 'cognito-idp.us-east-1.amazonaws.com/us-east-1_SwlJv7Aku';
        var logins = {};
        logins[loginKey] = idToken;

        AWS.config.region = 'us-east-1';
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
          IdentityPoolId: _getIdentityPoolId(),
          Logins: logins
        });

        AWS.config.credentials.refresh(function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(AWS.config.credentials);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Get the Identity Pool ID from config or fallback.
   * @returns {string}
   */
  function _getIdentityPoolId() {
    return window.AUTH_CONFIG && window.AUTH_CONFIG.IdentityPoolId
      ? window.AUTH_CONFIG.IdentityPoolId
      : 'us-east-1:3af656e6-b1fd-4e8e-954f-7e96686d2a37';
  }

  /**
   * Render the user list table with inline status controls.
   * @param {HTMLElement} container - The widget content element
   * @param {Array} users - Array of Cognito user objects from listUsers
   */
  function _renderUserList(container, users) {
    if (!users || users.length === 0) {
      container.innerHTML = '<p>No users found.</p>';
      return;
    }

    var html = '<table class="registrations-table" role="grid">';
    html += '<thead><tr>';
    html += '<th scope="col">Name</th>';
    html += '<th scope="col">Email</th>';
    html += '<th scope="col">Registration Status</th>';
    html += '<th scope="col">Payment Status</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    for (var i = 0; i < users.length; i++) {
      var user = users[i];
      var attrs = _extractUserAttributes(user.Attributes || []);
      var username = user.Username || '';

      html += '<tr data-username="' + _escapeHtml(username) + '">';
      html += '<td>' + _escapeHtml(attrs.name || 'N/A') + '</td>';
      html += '<td>' + _escapeHtml(attrs.email || 'N/A') + '</td>';
      html += '<td>' + _renderRegistrationStatusSelect(username, attrs.registrationStatus) + '</td>';
      html += '<td>' + _renderPaymentStatusSelect(username, attrs.paymentStatus) + '</td>';
      html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;

    // Attach change event listeners to all select elements
    _attachStatusChangeListeners(container);
  }

  /**
   * Extract relevant attributes from a Cognito user's attribute array.
   * @param {Array} attributes - Array of {Name, Value} objects
   * @returns {object} Extracted attributes
   */
  function _extractUserAttributes(attributes) {
    var result = {
      name: '',
      email: '',
      registrationStatus: 'Not Registered',
      paymentStatus: 'Not Paid'
    };

    for (var i = 0; i < attributes.length; i++) {
      var attr = attributes[i];
      switch (attr.Name) {
        case 'name':
          result.name = attr.Value || '';
          break;
        case 'email':
          result.email = attr.Value || '';
          break;
        case 'custom:registration_status':
          result.registrationStatus = attr.Value || 'Not Registered';
          break;
        case 'custom:payment_status':
          result.paymentStatus = attr.Value || 'Not Paid';
          break;
      }
    }

    return result;
  }

  /**
   * Render a registration status dropdown for a user.
   * @param {string} username - Cognito username
   * @param {string} currentStatus - Current registration status
   * @returns {string} HTML select element
   */
  function _renderRegistrationStatusSelect(username, currentStatus) {
    var options = ['Pending', 'Confirmed', 'Not Registered'];
    var html = '<select class="status-select registration-status-select" ';
    html += 'data-username="' + _escapeHtml(username) + '" ';
    html += 'data-attribute="registrationStatus" ';
    html += 'aria-label="Registration status for ' + _escapeHtml(username) + '">';

    for (var i = 0; i < options.length; i++) {
      var selected = (options[i] === currentStatus) ? ' selected' : '';
      html += '<option value="' + options[i] + '"' + selected + '>' + options[i] + '</option>';
    }

    html += '</select>';
    return html;
  }

  /**
   * Render a payment status dropdown for a user.
   * @param {string} username - Cognito username
   * @param {string} currentStatus - Current payment status
   * @returns {string} HTML select element
   */
  function _renderPaymentStatusSelect(username, currentStatus) {
    var options = ['Paid', 'Pending', 'Not Paid'];
    var html = '<select class="status-select payment-status-select" ';
    html += 'data-username="' + _escapeHtml(username) + '" ';
    html += 'data-attribute="paymentStatus" ';
    html += 'aria-label="Payment status for ' + _escapeHtml(username) + '">';

    for (var i = 0; i < options.length; i++) {
      var selected = (options[i] === currentStatus) ? ' selected' : '';
      html += '<option value="' + options[i] + '"' + selected + '>' + options[i] + '</option>';
    }

    html += '</select>';
    return html;
  }

  /**
   * Attach change event listeners to status select elements.
   * @param {HTMLElement} container - The widget content element
   */
  function _attachStatusChangeListeners(container) {
    var selects = container.querySelectorAll('.status-select');
    for (var i = 0; i < selects.length; i++) {
      selects[i].addEventListener('change', function (e) {
        var select = e.target;
        var username = select.getAttribute('data-username');
        var attributeType = select.getAttribute('data-attribute');
        var newValue = select.value;

        var attributes = {};
        attributes[attributeType] = newValue;

        // Call updateUserAttributes to persist the change
        updateUserAttributes(username, attributes);
      });
    }
  }

  /**
   * Update a user's custom attributes via Cognito Admin API.
   * Maps camelCase keys to custom: attribute names.
   * Auto-sets custom:payment_date when paymentStatus is "Paid".
   * @param {string} username - Cognito username
   * @param {object} attributes - Object with camelCase keys (e.g. { registrationStatus: 'Confirmed' })
   * Requirements: 9.3, 9.4, 9.5, 9.6
   */
  function updateUserAttributes(username, attributes) {
    // Map camelCase keys to Cognito custom attribute names
    var attributeMap = {
      registrationStatus: 'custom:registration_status',
      paymentStatus: 'custom:payment_status'
    };

    // Build the UserAttributes array
    var userAttributes = [];
    var keys = Object.keys(attributes);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var cognitoName = attributeMap[key];
      if (cognitoName) {
        userAttributes.push({
          Name: cognitoName,
          Value: attributes[key]
        });
      }
    }

    // Auto-set payment_date when paymentStatus is set to "Paid"
    if (attributes.paymentStatus === 'Paid') {
      var today = new Date();
      var yyyy = today.getFullYear();
      var mm = String(today.getMonth() + 1).padStart(2, '0');
      var dd = String(today.getDate()).padStart(2, '0');
      var paymentDate = yyyy + '-' + mm + '-' + dd;

      userAttributes.push({
        Name: 'custom:payment_date',
        Value: paymentDate
      });
    }

    if (userAttributes.length === 0) {
      return Promise.resolve();
    }

    // Find the select element that triggered this update for feedback
    var feedbackTarget = document.querySelector(
      '.status-select[data-username="' + username + '"]'
    );

    return _getAdminCredentials()
      .then(function (credentials) {
        var cognitoISP = new AWS.CognitoIdentityServiceProvider({
          region: 'us-east-1',
          credentials: credentials
        });

        var params = {
          UserPoolId: 'us-east-1_SwlJv7Aku',
          Username: username,
          UserAttributes: userAttributes
        };

        return cognitoISP.adminUpdateUserAttributes(params).promise();
      })
      .then(function () {
        _showFeedback(feedbackTarget, 'Updated successfully', 'success');
      })
      .catch(function (err) {
        var message = 'Failed to update user: ' + (err.message || 'Unknown error');
        _showFeedback(feedbackTarget, message, 'error');
      });
  }

  /**
   * Load announcements from S3 bucket.
   * Fetches data/announcements.json and returns the announcements array.
   * @returns {Promise<Array>} Array of announcement objects
   */
  function loadAnnouncementsFromS3() {
    return _getAdminCredentials()
      .then(function (credentials) {
        var s3 = new AWS.S3({
          region: 'us-east-1',
          credentials: credentials
        });

        var params = {
          Bucket: S3_BUCKET_NAME,
          Key: S3_ANNOUNCEMENTS_KEY
        };

        return s3.getObject(params).promise();
      })
      .then(function (data) {
        var body = data.Body.toString('utf-8');
        var parsed = JSON.parse(body);
        return parsed.announcements || [];
      });
  }

  /**
   * Save announcements array to S3 bucket.
   * Uses AWS SDK S3 putObject with Identity Pool admin credentials.
   * @param {Array} announcements - Array of announcement objects to save
   * @returns {Promise} Resolves on success, rejects on error
   * Requirements: 10.3, 10.5, 10.6
   */
  function saveAnnouncementsToS3(announcements) {
    return _getAdminCredentials()
      .then(function (credentials) {
        var s3 = new AWS.S3({
          region: 'us-east-1',
          credentials: credentials
        });

        var params = {
          Bucket: S3_BUCKET_NAME,
          Key: S3_ANNOUNCEMENTS_KEY,
          Body: JSON.stringify({ announcements: announcements }),
          ContentType: 'application/json'
        };

        return s3.putObject(params).promise();
      })
      .then(function () {
        var widget = document.querySelector('#announcements-management-widget .widget-content');
        if (widget) {
          _showFeedback(widget.querySelector('#announcement-form') || widget, 'Announcements saved successfully.', 'success');
        }
      })
      .catch(function (err) {
        var widget = document.querySelector('#announcements-management-widget .widget-content');
        if (widget) {
          _showFeedback(widget.querySelector('#announcement-form') || widget, 'Failed to save announcements: ' + (err.message || 'Unknown error'), 'error');
        }
        throw err;
      });
  }

  /**
   * Render the Announcements management widget.
   * Displays existing announcements with delete buttons and a form to create new ones.
   * Requirements: 10.1, 10.2, 10.4
   */
  function renderAnnouncementsManagementWidget() {
    var widgetEl = document.querySelector('#announcements-management-widget .widget-content');
    if (!widgetEl) return;

    widgetEl.innerHTML = '<p class="widget-loading">Loading announcements...</p>';

    loadAnnouncementsFromS3()
      .then(function (announcements) {
        _announcements = announcements;
        _renderAnnouncementsUI(widgetEl);
      })
      .catch(function (err) {
        // If the file doesn't exist yet, start with empty array
        if (err.code === 'NoSuchKey' || err.code === 'AccessDenied') {
          _announcements = [];
          _renderAnnouncementsUI(widgetEl);
        } else {
          widgetEl.innerHTML = '<p class="widget-error">Unable to load announcements: ' + _escapeHtml(err.message || 'Unknown error') + '</p>';
        }
      });
  }

  /**
   * Render the announcements management UI (form + list).
   * @param {HTMLElement} container - The widget content element
   */
  function _renderAnnouncementsUI(container) {
    var html = '';

    // Create announcement form
    html += '<form id="announcement-form" class="announcement-form">';
    html += '<div class="form-group">';
    html += '<label for="announcement-title">Title</label>';
    html += '<input type="text" id="announcement-title" name="title" required placeholder="Announcement title">';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label for="announcement-message">Message</label>';
    html += '<textarea id="announcement-message" name="message" required placeholder="Announcement message" rows="3"></textarea>';
    html += '</div>';
    html += '<button type="submit" class="btn-post-announcement">Post Announcement</button>';
    html += '</form>';

    // Existing announcements list
    html += '<div class="announcements-list">';
    if (_announcements.length === 0) {
      html += '<p class="no-announcements">No announcements yet.</p>';
    } else {
      for (var i = 0; i < _announcements.length; i++) {
        var announcement = _announcements[i];
        html += '<div class="announcement-item" data-id="' + _escapeHtml(announcement.id) + '">';
        html += '<div class="announcement-item-header">';
        html += '<h3 class="announcement-item-title">' + _escapeHtml(announcement.title) + '</h3>';
        html += '<button type="button" class="btn-delete-announcement" data-id="' + _escapeHtml(announcement.id) + '" aria-label="Delete announcement: ' + _escapeHtml(announcement.title) + '">Delete</button>';
        html += '</div>';
        html += '<p class="announcement-item-message">' + _escapeHtml(announcement.message) + '</p>';
        html += '<span class="announcement-item-date">Posted: ' + _escapeHtml(announcement.postedDate || 'Unknown') + '</span>';
        html += '</div>';
      }
    }
    html += '</div>';

    container.innerHTML = html;

    // Attach event listeners
    _attachAnnouncementListeners(container);
  }

  /**
   * Attach event listeners for the announcement form and delete buttons.
   * @param {HTMLElement} container - The widget content element
   */
  function _attachAnnouncementListeners(container) {
    // Form submit listener
    var form = container.querySelector('#announcement-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var titleInput = form.querySelector('#announcement-title');
        var messageInput = form.querySelector('#announcement-message');
        var title = titleInput.value.trim();
        var message = messageInput.value.trim();

        if (!title || !message) return;

        // Generate UUID
        var id = _generateUUID();

        // Get current date in YYYY-MM-DD format
        var today = new Date();
        var yyyy = today.getFullYear();
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var dd = String(today.getDate()).padStart(2, '0');
        var postedDate = yyyy + '-' + mm + '-' + dd;

        // Create new announcement object
        var newAnnouncement = {
          id: id,
          title: title,
          message: message,
          postedDate: postedDate
        };

        // Add to beginning of array (newest first)
        _announcements.unshift(newAnnouncement);

        // Save to S3 (implemented in task 9.2)
        if (typeof saveAnnouncementsToS3 === 'function') {
          saveAnnouncementsToS3(_announcements);
        }

        // Re-render the UI
        _renderAnnouncementsUI(container);
      });
    }

    // Delete button listeners
    var deleteButtons = container.querySelectorAll('.btn-delete-announcement');
    for (var i = 0; i < deleteButtons.length; i++) {
      deleteButtons[i].addEventListener('click', function (e) {
        var announcementId = e.target.getAttribute('data-id');
        if (!announcementId) return;

        // Remove from array
        _announcements = _announcements.filter(function (a) {
          return a.id !== announcementId;
        });

        // Save to S3 (implemented in task 9.2)
        if (typeof saveAnnouncementsToS3 === 'function') {
          saveAnnouncementsToS3(_announcements);
        }

        // Re-render the UI
        _renderAnnouncementsUI(container);
      });
    }
  }

  /**
   * Generate a UUID v4 string.
   * @returns {string} UUID string
   */
  function _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Show brief feedback message near a target element.
   * @param {HTMLElement|null} target - Element to show feedback near
   * @param {string} message - Feedback message text
   * @param {string} type - 'success' or 'error'
   */
  function _showFeedback(target, message, type) {
    // Remove any existing feedback messages
    var existing = document.querySelectorAll('.attribute-feedback');
    for (var i = 0; i < existing.length; i++) {
      existing[i].remove();
    }

    var feedbackEl = document.createElement('span');
    feedbackEl.className = 'attribute-feedback attribute-feedback--' + type;
    feedbackEl.textContent = message;
    feedbackEl.setAttribute('role', 'status');
    feedbackEl.setAttribute('aria-live', 'polite');

    if (target && target.parentNode) {
      target.parentNode.insertBefore(feedbackEl, target.nextSibling);
    } else {
      // Fallback: append to the registrations widget
      var widget = document.querySelector('#registrations-management-widget .widget-content');
      if (widget) {
        widget.appendChild(feedbackEl);
      }
    }

    // Auto-remove after 4 seconds
    setTimeout(function () {
      if (feedbackEl.parentNode) {
        feedbackEl.remove();
      }
    }, 4000);
  }

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Public API
  return {
    init: init,
    renderUsersWidget: renderUsersWidget,
    renderScheduleWidget: renderScheduleWidget,
    renderStatsWidget: renderStatsWidget,
    renderRegistrationsManagementWidget: renderRegistrationsManagementWidget,
    renderAnnouncementsManagementWidget: renderAnnouncementsManagementWidget,
    loadAnnouncementsFromS3: loadAnnouncementsFromS3,
    saveAnnouncementsToS3: saveAnnouncementsToS3,
    updateUserAttributes: updateUserAttributes
  };
})();
