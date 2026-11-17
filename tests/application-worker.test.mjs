import test from "node:test";
import assert from "node:assert/strict";
import { buildManagerEmail, validateApplication } from "../application-worker/src/index.mjs";

const candidate = {
  idempotencyKey: "a7f5b75e-e239-42b6-b01f-72b25bb3f072",
  type: "candidate",
  source: "Kompas",
  website: "",
  fields: { fullName: " Ana López ", email: "ana@example.com", phone: "", city: "Madrid", area: "", company: "", need: "", message: "Busco trabajo." },
};

test("accepts and trims a valid candidate application", () => {
  const result = validateApplication(candidate);
  assert.equal(result.value.fields.fullName, "Ana López");
  assert.equal(result.value.type, "candidate");
});

test("rejects an invalid applicant email", () => {
  const result = validateApplication({ ...candidate, fields: { ...candidate.fields, email: "invalid" } });
  assert.match(result.error, /correo/i);
});

test("requires a candidate cover letter", () => {
  const result = validateApplication({ ...candidate, fields: { ...candidate.fields, message: "  " } });
  assert.match(result.error, /carta/i);
});

test("requires company and staffing need for employer applications", () => {
  const result = validateApplication({ ...candidate, type: "employer", fields: { ...candidate.fields, message: "", company: "", need: "" } });
  assert.match(result.error, /empresa/i);
});

test("silently accepts a filled honeypot as spam", () => {
  assert.equal(validateApplication({ ...candidate, website: "https://spam.example" }).spam, true);
});

test("escapes applicant content in the manager email", () => {
  const application = validateApplication({ ...candidate, fields: { ...candidate.fields, fullName: "<script>alert(1)</script>" } }).value;
  const email = buildManagerEmail(application);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
});
