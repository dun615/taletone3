// Content: localisation helpers, rich-text cleaning, site data normalisation, member/partner dialogs, contact email.
// Methods of Component (src/app/component.js); the build attaches them with Object.assign.
var ComponentContent = {
  _langKey(){
    var raw = String(this.lang || 'kr').toLowerCase();
    if(raw === 'ko') return 'kr';
    if(raw === 'ja') return 'jp';
    return raw === 'en' || raw === 'jp' ? raw : 'kr';
  },

  _localizedObject(base, translations){
    var result = Object.assign({}, base || {});
    var lang = this._langKey();
    var translated = translations && typeof translations === 'object' ? translations[lang] : null;
    if(translated && typeof translated === 'object'){
      Object.keys(translated).forEach(function(key){
        if(key !== 'cards' && translated[key] != null) result[key] = translated[key];
      });
    }
    return result;
  },

  _localizedListItem(item, sectionTranslations, index){
    var lang = this._langKey();
    var fromSection = null;
    if(sectionTranslations && sectionTranslations[lang] && Array.isArray(sectionTranslations[lang].cards)){
      fromSection = sectionTranslations[lang].cards[index] || null;
    }
    var result = this._localizedObject(item || {}, item && item.translations);
    if(fromSection && typeof fromSection === 'object'){
      Object.keys(fromSection).forEach(function(key){
        if(fromSection[key] != null) result[key] = fromSection[key];
      });
    }
    return result;
  },

  looksLikeRichText(value){
    return typeof value === 'string' && /<\/?(span|strong|b|em|i|u|s|br|sub|sup|p|div)\b|&nbsp;|&#160;/i.test(value);
  },

  cleanRichStyle(styleText){
    var allowed = {
      color: true,
      'background-color': true,
      'font-size': true,
      'font-family': true,
      'font-weight': true,
      'font-style': true,
      'text-decoration': true,
      'letter-spacing': true,
      'line-height': true,
      'text-indent': true,
      'margin-left': true,
      'padding-left': true
    };
    return String(styleText || '').split(';').map(function(part){
      var idx = part.indexOf(':');
      if(idx < 0) return '';
      var name = part.slice(0, idx).trim().toLowerCase();
      var value = part.slice(idx + 1).trim();
      if(!allowed[name]) return '';
      if(/url\s*\(|expression\s*\(|javascript:/i.test(value)) return '';
      return name + ':' + value;
    }).filter(Boolean).join(';');
  },

  sanitizeRichHtml(html){
    var template = document.createElement('template');
    template.innerHTML = String(html == null ? '' : html);
    var allowed = { SPAN:true, STRONG:true, B:true, EM:true, I:true, U:true, S:true, BR:true, SUB:true, SUP:true, P:true, DIV:true };
    var cleanStyle = this.cleanRichStyle.bind(this);
    function clean(parent){
      Array.prototype.slice.call(parent.childNodes).forEach(function(node){
        if(node.nodeType === Node.COMMENT_NODE){ node.remove(); return; }
        if(node.nodeType !== Node.ELEMENT_NODE) return;
        if(!allowed[node.tagName]){
          node.replaceWith(document.createTextNode(node.textContent || ''));
          return;
        }
        Array.prototype.slice.call(node.attributes).forEach(function(attr){
          if(attr.name.toLowerCase() === 'style'){
            var nextStyle = cleanStyle(attr.value);
            if(nextStyle) node.setAttribute('style', nextStyle);
            else node.removeAttribute('style');
          } else {
            node.removeAttribute(attr.name);
          }
        });
        clean(node);
      });
    }
    clean(template.content);
    return template.innerHTML;
  },

  plainTextHtml(value){
    return String(value == null ? '' : value)
      .replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; })
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br>');
  },

  normalizedAnimatedText(value){
    return String(value == null ? '' : value)
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, '  ')
      .replace(/[^\S\n]{2,}/g, ' ')
      .trim();
  },

  initData(){
    this._applyExternalContent();
  },

  _applyExternalContent(){
    var cfg = window.TALETONE_CONTENT || {};
    var homeData = cfg.home || {};
    this.HOME = this._localizedObject(homeData, homeData.translations);
    // the newest work (added by the build) for the home page's "listen" card on phones
    var latest = cfg.latestWork;
    this.LATEST_WORK = {};
    if(latest && latest.slug){
      var lw = this._localizedObject(latest, latest.translations);
      lw.label = {kr:'최신 작업', en:'Latest release', jp:'最新リリース'}[this._langKey()] || '최신 작업';
      lw.ariaLabel = lw.label + ': ' + lw.title + ', ' + lw.artist;
      this.LATEST_WORK = lw;
    }
    var projectData = cfg.projects || {};
    this.PROJECTS_META = this._localizedObject(projectData, projectData.translations);
    this.PROJECTS = (Array.isArray(projectData.cards) ? projectData.cards : []).map((p,i)=>this._normalizeVisualEntry(this._localizedListItem(p, projectData.translations, i), 'project-' + (i + 1)));
    var contactData = cfg.contact || {};
    this.CONTACT = this._localizedObject(contactData, contactData.translations);
    var membersMetaData = cfg.membersMeta || {};
    this.MEMBERS_META = this._localizedObject(membersMetaData, membersMetaData.translations);
    // the "aka" line sits right under the TALETONE in the lead sentence, so the sentence is split around it
    var lead = String(this.MEMBERS_META.subtitle || ''), at = this.MEMBERS_META.aka ? lead.indexOf('TALETONE') : -1;
    this.MEMBERS_META.leadPlain = at < 0 ? lead : '';
    this.MEMBERS_META.leadBefore = at < 0 ? '' : lead.slice(0, at);
    this.MEMBERS_META.leadAfter = at < 0 ? '' : lead.slice(at + 8);
    this.MEMBERS_META.leadSplit = at < 0 ? '' : '1';
    var worksMetaData = cfg.worksMeta || {};
    this.WORKS_META = this._localizedObject(worksMetaData, worksMetaData.translations);
    var partnersMetaData = cfg.partnersMeta || {};
    this.PARTNERS_META = this._localizedObject(partnersMetaData, partnersMetaData.translations);
    this.PARTNERS_META.toggleLabel = this.state && this.state.partnerOpen ? (this.PARTNERS_META.closeLabel || 'Close') : (this.PARTNERS_META.openLabel || 'Open');
    var footerMetaData = cfg.footerMeta || {};
    this.FOOTER_META = this._localizedObject(footerMetaData, footerMetaData.translations);
    var uiLabelData = cfg.uiLabels || {};
    this.UI_LABELS = this._localizedObject(uiLabelData, uiLabelData.translations);
    var chapterLabelData = cfg.chapterLabels || {};
    this.CHAPTER_LABELS = this._localizedObject(chapterLabelData, chapterLabelData.translations);
    this.TRACK_RECORD = (Array.isArray(cfg.trackRecord) ? cfg.trackRecord : []).map((item,i)=>this._localizedObject(Object.assign({ id:'track-' + (i + 1) }, item || {}), item && item.translations));
    if(window.TALETONE_WORKS_API && window.TALETONE_WORKS_API.setMeta){ try{ window.TALETONE_WORKS_API.setMeta(worksMetaData); }catch(_e){} }
    this.MEMBERS = (Array.isArray(cfg.members) ? cfg.members : []).map((m)=>this._localizedObject(m, m && m.translations));
    this.PARTNERS = (Array.isArray(cfg.partners) ? cfg.partners : []).map((p)=>this._localizedObject(p, p && p.translations));
    this._normalizePartners();
    var bridgeData = (Array.isArray(cfg.bridges) ? cfg.bridges : []).filter((bridge)=>{
      var id = String((bridge && bridge.id) || '').toLowerCase();
      return id !== 'home-translation' && id !== 'home_translation' && id !== 'hometranslation';
    });
    this.BRIDGES = bridgeData.map((b)=>this._localizedObject(b, b && b.translations));
    // Home's featured song: the work card comes from the build (listenWork), the label and context from home.listen
    var listen = this.HOME.listen || {}, listenWork = cfg.listenWork ? this._localizedObject(cfg.listenWork, cfg.listenWork.translations) : {};
    this.HOME_LISTEN = listenWork.slug && listen.slug === listenWork.slug ? Object.assign({}, listenWork, {
      href: this._langPath('/discography/') + '?work=' + listenWork.slug,
      label: listen.label || '', context: listen.context || listenWork.artist || '',
      ariaLabel: (listen.label || '') + ': ' + listenWork.title + ', ' + (listen.context || listenWork.artist || '')
    }) : {};
    // Story, tone and music lead into a real production case; its artwork comes from the build.
    this.PROOF = this.PROJECTS_META.proof || {};
    var caseData = this.PROOF.case || {}, caseWork = cfg.caseWork && cfg.caseWork.slug === caseData.slug ? cfg.caseWork : {};
    this.CASE = caseData.title ? Object.assign({}, caseData, { thumb: caseWork.thumb || '', href: this._langPath('/discography/') + '?work=' + caseData.slug }) : {};
    // Blocks written only for some languages (the client voices, the inquiry form) are empty elsewhere
    var voicesData = cfg.voices || {};
    this.VOICES = this._localizedObject(voicesData, voicesData.translations);
    var contactExtra = this.CONTACT || {};
    this.CONTACT_FORM = contactExtra.form || {};
    this.CONTACT_CHANNELS = (Array.isArray(contactExtra.channels) ? contactExtra.channels : []).filter((c)=>c && c.url);
  },

  _normalizeNumber(value, fallback){
    var next = Number(String(value == null ? '' : value).replace('%',''));
    return Number.isFinite(next) ? next : fallback;
  },

  _normalizeVisualEntry(item, fallbackSlot){
    var src = Object.assign({}, item || {});
    var posX = this._normalizeNumber(src.posX, 50);
    var posY = this._normalizeNumber(src.posY, 50);
    var brightness = this._normalizeNumber(src.brightness, 100);
    var saturation = this._normalizeNumber(src.saturation, 100);
    var lightness = this._normalizeNumber(src.lightness, 100);
    if (brightness > 0 && brightness <= 2) brightness = brightness * 100;
    if (saturation > 0 && saturation <= 2) saturation = saturation * 100;
    if (lightness > 0 && lightness <= 2) lightness = lightness * 100;
    src.slotId = src.slotId || fallbackSlot;
    src.fit = src.fit || 'cover';
    src.posX = posX;
    src.posY = posY;
    src.position = posX + '% ' + posY + '%';
    src.brightness = brightness;
    src.saturation = saturation;
    src.lightness = lightness;
    src.filter = 'brightness(' + brightness + '%) saturate(' + saturation + '%) contrast(' + lightness + '%)';
    src.buttonColor = src.buttonColor || 'var(--ink,#141C30)';
    src.buttonTextColor = src.buttonTextColor || 'var(--paper,#fffdf8)';
    var rawLink = String(src.link || '').trim();
    src.hasLink = !!rawLink && rawLink !== '#';
    src.isPending = !src.hasLink;
    src.link = src.hasLink ? rawLink : '';
    var external = /^https?:\/\//i.test(src.link);
    if (src.openInNewTab == null) src.openInNewTab = external;
    src.linkTarget = src.openInNewTab ? '_blank' : '_self';
    src.linkRel = src.openInNewTab ? 'noopener noreferrer' : '';
    return src;
  },

  loadMemberImages(){
    if(document.body.getAttribute('data-active-chapter')!=='members'||(this._chapterTarget&&this._chapterTarget!=='c-members'))return;
    var section = document.getElementById('c-members');
    if (!section) return;
    section.querySelectorAll('img[data-member-src]').forEach((image)=>{
      var src = image.getAttribute('data-member-src');
      if (src) image.src = src;
      image.removeAttribute('data-member-src');
    });
  },

  openMember(i){ this.setState({mi:i, mOpen:true}); },

  // The member sheet reads creditsText as liner notes: "| 2025" starts a group, "* work — roles" is an entry,
  // an indented "* <track> — roles" belongs to the entry above, a bare [text](url) line links the entry above,
  // and trailing #tags are dropped (the keywords already show them). Text with no markers becomes one group.
  memberSheet(m){
    var groups = [], group = null, last = null;
    String((m && m.creditsText) || '').split(/\r?\n/).forEach(function(raw){
      var line = raw.replace(/\s+$/, ''), text = line.trim();
      if(!text || /^#\S/.test(text)) return;
      var head = text.match(/^\|\s*(.+)$/);
      if(head){ group = {label: head[1].trim(), items: []}; groups.push(group); last = null; return; }
      if(!group){ group = {label: '', items: []}; groups.push(group); }
      var link = text.match(/^\[([^\]]+)\]\((https?:[^)\s]+)\)$/);
      if(link && last){ last.link = link[2]; last.linkText = link[1].replace(/^https?:\/\//, '').replace(/\/$/, ''); return; }
      var body = text.replace(/^[-*•]\s*/, ''), parts = body.split(/\s+—\s+/);
      var entry = {title: parts[0], roles: parts.slice(1).join(' — '), subs: [], link: '', linkText: ''};
      if(/^\s{2,}[-*•]\s/.test(line) && last){ last.subs.push(entry); return; }
      group.items.push(entry); last = entry;
    });
    groups = groups.filter(function(g){ return g.items.length; });
    var selected = (Array.isArray(m && m.featuredCredits) ? m.featuredCredits : []).map(function(item){
      return String(item || '').replace(/^\s*[-*•]\s*/, '').trim();
    }).filter(Boolean).slice(0, 3).map(function(text, i){ return {number: String(i + 1).padStart(2, '0'), text: text}; });
    var traits = (Array.isArray(m && m.traits) ? m.traits : []).map(function(t){ return String(t || '').replace(/^#/, '').replace(/_/g, ' ').trim(); }).filter(Boolean);
    return {
      groups: groups,
      count: groups.reduce(function(sum, g){ return sum + g.items.length; }, 0),
      hasCredits: groups.length > 0,
      selected: selected,
      hasSelected: selected.length > 0,
      traits: traits,
      hasTraits: traits.length > 0,
      hasEducation: !!(m && m.education),
      hasMbti: !!(m && m.mbti),
      hasSns: !!(m && m.iglink)
    };
  },


  togglePartner(){var open=!this.state.partnerOpen;document.body.classList.toggle('tt-network-open',open);this.setState({partnerOpen:open});},

  _normalizePartner(p,i){var src=p||{};return Object.assign({id:'p'+(i+1),name:'',role:'',image:'',link:'',brightness:100,saturation:100,lightness:100,textColor:'#ffffff'},src,{id:src.id||('p'+(i+1)),brightness:Number.isFinite(Number(src.brightness))?Number(src.brightness):100,saturation:Number.isFinite(Number(src.saturation))?Number(src.saturation):100,lightness:Number.isFinite(Number(src.lightness))?Number(src.lightness):100,textColor:src.textColor||'#ffffff',link:src.link||'',linkState:src.link?'on':'off',tabIndex:src.link?0:-1});},

  _normalizePartners(){this.PARTNERS=(this.PARTNERS||[]).map((p,i)=>this._normalizePartner(p,i));},

  closeAll(){document.body.classList.remove('tt-network-open');this.setState({mOpen:false,partnerOpen:false});},

  openInquiry(e){e.preventDefault();var form=document.getElementById('tt-inquiry');if(form){form.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});var field=form.querySelector('input');if(field)field.focus({preventScroll:true});}},

  syncContactEmailLink(){
    var em=document.getElementById('email-link');
    if(!em) return;
    var contact = this.CONTACT || {};
    var link = contact.link || ('mailto:' + ['contact','taletone.net'].join(String.fromCharCode(64)));
    // Prefill the inquiry template in the visitor's language.
    if(contact.email && contact.mailSubject){
      link = 'mailto:' + contact.email + '?subject=' + encodeURIComponent(contact.mailSubject) + (contact.mailTemplate ? '&body=' + encodeURIComponent(contact.mailTemplate) : '');
    }
    em.href = '#tt-inquiry';
    var label = contact.buttonLabel || 'Start a Project';
    var emLabel = em.querySelector('[data-email-label]');
    if(emLabel) emLabel.textContent = label;
    else em.textContent = label;
  },

  pauseWorksAudio(){
    try{
      if(window.TALETONE_WORKS_API && window.TALETONE_WORKS_API.pauseAll){ window.TALETONE_WORKS_API.pauseAll(); return; }
      document.querySelectorAll('#c-works audio,audio[data-works-audio]').forEach(function(a){ a.pause(); });
    }catch(_e){}
  },

  // The inquiry form. Until a form service is connected it writes the answers into a mail to the contact address.
  sendInquiry(e){
    if(e && e.preventDefault) e.preventDefault();
    var formEl = e && e.currentTarget, contact = this.CONTACT || {}, f = this.CONTACT_FORM || {};
    if(!formEl || !contact.email) return;
    var data = new FormData(formEl), value = (name)=>String(data.get(name) || '').trim();
    var lines = [
      [f.nameLabel, value('name')], [f.contactLabel, value('reply')], [f.projectLabel, value('project')],
      [f.songLabel, data.getAll('song').join(', ')], [f.budgetLabel, value('budget')], [f.scheduleLabel, value('schedule')], [f.messageLabel, value('message')]
    ].filter((row)=>row[0]).map((row)=>row[0] + ': ' + (row[1] || '-'));
    var subject = (contact.mailSubject || '') + (value('project') ? ' — ' + value('project') : '');
    var mailto = ()=>{ window.location.href = 'mailto:' + contact.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n')); };
    if(!contact.formKey) return mailto();
    if(this._inquirySending) return;
    // Web3Forms mails the answers to the inbox behind the key; if it can't be reached, the visitor's mail app takes over
    this._inquirySending = true;
    this.setState({ inquiryMessage: f.sendingNote || '' });
    fetch('https://api.web3forms.com/submit', {
      method:'POST', headers:{ 'Content-Type':'application/json', Accept:'application/json' },
      body: JSON.stringify({ access_key: contact.formKey, subject: subject, from_name: value('name') || value('reply'), replyto: value('reply'), message: lines.join('\n') })
    }).then((r)=>r.json()).then((res)=>{
      if(!res || !res.success) throw new Error((res && res.message) || 'send failed');
      formEl.reset();
      this.setState({ inquiryMessage: f.sentNote || '' });
    }).catch(()=>{
      this.setState({ inquiryMessage: f.failNote || '' });
      mailto();
    }).finally(()=>{ this._inquirySending = false; });
  },

  async copyContactEmail(e){
    if(e && e.preventDefault) e.preventDefault();
    var contact = this.CONTACT || {};
    var email = contact.email || 'contact@taletone.net';
    var ok = false;
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(email);
        ok = true;
      }
    }catch(_e){}
    if(!ok){
      try{
        var ta = document.createElement('textarea');
        ta.value = email;
        ta.setAttribute('readonly','');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
      }catch(_e2){ ok = false; }
    }
    clearTimeout(this._contactCopyTimer);
    this.setState({ contactCopyMessage: ok ? (contact.copyDone || 'Copied') : (contact.copyFail || 'Copy failed') });
    if(!ok){
      // the copy was blocked: select the visible address so it can be copied by hand
      try{ var addr=document.querySelector('.tt-contact-address a'); if(addr){ var range=document.createRange(); range.selectNodeContents(addr); var sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range); } }catch(_e3){}
    }
    this._contactCopyTimer = setTimeout(()=>this.setState({ contactCopyMessage:'' }), ok ? 1800 : 6000);
  },
};
