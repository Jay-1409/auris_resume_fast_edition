const form = document.getElementById("resumeForm");
const preview = document.getElementById("resumePreview");
const fontScaleInput = form.querySelector('[name="fontScale"]');
const fontScaleValue = document.getElementById("fontScaleValue");
const authStatusEl = document.getElementById("authStatus");
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const cloudSaveBtn = document.getElementById("cloudSaveBtn");
const cloudLoadBtn = document.getElementById("cloudLoadBtn");
const instructionsModal = document.getElementById("instructionsModal");
const openInstructionsBtn = document.getElementById("openInstructionsBtn");
const closeInstructionsBtn = document.getElementById("closeInstructionsBtn");

const FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
	apiKey: "",
	authDomain: "",
	projectId: "",
	appId: "",
};

let firebaseReady = false;
let auth = null;
let db = null;
let authProvider = null;
let currentUser = null;

const scalarFields = ["fontScale", "fullName", "tagline", "linkedinUrl"];

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
	personal: true,
};

const sections = {
	education: { listId: "educationList", templateId: "educationTemplate" },
	expertise: { listId: "expertiseList", templateId: "expertiseTemplate" },
	achievements: {
		listId: "achievementsList",
		templateId: "achievementsTemplate",
	},
	work: { listId: "workList", templateId: "workTemplate" },
	internships: { listId: "internshipsList", templateId: "internshipsTemplate" },
	projects: { listId: "projectsList", templateId: "projectsTemplate" },
	certifications: {
		listId: "certificationsList",
		templateId: "certificationsTemplate",
	},
	por: { listId: "porList", templateId: "porTemplate" },
	extra: { listId: "extraList", templateId: "extraTemplate" },
	co: { listId: "coList", templateId: "coTemplate" },
	techSkills: { listId: "techSkillsList", templateId: "techSkillsTemplate" },
	personal: { listId: "personalList", templateId: "personalTemplate" },
	links: { listId: "linksList", templateId: "linksTemplate" },
};

const defaults = {
	fontScale: "1",
	fullName: "",
	tagline: "",
	linkedinUrl: "",
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
	links: [],
};

let data = structuredClone(defaults);

function safe(url) {
	if (!url) return "#";
	return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function escapeHtml(value) {
	return String(value || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function toBoolean(value, fallback = true) {
	if (typeof value === "boolean") return value;
	if (value == null || value === "") return fallback;
	const normalized = String(value).trim().toLowerCase();
	if (["true", "1", "yes", "on"].includes(normalized)) return true;
	if (["false", "0", "no", "off"].includes(normalized)) return false;
	return fallback;
}

function linkify(value) {
	const text = escapeHtml(value);
	const markdownLinks = [];
	const markdownRegex = /\[([^\]]+)\]\(([^)]+)\)/gi;
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
	return `mailto:${String(email || "").trim()}`;
}

function tel(phone) {
	const digits = String(phone || "").replace(/[^\d+]/g, "");
	return `tel:${digits}`;
}

function hasAny(value) {
	return Object.entries(value || {}).some(([key, v]) => {
		if (key.startsWith("show_")) return false;
		return String(v || "").trim();
	});
}

function splitTechSkillLine(text) {
	const raw = String(text || "").trim();
	if (!raw) return { category: "", items: "" };
	const match = raw.match(/^([^:]{2,80})\s*:\s*(.+)$/);
	if (match) {
		return { category: match[1].trim(), items: match[2].trim() };
	}
	return { category: "", items: raw };
}

function normalizeTechSkillItem(item) {
	const row = item && typeof item === "object" ? item : {};
	const fromText = splitTechSkillLine(row.text || "");
	const category = String(
		row.category || row.label || row.heading || row.type || fromText.category || "",
	).trim();
	const items = String(row.items || row.skills || row.value || fromText.items || "").trim();

	return {
		category,
		items,
		show_techskills_category: toBoolean(row.show_techskills_category, Boolean(category)),
		show_techskills_items: toBoolean(row.show_techskills_items, Boolean(items)),
	};
}

function isFirebaseConfigured() {
	return ["apiKey", "authDomain", "projectId", "appId"].every((key) =>
		Boolean(FIREBASE_CONFIG[key]),
	);
}

function isAuthEnvironmentSupported() {
	const protocolOk = ["http:", "https:", "chrome-extension:"].includes(window.location.protocol);
	const storageOk = (() => {
		try {
			const key = "__resume_builder_auth_check__";
			window.localStorage.setItem(key, "1");
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
	authStatusEl.classList.toggle("error", isError);
}

function updateAuthControls() {
	const enabled = firebaseReady;
	if (signInBtn) signInBtn.disabled = !enabled || !!currentUser;
	if (signOutBtn) signOutBtn.disabled = !enabled || !currentUser;
	if (cloudSaveBtn) cloudSaveBtn.disabled = !enabled || !currentUser;
	if (cloudLoadBtn) cloudLoadBtn.disabled = !enabled || !currentUser;
}

function resumeDocRef(uid) {
	return db.collection("users").doc(uid).collection("resumes").doc("default");
}

async function handleSignIn() {
	if (!auth || !authProvider) return;
	try {
		await auth.signInWithPopup(authProvider);
	} catch (error) {
		if (error?.code === "auth/operation-not-supported-in-this-environment") {
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
				updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
			},
			{ merge: true },
		);
		setAuthStatus("Cloud save complete.");
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
			if (!silent) setAuthStatus("No cloud resume found yet.");
			return;
		}
		load(snap.data().data);
		if (!silent) setAuthStatus("Cloud resume loaded.");
	} catch (error) {
		setAuthStatus(`Cloud load failed: ${error.message}`, true);
	}
}

function initFirebase() {
	if (!window.firebase) {
		setAuthStatus("Cloud unavailable: Firebase SDK not loaded.", true);
		updateAuthControls();
		return;
	}

	if (!isAuthEnvironmentSupported()) {
		setAuthStatus("Use http(s) URL with localStorage enabled (not file://).", true);
		updateAuthControls();
		return;
	}

	if (!isFirebaseConfigured()) {
		setAuthStatus("Cloud disabled: add window.FIREBASE_CONFIG.", true);
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
				setAuthStatus("Signed out.");
				return;
			}
			const label = currentUser.displayName || currentUser.email || "User";
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
	return matches.find((el) => !el.closest(".item-card")) || matches[0] || null;
}

function openInstructions() {
	if (!instructionsModal) return;
	instructionsModal.classList.add("open");
	instructionsModal.setAttribute("aria-hidden", "false");
}

function closeInstructions() {
	if (!instructionsModal) return;
	instructionsModal.classList.remove("open");
	instructionsModal.setAttribute("aria-hidden", "true");
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
		personal: form.querySelector('[name="show_personal"]')?.checked ?? true,
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
	const groups = [...form.querySelectorAll(".group")];
	groups.forEach((group) => {
		const head = group.querySelector(":scope > .group-head");
		const title = group.querySelector(":scope > h2");
		const toggle = document.createElement("button");
		toggle.type = "button";
		toggle.className = "group-toggle";
		toggle.textContent = "Edit";

		toggle.addEventListener("click", () => {
			const collapsed = group.classList.toggle("collapsed");
			toggle.textContent = collapsed ? "Edit" : "Close";
		});

		if (head) {
			let actions = head.querySelector(".group-head-actions");
			if (!actions) {
				actions = document.createElement("div");
				actions.className = "group-head-actions";
				[...head.querySelectorAll("button")].forEach((btn) => actions.appendChild(btn));
				head.appendChild(actions);
			}
			actions.appendChild(toggle);
		} else if (title) {
			title.appendChild(toggle);
		}

		group.classList.add("collapsed");
	});
}

function addItem(section, values = {}) {
	const cfg = sections[section];
	const list = document.getElementById(cfg.listId);
	const tpl = document.getElementById(cfg.templateId).content.firstElementChild.cloneNode(true);

	tpl.querySelectorAll("input, textarea").forEach((el) => {
		if (el.type === "checkbox") {
			const fallback = el.defaultChecked;
			el.checked = toBoolean(values[el.name], fallback);
		} else {
			el.value = values[el.name] || "";
		}
		el.addEventListener("input", sync);
		el.addEventListener("change", sync);
	});

	tpl.querySelector(".remove").addEventListener("click", () => {
		tpl.remove();
		sync();
	});

	list.appendChild(tpl);
}

function collectList(section) {
	const cfg = sections[section];
	const list = document.getElementById(cfg.listId);
	return [...list.querySelectorAll(".item-card")]
		.map((card) => {
			const row = {};
			card.querySelectorAll("input, textarea").forEach((el) => {
				if (el.type === "checkbox") {
					row[el.name] = el.checked;
				} else {
					row[el.name] = el.value.trim();
				}
			});
			return row;
		})
		.filter(hasAny);
}

function sync() {
	const next = {};
	scalarFields.forEach((k) => {
		const el = getScalarElement(k);
		next[k] = el ? el.value.trim() : "";
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
	return `${sectionTitle(title)}<table><tr><td style="width:86%">${left || ""}</td><td style="width:14%">${linkify(right || "")}</td></tr></table>`;
}

function optionalSection(title, body) {
	return body ? `${sectionTitle(title)}${body}` : "";
}

function parseDateRank(text) {
	const raw = String(text || "").trim();
	if (!raw) return null;

	if (/(present|current|pursuing|ongoing)/i.test(raw)) {
		return 999912;
	}

	const months = {
		jan: 1,
		feb: 2,
		mar: 3,
		apr: 4,
		may: 5,
		jun: 6,
		jul: 7,
		aug: 8,
		sep: 9,
		sept: 9,
		oct: 10,
		nov: 11,
		dec: 12,
	};

	const ranks = [];
	const monthYearRegex =
		/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s\-']*(\d{2,4})\b/gi;
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
			rank: parseDateRank(item?.[dateKey]),
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
	preview.style.setProperty("--resume-scale", String(next));
	if (fontScaleValue) fontScaleValue.textContent = `${Math.round(next * 100)}%`;
}

function render() {
	applyFontScale(currentScaleValue());

	const educationSorted = sortByDateDesc(data.education, "year");
	const achievementsSorted = sortByDateDesc(data.achievements, "date");
	const workSorted = sortByDateDesc(data.work, "date");
	const internshipsSorted = sortByDateDesc(data.internships, "date");
	const projectsSorted = sortByDateDesc(data.projects, "date");
	const certificationsSorted = sortByDateDesc(data.certifications, "date");
	const porSorted = sortByDateDesc(data.por, "date");
	const extraSorted = sortByDateDesc(data.extra, "date");
	const coSorted = sortByDateDesc(data.co, "date");

	const eduRows = educationSorted
		.map(
			(r) => `
    <tr>
      <td>${linkify(r.year || "")}</td>
      <td>${linkify(r.degree || "")}</td>
      <td>${linkify(r.board || "")}</td>
      <td>${linkify(r.institute || "")}</td>
      <td>${linkify(r.score || "")}</td>
    </tr>
  `,
		)
		.join("");

	const expertiseRows = data.expertise
		.map((item) => String(item.text || "").trim())
		.filter(Boolean)
		.map((text) => `• ${linkify(text)}`)
		.join(" ");

	const achievementRows = achievementsSorted
		.map(
			(a) => `
    <tr>
      <td style="width:86%"><strong>• ${linkify(a.title || "")}</strong>${a.description ? `<br>${linkify(a.description)}` : ""}</td>
      <td style="width:14%">${linkify(a.date || "")}</td>
    </tr>
  `,
		)
		.join("");

	const workRows = workSorted
		.map(
			(w) => `
    <table><tr><td style="width:86%">${linkify(w.title || "")}</td><td style="width:14%">${linkify(w.date || "")}</td></tr></table>
    <div class="project-block" style="padding-top:3px">
      <div><strong>${linkify(w.role || "")}</strong></div>
      ${(w.highlights || "")
			.split("\n")
			.filter(Boolean)
			.map((line) => `<div>• ${linkify(line)}</div>`)
			.join("")}
    </div>
  `,
		)
		.join("");

	const internshipRows = internshipsSorted
		.map(
			(i) => `
    <div class="project-block">
      <div class="project-head"><span>${linkify(i.organization || "")}</span><span>${linkify(i.date || "")}</span></div>
      <div><strong>${linkify(i.role || "")}</strong></div>
      <div>${linkify(i.summary || "")}</div>
    </div>
  `,
		)
		.join("");

	const projectRows = projectsSorted
		.map(
			(p) => `
    <div class="project-block">
      <div class="project-head"><span>${linkify(p.type || "")}</span><span>${linkify(p.date || "")}</span></div>
      <div><strong>${linkify(p.name || "")}</strong></div>
      <div><strong>Summary:</strong> ${linkify(p.summary || "")}</div>
      <div><strong>Skills Used:</strong> ${linkify(p.skills || "")}</div>
      <div><strong>Team Size:</strong> ${linkify(p.teamSize || "")}</div>
      <div><strong>Key Outcomes:</strong> ${linkify(p.outcomes || "")}</div>
    </div>
  `,
		)
		.join("");

	const certificationRows = certificationsSorted
		.map(
			(c) => `
    <tr>
      <td style="width:38%"><strong>${linkify(c.name || "")}</strong></td>
      <td style="width:28%">${linkify(c.issuer || "")}</td>
      <td style="width:14%">${linkify(c.date || "")}</td>
      <td>${c.url ? (c.url.includes("[") ? linkify(c.url) : `<a href="${safe(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.url)}</a>`) : ""}</td>
    </tr>
  `,
		)
		.join("");

	const porRows = porSorted
		.map(
			(item) => `
    <tr>
      <td style="width:86%"><strong>${linkify(item.title || "")}</strong><br>${linkify(item.description || "")}</td>
      <td style="width:14%">${linkify(item.date || "")}</td>
    </tr>
  `,
		)
		.join("");

	const extraRows = extraSorted
		.map(
			(item) => `
    <tr>
      <td style="width:86%"><strong>${linkify(item.title || "")}</strong><br>${linkify(item.description || "")}</td>
      <td style="width:14%">${linkify(item.date || "")}</td>
    </tr>
  `,
		)
		.join("");

	const coRows = coSorted
		.map(
			(item) => `
    <tr>
      <td style="width:86%"><strong>${linkify(item.title || "")}</strong><br>${linkify(item.description || "")}</td>
      <td style="width:14%">${linkify(item.date || "")}</td>
    </tr>
  `,
		)
		.join("");

	const linkRows = data.links
		.map(
			(l) => `
    <tr>
      <td style="width:42%">${linkify(l.platform || "")}</td>
      <td><a href="${safe(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.url || "")}</a></td>
    </tr>
  `,
		)
		.join("");

	const techSkillRows = data.techSkills
		.map((item) => normalizeTechSkillItem(item))
		.map((item) => {
			const showCategory = toBoolean(item.show_techskills_category, true);
			const showItems = toBoolean(item.show_techskills_items, true);
			const category = showCategory ? escapeHtml(item.category || "") : "";
			const items = showItems ? linkify(item.items || "") : "";
			if (!category && !items) return "";
			if (category && items)
				return `<tr><td><strong>${category}:</strong> ${items}</td></tr>`;
			if (category) return `<tr><td><strong>${category}</strong></td></tr>`;
			return `<tr><td>${items}</td></tr>`;
		})
		.filter(Boolean)
		.join("");

	const personalRows = data.personal
		.map(
			(p) => `
    <tr>
      <td>
        Email: ${p.email ? `<a href="${mailto(p.email)}">${escapeHtml(p.email)}</a>` : ""}
        &nbsp;&nbsp; | &nbsp;&nbsp;
        Phone: ${p.phone ? `<a href="${tel(p.phone)}">${escapeHtml(p.phone)}</a>` : ""}
        &nbsp;&nbsp; | &nbsp;&nbsp;
        Location: ${linkify(p.location || "")}
      </td>
    </tr>
  `,
		)
		.join("");

	const hasLinkedinLogo = Boolean(data.linkedinUrl);
	const hasHeader = Boolean(data.fullName || data.tagline || hasLinkedinLogo);
	const hasEducation = educationSorted.length > 0;
	const hasExpertise = data.expertise.some((item) => String(item.text || "").trim());
	const hasAchievements = achievementsSorted.length > 0;
	const hasWork = workSorted.some((item) => hasAny(item));
	const hasInternships = internshipsSorted.length > 0;
	const hasProjects = projectsSorted.length > 0;
	const hasCertifications = certificationsSorted.length > 0;
	const hasPor = porSorted.length > 0;
	const hasExtra = extraSorted.length > 0;
	const hasCo = coSorted.length > 0;
	const hasSkills = Boolean(techSkillRows);
	const hasLinks = data.links.length > 0;
	const hasPersonal = data.personal.some((item) => hasAny(item));

	const v = { ...visibilityDefaults, ...(data.sectionVisibility || {}) };

	preview.innerHTML = `
    ${
		v.header && hasHeader
			? `
      <div class="header-link-row">
        <h1 class="name-row"><span>${escapeHtml(data.fullName || "")}</span></h1>
        ${
			v.linkedinLogo && hasLinkedinLogo
				? `
          <a class="linkedin-logo-link" href="${safe(data.linkedinUrl)}" target="_blank" rel="noopener" aria-label="LinkedIn profile">
            <img src="./linkedin-logo.jpg" alt="LinkedIn Logo" />
          </a>
        `
				: ""
		}
      </div>
      <p class="tagline">${linkify(data.tagline || "")}</p>
    `
			: ""
	}

    ${
		v.education && hasEducation
			? `
      ${sectionTitle("Education")}
      <table>
        <tr>
          <th style="width:12%">Year</th>
          <th style="width:30%">Degree</th>
          <th style="width:19%">University/Board</th>
          <th style="width:27%">Institute</th>
          <th style="width:12%">% / CGPA</th>
        </tr>
        ${eduRows}
      </table>
    `
			: ""
	}

    ${
		v.expertise && hasExpertise
			? `
      ${sectionTitle("Expertise/Area of Interest")}
      <p class="bullet">${expertiseRows}</p>
    `
			: ""
	}

    ${v.achievements ? optionalSection("Achievements and Accomplishments", hasAchievements ? `<table class="no-inner-border">${achievementRows}</table>` : "") : ""}

    ${
		v.work && hasWork
			? `
      ${sectionTitle("Work Experience")}
      ${workRows}
    `
			: ""
	}

    ${v.internships ? optionalSection("Internships", hasInternships ? internshipRows : "") : ""}
    ${v.projects ? optionalSection("Projects", hasProjects ? projectRows : "") : ""}
    ${v.certifications ? optionalSection("Certifications", hasCertifications ? `<table>${certificationRows}</table>` : "") : ""}

    ${v.por && hasPor ? optionalSection("Positions of Responsibility", `<table>${porRows}</table>`) : ""}
    ${v.extra && hasExtra ? optionalSection("Extra Curricular Activities", `<table>${extraRows}</table>`) : ""}
    ${v.co && hasCo ? optionalSection("Co-Curricular Activities", `<table>${coRows}</table>`) : ""}

    ${
		v.skills && hasSkills
			? `
      ${sectionTitle("Technical Skills")}
      <table>${techSkillRows}</table>
    `
			: ""
	}

    ${
		v.links && hasLinks
			? `
      ${sectionTitle("Online Professional Presence")}
      <table class="links">${linkRows}</table>
    `
			: ""
	}

    ${
		v.personal && hasPersonal
			? `
      ${sectionTitle("Personal Details")}
      <table>${personalRows}</table>
    `
			: ""
	}

    <div class="page-break-marker" aria-hidden="true"></div>
  `;
}

function load(payload) {
	data = { ...structuredClone(defaults), ...payload };
	data.sectionVisibility = {
		...visibilityDefaults,
		...(payload?.sectionVisibility || {}),
	};

	if (
		(!Array.isArray(payload?.expertise) || payload.expertise.length === 0) &&
		String(payload?.expertise || "").trim()
	) {
		data.expertise = [{ text: payload.expertise }];
	}
	if (
		(!Array.isArray(payload?.work) || payload.work.length === 0) &&
		hasAny({
			title: payload?.workTitle,
			date: payload?.workDate,
			role: payload?.workRole,
			highlights: payload?.workHighlights,
		})
	) {
		data.work = [
			{
				title: payload.workTitle || "",
				date: payload.workDate || "",
				role: payload.workRole || "",
				highlights: payload.workHighlights || "",
			},
		];
	}
	if (
		(!Array.isArray(payload?.techSkills) || payload.techSkills.length === 0) &&
		String(payload?.skills || "").trim()
	) {
		data.techSkills = [{ text: payload.skills }];
	}
	data.techSkills = (Array.isArray(data.techSkills) ? data.techSkills : [])
		.map((row) => normalizeTechSkillItem(row))
		.filter((row) => hasAny(row));
	if (
		(!Array.isArray(payload?.personal) || payload.personal.length === 0) &&
		hasAny({
			email: payload?.personalEmail,
			phone: payload?.personalPhone,
			location: payload?.personalLocation,
		})
	) {
		data.personal = [
			{
				email: payload.personalEmail || "",
				phone: payload.personalPhone || "",
				location: payload.personalLocation || "",
			},
		];
	}

	const legacyPor = hasAny({
		title: payload?.porTitle,
		date: payload?.porDate,
		description: payload?.porDescription,
	});
	const legacyExtra = hasAny({
		title: payload?.extraTitle,
		date: payload?.extraDate,
		description: payload?.extraDescription,
	});
	const legacyCo = hasAny({
		title: payload?.coTitle,
		date: payload?.coDate,
		description: payload?.coDescription,
	});

	if ((!Array.isArray(payload?.por) || payload.por.length === 0) && legacyPor) {
		data.por = [
			{
				title: payload.porTitle || "",
				date: payload.porDate || "",
				description: payload.porDescription || "",
			},
		];
	}
	if ((!Array.isArray(payload?.extra) || payload.extra.length === 0) && legacyExtra) {
		data.extra = [
			{
				title: payload.extraTitle || "",
				date: payload.extraDate || "",
				description: payload.extraDescription || "",
			},
		];
	}
	if ((!Array.isArray(payload?.co) || payload.co.length === 0) && legacyCo) {
		data.co = [
			{
				title: payload.coTitle || "",
				date: payload.coDate || "",
				description: payload.coDescription || "",
			},
		];
	}

	scalarFields.forEach((k) => {
		const el = getScalarElement(k);
		if (el) el.value = data[k] || "";
	});

	applyVisibilityToForm(data.sectionVisibility);

	Object.keys(sections).forEach((name) => {
		const list = document.getElementById(sections[name].listId);
		list.innerHTML = "";
		(data[name] || []).forEach((row) => addItem(name, row));
	});

	render();
}

Object.keys(sections).forEach((name) => {
	const btn = document.querySelector(`[data-add="${name}"]`);
	btn.addEventListener("click", () => {
		addItem(name, {});
		sync();
	});
});

// ═══════════════════════════════════════════════════════════════
// IMPORT RESUME — modal controls
// ═══════════════════════════════════════════════════════════════

const importModal = document.getElementById("importModal");
const openImportBtnTop = document.getElementById("openImportBtn");
const importResumeBtn = document.getElementById("importResumeBtn");
const closeImportBtn = document.getElementById("closeImportBtn");
const closeImportBtn2 = document.getElementById("closeImportBtn2");
const runImportBtn = document.getElementById("runImportBtn");
const importTextarea = document.getElementById("importTextarea");
const importPdfFile = document.getElementById("importPdfFile");
const pdfFileName = document.getElementById("pdfFileName");
const importStatusEl = document.getElementById("importStatus");
const tabPaste = document.getElementById("tabPaste");
const tabPdf = document.getElementById("tabPdf");
const panePaste = document.getElementById("panePaste");
const panePdf = document.getElementById("panePdf");
const aiApiKeyEl = document.getElementById("aiApiKey");
const aiEndpointEl = document.getElementById("aiEndpoint");
const aiModelEl = document.getElementById("aiModel");

function openImportModal() {
	if (!importModal) return;
	importModal.inert = false;
	importModal.classList.add("open");
	importModal.setAttribute("aria-hidden", "false");
	setImportStatus("", "");
}

function closeImportModal() {
	if (!importModal) return;
	importModal.classList.remove("open");
	importModal.setAttribute("aria-hidden", "true");
	importModal.inert = true;
}

function setImportStatus(type, message) {
	if (!importStatusEl) return;
	if (!type || !message) {
		importStatusEl.hidden = true;
		importStatusEl.className = "import-status";
		importStatusEl.innerHTML = "";
		return;
	}
	importStatusEl.hidden = false;
	importStatusEl.className = `import-status ${type}`;
	if (type === "loading") {
		importStatusEl.innerHTML = `<div class="import-spinner"></div><span>${message}</span>`;
	} else {
		importStatusEl.textContent = message;
	}
}

// Tab switching
function switchImportTab(tab) {
	if (tab === "paste") {
		tabPaste.classList.add("active");
		tabPdf.classList.remove("active");
		tabPaste.setAttribute("aria-selected", "true");
		tabPdf.setAttribute("aria-selected", "false");
		panePaste.hidden = false;
		panePdf.hidden = true;
	} else {
		tabPdf.classList.add("active");
		tabPaste.classList.remove("active");
		tabPdf.setAttribute("aria-selected", "true");
		tabPaste.setAttribute("aria-selected", "false");
		panePdf.hidden = false;
		panePaste.hidden = true;
	}
}

tabPaste?.addEventListener("click", () => switchImportTab("paste"));
tabPdf?.addEventListener("click", () => switchImportTab("pdf"));

openImportBtnTop?.addEventListener("click", openImportModal);
importResumeBtn?.addEventListener("click", openImportModal);
closeImportBtn?.addEventListener("click", closeImportModal);
closeImportBtn2?.addEventListener("click", closeImportModal);
importModal?.addEventListener("click", (e) => {
	if (e.target === importModal) closeImportModal();
});
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && importModal?.classList.contains("open")) closeImportModal();
});

// PDF file name display
importPdfFile?.addEventListener("change", () => {
	const file = importPdfFile.files?.[0];
	if (pdfFileName) pdfFileName.textContent = file ? file.name : "No file selected.";
	setImportStatus("", "");
});

// ═══════════════════════════════════════════════════════════════
// PDF TEXT EXTRACTION  (pdf.js UMD — loaded via script tag)
// ═══════════════════════════════════════════════════════════════

async function extractTextFromPdf(file) {
	return new Promise((resolve, reject) => {
		// pdf.js may not be loaded yet; retry briefly
		const attempt = (tries) => {
			if (window.pdfjsLib) {
				doExtract();
			} else if (tries > 0) {
				setTimeout(() => attempt(tries - 1), 300);
			} else {
				reject(new Error('pdf.js library not loaded. Try the "Paste Text" tab instead.'));
			}
		};

		const doExtract = async () => {
			try {
				const arrayBuffer = await file.arrayBuffer();
				const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
				const pageTexts = [];
				for (let i = 1; i <= pdf.numPages; i++) {
					const page = await pdf.getPage(i);
					const content = await page.getTextContent();
					// Reconstruct lines: group items by approximate Y position
					const lines = {};
					for (const item of content.items) {
						if (!item.str) continue;
						const y = Math.round(item.transform[5]);
						if (!lines[y]) lines[y] = [];
						lines[y].push(item.str);
					}
					const sortedYs = Object.keys(lines)
						.map(Number)
						.sort((a, b) => b - a);
					pageTexts.push(sortedYs.map((y) => lines[y].join(" ")).join("\n"));
				}
				resolve(pageTexts.join("\n\n"));
			} catch (err) {
				reject(err);
			}
		};

		attempt(10);
	});
}

// ═══════════════════════════════════════════════════════════════
// HEURISTIC RESUME PARSER
// Converts free-form resume text → Auris data object
// ═══════════════════════════════════════════════════════════════

/**
 * Split text into labelled sections based on common resume section headers.
 * Returns { sectionName: rawText, ... }
 */
function splitIntoSections(text) {
	// All known section header patterns mapped to canonical keys
	const HEADER_MAP = [
		{
			key: "header",
			re: /^(contact\s*info(rmation)?|personal\s*info(rmation)?|about\s*me|profile|summary|objective|career\s*objective|professional\s*summary)$/i,
		},
		{
			key: "education",
			re: /^(education|academic\s*background|academic\s*qualifications?|qualifications?)$/i,
		},
		{
			key: "work",
			re: /^(work\s*experience|professional\s*experience|employment\s*history|experience|career\s*history|work\s*history|full[\s-]time|professional\s*background)$/i,
		},
		{
			key: "internships",
			re: /^(internships?|trainings?|apprenticeships?|work\s*placement)$/i,
		},
		{
			key: "projects",
			re: /^(projects?|personal\s*projects?|academic\s*projects?|key\s*projects?|notable\s*projects?)$/i,
		},
		{
			key: "skills",
			re: /^(skills?|technical\s*skills?|core\s*competenc(y|ies)|technologies|tech\s*stack|tools?\s*&?\s*technologies?|programming\s*languages?)$/i,
		},
		{
			key: "achievements",
			re: /^(achievements?|accomplishments?|honours?|honors?|awards?|recognitions?|awards?\s*&\s*honours?)$/i,
		},
		{
			key: "certifications",
			re: /^(certifications?|licenses?\s*&?\s*certifications?|professional\s*certifications?|credentials?)$/i,
		},
		{
			key: "por",
			re: /^(positions?\s*of\s*responsibility|leadership|leadership\s*roles?|volunteer(ing)?|volunteering?\s*experience|extracurricular\s*leadership)$/i,
		},
		{
			key: "extra",
			re: /^(extra[\s-]?curricular|activities|hobbies|interests|clubs?\s*&\s*activities|sports?)$/i,
		},
		{
			key: "co",
			re: /^(co[\s-]?curricular|competitions?|hackathons?|contests?)$/i,
		},
		{
			key: "links",
			re: /^(online\s*presence|profiles?|social\s*media|links?|websites?|portfolio)$/i,
		},
		{
			key: "expertise",
			re: /^(expertise|area[s]?\s*of\s*interest|specializations?|domains?)$/i,
		},
		{
			key: "publications",
			re: /^(publications?|research|papers?|articles?)$/i,
		},
	];

	const lines = text.split("\n");
	const result = {};
	let currentKey = "header";
	let buffer = [];

	const flush = () => {
		if (buffer.length) {
			result[currentKey] =
				(result[currentKey] ? result[currentKey] + "\n" : "") + buffer.join("\n");
		}
		buffer = [];
	};

	const isSectionHeader = (line) => {
		const trimmed = line.trim();
		if (!trimmed) return null;
		// Must be short enough to be a header (not a sentence)
		if (trimmed.length > 60) return null;
		// All-caps line is almost certainly a header
		const allCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
		// Check against known patterns
		const stripped = trimmed.replace(/[:\-–—|•*_#]+$/g, "").trim();
		for (const { key, re } of HEADER_MAP) {
			if (re.test(stripped)) return key;
		}
		// Heuristic: short all-caps line we don't recognise → treat as unknown section
		if (allCaps && trimmed.length <= 40) return `__unknown__${trimmed}`;
		return null;
	};

	for (const line of lines) {
		const key = isSectionHeader(line);
		if (key) {
			flush();
			currentKey = key;
		} else {
			buffer.push(line);
		}
	}
	flush();

	return result;
}

/** Extract email, phone, location from any blob of text */
function extractContactInfo(text) {
	const emailMatch = text.match(/[\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,}/);
	// Phone: must start with + or digit, allow spaces/dashes/dots/parens, min 7 digits
	const phoneMatch = text.match(/(\+?[\d][\d\s\-().]{5,}[\d])/);
	const linkedinMatch = text.match(/linkedin\.com\/in\/[\w\-]+\/?/i);
	const githubMatch = text.match(/github\.com\/[\w\-]+\/?/i);

	// Location: look for explicit "Location:" label first
	let location = "";
	const labelMatch = text.match(/location\s*[:\-]\s*([^\n|,]{3,40})/i);
	if (labelMatch) {
		location = labelMatch[1].trim();
	} else {
		// Fallback: "City, State" or "City, Country" — must not be a person name
		// Require the second part to be a known state/country abbreviation or word ≥ 3 chars
		const cityMatch = text.match(
			/\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?),\s*([A-Z][a-zA-Z]{2,})\b/,
		);
		if (cityMatch) {
			// Reject if it looks like a person's name (two capitalised words with no comma context)
			const candidate = cityMatch[0];
			// Only accept if it comes after common location indicators or standalone on a line
			const lines = text.split("\n");
			for (const line of lines) {
				const trimmed = line.trim();
				if (
					trimmed === candidate ||
					/^(location|address|city|based\s*in)\s*[:\-]/i.test(trimmed)
				) {
					location = candidate;
					break;
				}
			}
		}
	}

	// Validate phone — must have at least 7 digits
	let phone = "";
	if (phoneMatch) {
		const digits = (phoneMatch[1].match(/\d/g) || []).length;
		if (digits >= 7) phone = phoneMatch[1].trim();
	}

	return {
		email: emailMatch ? emailMatch[0] : "",
		phone,
		linkedin: linkedinMatch ? `https://${linkedinMatch[0]}` : "",
		github: githubMatch ? `https://${githubMatch[0]}` : "",
		location,
	};
}

/** Extract the candidate's name from the top of the resume */
function extractName(headerText) {
	const lines = headerText
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	for (const line of lines.slice(0, 6)) {
		// Skip lines that look like contact details, URLs, or known section headers
		if (/[@\d()+]/.test(line)) continue;
		if (/^(resume|curriculum\s*vitae|cv|profile|summary|objective)$/i.test(line)) continue;
		if (/^https?:\/\//i.test(line)) continue;
		// Must be 1–5 words, only letters/spaces/dots/hyphens/apostrophes, 2–50 chars
		const words = line.split(/\s+/);
		if (words.length >= 1 && words.length <= 5 && line.length >= 2 && line.length <= 50) {
			if (/^[A-Za-z][A-Za-z\s.\-']+$/.test(line)) return line;
		}
	}
	return "";
}

/** Extract a professional tagline / summary */
function extractTagline(headerText) {
	const lines = headerText
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	// Skip the first line (name) and find the first descriptive sentence
	let skippedName = false;
	for (const line of lines) {
		// Skip very short lines (likely name or label)
		if (line.length < 15) {
			skippedName = true;
			continue;
		}
		// Skip contact-info-looking lines
		if (/[@|]/.test(line)) continue;
		if (/^https?:\/\//i.test(line)) continue;
		// Skip lines that are just a job title (≤ 4 words, no lowercase connectives)
		const words = line.split(/\s+/);
		if (!skippedName && words.length <= 3) {
			skippedName = true;
			continue;
		}
		skippedName = true;
		// This is a descriptive line — use it as tagline, cap at 160 chars
		return line.length > 160 ? line.substring(0, 157) + "..." : line;
	}
	return "";
}

/**
 * Parse a date range string like "Jan 2021 – Mar 2023", "2020 - Present", etc.
 * Returns the original string normalised.
 */
function normaliseDate(raw) {
	if (!raw) return "";
	return raw
		.trim()
		.replace(/–|—/g, "-")
		.replace(/\s*-\s*/g, " - ")
		.replace(/\s+/g, " ");
}

/**
 * Attempt to split a block of text into individual entries.
 * Entries are delimited by blank lines, or by lines that look like titles/dates.
 */
function splitEntries(text) {
	// Split on 2+ consecutive blank lines first, then on single blank lines
	const blocks = text
		.split(/\n{2,}/)
		.map((b) => b.trim())
		.filter(Boolean);
	return blocks;
}

/** Try to extract a date range or single date from a line. Returns the match string or "". */
function extractDateFromLine(line) {
	const patterns = [
		// "Jan 2020 - Mar 2021" / "January 2020 – Present" / "Jul'25-Aug'25"
		/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?[''\s]*\d{2,4}\s*[-–—]+\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?[''\s]*\d{2,4}|present|current|now|ongoing|pursuing)/gi,
		// "2020 - 2022" / "2021 - Present"
		/\b(19|20)\d{2}\s*[-–—]+\s*((19|20)\d{2}|present|current|ongoing|pursuing)\b/gi,
		// "'20 - '22" / "'23 - Present"
		/''\d{2}\s*[-–—]+\s*(''\d{2}|present|current)/gi,
		// Single "Oct'24" or "Oct 2024" or "Oct'24"
		/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?[''\s]\d{2,4}\b/gi,
		// Single year "2023"
		/\b(19|20)\d{2}\b/g,
	];
	for (const re of patterns) {
		const m = line.match(re);
		if (m) return normaliseDate(m[0]);
	}
	return "";
}

/**
 * Given a line that contains a date, strip the date out and return the remainder.
 * Useful for lines like "Tata Chemicals  Jul'25-Aug'25"
 */
function stripDateFromLine(line) {
	return line
		.replace(
			/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?[''\s]*\d{2,4}\s*[-–—]*\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?[''\s]*\d{2,4}|present|current|ongoing|pursuing)?\b/gi,
			"",
		)
		.replace(/\b(19|20)\d{2}\s*[-–—]*\s*((19|20)\d{2}|present|current|ongoing)?\b/gi, "")
		.replace(/[''\d]{2,6}\s*[-–—]+\s*([''\d]{2,6}|present)/gi, "")
		.replace(/[-–—|,\s]+$/, "")
		.replace(/^\s*[-–—|,]+/, "")
		.trim();
}

/** Parse education section text into Auris education entries */
function parseEducation(text) {
	const entries = splitEntries(text);
	return entries
		.map((block) => {
			const lines = block
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			let year = "",
				degree = "",
				board = "",
				institute = "",
				score = "";

			for (const line of lines) {
				// Score/CGPA: a numeric value, possibly followed by /4.0 or %
				if (
					/\b(\d+\.?\d*)\s*(\/\s*\d+\.?\d*|%|cgpa|gpa|percentage)\b/i.test(line) ||
					/\bcgpa\b.*\d/i.test(line)
				) {
					if (!score) {
						const scoreMatch = line.match(/\d+\.?\d*\s*(\/\s*\d+\.?\d*|%)?/);
						if (scoreMatch) score = scoreMatch[0].trim();
					}
					// Don't skip — the line may also contain a year or degree
				}

				// Date/year for the year column
				const d = extractDateFromLine(line);
				if (d && !year) {
					year = d;
					// If the line is ONLY a date (nothing else meaningful), skip to next
					const rest = stripDateFromLine(line);
					if (!rest) continue;
				}

				// Degree keywords — match common Indian + global degree names
				if (
					/\b(b\.?\s*tech|m\.?\s*tech|b\.?\s*e\.?|m\.?\s*e\.?|b\.?\s*sc\.?|m\.?\s*sc\.?|b\.?\s*a\.?|m\.?\s*a\.?|ph\.?\s*d|bachelor|master|diploma|hsc|ssc|12th|10th|high\s*school|secondary|senior\s*secondary|intermediate|associate|b\.?\s*com|m\.?\s*com|mba|bca|mca)\b/i.test(
						line,
					)
				) {
					if (!degree) {
						degree = line;
						continue;
					}
				}

				// Board keywords (CBSE, ICSE, etc.)
				if (/\b(cbse|icse|igcse|state\s*board|matriculation)\b/i.test(line)) {
					if (!board) {
						board = line;
						continue;
					}
				}

				// University/Institute keywords
				if (
					/\b(university|univeristy|institute|college|iit|nit|bits|vit|mit|school|academy|polytechnic)\b/i.test(
						line,
					)
				) {
					if (!institute) {
						institute = line;
						continue;
					} else if (!board) {
						board = institute;
						institute = line;
						continue;
					}
				}

				// Fallback: assign remaining lines in order
				if (!degree) degree = line;
				else if (!institute) institute = line;
				else if (!board) board = line;
			}

			return { year, degree, board, institute, score };
		})
		.filter((e) => e.degree || e.institute || e.year);
}

/** Parse work / internship blocks into structured entries */
function parseWorkBlocks(text, isInternship = false) {
	const entries = splitEntries(text);
	return entries
		.map((block) => {
			const lines = block
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			let title = "",
				date = "",
				role = "",
				highlights = [];

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];

				// Bullet points → highlights/summary lines
				if (/^[•\-*▪▸➤>]/.test(line)) {
					const cleaned = line.replace(/^[•\-*▪▸➤>\s]+/, "");
					if (cleaned) highlights.push(cleaned);
					continue;
				}

				// Lines that contain BOTH an org/role name AND a date (common format: "Tata Chemicals   Jul'25-Aug'25")
				const d = extractDateFromLine(line);
				if (d) {
					if (!date) date = d;
					const rest = stripDateFromLine(line);
					if (rest) {
						// Decide: is this rest the org name or the role?
						if (!title) {
							title = rest;
							continue;
						}
						if (!role) {
							role = rest;
							continue;
						}
					}
					continue;
				}

				// Role/position keywords  → assign as role
				if (
					/\b(engineer|developer|designer|analyst|manager|intern|lead|architect|scientist|consultant|associate|specialist|coordinator|director|officer|head|vp|president|founder|co-?founder|executive|researcher|trainee)\b/i.test(
						line,
					)
				) {
					if (!role) {
						role = line;
						continue;
					}
				}

				// First two un-assigned non-bullet lines: org name then role
				if (!title) {
					title = line;
					continue;
				}
				if (!role) {
					role = line;
					continue;
				}

				// Everything else is a highlight/summary line
				highlights.push(line);
			}

			if (isInternship) {
				return {
					organization: title,
					date,
					role,
					summary: highlights.join(" "),
				};
			}
			return { title, date, role, highlights: highlights.join("\n") };
		})
		.filter((e) => (isInternship ? e.organization : e.title) || e.role || e.date);
}

/** Parse project entries */
function parseProjects(text) {
	const entries = splitEntries(text);
	return entries
		.map((block) => {
			const lines = block
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			let name = "",
				date = "",
				type = "",
				summary = "",
				skills = "",
				teamSize = "",
				outcomeLines = [];

			for (const line of lines) {
				// Explicit labeled fields first (e.g. "Summary: ...", "Skills Used: ...")
				if (/^summary\s*:/i.test(line)) {
					summary = line.replace(/^summary\s*:\s*/i, "").trim();
					continue;
				}
				if (
					/^(skills\s*used|tech(?:nologies)?(?:\s*stack)?|tools|built\s*with|stack)\s*:/i.test(
						line,
					)
				) {
					skills = line.replace(/^.*?:\s*/i, "").trim();
					continue;
				}
				if (/^(team\s*size|team)\s*:/i.test(line)) {
					teamSize = line.replace(/^.*?:\s*/i, "").trim();
					continue;
				}
				if (/^(key\s*outcomes?|outcomes?|results?|impact)\s*:/i.test(line)) {
					outcomeLines.push(line.replace(/^.*?:\s*/i, "").trim());
					continue;
				}

				// Bullet points → outcomes
				if (/^[•\-*▪▸➤>]/.test(line)) {
					outcomeLines.push(line.replace(/^[•\-*▪▸➤>\s]+/, ""));
					continue;
				}

				// Date extraction — may appear on the name line e.g. "TeamSync | Jun'25 - Jul'25"
				const d = extractDateFromLine(line);
				if (d) {
					if (!date) date = d;
					const rest = stripDateFromLine(line)
						.replace(/[|\[\]]/g, "")
						.trim();
					// The rest might be the project name or type
					if (rest && !name) {
						name = rest;
						continue;
					}
					if (rest && !type) {
						type = rest;
						continue;
					}
					continue;
				}

				// Lines with pipe separator: "TeamSync | Go, PostgreSQL, Redis"
				if (/\|/.test(line)) {
					const parts = line
						.split("|")
						.map((p) => p.trim())
						.filter(Boolean);
					if (!name && parts[0]) name = parts[0];
					if (parts[1] && !skills) skills = parts[1];
					continue;
				}

				// github.com URL → treat as a link in outcomes
				if (/github\.com\//i.test(line)) {
					outcomeLines.push(line);
					continue;
				}

				// First unassigned line = project name, second = type/category
				if (!name) {
					name = line;
					continue;
				}
				if (!type) {
					type = line;
					continue;
				}
				if (!summary) {
					summary = line;
					continue;
				}
				// Remaining lines spill into outcomes
				outcomeLines.push(line);
			}

			return {
				type,
				date,
				name,
				summary,
				skills,
				teamSize,
				outcomes: outcomeLines.join("\n"),
			};
		})
		.filter((e) => e.name);
}

/** Parse skills section into Auris techSkills entries (category + items). */
function parseSkills(text) {
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	const result = [];

	for (const line of lines) {
		// Strip leading bullet markers
		const cleaned = line.replace(/^[•\-*▪▸➤>\s]+/, "").trim();
		if (!cleaned) continue;
		// Skip lines that are just a section header repeated
		if (/^(technical\s*skills?|skills?|technologies)$/i.test(cleaned)) continue;
		const { category, items } = splitTechSkillLine(cleaned);
		result.push({
			category,
			items,
			show_techskills_category: Boolean(category),
			show_techskills_items: Boolean(items),
		});
	}

	// If we got one unlabeled blob split by | or ;, break into separate rows.
	if (result.length === 1 && !result[0].category && /[|;]/.test(result[0].items || "")) {
		return result[0].items
			.split(/[|;]/)
			.map((s) => normalizeTechSkillItem({ items: s.trim() }))
			.filter((row) => hasAny(row));
	}

	return result;
}

/** Parse achievements / por / extra / co entries */
function parseGenericEntries(text) {
	const entries = splitEntries(text);
	return entries
		.map((block) => {
			const lines = block
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			let title = "",
				date = "";
			const descLines = [];

			for (const line of lines) {
				// Bullet → description
				if (/^[•\-*▪▸➤>]/.test(line)) {
					descLines.push(line.replace(/^[•\-*▪▸➤>\s]+/, ""));
					continue;
				}

				const d = extractDateFromLine(line);
				if (d) {
					if (!date) date = d;
					const rest = stripDateFromLine(line);
					// If the rest is meaningful and title not yet set, use it as title
					if (rest && !title) {
						title = rest;
						continue;
					}
					// If title already set, rest goes to description
					if (rest) descLines.push(rest);
					continue;
				}

				if (!title) {
					title = line;
					continue;
				}
				descLines.push(line);
			}

			return { title, date, description: descLines.join("\n") };
		})
		.filter((e) => e.title || e.description);
}

/** Parse certifications */
function parseCertifications(text) {
	const entries = splitEntries(text);
	return entries
		.map((block) => {
			const lines = block
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			let name = "",
				issuer = "",
				date = "",
				url = "";

			for (const line of lines) {
				// URL
				if (/^https?:\/\//i.test(line)) {
					url = line;
					continue;
				}

				// Date
				const d = extractDateFromLine(line);
				if (d) {
					if (!date) date = d;
					const rest = stripDateFromLine(line);
					if (rest && !name) {
						name = rest;
						continue;
					}
					if (rest && !issuer) {
						issuer = rest;
						continue;
					}
					continue;
				}

				// Known issuer platforms
				if (
					/\b(coursera|udemy|edx|google|aws|amazon|microsoft|oracle|cisco|comptia|pmi|pmbok|linkedin\s*learning|pluralsight|udacity|nptel|infosys|ibm|meta|nvidia)\b/i.test(
						line,
					)
				) {
					if (!issuer) {
						issuer = line;
						continue;
					}
				}

				if (!name) {
					name = line;
					continue;
				}
				if (!issuer) {
					issuer = line;
					continue;
				}
			}

			return { name, issuer, date, url };
		})
		.filter((e) => e.name);
}

/** Infer a platform name from a URL */
function inferPlatform(url, lineContext) {
	if (/github\.com/i.test(url)) return "GitHub";
	if (/linkedin\.com/i.test(url)) return "LinkedIn";
	if (/leetcode\.com/i.test(url)) return "LeetCode";
	if (/hackerrank\.com/i.test(url)) return "HackerRank";
	if (/codeforces\.com/i.test(url)) return "Codeforces";
	if (/codechef\.com/i.test(url)) return "CodeChef";
	if (/geeksforgeeks\.org/i.test(url)) return "GeeksForGeeks";
	if (/stackoverflow\.com/i.test(url)) return "Stack Overflow";
	if (/kaggle\.com/i.test(url)) return "Kaggle";
	if (/portfolio|personal/i.test(lineContext)) return "Portfolio";
	// Extract the domain name as a fallback
	const domainMatch = url.match(/^https?:\/\/(?:www\.)?([^\/]+)/i);
	return domainMatch ? domainMatch[1] : "Website";
}

/** Parse online links (GitHub, portfolio, etc.) */
function parseLinks(text) {
	const results = [];
	const urlRe = /(https?:\/\/[^\s,)\]>]+)/gi;
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

	for (const line of lines) {
		// Reset lastIndex for global regex
		urlRe.lastIndex = 0;
		let urlMatch;
		while ((urlMatch = urlRe.exec(line)) !== null) {
			const url = urlMatch[1].replace(/[.,;)]+$/, ""); // strip trailing punctuation
			// Infer platform from explicit label on the line or from the URL itself
			const label = line
				.replace(urlMatch[1], "")
				.replace(/[:\-|[\]()]/g, "")
				.trim();
			const platform = label || inferPlatform(url, line);
			results.push({ platform, url });
		}
	}

	return results;
}

/**
 * Master heuristic parser — takes raw resume text, returns Auris data object.
 */
function heuristicParse(rawText) {
	const sections = splitIntoSections(rawText);

	const headerText = sections.header || rawText.split("\n").slice(0, 15).join("\n");
	const contactInfo = extractContactInfo(rawText); // scan whole doc for contact

	const fullName = extractName(headerText) || "";
	const tagline = extractTagline(headerText) || "";

	// Education
	const education = parseEducation(sections.education || "");

	// Work — if "internship" keyword appears in work section, split
	const workRaw = sections.work || "";
	const internRaw = sections.internships || "";
	const work = parseWorkBlocks(workRaw, false);
	const internships = parseWorkBlocks(internRaw, true);

	// Projects
	const projects = parseProjects(sections.projects || "");

	// Skills
	const techSkills = parseSkills(sections.skills || "");

	// Achievements
	const rawAch = sections.achievements || "";
	const achievements = parseGenericEntries(rawAch).map((e) => ({
		title: e.title,
		date: e.date,
		description: e.description,
	}));

	// Certifications
	const certifications = parseCertifications(sections.certifications || "");

	// POR
	const por = parseGenericEntries(sections.por || "").map((e) => ({
		title: e.title,
		date: e.date,
		description: e.description,
	}));

	// Extra curricular
	const extra = parseGenericEntries(sections.extra || "").map((e) => ({
		title: e.title,
		date: e.date,
		description: e.description,
	}));

	// Co-curricular
	const co = parseGenericEntries(sections.co || "").map((e) => ({
		title: e.title,
		date: e.date,
		description: e.description,
	}));

	// Expertise (may also come from summary keywords)
	let expertiseArr = [];
	if (sections.expertise) {
		expertiseArr = sections.expertise
			.split("\n")
			.map((l) => l.replace(/^[•\-*▪▸➤>\s]+/, "").trim())
			.filter(Boolean)
			.map((text) => ({ text }));
	}

	// Online links — scan across the whole doc for URLs & known platforms
	const links = parseLinks(sections.links || rawText);
	// De-dup
	const seenUrls = new Set();
	const uniqueLinks = links.filter((l) => {
		if (!l.url || seenUrls.has(l.url)) return false;
		seenUrls.add(l.url);
		return true;
	});

	// LinkedIn URL — pull out for the header field
	const linkedinEntry = uniqueLinks.find((l) => /linkedin\.com/i.test(l.url));
	const linkedinUrl = contactInfo.linkedin || linkedinEntry?.url || "";
	// Remove LinkedIn from the links table to avoid duplication if it's used as logo
	const linksFiltered = uniqueLinks.filter((l) => !/linkedin\.com/i.test(l.url));

	// Personal details
	const personal =
		contactInfo.email || contactInfo.phone || contactInfo.location
			? [
					{
						email: contactInfo.email,
						phone: contactInfo.phone,
						location: contactInfo.location,
					},
				]
			: [];

	return {
		fullName,
		tagline,
		linkedinUrl,
		education,
		work,
		internships,
		projects,
		techSkills,
		achievements,
		certifications,
		por,
		extra,
		co,
		expertise: expertiseArr,
		links: linksFiltered,
		personal,
	};
}

// ═══════════════════════════════════════════════════════════════
// AI-ASSISTED PARSER  (OpenAI-compatible Chat Completions API)
// ═══════════════════════════════════════════════════════════════

const AI_SYSTEM_PROMPT = `You are a resume parser. Extract information from the provided resume text and return ONLY a valid JSON object with no markdown fences, no extra commentary.

The JSON must match this exact schema (all fields optional, use empty arrays [] for missing list fields, empty strings "" for missing string fields):

{
  "fullName": "string",
  "tagline": "string — professional headline or summary (1-2 sentences max)",
  "linkedinUrl": "string",
  "education": [{ "year": "string", "degree": "string", "board": "string", "institute": "string", "score": "string" }],
  "work": [{ "title": "string — company/org name", "date": "string", "role": "string", "highlights": "string — bullet points joined by newline" }],
  "internships": [{ "organization": "string", "date": "string", "role": "string", "summary": "string" }],
  "projects": [{ "type": "string — category", "date": "string", "name": "string", "summary": "string", "skills": "string", "teamSize": "string", "outcomes": "string" }],
  "achievements": [{ "title": "string", "date": "string", "description": "string" }],
  "certifications": [{ "name": "string", "issuer": "string", "date": "string", "url": "string" }],
  "por": [{ "title": "string", "date": "string", "description": "string" }],
  "extra": [{ "title": "string", "date": "string", "description": "string" }],
  "co": [{ "title": "string", "date": "string", "description": "string" }],
  "techSkills": [{ "category": "string — e.g. 'Languages'", "items": "string — e.g. 'Python, Java'" }],
  "expertise": [{ "text": "string — area of interest or domain" }],
  "links": [{ "platform": "string", "url": "string" }],
  "personal": [{ "email": "string", "phone": "string", "location": "string" }]
}

Rules:
- Classify short-term roles (< 6 months or labelled intern/trainee) as internships, full-time roles as work.
- For techSkills, return category + items rows (e.g. category "Framework / Libraries", items "React, Node.js").
- Dates should be kept in their original format (e.g. "Jun'23 - Aug'23" or "2021 - Present").
- Do not invent data — if something is not in the resume, omit or leave as empty string.
- Return ONLY the JSON object, nothing else.`;

async function aiParse(resumeText, apiKey, endpoint, model) {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: model || "gpt-4o-mini",
			messages: [
				{ role: "system", content: AI_SYSTEM_PROMPT },
				{ role: "user", content: resumeText.slice(0, 12000) }, // cap to ~12k chars
			],
			temperature: 0.1,
			max_tokens: 3000,
		}),
	});

	if (!response.ok) {
		const errBody = await response.text().catch(() => "");
		throw new Error(`API request failed (${response.status}): ${errBody.slice(0, 200)}`);
	}

	const json = await response.json();
	const raw = json?.choices?.[0]?.message?.content || "";
	// Strip possible markdown fences
	const clean = raw
		.replace(/^```[a-z]*\n?/i, "")
		.replace(/\n?```$/i, "")
		.trim();
	return JSON.parse(clean);
}

// ═══════════════════════════════════════════════════════════════
// RUN IMPORT — orchestrates extraction + parsing + load()
// ═══════════════════════════════════════════════════════════════

runImportBtn?.addEventListener("click", async () => {
	setImportStatus("", "");

	// 1. Get raw text
	let rawText = "";
	const activeTab = tabPdf?.classList.contains("active") ? "pdf" : "paste";

	if (activeTab === "pdf") {
		const file = importPdfFile?.files?.[0];
		if (!file) {
			setImportStatus("error", "Please choose a PDF file first.");
			return;
		}
		setImportStatus("loading", "Extracting text from PDF…");
		try {
			rawText = await extractTextFromPdf(file);
		} catch (err) {
			setImportStatus("error", `PDF extraction failed: ${err.message}`);
			return;
		}
	} else {
		rawText = importTextarea?.value?.trim() || "";
		if (!rawText) {
			setImportStatus("error", "Please paste your resume text first.");
			return;
		}
	}

	// 2. Parse — AI if key provided, else heuristic
	const apiKey = aiApiKeyEl?.value?.trim() || "";
	const endpoint = (aiEndpointEl?.value?.trim() || "https://api.openai.com/v1/chat/completions")
		.replace(/^`+|`+$/g, "")
		.trim();
	const model = aiModelEl?.value?.trim() || "gpt-4o-mini";

	let parsed = null;

	if (apiKey && window.location.protocol === "file:") {
		setImportStatus(
			"error",
			"AI parsing requires a local server due to browser security (CORS). Run: python3 -m http.server 4173 --bind 127.0.0.1  then open http://127.0.0.1:4173. Without a server, the heuristic parser will be used instead.",
		);
		await new Promise((r) => setTimeout(r, 60));
		parsed = heuristicParse(rawText);
		setImportStatus(
			"info",
			"Heuristic parsing used (file:// detected). Some fields may need manual adjustment.",
		);
		load(parsed);
		setTimeout(() => {
			closeImportModal();
			setImportStatus("", "");
		}, 2800);
		return;
	}

	if (apiKey) {
		setImportStatus("loading", "Sending to AI for extraction… (this may take a few seconds)");
		try {
			parsed = await aiParse(rawText, apiKey, endpoint, model);
			setImportStatus("success", "AI extraction complete! Review the results in the editor.");
		} catch (err) {
			setImportStatus(
				"error",
				`AI parsing failed: ${err.message}. Falling back to heuristic parser…`,
			);
			// Fall back to heuristic
			await new Promise((r) => setTimeout(r, 1200));
			parsed = heuristicParse(rawText);
			setImportStatus(
				"info",
				"Heuristic parsing used (AI failed). Some fields may need manual adjustment.",
			);
		}
	} else {
		setImportStatus("loading", "Parsing resume…");
		await new Promise((r) => setTimeout(r, 60)); // let the UI update
		parsed = heuristicParse(rawText);
		setImportStatus("success", "Import complete! Review and adjust the fields in the editor.");
	}

	// 3. Load into the builder
	if (parsed) {
		load(parsed);
	}

	// 4. Close modal after a short delay so the user can read the status
	setTimeout(() => {
		closeImportModal();
		setImportStatus("", "");
	}, 2200);
});

form.querySelectorAll("input, textarea").forEach((el) => {
	el.addEventListener("input", sync);
	el.addEventListener("change", sync);
});

document.getElementById("downloadJson").addEventListener("click", () => {
	sync();
	const blob = new Blob([JSON.stringify(data, null, 2)], {
		type: "application/json",
	});
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = "resume-template-data.json";
	a.click();
});

document.getElementById("uploadJson").addEventListener("change", async (e) => {
	const file = e.target.files?.[0];
	if (!file) return;
	try {
		const parsed = JSON.parse(await file.text());
		load(parsed);
	} catch {
		alert("Invalid JSON file.");
	}
});

document.getElementById("printResume").addEventListener("click", () => window.print());

signInBtn?.addEventListener("click", handleSignIn);
signOutBtn?.addEventListener("click", handleSignOut);
cloudSaveBtn?.addEventListener("click", saveToCloud);
cloudLoadBtn?.addEventListener("click", () => loadFromCloud({ silent: false }));
openInstructionsBtn?.addEventListener("click", openInstructions);
closeInstructionsBtn?.addEventListener("click", closeInstructions);
instructionsModal?.addEventListener("click", (event) => {
	if (event.target === instructionsModal) closeInstructions();
});
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape") closeInstructions();
});

document.getElementById("fontDecrease").addEventListener("click", () => {
	applyFontScale(currentScaleValue() - 0.05);
	sync();
});

document.getElementById("fontIncrease").addEventListener("click", () => {
	applyFontScale(currentScaleValue() + 0.05);
	sync();
});

document.getElementById("fontReset").addEventListener("click", () => {
	applyFontScale(1);
	sync();
});

initFirebase();
setupCollapsibleGroups();
load(defaults);
