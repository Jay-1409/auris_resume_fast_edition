import * as React from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Achievement,
  Certification,
  Education,
  Expertise,
  Internship,
  Link,
  Personal,
  Project,
  ResumeData,
  Skill,
  TripleEntry,
  Visibility,
  Work,
  defaultResumeData,
  defaultVisibility,
} from "@/lib/resume";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";

type ResumeEditorProps = {
  data: ResumeData;
  setData: React.Dispatch<React.SetStateAction<ResumeData>>;
};

type ReorderableKey =
  | "education"
  | "work"
  | "projects"
  | "achievements"
  | "expertise"
  | "techSkills"
  | "internships"
  | "certifications"
  | "por"
  | "extra"
  | "co"
  | "links"
  | "personal";

export function ResumeEditor({ data, setData }: ResumeEditorProps) {
  const [cloudKey, setCloudKey] = React.useState("default");
  const [cloudStatus, setCloudStatus] = React.useState("");
  const [cloudBusy, setCloudBusy] = React.useState(false);
  const [dragItem, setDragItem] = React.useState<{
    key: ReorderableKey;
    index: number;
  } | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{
    key: ReorderableKey;
    index: number;
  } | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("resume_cloud_key")?.trim();
    if (saved) setCloudKey(saved);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("resume_cloud_key", cloudKey.trim() || "default");
  }, [cloudKey]);

  const updateHeader = (
    field: "fullName" | "tagline" | "linkedinUrl" | "githubUrl",
    value: string,
  ) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateFontScale = (nextValue: number) => {
    setData((prev) => ({ ...prev, fontScale: nextValue }));
  };

  const updateVisibility = (key: keyof Visibility, checked: boolean) => {
    setData((prev) => ({
      ...prev,
      sectionVisibility: {
        ...prev.sectionVisibility,
        [key]: checked,
      },
    }));
  };

  const updateListItem = (key: keyof ResumeData, index: number, patch: Record<string, string>) => {
    setData((prev) => {
      const list = [...(prev[key] as Record<string, string>[])];
      list[index] = { ...list[index], ...patch };
      return { ...prev, [key]: list };
    });
  };

  const addListItem = (key: keyof ResumeData, value: Record<string, string>) => {
    setData((prev) => ({
      ...prev,
      [key]: [...(prev[key] as Record<string, string>[]), value],
    }));
  };

  const removeListItem = (key: keyof ResumeData, index: number) => {
    setData((prev) => ({
      ...prev,
      [key]: (prev[key] as unknown[]).filter((_, i) => i !== index),
    }));
  };

  const moveListItem = (key: ReorderableKey, from: number, to: number) => {
    if (from === to) return;

    setData((prev) => {
      const list = [...(prev[key] as Record<string, string>[])];
      if (from < 0 || to < 0 || from >= list.length || to >= list.length) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...prev, [key]: list };
    });
  };

  const dragBoxProps = (
    key: ReorderableKey,
    index: number,
  ): React.HTMLAttributes<HTMLDivElement> => ({
    draggable: true,
    onDragStart: () => {
      setDragItem({ key, index });
      setDropTarget(null);
    },
    onDragEnter: (e) => {
      if (dragItem?.key !== key) return;
      e.preventDefault();
      setDropTarget({ key, index });
    },
    onDragOver: (e) => {
      if (dragItem?.key === key) {
        e.preventDefault();
        setDropTarget({ key, index });
      }
    },
    onDrop: (e) => {
      e.preventDefault();
      if (!dragItem || dragItem.key !== key) return;
      moveListItem(key, dragItem.index, index);
      setDragItem(null);
      setDropTarget(null);
    },
    onDragEnd: () => {
      setDragItem(null);
      setDropTarget(null);
    },
  });

  const dropTargetClass = (key: ReorderableKey, index: number) => {
    const isSameAsSource = dragItem?.key === key && dragItem.index === index;
    const isTarget = dropTarget?.key === key && dropTarget.index === index;
    if (isSameAsSource || !isTarget) return "";
    return " ring-2 ring-sky-400 border-sky-400 bg-sky-50/50";
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "resume-data.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJson: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as Partial<ResumeData>;
      setData({
        ...defaultResumeData,
        ...parsed,
        sectionVisibility: {
          ...defaultVisibility,
          ...(parsed.sectionVisibility ?? {}),
        },
      });
    } catch {
      alert("Invalid JSON file");
    }

    e.target.value = "";
  };

  const saveToCloud = async () => {
    const key = cloudKey.trim() || "default";
    if (!isFirebaseConfigured()) {
      setCloudStatus("Cloud disabled: set NEXT_PUBLIC_FIREBASE_* env values.");
      return;
    }

    const db = getFirebaseDb();
    if (!db) {
      setCloudStatus("Cloud unavailable: Firebase init failed.");
      return;
    }

    setCloudBusy(true);
    setCloudStatus("Saving...");
    try {
      const ref = doc(db, "resumes", key);
      await setDoc(
        ref,
        {
          data,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setCloudStatus(`Saved to cloud key: ${key}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setCloudStatus(`Save failed: ${message}`);
    } finally {
      setCloudBusy(false);
    }
  };

  const loadFromCloud = async () => {
    const key = cloudKey.trim() || "default";
    if (!isFirebaseConfigured()) {
      setCloudStatus("Cloud disabled: set NEXT_PUBLIC_FIREBASE_* env values.");
      return;
    }

    const db = getFirebaseDb();
    if (!db) {
      setCloudStatus("Cloud unavailable: Firebase init failed.");
      return;
    }

    setCloudBusy(true);
    setCloudStatus("Loading...");
    try {
      const ref = doc(db, "resumes", key);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        setCloudStatus(`No cloud data found for key: ${key}`);
        return;
      }

      const payload = snapshot.data()?.data as Partial<ResumeData> | undefined;
      if (!payload) {
        setCloudStatus("Cloud record found, but resume data is missing.");
        return;
      }

      setData({
        ...defaultResumeData,
        ...payload,
        sectionVisibility: {
          ...defaultVisibility,
          ...(payload.sectionVisibility ?? {}),
        },
      });
      setCloudStatus(`Loaded from cloud key: ${key}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setCloudStatus(`Load failed: ${message}`);
    } finally {
      setCloudBusy(false);
    }
  };

  return (
    <div
      style={{ fontFamily: "var(--font-geist-sans), Inter, Segoe UI, sans-serif" }}
    >
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
        Auris Resume Builder
      </h1>
      <p className="mt-1 text-xs font-medium text-zinc-600">
        Cleaner structure with split components.
      </p>

      <div className="mt-4 space-y-4 overflow-y-auto pr-1 lg:max-h-[calc(100vh-2.5rem)]">
        <div className="rounded-lg border p-3">
          <h2 className="text-sm font-semibold">Header</h2>
          <div className="mt-2 space-y-2">
            <Input className="h-9" placeholder="Full name" value={data.fullName} onChange={(e) => updateHeader("fullName", e.target.value)} />
            <Input className="h-9" placeholder="Tagline" value={data.tagline} onChange={(e) => updateHeader("tagline", e.target.value)} />
            <Input className="h-9" placeholder="LinkedIn URL" value={data.linkedinUrl} onChange={(e) => updateHeader("linkedinUrl", e.target.value)} />
            <Input className="h-9" placeholder="GitHub URL" value={data.githubUrl} onChange={(e) => updateHeader("githubUrl", e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <h2 className="text-sm font-semibold">Education</h2>
          <p className="mt-1 text-[11px] text-zinc-600">Drag cards to reorder.</p>
          <div className="mt-2 space-y-2">
            {data.education.map((row, idx) => (
              <div key={idx} className={`cursor-move rounded-md border p-2${dropTargetClass("education", idx)}`} {...dragBoxProps("education", idx)}>
                <div className="grid grid-cols-2 gap-2">
                  <Input className="h-8 text-xs" placeholder="Year" value={row.year} onChange={(e) => updateListItem("education", idx, { year: e.target.value })} />
                  <Input className="h-8 text-xs" placeholder="Degree" value={row.degree} onChange={(e) => updateListItem("education", idx, { degree: e.target.value })} />
                  <Input className="h-8 text-xs" placeholder="University/Board" value={row.board} onChange={(e) => updateListItem("education", idx, { board: e.target.value })} />
                  <Input className="h-8 text-xs" placeholder="Institute" value={row.institute} onChange={(e) => updateListItem("education", idx, { institute: e.target.value })} />
                  <Input className="col-span-2 h-8 text-xs" placeholder="CGPA/%" value={row.score} onChange={(e) => updateListItem("education", idx, { score: e.target.value })} />
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => removeListItem("education", idx)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => addListItem("education", { year: "", degree: "", board: "", institute: "", score: "" } as Education)}>
              + Add Education
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <h2 className="text-sm font-semibold">Experience & Projects</h2>
          <p className="mt-1 text-[11px] text-zinc-600">Drag cards to reorder.</p>
          <div className="mt-2 space-y-2">
            {data.work.map((row, idx) => (
              <div key={idx} className={`cursor-move rounded-md border p-2${dropTargetClass("work", idx)}`} {...dragBoxProps("work", idx)}>
                <Input className="mb-2 h-8 w-full text-xs" placeholder="Organization/Title" value={row.title} onChange={(e) => updateListItem("work", idx, { title: e.target.value })} />
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <Input className="h-8 text-xs" placeholder="Date" value={row.date} onChange={(e) => updateListItem("work", idx, { date: e.target.value })} />
                  <Input className="h-8 text-xs" placeholder="Role" value={row.role} onChange={(e) => updateListItem("work", idx, { role: e.target.value })} />
                </div>
                <Textarea className="min-h-20 text-xs" rows={3} placeholder="Highlights (one per line)" value={row.highlights} onChange={(e) => updateListItem("work", idx, { highlights: e.target.value })} />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => removeListItem("work", idx)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => addListItem("work", { title: "", date: "", role: "", highlights: "" } as Work)}>
              + Add Work
            </Button>

            {data.projects.map((row, idx) => (
              <div key={idx} className={`cursor-move rounded-md border p-2${dropTargetClass("projects", idx)}`} {...dragBoxProps("projects", idx)}>
                <div className="grid grid-cols-2 gap-2">
                  <Input className="h-8 text-xs" placeholder="Project Type" value={row.type} onChange={(e) => updateListItem("projects", idx, { type: e.target.value })} />
                  <Input className="h-8 text-xs" placeholder="Date" value={row.date} onChange={(e) => updateListItem("projects", idx, { date: e.target.value })} />
                  <Input className="col-span-2 h-8 text-xs" placeholder="Project Name" value={row.name} onChange={(e) => updateListItem("projects", idx, { name: e.target.value })} />
                  <Textarea className="col-span-2 text-xs" rows={2} placeholder="Summary" value={row.summary} onChange={(e) => updateListItem("projects", idx, { summary: e.target.value })} />
                  <Input className="col-span-2 h-8 text-xs" placeholder="Skills Used" value={row.skills} onChange={(e) => updateListItem("projects", idx, { skills: e.target.value })} />
                  <Input className="h-8 text-xs" placeholder="Team Size" value={row.teamSize} onChange={(e) => updateListItem("projects", idx, { teamSize: e.target.value })} />
                  <Textarea className="text-xs" rows={2} placeholder="Outcomes" value={row.outcomes} onChange={(e) => updateListItem("projects", idx, { outcomes: e.target.value })} />
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => removeListItem("projects", idx)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => addListItem("projects", { type: "", date: "", name: "", summary: "", skills: "", teamSize: "", outcomes: "" } as Project)}>
              + Add Project
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <h2 className="text-sm font-semibold">Other Sections</h2>
          <p className="mt-1 text-[11px] text-zinc-600">Drag rows/cards to reorder inside each section.</p>
          <div className="mt-2 space-y-2">
            {data.achievements.map((row, idx) => (
              <div key={idx} className={`cursor-move rounded border p-2${dropTargetClass("achievements", idx)}`} {...dragBoxProps("achievements", idx)}>
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Achievement" value={row.title} onChange={(e) => updateListItem("achievements", idx, { title: e.target.value })} />
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Date" value={row.date} onChange={(e) => updateListItem("achievements", idx, { date: e.target.value })} />
                <Textarea className="text-xs" rows={2} placeholder="Description" value={row.description} onChange={(e) => updateListItem("achievements", idx, { description: e.target.value })} />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => removeListItem("achievements", idx)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => addListItem("achievements", { title: "", date: "", description: "" } as Achievement)}>
              + Add Achievement
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => addListItem("expertise", { text: "" } as Expertise)}>+ Add Expertise</Button>
              <Button variant="secondary" size="sm" onClick={() => addListItem("techSkills", { text: "" } as Skill)}>+ Add Skill</Button>
              <Button variant="secondary" size="sm" onClick={() => addListItem("internships", { organization: "", date: "", role: "", summary: "" } as Internship)}>+ Add Internship</Button>
              <Button variant="secondary" size="sm" onClick={() => addListItem("certifications", { name: "", issuer: "", date: "", url: "" } as Certification)}>+ Add Certification</Button>
              <Button variant="secondary" size="sm" onClick={() => addListItem("por", { title: "", date: "", description: "" } as TripleEntry)}>+ Add POR</Button>
              <Button variant="secondary" size="sm" onClick={() => addListItem("extra", { title: "", date: "", description: "" } as TripleEntry)}>+ Add Extra Curricular</Button>
              <Button variant="secondary" size="sm" onClick={() => addListItem("co", { title: "", date: "", description: "" } as TripleEntry)}>+ Add Co-Curricular</Button>
              <Button variant="secondary" size="sm" onClick={() => addListItem("links", { platform: "", url: "" } as Link)}>+ Add Link</Button>
              <Button variant="secondary" size="sm" onClick={() => addListItem("personal", { email: "", phone: "", location: "" } as Personal)}>+ Add Personal Row</Button>
            </div>

            {data.expertise.map((row, idx) => (
              <div key={idx} className={`flex cursor-move items-center gap-2 rounded-sm px-1${dropTargetClass("expertise", idx)}`} {...dragBoxProps("expertise", idx)}>
                <Input className="h-8 w-full text-xs" placeholder="Expertise line" value={row.text} onChange={(e) => updateListItem("expertise", idx, { text: e.target.value })} />
                <Button variant="outline" size="sm" onClick={() => removeListItem("expertise", idx)}>Remove</Button>
              </div>
            ))}

            {data.techSkills.map((row, idx) => (
              <div key={idx} className={`flex cursor-move items-center gap-2 rounded-sm px-1${dropTargetClass("techSkills", idx)}`} {...dragBoxProps("techSkills", idx)}>
                <Input className="h-8 w-full text-xs" placeholder="Skill line" value={row.text} onChange={(e) => updateListItem("techSkills", idx, { text: e.target.value })} />
                <Button variant="outline" size="sm" onClick={() => removeListItem("techSkills", idx)}>Remove</Button>
              </div>
            ))}

            {data.internships.map((row, idx) => (
              <div key={idx} className={`cursor-move rounded border p-2${dropTargetClass("internships", idx)}`} {...dragBoxProps("internships", idx)}>
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Organization" value={row.organization} onChange={(e) => updateListItem("internships", idx, { organization: e.target.value })} />
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Date" value={row.date} onChange={(e) => updateListItem("internships", idx, { date: e.target.value })} />
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Role" value={row.role} onChange={(e) => updateListItem("internships", idx, { role: e.target.value })} />
                <Textarea className="text-xs" rows={2} placeholder="Summary" value={row.summary} onChange={(e) => updateListItem("internships", idx, { summary: e.target.value })} />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => removeListItem("internships", idx)}>Remove</Button>
              </div>
            ))}

            {data.certifications.map((row, idx) => (
              <div key={idx} className={`cursor-move rounded border p-2${dropTargetClass("certifications", idx)}`} {...dragBoxProps("certifications", idx)}>
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Name" value={row.name} onChange={(e) => updateListItem("certifications", idx, { name: e.target.value })} />
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Issuer" value={row.issuer} onChange={(e) => updateListItem("certifications", idx, { issuer: e.target.value })} />
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Date" value={row.date} onChange={(e) => updateListItem("certifications", idx, { date: e.target.value })} />
                <Input className="h-8 w-full text-xs" placeholder="URL" value={row.url} onChange={(e) => updateListItem("certifications", idx, { url: e.target.value })} />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => removeListItem("certifications", idx)}>Remove</Button>
              </div>
            ))}

            {(["por", "extra", "co"] as const).map((group) =>
              data[group].map((row, idx) => (
                <div key={`${group}-${idx}`} className={`cursor-move rounded border p-2${dropTargetClass(group, idx)}`} {...dragBoxProps(group, idx)}>
                  <p className="mb-1 text-[11px] font-semibold uppercase text-zinc-600">{group}</p>
                  <Input className="mb-1 h-8 w-full text-xs" placeholder="Title" value={row.title} onChange={(e) => updateListItem(group, idx, { title: e.target.value })} />
                  <Input className="mb-1 h-8 w-full text-xs" placeholder="Date" value={row.date} onChange={(e) => updateListItem(group, idx, { date: e.target.value })} />
                  <Textarea className="text-xs" rows={2} placeholder="Description" value={row.description} onChange={(e) => updateListItem(group, idx, { description: e.target.value })} />
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => removeListItem(group, idx)}>Remove</Button>
                </div>
              )),
            )}

            {data.links.map((row, idx) => (
              <div key={idx} className={`cursor-move rounded border p-2${dropTargetClass("links", idx)}`} {...dragBoxProps("links", idx)}>
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Platform" value={row.platform} onChange={(e) => updateListItem("links", idx, { platform: e.target.value })} />
                <Input className="h-8 w-full text-xs" placeholder="URL" value={row.url} onChange={(e) => updateListItem("links", idx, { url: e.target.value })} />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => removeListItem("links", idx)}>Remove</Button>
              </div>
            ))}

            {data.personal.map((row, idx) => (
              <div key={idx} className={`cursor-move rounded border p-2${dropTargetClass("personal", idx)}`} {...dragBoxProps("personal", idx)}>
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Email" value={row.email} onChange={(e) => updateListItem("personal", idx, { email: e.target.value })} />
                <Input className="mb-1 h-8 w-full text-xs" placeholder="Phone" value={row.phone} onChange={(e) => updateListItem("personal", idx, { phone: e.target.value })} />
                <Input className="h-8 w-full text-xs" placeholder="Location" value={row.location} onChange={(e) => updateListItem("personal", idx, { location: e.target.value })} />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => removeListItem("personal", idx)}>Remove</Button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <h2 className="text-sm font-semibold">Controls</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => updateFontScale(Math.max(0.7, Number((data.fontScale - 0.1).toFixed(2))))}>A-</Button>
            <Button variant="outline" size="sm" onClick={() => updateFontScale(1)}>Reset</Button>
            <Button variant="outline" size="sm" onClick={() => updateFontScale(Math.min(1.5, Number((data.fontScale + 0.1).toFixed(2))))}>A+</Button>
            <span className="self-center text-xs font-semibold">{Math.round(data.fontScale * 100)}%</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {(Object.keys(defaultVisibility) as (keyof Visibility)[]).map((key) => (
              <label key={key} className="flex items-center gap-2 rounded border px-2 py-1">
                <input type="checkbox" checked={data.sectionVisibility[key]} onChange={(e) => updateVisibility(key, e.target.checked)} />
                {key}
              </label>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={exportJson}>Download JSON</Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium">
              Load JSON
              <input type="file" className="hidden" accept="application/json" onChange={importJson} />
            </label>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>Print / Save PDF</Button>
          </div>

          <div className="mt-4 rounded-md border p-2">
            <p className="text-xs font-semibold">Cloud (Firebase)</p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Use the same cloud key on any device to load the same resume.
            </p>
            <Input
              className="mt-2 h-8 text-xs"
              placeholder="Cloud key (e.g. auris-myname)"
              value={cloudKey}
              onChange={(e) => setCloudKey(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={saveToCloud} disabled={cloudBusy}>
                Save to Cloud
              </Button>
              <Button size="sm" variant="outline" onClick={loadFromCloud} disabled={cloudBusy}>
                Load from Cloud
              </Button>
            </div>
            {cloudStatus ? <p className="mt-2 text-[11px] text-zinc-700">{cloudStatus}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
