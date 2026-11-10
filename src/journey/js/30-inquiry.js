/* ---------------- the inquiry: the visitor writes on the phone's blank screen ----------------
   The design system's form: a field that needs fixing turns its line to the error colour and says under it what to
   fix; the result is one sentence under the form (sent, in the success colour; or what happens instead). */
const form = $('#jy-form'), note = $('#jy-note'), label = $('#jy-rec-label'), rec = $('#jy-rec'), sendBtn = $('.jy-send', form);
let sending = false;
form.project.addEventListener('input', () => { label.textContent = form.project.value; });
function say(text, kind) { note.textContent = text; note.classList.toggle('err', kind === 'err'); note.classList.toggle('ok', kind === 'ok'); }
function fieldError(input, text) {
  const err = $('#' + input.id + '-err');
  input.setAttribute('aria-invalid', text ? 'true' : 'false');
  if (err) { err.textContent = text || ''; err.hidden = !text; }
}
['project', 'reply'].forEach((n) => form[n].addEventListener('input', () => { if (form[n].getAttribute('aria-invalid') === 'true') fieldError(form[n], ''); }));
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (sending) return;
  const value = (n) => String((form.elements[n] && form.elements[n].value) || '').trim();
  fieldError(form.project, ''); fieldError(form.reply, ''); say('');
  const bad = [];
  if (!value('project')) { fieldError(form.project, COPY.needProject); bad.push(form.project); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('reply'))) { fieldError(form.reply, COPY.needEmail); bad.push(form.reply); }
  if (bad.length) { bad[0].focus(); return; }
  const f = COPY.form || {}, contact = COPY.mail || {};
  const songs = $$('input[name="song"]:checked', form).map((x) => x.value).join(', ');
  const lines = [
    [f.nameLabel, value('name')], [f.contactLabel, value('reply')], [f.projectLabel, value('project')],
    [f.songLabel, songs], [f.budgetLabel, value('budget')], [f.scheduleLabel, value('schedule')], [f.messageLabel, value('message')],
  ].filter((r) => r[0]).map((r) => r[0] + ': ' + (r[1] || '-'));
  const subject = (contact.mailSubject || 'TALETONE MUSIC') + ' — ' + value('project');
  const mailto = () => { location.href = 'mailto:' + contact.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n')); };
  const done = () => { rec.classList.add('lit'); say(COPY.received, 'ok'); $('#jy-rewind').hidden = false; };
  if (!contact.formKey) { mailto(); return; }
  sending = true; sendBtn.disabled = true; say(COPY.sending);
  fetch('https://api.web3forms.com/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ access_key: contact.formKey, subject, from_name: value('name') || value('reply'), replyto: value('reply'), message: lines.join('\n') }),
  }).then((r) => r.json()).then((res) => {
    if (!res || !res.success) throw new Error('send failed');
    done();
  }).catch(() => { say(COPY.failed, 'err'); mailto(); }).finally(() => { sending = false; sendBtn.disabled = false; });
});
$('#jy-rewind').addEventListener('click', () => {
  rec.classList.remove('lit'); $('#jy-rewind').hidden = true; say(''); form.reset(); label.textContent = '';
  go('pro');
});
