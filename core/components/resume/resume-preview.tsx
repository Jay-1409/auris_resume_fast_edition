import {
  ResumeData,
  safeUrl,
  sortByDateDesc,
} from "@/lib/resume";

type ResumePreviewProps = {
  data: ResumeData;
};

const sectionTitleClass =
  "mt-3 border border-zinc-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide";

export function ResumePreview({ data }: ResumePreviewProps) {
  const v = data.sectionVisibility;

  const educationSorted = sortByDateDesc(data.education, "year");
  const achievementsSorted = sortByDateDesc(data.achievements, "date");
  const workSorted = sortByDateDesc(data.work, "date");
  const internshipsSorted = sortByDateDesc(data.internships, "date");
  const projectsSorted = sortByDateDesc(data.projects, "date");
  const certificationsSorted = sortByDateDesc(data.certifications, "date");
  const porSorted = sortByDateDesc(data.por, "date");
  const extraSorted = sortByDateDesc(data.extra, "date");
  const coSorted = sortByDateDesc(data.co, "date");

  return (
    <article
      id="resume-article"
      className="mx-auto w-full max-w-[210mm] border border-zinc-400 bg-white p-6 text-[13px] leading-[1.35]"
      style={{
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: `${13 * data.fontScale}px`,
      }}
    >
      {v.header && (data.fullName || data.tagline || data.linkedinUrl) && (
        <>
          <div className="mb-1 flex min-h-4.5 items-start justify-between gap-3">
            <h1 className="text-[30px] leading-[1.08] font-semibold tracking-tight">
              {data.fullName}
            </h1>
            {v.linkedinLogo && data.linkedinUrl && (
              <a
                href={safeUrl(data.linkedinUrl)}
                target="_blank"
                rel="noreferrer"
                className="pt-1 text-[#0a66c2]"
              >
                LinkedIn
              </a>
            )}
          </div>
          <p className="mb-2 mt-1 text-[14px] leading-tight italic font-medium text-zinc-700">
            {data.tagline}
          </p>
        </>
      )}

      {v.education && educationSorted.length > 0 && (
        <>
          <div className={sectionTitleClass}>Education</div>
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[12%] border border-zinc-700 px-1 py-0.5 text-left">
                  Year
                </th>
                <th className="w-[30%] border border-zinc-700 px-1 py-0.5 text-left">
                  Degree
                </th>
                <th className="w-[19%] border border-zinc-700 px-1 py-0.5 text-left">
                  University/Board
                </th>
                <th className="w-[27%] border border-zinc-700 px-1 py-0.5 text-left">
                  Institute
                </th>
                <th className="w-[12%] border border-zinc-700 px-1 py-0.5 text-left">
                  / CGPA
                </th>
              </tr>
            </thead>
            <tbody>
              {educationSorted.map((row, idx) => (
                <tr key={idx}>
                  <td className="border border-zinc-700 px-1 py-0.5">{row.year}</td>
                  <td className="border border-zinc-700 px-1 py-0.5">{row.degree}</td>
                  <td className="border border-zinc-700 px-1 py-0.5">{row.board}</td>
                  <td className="border border-zinc-700 px-1 py-0.5">{row.institute}</td>
                  <td className="border border-zinc-700 px-1 py-0.5">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {v.expertise && data.expertise.length > 0 && (
        <>
          <div className={sectionTitleClass}>Expertise/Area of Interest</div>
          <p className="border border-zinc-700 border-t-0 px-2 py-1">
            {data.expertise
              .map((e) => e.text.trim())
              .filter(Boolean)
              .map((e, idx) => (
                <span key={idx}>• {e} </span>
              ))}
          </p>
        </>
      )}

      {v.achievements && achievementsSorted.length > 0 && (
        <>
          <div className={sectionTitleClass}>Achievements and Accomplishments</div>
          <table className="w-full border-collapse">
            <tbody>
              {achievementsSorted.map((a, idx) => (
                <tr key={idx}>
                  <td className="border border-zinc-700 px-1 py-0.5 align-top">
                    <strong>{a.title}</strong>
                    {a.description ? (
                      <>
                        <br />
                        {a.description}
                      </>
                    ) : null}
                  </td>
                  <td className="border border-zinc-700 px-1 py-0.5 align-top">
                    {a.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {v.work && workSorted.length > 0 && (
        <>
          <div className={sectionTitleClass}>Work Experience</div>
          {workSorted.map((w, idx) => (
            <div key={idx}>
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="w-[86%] border border-zinc-700 px-1 py-0.5 align-top">
                      {w.title}
                    </td>
                    <td className="w-[14%] border border-zinc-700 px-1 py-0.5 align-top">
                      {w.date}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="border border-zinc-700 border-t-0 px-2 py-1">
                <div className="font-semibold">{w.role}</div>
                {w.highlights
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, lineIndex) => (
                    <div key={lineIndex}>• {line}</div>
                  ))}
              </div>
            </div>
          ))}
        </>
      )}

      {v.internships && internshipsSorted.length > 0 && (
        <>
          <div className={sectionTitleClass}>Internships</div>
          {internshipsSorted.map((i, idx) => (
            <div key={idx} className="border border-zinc-700 border-t-0 px-2 py-1 first:border-t">
              <div className="flex justify-between font-semibold">
                <span>{i.organization}</span>
                <span>{i.date}</span>
              </div>
              <div className="font-semibold">{i.role}</div>
              <div>{i.summary}</div>
            </div>
          ))}
        </>
      )}

      {v.projects && projectsSorted.length > 0 && (
        <>
          <div className={sectionTitleClass}>Projects</div>
          {projectsSorted.map((p, idx) => (
            <div key={idx} className="border border-zinc-700 border-t-0 px-2 py-1 first:border-t">
              <div className="flex justify-between font-semibold">
                <span>{p.type}</span>
                <span>{p.date}</span>
              </div>
              <div>
                <strong>{p.name}</strong>
              </div>
              <div>
                <strong>Summary:</strong> {p.summary}
              </div>
              <div>
                <strong>Skills Used:</strong> {p.skills}
              </div>
              <div>
                <strong>Team Size:</strong> {p.teamSize}
              </div>
              <div>
                <strong>Key Outcomes:</strong> {p.outcomes}
              </div>
            </div>
          ))}
        </>
      )}

      {v.certifications && certificationsSorted.length > 0 && (
        <>
          <div className={sectionTitleClass}>Certifications</div>
          <table className="w-full border-collapse">
            <tbody>
              {certificationsSorted.map((c, idx) => (
                <tr key={idx}>
                  <td className="border border-zinc-700 px-1 py-0.5">
                    <strong>{c.name}</strong>
                  </td>
                  <td className="border border-zinc-700 px-1 py-0.5">{c.issuer}</td>
                  <td className="border border-zinc-700 px-1 py-0.5">{c.date}</td>
                  <td className="border border-zinc-700 px-1 py-0.5">
                    {c.url ? (
                      <a className="text-blue-700 underline" href={safeUrl(c.url)} target="_blank" rel="noreferrer">
                        {c.url}
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {v.por && porSorted.length > 0 && (
        <>
          {porSorted.map((p, idx) => (
            <div key={idx}>
              <div className={sectionTitleClass}>Positions of Responsibility</div>
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="w-[86%] border border-zinc-700 px-1 py-0.5 align-top">
                      <strong>{p.title}</strong>
                      <br />
                      {p.description}
                    </td>
                    <td className="w-[14%] border border-zinc-700 px-1 py-0.5 align-top">
                      {p.date}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {v.extra && extraSorted.length > 0 && (
        <>
          {extraSorted.map((p, idx) => (
            <div key={idx}>
              <div className={sectionTitleClass}>Extra Curricular Activities</div>
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="w-[86%] border border-zinc-700 px-1 py-0.5 align-top">
                      <strong>{p.title}</strong>
                      <br />
                      {p.description}
                    </td>
                    <td className="w-[14%] border border-zinc-700 px-1 py-0.5 align-top">
                      {p.date}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {v.co && coSorted.length > 0 && (
        <>
          <div className={sectionTitleClass}>Co-Curricular Activities</div>
          <table className="w-full border-collapse">
            <tbody>
              {coSorted.map((c, idx) => (
                <tr key={idx}>
                  <td className="w-[86%] border border-zinc-700 px-1 py-0.5 align-top">
                    <strong>{c.title}</strong>
                    <br />
                    {c.description}
                  </td>
                  <td className="w-[14%] border border-zinc-700 px-1 py-0.5 align-top">
                    {c.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {v.skills && data.techSkills.some((x) => x.text.trim()) && (
        <>
          <div className={sectionTitleClass}>Technical Skills</div>
          <div className="border border-zinc-700 border-t-0 px-2 py-1">
            {data.techSkills
              .map((s) => s.text.trim())
              .filter(Boolean)
              .map((s, idx) => (
                <div key={idx}>• {s}</div>
              ))}
          </div>
        </>
      )}

      {v.links && data.links.length > 0 && (
        <>
          <div className={sectionTitleClass}>Online Professional Presence</div>
          <table className="w-full border-collapse">
            <tbody>
              {data.links.map((l, idx) => (
                <tr key={idx}>
                  <td className="w-[42%] border border-zinc-700 px-1 py-0.5">{l.platform}</td>
                  <td className="border border-zinc-700 px-1 py-0.5">
                    <a href={safeUrl(l.url)} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                      {l.url}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {v.personal && data.personal.length > 0 && (
        <>
          <div className={sectionTitleClass}>Personal Details</div>
          <table className="w-full border-collapse">
            <tbody>
              {data.personal.map((p, idx) => (
                <tr key={idx}>
                  <td className="border border-zinc-700 px-1 py-0.5">
                    Email: {p.email} | Phone: {p.phone} | Location: {p.location}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}
