// A small, preview-only experiment over the shared site. No duplicate app tree.
const copy = {
  kr: {
    invitation: '모든 이야기가 시작되는 마법의 서를 찾아, 테일톤과 함께 수면 아래로.',
    subtitle: '당신의 이야기에, 이 음악이어야 하는 이유를 만듭니다.',
    description: '인물과 장면을 읽고, 감정에 맞는 소리를 고릅니다.\n프로젝트의 이야기가 음악의 방향이 됩니다.',
    stages: [
      ['01 · TALE', '이야기를 읽습니다', 'IP의 세계와 인물, 아티스트의 목소리에서 출발점을 찾습니다.'],
      ['02 · TONE', '감정을 설계합니다', '남기고 싶은 감정을 바탕으로 장르, 악기와 노래의 흐름을 정합니다.'],
      ['03 · MUSIC', '음악으로 완성합니다', '기획의 이유가 작곡·편곡·가사와 보컬까지 이어지도록 만듭니다.']
    ],
    closing: '이야기를 이해한 선택이 모이면, 그 프로젝트만의 음악이 됩니다.',
    caseEyebrow: 'STORY INTO SOUND · 실제 제작 사례',
    caseLesson: '목소리의 강점을 이야기의 출발점으로 삼았습니다. 치어리딩이라는 장면이 강한 발성의 이유가 되었습니다.',
    cta: '내 프로젝트의 음악도 함께 찾기',
    arrival: '마침내 만난, 아직 쓰이지 않은 페이지',
    title: '이제, 당신의 이야기를', accent: '함께 써 내려갑니다.',
    subtitleContact: '우리가 찾던 책의 다음 페이지는 아직 비어 있습니다.',
    caption: '캐릭터의 첫 노래부터 게임 속 한 장면까지.\n어떤 감정을 남기고 싶은지 들려주세요.',
    formIntro: '이야기의 첫 단서를 남겨주세요',
    formNote: '이메일과 프로젝트 소개는 필수입니다. 예산과 일정은 미정이어도 괜찮습니다. 확인 후 남겨주신 이메일로 답장드립니다.',
    replyLabel: '연락받을 이메일 (필수)', projectLabel: '프로젝트 한 줄 소개 (필수)', budgetLabel: '예산 (곡당·선택)', scheduleLabel: '희망 일정·공개 시점 (선택)',
    budgetPlaceholder: '예: 200–300만 원 / 협의 / 미정', schedulePlaceholder: '예: 내년 3월 공개 / 미정'
  },
  en: {
    invitation: 'Dive with TALETONE in search of the magical book where every story begins.',
    subtitle: 'Give every musical choice a reason rooted in your story.',
    description: 'We read the characters and scenes, then choose sounds for their emotions.\nYour project’s story guides the music.',
    stages: [
      ['01 · TALE', 'Read the story', 'Find a starting point in your IP, its characters and the artist’s voice.'],
      ['02 · TONE', 'Shape the emotion', 'Choose the genre, instruments and musical arc around what you want people to feel.'],
      ['03 · MUSIC', 'Bring it to life', 'Carry those choices through composition, arrangement, lyrics and vocals.']
    ],
    closing: 'Choices grounded in the story become music that belongs to your project.',
    caseEyebrow: 'STORY INTO SOUND · A real project',
    caseLesson: 'Her vocal strength became the starting point. A cheerleading story gave that powerful voice a purpose.',
    cta: 'Find the music for your project', arrival: 'An unwritten page, found at last',
    title: 'Your story.', accent: 'Our next page together.',
    subtitleContact: 'The next page of the book we found is still blank.',
    caption: 'A character’s first song, or a scene in your game.\nTell us what you want people to feel.',
    formIntro: 'Leave the first clues to your story',
    formNote: 'Email and a short project introduction are required. Budget and timing can be undecided. We will reply to the email you provide.',
    replyLabel: 'Reply email (required)', projectLabel: 'Your project in one line (required)', budgetLabel: 'Budget per song (optional)', scheduleLabel: 'Timeline / release date (optional)',
    budgetPlaceholder: 'Range / to discuss / undecided', schedulePlaceholder: 'Release target / undecided'
  },
  jp: {
    invitation: 'すべての物語が始まる魔法の書を探して、TALETONEと水面の下へ。',
    subtitle: 'あなたの物語から、この音楽である理由を見つけます。',
    description: '人物と場面を読み、その感情に合う音を選びます。\nプロジェクトの物語が、音楽の道しるべになります。',
    stages: [
      ['01 · TALE', '物語を読み解く', 'IPの世界や人物、アーティストの声から出発点を探します。'],
      ['02 · TONE', '感情を形にする', '届けたい感情をもとに、ジャンル、楽器、曲の流れを選びます。'],
      ['03 · MUSIC', '音楽として仕上げる', '企画の意図を、作曲・編曲・歌詞・歌声までつなげます。']
    ],
    closing: '物語を理解した選択が、そのプロジェクトならではの音楽になります。',
    caseEyebrow: 'STORY INTO SOUND · 制作事例',
    caseLesson: '声の強さを物語の出発点に。チアリーディングという場面が、その力強い声の理由になりました。',
    cta: 'あなたのプロジェクトの音楽を探す', arrival: 'たどり着いた、まだ白いページ',
    title: 'あなたの物語を、', accent: '一緒に綴る次のページへ。',
    subtitleContact: '探していた本の次のページは、まだ白いままです。',
    caption: 'キャラクターの初めての歌から、ゲームのひと場面まで。\nどんな感情を届けたいか、聞かせてください。',
    formIntro: '物語の最初の手がかりを',
    formNote: 'メールアドレスとプロジェクト紹介は必須です。ご予算と日程は未定でも大丈夫です。ご記入のメールに返信します。',
    replyLabel: 'メールアドレス（必須）', projectLabel: 'プロジェクトの概要（必須）', budgetLabel: '1曲のご予算（任意）', scheduleLabel: '日程・公開時期（任意）',
    budgetPlaceholder: 'ご予算の目安・応相談・未定', schedulePlaceholder: '公開予定・未定'
  }
};

export function previewSite(source) {
  const site = structuredClone(source);
  for (const [lang, c] of Object.entries(copy)) {
    const patch = (section, values) => {
      if (lang === 'kr') Object.assign(section, values);
      section.translations ||= {};
      section.translations[lang] = { ...section.translations[lang], ...values };
    };
    patch(site.home, { journeyIntro: c.invitation });
    const proof = structuredClone(lang === 'kr' ? site.projects.proof : site.projects.translations[lang].proof);
    proof.rows = c.stages.map(([label, text, result]) => ({ label, ours: 'true', badge: '', steps: [{ text, en: '' }], result }));
    Object.assign(proof, { closing: c.closing, ctaLabel: c.cta });
    Object.assign(proof.case, { eyebrow: c.caseEyebrow, lesson: c.caseLesson });
    patch(site.projects, { subtitle: c.subtitle, description: c.description, proof });
    const form = { ...site.contact.translations[lang].form, title: c.formIntro, mailNote: c.formNote, contactLabel: c.replyLabel, projectLabel: c.projectLabel, budgetLabel: c.budgetLabel, scheduleLabel: c.scheduleLabel, budgetPlaceholder: c.budgetPlaceholder, schedulePlaceholder: c.schedulePlaceholder };
    patch(site.contact, { arrivalLabel: c.arrival, titleLine1: c.title, titleAccent: c.accent, subtitle: c.subtitleContact, caption: c.caption, form });
  }
  return site;
}

export function previewTemplate(source) {
  let template = source.replace(/\r\n/g, '\n').replace('<!-- BRAND -->', '<!-- Preview experiment: story to project -->\n<!-- BRAND -->');
  template = template.replace('  <div data-reveal="" class="tt-home-quick-actions">', '  <p class="tt-journey-invitation">{{ HOME.journeyIntro }}</p>\n  <div data-reveal="" class="tt-home-quick-actions">');
  template = template.replace('class="tt-cmp"', 'class="tt-cmp tt-process"');
  template = template.replace('href="/discography/?work={{ HOME_LISTEN.slug }}"', 'href="{{ HOME_LISTEN.previewHref }}"');
  const bookStart = template.indexOf('    <!-- the book rests on the sea floor');
  const bookEnd = template.indexOf('    </section></div>', bookStart);
  if (bookStart < 0 || bookEnd < 0) throw new Error('Preview book boundary missing');
  const book = template.slice(bookStart, bookEnd).replace('<div style="margin-top:', '<div class="tt-arrival-book" style="margin-top:');
  template = template.slice(0, bookStart) + template.slice(bookEnd);
  const contactStart = template.indexOf('<section id="c-contact"');
  const copyStart = template.indexOf('  <div data-reveal=""', contactStart);
  const formStart = template.indexOf('  <sc-if value="{{ CONTACT_FORM.title }}">', copyStart);
  if (contactStart < 0 || copyStart < 0 || formStart < 0) throw new Error('Preview contact boundary missing');
  const contactCopy = template.slice(copyStart, formStart)
    .replace('<div data-reveal=""', '<div class="tt-arrival-copy" data-reveal=""')
    .replace('<div style="margin-top:42px;', '<div class="tt-contact-actions" style="margin-top:42px;');
  template = template.slice(0, copyStart) + '<div class="tt-arrival">\n' + book + contactCopy + '</div>\n' + template.slice(formStart);
  template = template.replace('<div class="tt-section-chapter-block"><div class="tt-section-chapter">{{ CHAPTER_EPILOGUE.label }}', '<p class="tt-arrival-label">{{ CONTACT.arrivalLabel }}</p><div class="tt-section-chapter-block"><div class="tt-section-chapter">{{ CHAPTER_EPILOGUE.label }}');
  template = template.replace(/<div class="tt-contact-channels"[\s\S]*?<\/div>/, '<sc-if value="{{ CONTACT_CHANNELS.length }}">$&</sc-if>');
  template = template.replace('name="budget" type="text"', 'name="budget" type="text" placeholder="{{ CONTACT_FORM.budgetPlaceholder }}"');
  template = template.replace('name="schedule" type="text"', 'name="schedule" type="text" placeholder="{{ CONTACT_FORM.schedulePlaceholder }}"');
  return template;
}

export function previewComponent(source) {
  const prefix = "'/preview' + (this.lang === 'en' ? '/en' : this.lang === 'jp' ? '/ja' : '')";
  const home = "label: listen.label || '', context:";
  const detail = "href: '/discography/?work='";
  if (!source.includes(home) || !source.includes(detail)) throw new Error('Preview song link boundary missing');
  return source.replace(home, "previewHref: " + prefix + " + '/discography/?work=' + listenWork.slug, " + home)
    .replace(detail, "href: " + prefix + " + '/discography/?work='") + `
// Translated copy changes section heights; keep the chosen preview chapter in view.
(function () {
  var setLang = Component.prototype.setLang;
  Component.prototype.setLang = function (lang) {
    var changed = this.lang !== lang;
    var page = this._seoPageForKey(this._seoPageKeyFromLocation());
    setLang.call(this, lang);
    if (changed && page && page.sectionId) requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.scroller) this.scrollToId(page.sectionId, 'auto');
    }));
  };
})();
`;
}
