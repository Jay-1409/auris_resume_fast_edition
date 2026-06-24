"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import { ResumeEditor } from "@/components/resume/resume-editor";
import { ResumePreview } from "@/components/resume/resume-preview";
import { ResumeData, defaultResumeData } from "@/lib/resume";

export default function Page() {
  const [data, setData] = useState<ResumeData>(defaultResumeData);

  return (
    <div id="print-page" className="min-h-screen bg-zinc-100 p-3 text-zinc-900 md:p-4">
      <div className="mx-auto grid w-full max-w-screen-2xl gap-3 xl:grid-cols-[390px_minmax(0,1fr)]">
        <Card className="no-print p-4">
          <ResumeEditor data={data} setData={setData} />
        </Card>

        <Card id="print-preview-card" className="p-4">
          <h2 className="no-print mb-3 text-sm font-semibold">Preview</h2>
          <ResumePreview data={data} />
        </Card>
      </div>
    </div>
  );
}
