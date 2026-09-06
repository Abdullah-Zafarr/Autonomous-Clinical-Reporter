export interface WorkflowSnapshot {
  studyStatus: string | null;
  worksheet: {
    status: string;
    created_at: string;
    signed_at: string | null;
    signed_by: string | null;
  } | null;
  reviewAt: string | null;
  delivery: { status: string; sent_at?: string | null; response_body?: string | null } | null;
}

export function workflowProgress(snapshot: WorkflowSnapshot) {
  const { worksheet, delivery } = snapshot;
  const signed = !!worksheet?.signed_at && !!worksheet.signed_by && worksheet.status !== "draft";
  const review = signed || snapshot.studyStatus === "review_pending" || !!snapshot.reviewAt;
  let demo = false;
  try {
    const response = JSON.parse(delivery?.response_body || "{}");
    demo = response.mock === true || String(response.messageId ?? "").startsWith("MOCK-");
  } catch {
    /* Older delivery records may contain plain text acknowledgments. */
  }
  // A completed study or signed worksheet alone is not evidence of delivery.
  const sent = signed && delivery?.status === "sent";
  const failed = signed && delivery?.status === "failed";
  const active = sent ? 4 : signed ? 3 : review ? 1 : 0;
  return {
    active,
    summary: sent
      ? demo
        ? "Demo sent"
        : "Sent"
      : failed
        ? "Delivery failed"
        : signed
          ? "Signed · Awaiting delivery"
          : review
            ? "Awaiting doctor review"
            : worksheet
              ? "Worksheet in progress"
              : "Worksheet not started",
    steps: [
      {
        label: "Worksheet",
        complete: review || signed,
        time: worksheet?.created_at,
        detail: worksheet ? "First saved" : "Not saved yet",
      },
      {
        label: "Doctor Review",
        complete: signed,
        time: snapshot.reviewAt,
        detail: review ? "Submitted for review" : "Awaiting submission",
      },
      {
        label: "Signed",
        complete: signed,
        time: signed ? worksheet?.signed_at : null,
        detail: signed ? "Signature recorded" : "Awaiting signature",
      },
      {
        label: "Sent",
        complete: !!sent,
        time: sent ? delivery?.sent_at : null,
        detail: sent
          ? demo
            ? "Demo receiver only"
            : "Delivery recorded"
          : failed
            ? "Delivery failed"
            : delivery?.status === "pending"
              ? "Dispatch pending"
              : "Awaiting delivery",
      },
    ],
  };
}
