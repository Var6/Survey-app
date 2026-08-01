"use client";

import { btnPrimary } from "@/components/ui";

/** Opens the browser print dialog — "Save as PDF" gives the download. */
export default function PrintButton() {
  return (
    <button
      type="button"
      className={`${btnPrimary} print:hidden`}
      onClick={() => window.print()}
    >
      ⬇ PDF
    </button>
  );
}
