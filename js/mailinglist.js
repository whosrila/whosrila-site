/* Mailing list signup for WHOSRILA.
 *
 * Handles every signup form on the page and talks to whichever provider is
 * configured below. Submitting never navigates away — the form is swapped for
 * a success message in place.
 *
 * ---------------------------------------------------------------------------
 * TO SWITCH TO KIT: set provider to 'kit' and paste the form id. That's it.
 *
 *   In Kit: Grow -> Landing Pages & Forms -> your form -> Embed -> HTML.
 *   The snippet contains .../forms/1234567/subscriptions — the number is the id.
 * ---------------------------------------------------------------------------
 *
 * Why bother: Web3Forms emails each signup to an inbox. That collects
 * addresses but isn't a list you can send a release announcement to. Kit is
 * a real provider — it stores subscribers, sends campaigns, and can deliver a
 * free download automatically on confirmation.
 */
(function () {
  'use strict';

  var MAIL = {
    provider:   'kit',                                    // 'web3forms' | 'kit'
    kitFormId:  '9777004',                                // whosrila.com — site signup
    web3Key:    '71705d41-553f-47fe-a068-61822ae89277'
  };

  function endpoint() {
    return MAIL.provider === 'kit'
      ? 'https://app.kit.com/forms/' + MAIL.kitFormId + '/subscriptions'
      : 'https://api.web3forms.com/submit';
  }

  function payload(email) {
    var d = new FormData();
    if (MAIL.provider === 'kit') {
      d.append('email_address', email);
    } else {
      d.append('access_key', MAIL.web3Key);
      d.append('subject', 'New fan signup — WHOSRILA');
      d.append('email', email);
    }
    return d;
  }

  // Kit answers {subscription:{...}}, Web3Forms answers {success:true}
  function accepted(json) {
    if (!json) return false;
    return json.success === true || !!json.subscription || json.status === 'success';
  }

  function wire(form, doneEl, noteEl, label) {
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var email = input && input.value.trim();
      if (!email) return;

      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Sending…'; }

      fetch(endpoint(), { method: 'POST', body: payload(email) })
        .then(function (r) { return r.json().catch(function () { return { success: r.ok }; }); })
        .then(function (j) {
          if (!accepted(j)) throw new Error('rejected');
          form.hidden = true;
          if (doneEl) doneEl.hidden = false;
          if (window.wrTrack) window.wrTrack('SignUp', { where: label });
          try { if (window.fbq) window.fbq('track', 'CompleteRegistration', { where: label }); } catch (e) {}
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Try again'; }
          if (noteEl) noteEl.textContent = 'Something went wrong — try again in a moment.';
        });
    });
  }

  function init() {
    wire(document.getElementById('notifyForm'),
         document.getElementById('notifyDone'),
         document.querySelector('#notifyForm .notify-note'), 'notify');
    wire(document.getElementById('signupForm'),
         document.getElementById('signupSuccess'),
         document.getElementById('signupError'), 'footer');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
