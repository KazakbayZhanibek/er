const endpoint = (import.meta.env.VITE_APPLICATION_API_URL || "").trim().replace(/\/$/, "");

export const applicationSubmissionEnabled = Boolean(endpoint);

export async function submitApplication(application, signal) {
  if (!applicationSubmissionEnabled) throw new Error("APPLICATION_SUBMISSION_DISABLED");

  const response = await fetch(`${endpoint}/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(application),
    signal,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.accepted) {
    const error = new Error(result.error || "APPLICATION_SUBMISSION_FAILED");
    error.status = response.status;
    throw error;
  }
  return result;
}
