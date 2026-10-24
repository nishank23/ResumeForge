export const key = "synthetic-private-service-key-for-tests-only";
export const jdText =
  "Requirements\nPython experience is required.\nPreferred: experience with PostgreSQL databases.";
export const input = {
  jdText,
  sources: [
    {
      id: "experience:one",
      kind: "experience",
      text: "Built Python services to process daily inventory transactions.",
    },
  ],
};
export const row = (overrides = {}) => ({
  id: "python",
  requirement: "Python experience",
  jdQuote: "Python experience is required.",
  importance: "required",
  status: "supported",
  evidence: [
    {
      sourceId: "experience:one",
      quote: "Built Python services to process daily inventory transactions.",
    },
  ],
  ...overrides,
});
export const envelope = (requirements = [row()]) => ({
  candidates: [
    {
      finishReason: "STOP",
      content: { parts: [{ text: JSON.stringify({ requirements }) }] },
    },
  ],
});
export const response = (requirements = [row()]) =>
  new Response(JSON.stringify(envelope(requirements)), {
    headers: { "Content-Type": "application/json" },
  });
