import {
  ResumeData,
  safeUrl,
} from "@/lib/resume";

type ResumePreviewProps = {
  data: ResumeData;
};

const sectionTitleClass =
  "mt-3 border border-zinc-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide";

export function ResumePreview({ data }: ResumePreviewProps) {
  const v = data.sectionVisibility;

  return (
    <article
      id="resume-article"
      className="mx-auto w-full max-w-[210mm] border border-zinc-400 bg-white p-6 text-[13px] leading-[1.35]"
      style={{
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: `${13 * data.fontScale}px`,
      }}
    >
      {v.header && (data.fullName || data.tagline || data.linkedinUrl || data.githubUrl) && (
        <>
          <div className="mb-1 flex min-h-4.5 items-center justify-between gap-3">
            <h1 className="text-[30px] leading-[1.08] font-semibold tracking-tight">
              {data.fullName}
            </h1>
            <div className="flex items-center gap-2 pt-1">
              {v.linkedinLogo && data.linkedinUrl && (
                <a
                  href={safeUrl(data.linkedinUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0a66c2]"
                  aria-label="LinkedIn"
                  title="LinkedIn"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M4.983 3.5C4.983 4.88 3.862 6 2.482 6S-.018 4.88-.018 3.5 1.103 1 2.482 1s2.501 1.12 2.501 2.5zM.5 8h4v13h-4V8zm7 0h3.832v1.775h.055c.534-1.014 1.84-2.084 3.788-2.084C19.225 7.69 21 10.04 21 13.51V21h-4v-6.637c0-1.583-.028-3.62-2.206-3.62-2.21 0-2.548 1.726-2.548 3.506V21h-4V8z" />
                  </svg>
                </a>
              )}
              {v.githubLogo && data.githubUrl && (
                <a
                  href={safeUrl(data.githubUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-800"
                  aria-label="GitHub"
                  title="GitHub"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 1C5.923 1 1 5.922 1 12c0 4.867 3.15 8.996 7.523 10.452.55.102.752-.239.752-.53 0-.261-.01-.953-.015-1.87-3.06.665-3.706-1.474-3.706-1.474-.5-1.272-1.222-1.611-1.222-1.611-.998-.681.075-.667.075-.667 1.103.078 1.683 1.133 1.683 1.133.98 1.679 2.571 1.194 3.198.913.1-.71.384-1.194.699-1.469-2.442-.278-5.01-1.221-5.01-5.434 0-1.2.43-2.182 1.133-2.951-.114-.278-.491-1.397.108-2.913 0 0 .924-.296 3.027 1.128A10.49 10.49 0 0112 6.845c.935.004 1.877.126 2.757.37 2.1-1.424 3.022-1.128 3.022-1.128.601 1.516.224 2.635.11 2.913.706.769 1.132 1.751 1.132 2.951 0 4.223-2.572 5.153-5.022 5.426.394.34.746 1.012.746 2.04 0 1.472-.013 2.659-.013 3.021 0 .294.198.637.758.529C19.853 20.992 23 16.864 23 12c0-6.078-4.922-11-11-11z" />
                  </svg>
                </a>
              )}
            </div>
          </div>
          <p className="mb-2 mt-1 text-[14px] leading-tight italic font-medium text-zinc-700">
            {data.tagline}
          </p>
        </>
      )}

      {v.education && data.education.length > 0 && (
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
              {data.education.map((row, idx) => (
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

      {v.achievements && data.achievements.length > 0 && (
        <>
          <div className={sectionTitleClass}>Achievements and Accomplishments</div>
          <table className="w-full border-collapse">
            <tbody>
              {data.achievements.map((a, idx) => (
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

      {v.work && data.work.length > 0 && (
        <>
          <div className={sectionTitleClass}>Work Experience</div>
          {data.work.map((w, idx) => (
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

      {v.internships && data.internships.length > 0 && (
        <>
          <div className={sectionTitleClass}>Internships</div>
          {data.internships.map((i, idx) => (
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

      {v.projects && data.projects.length > 0 && (
        <>
          <div className={sectionTitleClass}>Projects</div>
          {data.projects.map((p, idx) => (
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

      {v.certifications && data.certifications.length > 0 && (
        <>
          <div className={sectionTitleClass}>Certifications</div>
          <table className="w-full border-collapse">
            <tbody>
              {data.certifications.map((c, idx) => (
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

      {v.por && data.por.length > 0 && (
        <>
          {data.por.map((p, idx) => (
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

      {v.extra && data.extra.length > 0 && (
        <>
          {data.extra.map((p, idx) => (
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

      {v.co && data.co.length > 0 && (
        <>
          <div className={sectionTitleClass}>Co-Curricular Activities</div>
          <table className="w-full border-collapse">
            <tbody>
              {data.co.map((c, idx) => (
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
