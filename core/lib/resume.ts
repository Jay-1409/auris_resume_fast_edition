export type Education = {
  year: string;
  degree: string;
  board: string;
  institute: string;
  score: string;
};

export type Expertise = { text: string };
export type Achievement = { title: string; date: string; description: string };
export type Work = { title: string; date: string; role: string; highlights: string };
export type Internship = {
  organization: string;
  date: string;
  role: string;
  summary: string;
};
export type Project = {
  type: string;
  date: string;
  name: string;
  summary: string;
  skills: string;
  teamSize: string;
  outcomes: string;
};
export type Certification = { name: string; issuer: string; date: string; url: string };
export type TripleEntry = { title: string; date: string; description: string };
export type Skill = { text: string };
export type Link = { platform: string; url: string };
export type Personal = { email: string; phone: string; location: string };

export type Visibility = {
  header: boolean;
  linkedinLogo: boolean;
  githubLogo: boolean;
  education: boolean;
  expertise: boolean;
  achievements: boolean;
  work: boolean;
  internships: boolean;
  projects: boolean;
  certifications: boolean;
  por: boolean;
  extra: boolean;
  co: boolean;
  skills: boolean;
  links: boolean;
  personal: boolean;
};

export type ResumeData = {
  fontScale: number;
  fullName: string;
  tagline: string;
  linkedinUrl: string;
  githubUrl: string;
  education: Education[];
  expertise: Expertise[];
  achievements: Achievement[];
  work: Work[];
  internships: Internship[];
  projects: Project[];
  certifications: Certification[];
  por: TripleEntry[];
  extra: TripleEntry[];
  co: TripleEntry[];
  techSkills: Skill[];
  links: Link[];
  personal: Personal[];
  sectionVisibility: Visibility;
};

export const defaultVisibility: Visibility = {
  header: true,
  linkedinLogo: true,
  githubLogo: true,
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

export const defaultResumeData: ResumeData = {
  fontScale: 1,
  fullName: "",
  tagline: "",
  linkedinUrl: "",
  githubUrl: "",
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
  links: [],
  personal: [],
  sectionVisibility: defaultVisibility,
};

export const safeUrl = (url: string) => {
  if (!url.trim()) return "#";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const parseDateRank = (text: string) => {
  const raw = text.trim();
  if (!raw) return null;
  if (/(present|current|pursuing|ongoing)/i.test(raw)) return 999912;

  const months: Record<string, number> = {
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

  const ranks: number[] = [];
  const monthYearRegex =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s\-']*(\d{2,4})\b/gi;

  let match: RegExpExecArray | null;
  while ((match = monthYearRegex.exec(raw)) !== null) {
    const month = months[match[1].toLowerCase()] ?? 1;
    let year = Number(match[2]);
    if (year < 100) year += 2000;
    ranks.push(year * 100 + month);
  }

  const yearRegex = /\b(19\d{2}|20\d{2})\b/g;
  while ((match = yearRegex.exec(raw)) !== null) {
    ranks.push(Number(match[1]) * 100 + 1);
  }

  const shortYearRegex = /'(\d{2})\b/g;
  while ((match = shortYearRegex.exec(raw)) !== null) {
    ranks.push((2000 + Number(match[1])) * 100 + 1);
  }

  if (!ranks.length) return null;
  return Math.max(...ranks);
};

export const sortByDateDesc = <T extends Record<string, string>>(
  rows: T[],
  key: keyof T,
) => {
  return [...rows]
    .map((row, index) => ({ row, index, rank: parseDateRank(String(row[key] ?? "")) }))
    .sort((a, b) => {
      if (a.rank == null && b.rank == null) return a.index - b.index;
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      if (a.rank !== b.rank) return b.rank - a.rank;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
};
