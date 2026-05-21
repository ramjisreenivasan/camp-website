/**
 * Dashboard Module - Post-Login User Dashboard
 * Manages dashboard initialization, auth guard, and widget rendering.
 * Loaded via script tag on dashboard.html; exposes global `Dashboard` object.
 */
var Dashboard = (function () {
  'use strict';

  // Module-level variables
  var _attrs = null;
  var _user = null;
  var _role = null;

  // CloudFront URL for announcements data
  var ANNOUNCEMENTS_URL = 'https://d2eqj6ny4k60av.cloudfront.net/data/announcements.json';

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Static camp schedule data
  var CAMP_DATA = {
    startDate: '2026-07-27',
    endDate: '2026-07-31',
    days: [
      { day: 1, title: 'AI & Cloud Foundations', deliverable: 'Working AI development environment on the cloud' },
      { day: 2, title: 'Building AI Products', deliverable: 'AI product prototype' },
      { day: 3, title: 'AI Programming', deliverable: 'Functional AI application' },
      { day: 4, title: 'AI Architecture', deliverable: 'Production-ready architecture plan' },
      { day: 5, title: 'Demo Day', deliverable: 'Portfolio-ready AI project' }
    ]
  };

  /**
   * Initialize the dashboard: verify auth, fetch data, render widgets.
   * Shows loading indicator during session verification.
   * Redirects to index.html if not authenticated.
   */
  function init() {
    var loadingEl = document.getElementById('dashboard-loading');
    var widgetsEl = document.getElementById('dashboard-widgets');

    // Show loading indicator
    if (loadingEl) {
      loadingEl.style.display = '';
    }

    // Initialize Auth and verify session
    Auth.init().then(function () {
      // Check authentication status
      if (!Auth.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
      }

      // Hide loading, show widgets
      if (loadingEl) {
        loadingEl.style.display = 'none';
      }
      if (widgetsEl) {
        widgetsEl.style.display = '';
      }

      // Fetch user data
      _user = Auth.getCurrentUser();
      _role = RoleManager.getUserRole();

      // Fetch custom attributes and render widgets
      Auth.getCustomAttributes()
        .then(function (attrs) {
          _attrs = attrs;
          renderRegistrationWidget(attrs);
          renderPaymentWidget(attrs);
          renderMaterialsWidget(attrs);
          renderProfileWidget(_user, _role);
          renderScheduleWidget();
          renderAnnouncementsWidget();
        })
        .catch(function () {
          _attrs = null;
          renderRegistrationWidget(null);
          renderPaymentWidget(null);
          renderMaterialsWidget(null);
          renderProfileWidget(_user, _role);
          renderScheduleWidget();
          renderAnnouncementsWidget();
        });

      // Subscribe to auth state changes - redirect on session expiry
      document.addEventListener('auth:stateChanged', function (e) {
        var detail = e.detail;
        if (!detail || detail.state !== 'authenticated') {
          window.location.href = 'index.html';
        }
      });
    });
  }

  /**
   * Render the Registration Status widget.
   * @param {object|null} attrs - Custom attributes from Auth.getCustomAttributes()
   */
  function renderRegistrationWidget(attrs) {
    var container = document.querySelector('#registration-widget .widget-content');
    if (!container) return;

    // Error state: attrs fetch failed
    if (attrs === null) {
      container.innerHTML = '<p class="widget-error">Unable to load registration data</p>';
      return;
    }

    // Normalize registration status
    var validStatuses = ['Pending', 'Confirmed', 'Not Registered'];
    var status = attrs.registrationStatus;
    if (!status || validStatuses.indexOf(status) === -1) {
      status = 'Not Registered';
    }

    // Determine badge class
    var badgeClass = 'status-badge ';
    if (status === 'Confirmed') {
      badgeClass += 'status-badge-confirmed';
    } else if (status === 'Pending') {
      badgeClass += 'status-badge-pending';
    } else {
      badgeClass += 'status-badge-not-registered';
    }

    // Build HTML
    var html = '<p>Status: <span class="' + badgeClass + '">' + status + '</span></p>';

    // Show registration date when status is Confirmed or Pending and date exists
    if ((status === 'Confirmed' || status === 'Pending') && attrs.registrationDate) {
      html += '<p>Registration Date: ' + formatDate(attrs.registrationDate) + '</p>';
    }

    container.innerHTML = html;
  }


  /**
   * Render the Payment Status widget.
   * @param {object|null} attrs - Custom attributes from Auth.getCustomAttributes()
   */
  function renderPaymentWidget(attrs) {
    var container = document.querySelector('#payment-widget .widget-content');
    if (!container) return;

    // Error state: attrs fetch failed
    if (attrs === null) {
      container.innerHTML = '<p class="widget-error">Unable to load payment data</p>';
      return;
    }

    // Normalize payment status
    var validStatuses = ['Paid', 'Pending', 'Not Paid'];
    var status = attrs.paymentStatus;
    if (!status || validStatuses.indexOf(status) === -1) {
      status = 'Not Paid';
    }

    // Determine badge class
    var badgeClass = 'status-badge ';
    if (status === 'Paid') {
      badgeClass += 'status-badge-paid';
    } else if (status === 'Pending') {
      badgeClass += 'status-badge-pending';
    } else {
      badgeClass += 'status-badge-not-paid';
    }

    // Build HTML
    var html = '<p>Status: <span class="' + badgeClass + '">' + status + '</span></p>';

    // Show payment date when status is "Paid" and date exists
    if (status === 'Paid' && attrs.paymentDate) {
      html += '<p>Payment Date: ' + formatDate(attrs.paymentDate) + '</p>';
    }

    // Display camp price reference
    html += '<p class="price-reference">Camp Price: $199 early bird / $229 regular</p>';

    container.innerHTML = html;
  }



  /**
   * Render the Camp Materials widget.
   * @param {object|null} attrs - Custom attributes from Auth.getCustomAttributes()
   */
  function renderMaterialsWidget(attrs) {
    var container = document.querySelector('#materials-widget .widget-content');
    if (!container) return;

    // Determine payment status - treat null attrs (fetch failed) as not paid
    var paymentStatus = (attrs && attrs.paymentStatus) || '';
    var isPaid = paymentStatus === 'Paid';

    var html = '';

    if (!isPaid) {
      // Not Paid: show message that materials are available after payment
      html += '<p>Camp materials will be available after your payment is confirmed.</p>';
    } else {
      // Paid: show placeholder message and empty list for future downloadable links
      html += '<p>Camp materials will be available when camp starts. Check back closer to the start date!</p>';
      html += '<ul class="materials-list"></ul>';
    }

    container.innerHTML = html;
  }


  /**
   * Render the Profile Information widget.
   * @param {object|null} user - User info from Auth.getCurrentUser()
   * @param {string} role - User role from RoleManager.getUserRole()
   */
  function renderProfileWidget(user, role) {
    var container = document.querySelector('#profile-widget .widget-content');
    if (!container) return;

    // Error state: user is null/undefined
    if (!user) {
      container.innerHTML = '<p class="widget-error">Unable to load profile information</p>';
      return;
    }

    // Determine display values
    var displayName = user.name || 'N/A';
    var displayEmail = user.email || 'N/A';
    var emailStatus = user.emailVerified ? 'Verified' : 'Not Verified';
    var displayRole = (role === 'admin') ? 'Admin' : 'Camper';

    // Build HTML using definition list for structured display
    var html = '<dl class="profile-info">';
    html += '<dt>Name</dt><dd>' + displayName + '</dd>';
    html += '<dt>Email</dt><dd>' + displayEmail + '</dd>';
    html += '<dt>Email Status</dt><dd>' + emailStatus + '</dd>';
    html += '<dt>Role</dt><dd>' + displayRole + '</dd>';
    html += '</dl>';

    container.innerHTML = html;
  }



  /**
   * Render the Camp Schedule widget with countdown.
   */
  function renderScheduleWidget() {
    var container = document.querySelector('#schedule-widget .widget-content');
    if (!container) return;

    // Get countdown text
    var countdownText = getCountdownText();

    // Build HTML - countdown text prominently displayed
    var html = '<p class="countdown-text">' + countdownText + '</p>';

    // Render schedule table
    html += '<table class="schedule-table">';
    html += '<thead><tr><th>Day</th><th>Topic</th><th>Deliverable</th></tr></thead>';
    html += '<tbody>';

    // Determine current day number if camp is in progress
    var currentDayNum = -1;
    if (countdownText === 'Camp is in progress!') {
      var now = new Date();
      var startParts = CAMP_DATA.startDate.split('-');
      var startDate = new Date(Date.UTC(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2])));
      var todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      var diffMs = todayUTC.getTime() - startDate.getTime();
      currentDayNum = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    }

    for (var i = 0; i < CAMP_DATA.days.length; i++) {
      var dayData = CAMP_DATA.days[i];
      var rowClass = (dayData.day === currentDayNum) ? ' class="current-day"' : '';
      html += '<tr' + rowClass + '>';
      html += '<td>' + dayData.day + '</td>';
      html += '<td>' + dayData.title + '</td>';
      html += '<td>' + dayData.deliverable + '</td>';
      html += '</tr>';
    }

    html += '</tbody></table>';

    container.innerHTML = html;
  }

  /**
   * Render the Announcements widget.
   * Fetches announcements from CloudFront and displays them.
   */
  function renderAnnouncementsWidget() {
    var container = document.querySelector('#announcements-widget .widget-content');
    if (!container) return;

    fetch(ANNOUNCEMENTS_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var announcements = data.announcements || [];

        if (announcements.length === 0) {
          container.innerHTML = '<p class="no-announcements">No announcements at this time.</p>';
          return;
        }

        // Sort by postedDate descending (newest first)
        announcements.sort(function (a, b) {
          return (b.postedDate || '').localeCompare(a.postedDate || '');
        });

        var html = '';
        announcements.forEach(function (announcement) {
          html += '<article class="announcement-item">';
          html += '<h3>' + escapeHtml(announcement.title) + '</h3>';
          html += '<p>' + escapeHtml(announcement.message) + '</p>';
          html += '<small class="announcement-date">' + formatDate(announcement.postedDate) + '</small>';
          html += '</article>';
        });

        container.innerHTML = html;
      })
      .catch(function () {
        container.innerHTML = '<p class="widget-error">Unable to load announcements</p>';
      });
  }

  /**
   * Calculate countdown text relative to the camp start date.
   * @param {Date} targetDate - The date to calculate countdown from (defaults to now)
   * @returns {string} Countdown text
   */
  function getCountdownText(targetDate) {
    // Use provided Date object or default to current date
    var now = (targetDate instanceof Date) ? targetDate : new Date();

    // Parse camp dates in UTC to avoid timezone issues
    var startParts = CAMP_DATA.startDate.split('-');
    var endParts = CAMP_DATA.endDate.split('-');
    var startDate = new Date(Date.UTC(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2])));
    var endDate = new Date(Date.UTC(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2])));

    // Normalize the target date to UTC midnight for comparison
    var todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (todayUTC < startDate) {
      // Before camp: calculate days remaining
      var diffMs = startDate.getTime() - todayUTC.getTime();
      var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return diffDays + ' days until camp starts!';
    } else if (todayUTC <= endDate) {
      // During camp (start to end inclusive)
      return 'Camp is in progress!';
    } else {
      // After camp
      return 'Camp has ended';
    }
  }

  /**
   * Format a date string for display.
   * @param {string} dateString - ISO date string (YYYY-MM-DD)
   * @returns {string} Formatted date string
   */
  function formatDate(dateString) {
    if (!dateString) return '';

    var parts = dateString.split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1; // months are 0-indexed
    var day = parseInt(parts[2], 10);

    var date = new Date(Date.UTC(year, month, day));

    var months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return months[date.getUTCMonth()] + ' ' + date.getUTCDate() + ', ' + date.getUTCFullYear();
  }

  // Public API
  return {
    init: init,
    renderRegistrationWidget: renderRegistrationWidget,
    renderPaymentWidget: renderPaymentWidget,
    renderMaterialsWidget: renderMaterialsWidget,
    renderProfileWidget: renderProfileWidget,
    renderScheduleWidget: renderScheduleWidget,
    renderAnnouncementsWidget: renderAnnouncementsWidget,
    getCountdownText: getCountdownText,
    formatDate: formatDate
  };
})();
