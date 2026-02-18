const form = document.getElementById('resumeForm');
const preview = document.getElementById('resumePreview');
const fontScaleInput = form.querySelector('[name="fontScale"]');
const fontScaleValue = document.getElementById('fontScaleValue');
const authStatusEl = document.getElementById('authStatus');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const cloudSaveBtn = document.getElementById('cloudSaveBtn');
const cloudLoadBtn = document.getElementById('cloudLoadBtn');
const instructionsModal = document.getElementById('instructionsModal');
const openInstructionsBtn = document.getElementById('openInstructionsBtn');
const closeInstructionsBtn = document.getElementById('closeInstructionsBtn');

const FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: ''
};

let firebaseReady = false;
let auth = null;
let db = null;
let authProvider = null;
let currentUser = null;

const scalarFields = [
  'fontScale', 'fullName', 'tagline', 'linkedinUrl'
];

const visibilityDefaults = {
  header: true,
  linkedinLogo: true,
  education: true,
  expertise: true,
  achievements: true,
  work: true,
  internships: true,
  projects: true,
  certifications: true,
  por: true,
  extra: true,
  co: true,
  skills: true,
  links: true,
  personal: true
};

const sections = {
  education: { listId: 'educationList', templateId: 'educationTemplate' },
  expertise: { listId: 'expertiseList', templateId: 'expertiseTemplate' },
  achievements: { listId: 'achievementsList', templateId: 'achievementsTemplate' },
  work: { listId: 'workList', templateId: 'workTemplate' },
  internships: { listId: 'internshipsList', templateId: 'internshipsTemplate' },
  projects: { listId: 'projectsList', templateId: 'projectsTemplate' },
  certifications: { listId: 'certificationsList', templateId: 'certificationsTemplate' },
  por: { listId: 'porList', templateId: 'porTemplate' },
  extra: { listId: 'extraList', templateId: 'extraTemplate' },
  co: { listId: 'coList', templateId: 'coTemplate' },
  techSkills: { listId: 'techSkillsList', templateId: 'techSkillsTemplate' },
  personal: { listId: 'personalList', templateId: 'personalTemplate' },
  links: { listId: 'linksList', templateId: 'linksTemplate' }
};

const defaults = {
  fontScale: '1',
  fullName: '',
  tagline: '',
  linkedinUrl: '',
  education: [],
  expertise: [],
  achievements: [],
  work: [],
  internships: [],
  projects: [],
  certifications: [],
  por: [],
  extra: [],
  co: [],
  techSkills: [],
  personal: [],
  sectionVisibility: { ...visibilityDefaults },
  links: []
};

let data = structuredClone(defaults);

function safe(url) {
  if (!url) return '#';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkify(value) {
  const text = escapeHtml(value);
  const markdownLinks = [];
  const markdownRegex = /\[([^\]]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi;
  const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+)/gi;

  let processed = text.replace(markdownRegex, (_, label, url) => {
    const token = `__MD_LINK_${markdownLinks.length}__`;
    markdownLinks.push(`<a href="${safe(url)}" target="_blank" rel="noopener">${label}</a>`);
    return token;
  });

  processed = processed.replace(urlRegex, (match) => {
    const href = /^https?:\/\//i.test(match) ? match : `https://${match}`;
    return `<a href="${href}" target="_blank" rel="noopener">${match}</a>`;
  });

  markdownLinks.forEach((html, idx) => {
    processed = processed.replaceAll(`__MD_LINK_${idx}__`, html);
  });

  return processed;
}

function mailto(email) {
  return `mailto:${String(email || '').trim()}`;
}

function tel(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return `tel:${digits}`;
}

function hasAny(value) {
  return Object.values(value || {}).some((v) => String(v || '').trim());
}

function isFirebaseConfigured() {
  return ['apiKey', 'authDomain', 'projectId', 'appId'].every((key) => Boolean(FIREBASE_CONFIG[key]));
}

function isAuthEnvironmentSupported() {
  const protocolOk = ['http:', 'https:', 'chrome-extension:'].includes(window.location.protocol);
  const storageOk = (() => {
    try {
      const key = '__resume_builder_auth_check__';
      window.localStorage.setItem(key, '1');
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  })();
  return protocolOk && storageOk;
}

function setAuthStatus(text, isError = false) {
  if (!authStatusEl) return;
  authStatusEl.textContent = text;
  authStatusEl.classList.toggle('error', isError);
}

function updateAuthControls() {
  const enabled = firebaseReady;
  if (signInBtn) signInBtn.disabled = !enabled || !!currentUser;
  if (signOutBtn) signOutBtn.disabled = !enabled || !currentUser;
  if (cloudSaveBtn) cloudSaveBtn.disabled = !enabled || !currentUser;
  if (cloudLoadBtn) cloudLoadBtn.disabled = !enabled || !currentUser;
}

function resumeDocRef(uid) {
  return db.collection('users').doc(uid).collection('resumes').doc('default');
}

async function handleSignIn() {
  if (!auth || !authProvider) return;
  try {
    await auth.signInWithPopup(authProvider);
  } catch (error) {
    if (error?.code === 'auth/operation-not-supported-in-this-environment') {
      try {
        await auth.signInWithRedirect(authProvider);
        return;
      } catch (redirectError) {
        setAuthStatus(`Sign-in failed: ${redirectError.message}`, true);
        return;
      }
    }
    setAuthStatus(`Sign-in failed: ${error.message}`, true);
  }
}

async function handleSignOut() {
  if (!auth) return;
  try {
    await auth.signOut();
  } catch (error) {
    setAuthStatus(`Sign-out failed: ${error.message}`, true);
  }
}

async function saveToCloud() {
  if (!db || !currentUser) return;
  try {
    sync();
    await resumeDocRef(currentUser.uid).set(
      {
        data,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    setAuthStatus('Cloud save complete.');
  } catch (error) {
    setAuthStatus(`Cloud save failed: ${error.message}`, true);
  }
}

async function loadFromCloud(options = {}) {
  const { silent = false } = options;
  if (!db || !currentUser) return;
  try {
    const snap = await resumeDocRef(currentUser.uid).get();
    if (!snap.exists || !snap.data()?.data) {
      if (!silent) setAuthStatus('No cloud resume found yet.');
      return;
    }
    load(snap.data().data);
    if (!silent) setAuthStatus('Cloud resume loaded.');
  } catch (error) {
    setAuthStatus(`Cloud load failed: ${error.message}`, true);
  }
}

function initFirebase() {
  if (!window.firebase) {
    setAuthStatus('Cloud unavailable: Firebase SDK not loaded.', true);
    updateAuthControls();
    return;
  }

  if (!isAuthEnvironmentSupported()) {
    setAuthStatus('Use http(s) URL with localStorage enabled (not file://).', true);
    updateAuthControls();
    return;
  }

  if (!isFirebaseConfigured()) {
    setAuthStatus('Cloud disabled: add window.FIREBASE_CONFIG.', true);
    updateAuthControls();
    return;
  }

  try {
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(FIREBASE_CONFIG);
    }
    auth = window.firebase.auth();
    db = window.firebase.firestore();
    authProvider = new window.firebase.auth.GoogleAuthProvider();
    firebaseReady = true;
    updateAuthControls();

    auth.onAuthStateChanged(async (user) => {
      currentUser = user || null;
      updateAuthControls();
      if (!currentUser) {
        setAuthStatus('Signed out.');
        return;
      }
      const label = currentUser.displayName || currentUser.email || 'User';
      setAuthStatus(`Signed in: ${label}`);
      await loadFromCloud({ silent: true });
    });
  } catch (error) {
    setAuthStatus(`Firebase init failed: ${error.message}`, true);
    firebaseReady = false;
    updateAuthControls();
  }
}

function getScalarElement(name) {
  const matches = [...form.querySelectorAll(`[name="${name}"]`)];
  return matches.find((el) => !el.closest('.item-card')) || matches[0] || null;
}

function openInstructions() {
  if (!instructionsModal) return;
  instructionsModal.classList.add('open');
  instructionsModal.setAttribute('aria-hidden', 'false');
}

function closeInstructions() {
  if (!instructionsModal) return;
  instructionsModal.classList.remove('open');
  instructionsModal.setAttribute('aria-hidden', 'true');
}

function readVisibilityFromForm() {
  return {
    header: form.querySelector('[name="show_header"]')?.checked ?? true,
    linkedinLogo: form.querySelector('[name="show_linkedin_logo"]')?.checked ?? true,
    education: form.querySelector('[name="show_education"]')?.checked ?? true,
    expertise: form.querySelector('[name="show_expertise"]')?.checked ?? true,
    achievements: form.querySelector('[name="show_achievements"]')?.checked ?? true,
    work: form.querySelector('[name="show_work"]')?.checked ?? true,
    internships: form.querySelector('[name="show_internships"]')?.checked ?? true,
    projects: form.querySelector('[name="show_projects"]')?.checked ?? true,
    certifications: form.querySelector('[name="show_certifications"]')?.checked ?? true,
    por: form.querySelector('[name="show_por"]')?.checked ?? true,
    extra: form.querySelector('[name="show_extra"]')?.checked ?? true,
    co: form.querySelector('[name="show_co"]')?.checked ?? true,
    skills: form.querySelector('[name="show_skills"]')?.checked ?? true,
    links: form.querySelector('[name="show_links"]')?.checked ?? true,
    personal: form.querySelector('[name="show_personal"]')?.checked ?? true
  };
}

function applyVisibilityToForm(visibility) {
  form.querySelector('[name="show_header"]').checked = visibility.header;
  form.querySelector('[name="show_linkedin_logo"]').checked = visibility.linkedinLogo;
  form.querySelector('[name="show_education"]').checked = visibility.education;
  form.querySelector('[name="show_expertise"]').checked = visibility.expertise;
  form.querySelector('[name="show_achievements"]').checked = visibility.achievements;
  form.querySelector('[name="show_work"]').checked = visibility.work;
  form.querySelector('[name="show_internships"]').checked = visibility.internships;
  form.querySelector('[name="show_projects"]').checked = visibility.projects;
  form.querySelector('[name="show_certifications"]').checked = visibility.certifications;
  form.querySelector('[name="show_por"]').checked = visibility.por;
  form.querySelector('[name="show_extra"]').checked = visibility.extra;
  form.querySelector('[name="show_co"]').checked = visibility.co;
  form.querySelector('[name="show_skills"]').checked = visibility.skills;
  form.querySelector('[name="show_links"]').checked = visibility.links;
  form.querySelector('[name="show_personal"]').checked = visibility.personal;
}

function setupCollapsibleGroups() {
  const groups = [...form.querySelectorAll('.group')];
  groups.forEach((group) => {
    const head = group.querySelector(':scope > .group-head');
    const title = group.querySelector(':scope > h2');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'group-toggle';
    toggle.textContent = 'Edit';

    toggle.addEventListener('click', () => {
      const collapsed = group.classList.toggle('collapsed');
      toggle.textContent = collapsed ? 'Edit' : 'Close';
    });

    if (head) {
      let actions = head.querySelector('.group-head-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'group-head-actions';
        [...head.querySelectorAll('button')].forEach((btn) => actions.appendChild(btn));
        head.appendChild(actions);
      }
      actions.appendChild(toggle);
    } else if (title) {
      title.appendChild(toggle);
    }

    group.classList.add('collapsed');
  });
}

function addItem(section, values = {}) {
  const cfg = sections[section];
  const list = document.getElementById(cfg.listId);
  const tpl = document.getElementById(cfg.templateId).content.firstElementChild.cloneNode(true);

  tpl.querySelectorAll('input, textarea').forEach((el) => {
    el.value = values[el.name] || '';
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
  });

  tpl.querySelector('.remove').addEventListener('click', () => {
    tpl.remove();
    sync();
  });

  list.appendChild(tpl);
}

function collectList(section) {
  const cfg = sections[section];
  const list = document.getElementById(cfg.listId);
  return [...list.querySelectorAll('.item-card')]
    .map((card) => {
      const row = {};
      card.querySelectorAll('input, textarea').forEach((el) => {
        row[el.name] = el.value.trim();
      });
      return row;
    })
    .filter(hasAny);
}

function sync() {
  const next = {};
  scalarFields.forEach((k) => {
    const el = getScalarElement(k);
    next[k] = el ? el.value.trim() : '';
  });

  Object.keys(sections).forEach((name) => {
    next[name] = collectList(name);
  });

  next.sectionVisibility = readVisibilityFromForm();
  data = next;
  render();
}

function sectionTitle(title) {
  return `<div class="section-title">${escapeHtml(title)}</div>`;
}

function pairSection(title, left, right) {
  return `${sectionTitle(title)}<table><tr><td style="width:86%">${left || ''}</td><td style="width:14%">${linkify(right || '')}</td></tr></table>`;
}

function optionalSection(title, body) {
  return body ? `${sectionTitle(title)}${body}` : '';
}

function parseDateRank(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  if (/(present|current|pursuing|ongoing)/i.test(raw)) {
    return 999912;
  }

  const months = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
  };

  const ranks = [];
  const monthYearRegex = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s\-']*(\d{2,4})\b/gi;
  let match;
  while ((match = monthYearRegex.exec(raw)) !== null) {
    const mon = months[match[1].toLowerCase()] || 1;
    let year = Number(match[2]);
    if (year < 100) year += 2000;
    ranks.push(year * 100 + mon);
  }

  const yearRegex = /\b(19\d{2}|20\d{2})\b/g;
  while ((match = yearRegex.exec(raw)) !== null) {
    const year = Number(match[1]);
    ranks.push(year * 100 + 1);
  }

  const shortYearRegex = /'(\d{2})\b/g;
  while ((match = shortYearRegex.exec(raw)) !== null) {
    const year = 2000 + Number(match[1]);
    ranks.push(year * 100 + 1);
  }

  if (!ranks.length) return null;
  return Math.max(...ranks);
}

function sortByDateDesc(items, dateKey) {
  return (items || [])
    .map((item, idx) => ({
      item,
      idx,
      rank: parseDateRank(item?.[dateKey])
    }))
    .sort((a, b) => {
      if (a.rank == null && b.rank == null) return a.idx - b.idx;
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      if (a.rank !== b.rank) return b.rank - a.rank;
      return a.idx - b.idx;
    })
    .map((x) => x.item);
}

function currentScaleValue() {
  const raw = Number(fontScaleInput?.value || 1);
  if (!Number.isFinite(raw)) return 1;
  return raw > 0 ? raw : 0.01;
}

function applyFontScale(scale) {
  const numeric = Number(scale);
  const next = Math.round((Number.isFinite(numeric) && numeric > 0 ? numeric : 0.01) * 100) / 100;
  if (fontScaleInput) fontScaleInput.value = String(next);
  preview.style.setProperty('--resume-scale', String(next));
  if (fontScaleValue) fontScaleValue.textContent = `${Math.round(next * 100)}%`;
}

function render() {
  applyFontScale(currentScaleValue());

  const educationSorted = sortByDateDesc(data.education, 'year');
  const achievementsSorted = sortByDateDesc(data.achievements, 'date');
  const workSorted = sortByDateDesc(data.work, 'date');
  const internshipsSorted = sortByDateDesc(data.internships, 'date');
  const projectsSorted = sortByDateDesc(data.projects, 'date');
  const certificationsSorted = sortByDateDesc(data.certifications, 'date');
  const porSorted = sortByDateDesc(data.por, 'date');
  const extraSorted = sortByDateDesc(data.extra, 'date');
  const coSorted = sortByDateDesc(data.co, 'date');

  const eduRows = educationSorted.map((r) => `
    <tr>
      <td>${linkify(r.year || '')}</td>
      <td>${linkify(r.degree || '')}</td>
      <td>${linkify(r.board || '')}</td>
      <td>${linkify(r.institute || '')}</td>
      <td>${linkify(r.score || '')}</td>
    </tr>
  `).join('');

  const expertiseRows = data.expertise
    .map((item) => String(item.text || '').trim())
    .filter(Boolean)
    .map((text) => `• ${linkify(text)}`)
    .join(' ');

  const achievementRows = achievementsSorted.map((a) => `
    <tr>
      <td style="width:86%"><strong>${linkify(a.title || '')}</strong>${a.description ? `<br>${linkify(a.description)}` : ''}</td>
      <td style="width:14%">${linkify(a.date || '')}</td>
    </tr>
  `).join('');

  const workRows = workSorted.map((w) => `
    <table><tr><td style="width:86%">${linkify(w.title || '')}</td><td style="width:14%">${linkify(w.date || '')}</td></tr></table>
    <div class="project-block" style="padding-top:3px">
      <div><strong>${linkify(w.role || '')}</strong></div>
      ${(w.highlights || '').split('\n').filter(Boolean).map((line) => `<div>• ${linkify(line)}</div>`).join('')}
    </div>
  `).join('');

  const internshipRows = internshipsSorted.map((i) => `
    <div class="project-block">
      <div class="project-head"><span>${linkify(i.organization || '')}</span><span>${linkify(i.date || '')}</span></div>
      <div><strong>${linkify(i.role || '')}</strong></div>
      <div>${linkify(i.summary || '')}</div>
    </div>
  `).join('');

  const projectRows = projectsSorted.map((p) => `
    <div class="project-block">
      <div class="project-head"><span>${linkify(p.type || '')}</span><span>${linkify(p.date || '')}</span></div>
      <div><strong>${linkify(p.name || '')}</strong></div>
      <div><strong>Summary:</strong> ${linkify(p.summary || '')}</div>
      <div><strong>Skills Used:</strong> ${linkify(p.skills || '')}</div>
      <div><strong>Team Size:</strong> ${linkify(p.teamSize || '')}</div>
      <div><strong>Key Outcomes:</strong> ${linkify(p.outcomes || '')}</div>
    </div>
  `).join('');

  const certificationRows = certificationsSorted.map((c) => `
    <tr>
      <td style="width:38%"><strong>${linkify(c.name || '')}</strong></td>
      <td style="width:28%">${linkify(c.issuer || '')}</td>
      <td style="width:14%">${linkify(c.date || '')}</td>
      <td>${c.url ? `<a href="${safe(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.url)}</a>` : ''}</td>
    </tr>
  `).join('');

  const porRows = porSorted.map((item) =>
    pairSection(
      'Positions of Responsibility',
      `<strong>${linkify(item.title || '')}</strong><br>${linkify(item.description || '')}`,
      item.date || ''
    )
  ).join('');

  const extraRows = extraSorted.map((item) =>
    pairSection(
      'Extra Curricular Activities',
      `<strong>${linkify(item.title || '')}</strong><br>${linkify(item.description || '')}`,
      item.date || ''
    )
  ).join('');

  const coRows = coSorted.map((item) => `
    <tr>
      <td style="width:86%"><strong>${linkify(item.title || '')}</strong><br>${linkify(item.description || '')}</td>
      <td style="width:14%">${linkify(item.date || '')}</td>
    </tr>
  `).join('');

  const linkRows = data.links.map((l) => `
    <tr>
      <td style="width:42%">${linkify(l.platform || '')}</td>
      <td><a href="${safe(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.url || '')}</a></td>
    </tr>
  `).join('');

  const techSkillRows = data.techSkills
    .map((item) => String(item.text || '').trim())
    .filter(Boolean)
    .map((text) => `<div>• ${linkify(text)}</div>`)
    .join('');

  const personalRows = data.personal.map((p) => `
    <tr>
      <td>
        Email: ${p.email ? `<a href="${mailto(p.email)}">${escapeHtml(p.email)}</a>` : ''}
        &nbsp;&nbsp; | &nbsp;&nbsp;
        Phone: ${p.phone ? `<a href="${tel(p.phone)}">${escapeHtml(p.phone)}</a>` : ''}
        &nbsp;&nbsp; | &nbsp;&nbsp;
        Location: ${linkify(p.location || '')}
      </td>
    </tr>
  `).join('');

  const hasHeader = Boolean(data.fullName || data.tagline || hasLinkedinLogo);
  const hasLinkedinLogo = Boolean(data.linkedinUrl);
  const hasEducation = educationSorted.length > 0;
  const hasExpertise = data.expertise.some((item) => String(item.text || '').trim());
  const hasAchievements = achievementsSorted.length > 0;
  const hasWork = workSorted.some((item) => hasAny(item));
  const hasInternships = internshipsSorted.length > 0;
  const hasProjects = projectsSorted.length > 0;
  const hasCertifications = certificationsSorted.length > 0;
  const hasPor = porSorted.length > 0;
  const hasExtra = extraSorted.length > 0;
  const hasCo = coSorted.length > 0;
  const hasSkills = data.techSkills.some((item) => String(item.text || '').trim());
  const hasLinks = data.links.length > 0;
  const hasPersonal = data.personal.some((item) => hasAny(item));

  const v = { ...visibilityDefaults, ...(data.sectionVisibility || {}) };

  preview.innerHTML = `
    ${v.header && hasHeader ? `
      <div class="header-link-row">
        ${v.linkedinLogo && hasLinkedinLogo ? `
          <a class="linkedin-logo-link" href="${safe(data.linkedinUrl)}" target="_blank" rel="noopener" aria-label="LinkedIn profile">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM0 8h5v16H0V8zm8 0h4.8v2.2h.1c.7-1.2 2.4-2.5 4.9-2.5 5.2 0 6.2 3.4 6.2 7.8V24h-5v-7.3c0-1.7 0-4-2.5-4s-2.9 1.9-2.9 3.9V24H8V8z"></path>
            </svg>
          </a>
        ` : ''}
      </div>
      <h1 class="name-row"><span>${escapeHtml(data.fullName || '')}</span></h1>
      <p class="tagline">${linkify(data.tagline || '')}</p>
    ` : ''}

    ${v.education && hasEducation ? `
      ${sectionTitle('Education')}
      <table>
        <tr>
          <th style="width:12%">Year</th>
          <th style="width:30%">Degree</th>
          <th style="width:19%">University/Board</th>
          <th style="width:27%">Institute</th>
          <th style="width:12%">/ CGPA</th>
        </tr>
        ${eduRows}
      </table>
    ` : ''}

    ${v.expertise && hasExpertise ? `
      ${sectionTitle('Expertise/Area of Interest')}
      <p class="bullet">${expertiseRows}</p>
    ` : ''}

    ${v.achievements ? optionalSection('Achievements and Accomplishments', hasAchievements ? `<table>${achievementRows}</table>` : '') : ''}

    ${v.work && hasWork ? `
      ${sectionTitle('Work Experience')}
      ${workRows}
    ` : ''}

    ${v.internships ? optionalSection('Internships', hasInternships ? internshipRows : '') : ''}
    ${v.projects ? optionalSection('Projects', hasProjects ? projectRows : '') : ''}
    ${v.certifications ? optionalSection('Certifications', hasCertifications ? `<table>${certificationRows}</table>` : '') : ''}

    ${v.por && hasPor ? porRows : ''}
    ${v.extra && hasExtra ? extraRows : ''}
    ${v.co && hasCo ? optionalSection('Co-Curricular Activities', `<table>${coRows}</table>`) : ''}

    ${v.skills && hasSkills ? `
      ${sectionTitle('Technical Skills')}
      <div class="bullet">${techSkillRows}</div>
    ` : ''}

    ${v.links && hasLinks ? `
      ${sectionTitle('Online Professional Presence')}
      <table class="links">${linkRows}</table>
    ` : ''}

    ${v.personal && hasPersonal ? `
      ${sectionTitle('Personal Details')}
      <table>${personalRows}</table>
    ` : ''}

    <div class="page-break-marker" aria-hidden="true"></div>
  `;
}

function load(payload) {
  data = { ...structuredClone(defaults), ...payload };
  data.sectionVisibility = { ...visibilityDefaults, ...(payload?.sectionVisibility || {}) };

  if ((!Array.isArray(payload?.expertise) || payload.expertise.length === 0) && String(payload?.expertise || '').trim()) {
    data.expertise = [{ text: payload.expertise }];
  }
  if ((!Array.isArray(payload?.work) || payload.work.length === 0) && hasAny({
    title: payload?.workTitle,
    date: payload?.workDate,
    role: payload?.workRole,
    highlights: payload?.workHighlights
  })) {
    data.work = [{
      title: payload.workTitle || '',
      date: payload.workDate || '',
      role: payload.workRole || '',
      highlights: payload.workHighlights || ''
    }];
  }
  if ((!Array.isArray(payload?.techSkills) || payload.techSkills.length === 0) && String(payload?.skills || '').trim()) {
    data.techSkills = [{ text: payload.skills }];
  }
  if ((!Array.isArray(payload?.personal) || payload.personal.length === 0) && hasAny({
    email: payload?.personalEmail,
    phone: payload?.personalPhone,
    location: payload?.personalLocation
  })) {
    data.personal = [{
      email: payload.personalEmail || '',
      phone: payload.personalPhone || '',
      location: payload.personalLocation || ''
    }];
  }

  const legacyPor = hasAny({
    title: payload?.porTitle,
    date: payload?.porDate,
    description: payload?.porDescription
  });
  const legacyExtra = hasAny({
    title: payload?.extraTitle,
    date: payload?.extraDate,
    description: payload?.extraDescription
  });
  const legacyCo = hasAny({
    title: payload?.coTitle,
    date: payload?.coDate,
    description: payload?.coDescription
  });

  if ((!Array.isArray(payload?.por) || payload.por.length === 0) && legacyPor) {
    data.por = [{ title: payload.porTitle || '', date: payload.porDate || '', description: payload.porDescription || '' }];
  }
  if ((!Array.isArray(payload?.extra) || payload.extra.length === 0) && legacyExtra) {
    data.extra = [{ title: payload.extraTitle || '', date: payload.extraDate || '', description: payload.extraDescription || '' }];
  }
  if ((!Array.isArray(payload?.co) || payload.co.length === 0) && legacyCo) {
    data.co = [{ title: payload.coTitle || '', date: payload.coDate || '', description: payload.coDescription || '' }];
  }

  scalarFields.forEach((k) => {
    const el = getScalarElement(k);
    if (el) el.value = data[k] || '';
  });

  applyVisibilityToForm(data.sectionVisibility);

  Object.keys(sections).forEach((name) => {
    const list = document.getElementById(sections[name].listId);
    list.innerHTML = '';
    (data[name] || []).forEach((row) => addItem(name, row));
  });

  render();
}

Object.keys(sections).forEach((name) => {
  const btn = document.querySelector(`[data-add="${name}"]`);
  btn.addEventListener('click', () => {
    addItem(name, {});
    sync();
  });
});

form.querySelectorAll('input, textarea').forEach((el) => {
  el.addEventListener('input', sync);
  el.addEventListener('change', sync);
});

document.getElementById('downloadJson').addEventListener('click', () => {
  sync();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'resume-template-data.json';
  a.click();
});

document.getElementById('uploadJson').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    load(parsed);
  } catch {
    alert('Invalid JSON file.');
  }
});

document.getElementById('printResume').addEventListener('click', () => window.print());

signInBtn?.addEventListener('click', handleSignIn);
signOutBtn?.addEventListener('click', handleSignOut);
cloudSaveBtn?.addEventListener('click', saveToCloud);
cloudLoadBtn?.addEventListener('click', () => loadFromCloud({ silent: false }));
openInstructionsBtn?.addEventListener('click', openInstructions);
closeInstructionsBtn?.addEventListener('click', closeInstructions);
instructionsModal?.addEventListener('click', (event) => {
  if (event.target === instructionsModal) closeInstructions();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeInstructions();
});

document.getElementById('fontDecrease').addEventListener('click', () => {
  applyFontScale(currentScaleValue() - 0.05);
  sync();
});

document.getElementById('fontIncrease').addEventListener('click', () => {
  applyFontScale(currentScaleValue() + 0.05);
  sync();
});

document.getElementById('fontReset').addEventListener('click', () => {
  applyFontScale(1);
  sync();
});

initFirebase();
setupCollapsibleGroups();
load(defaults);
