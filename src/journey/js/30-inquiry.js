/* ---------------- the inquiry: the visitor writes the empty groove ---------------- */
const form = $('#jy-form'), note = $('#jy-note'), label = $('#jy-rec-label'), rec = $('#jy-rec'), banner = $('#jy-banner');
let sending = false;
form.project.addEventListener('input', () => { label.textContent = form.project.value; });
function say(text, err) { note.textContent = text; note.classList.toggle('err', !!err); }
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (sending) return;
  const value = (n) => String((form.elements[n] && form.elements[n].value) || '').trim();
  form.project.setAttribute('aria-invalid', 'false'); form.reply.setAttribute('aria-invalid', 'false');
  if (!value('project')) { form.project.setAttribute('aria-invalid', 'true'); say(COPY.needProject, true); form.project.focus(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('reply'))) { form.reply.setAttribute('aria-invalid', 'true'); say(COPY.needEmail, true); form.reply.focus(); return; }
  const f = COPY.form || {}, contact = COPY.mail || {};
  const songs = $$('input[name="song"]:checked', form).map((x) => x.value).join(', ');
  const lines = [
    [f.nameLabel, value('name')], [f.contactLabel, value('reply')], [f.projectLabel, value('project')],
    [f.songLabel, songs], [f.budgetLabel, value('budget')], [f.scheduleLabel, value('schedule')], [f.messageLabel, value('message')],
  ].filter((r) => r[0]).map((r) => r[0] + ': ' + (r[1] || '-'));
  const subject = (contact.mailSubject || 'TALETONE MUSIC') + ' — ' + value('project');
  const mailto = () => { location.href = 'mailto:' + contact.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n')); };
  const done = () => {
    rec.classList.add('lit'); on(banner, true); say(!html.classList.contains('jy-narrow') ? '' : COPY.received);
    $('#jy-rewind').hidden = false;
    setTimeout(() => on(banner, false), 6000);
  };
  if (!contact.formKey) { mailto(); return; }
  sending = true; say(COPY.sending);
  fetch('https://api.web3forms.com/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ access_key: contact.formKey, subject, from_name: value('name') || value('reply'), replyto: value('reply'), message: lines.join('\n') }),
  }).then((r) => r.json()).then((res) => {
    if (!res || !res.success) throw new Error('send failed');
    done();
  }).catch(() => { say(COPY.failed, true); mailto(); }).finally(() => { sending = false; });
});
$('#jy-rewind').addEventListener('click', () => {
  rec.classList.remove('lit'); on(banner, false); $('#jy-rewind').hidden = true; say(''); form.reset(); label.textContent = '';
  stage.reset();
  go('pro');
});
