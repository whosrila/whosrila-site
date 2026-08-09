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

  function payload(email, prefs) {
    var d = new FormData();
    if (MAIL.provider === 'kit') {
      d.append('email_address', email);
      // Custom fields auto-create in Kit on first use, so this needs no setup
      // and no hardcoded ids. Broadcasts can then be filtered on them.
      if (prefs) {
        d.append('fields[interests]', prefs.join(', ') || 'none');
        d.append('fields[wants_music]',  prefs.indexOf('music') !== -1 ? 'yes' : 'no');
        d.append('fields[wants_video]',  prefs.indexOf('video') !== -1 ? 'yes' : 'no');
        d.append('fields[wants_shows]',  prefs.indexOf('shows') !== -1 ? 'yes' : 'no');
      }
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

  // Re-send the subscriber with their current choices. Kit matches on email,
  // so this updates the record created a moment ago rather than adding one.
  function livePrefs(box, email, label) {
    var note = document.getElementById('prefsNote');
    var t;
    box.addEventListener('change', function () {
      var chosen = [].slice.call(box.querySelectorAll('input[name="pref"]:checked'))
                     .map(function (c) { return c.value; });
      if (note) note.textContent = 'Saving…';
      clearTimeout(t);
      // debounce so ticking three boxes quickly is one request, not three
      t = setTimeout(function () {
        fetch(endpoint(), { method: 'POST', body: payload(email, chosen) })
          .then(function (r) { return r.json().catch(function () { return { success: r.ok }; }); })
          .then(function (j) {
            if (!accepted(j)) throw new Error('rejected');
            if (note) note.textContent = chosen.length
              ? 'Saved — sending you ' + chosen.join(', ') + '.'
              : 'Saved — you will only get the occasional big one.';
            if (window.wrTrack) window.wrTrack('PrefsUpdate', { where: label, interests: chosen.join('|') });
          })
          .catch(function () { if (note) note.textContent = 'Could not save that — try again.'; });
      }, 600);
    });
  }

  function wire(form, doneEl, noteEl, label) {
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // honeypot: humans never see this field, so anything in it is a bot.
      // Show the success state so the bot doesn't retry, but send nothing.
      var trap = form.querySelector('input[name="bot-field"]');
      if (trap && trap.value) { form.hidden = true; if (doneEl) doneEl.hidden = false; return; }

      var input = form.querySelector('input[type="email"]');
      var email = input && input.value.trim();
      if (!email) return;

      // Preferences are asked for AFTER this submit, so the first call goes
      // out with everything on. Losing someone at a second step would mean
      // losing the address entirely, and the address is the point.
      var prefsBox = doneEl && doneEl.querySelector('.prefs');
      var prefs = prefsBox
        ? [].slice.call(prefsBox.querySelectorAll('input[name="pref"]')).map(function (c) { return c.value; })
        : [].slice.call(form.querySelectorAll('input[name="pref"]:checked')).map(function (c) { return c.value; });

      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Sending…'; }

      fetch(endpoint(), { method: 'POST', body: payload(email, prefs) })
        .then(function (r) { return r.json().catch(function () { return { success: r.ok }; }); })
        .then(function (j) {
          if (!accepted(j)) throw new Error('rejected');
          form.hidden = true;
          if (doneEl) doneEl.hidden = false;
          if (window.wrTrack) window.wrTrack('SignUp', { where: label, interests: prefs.join('|') });
          try { if (window.fbq) window.fbq('track', 'CompleteRegistration', { where: label }); } catch (e) {}
          if (prefsBox) livePrefs(prefsBox, email, label);
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
