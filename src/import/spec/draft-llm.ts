// Port to the language model that drafts rules, state machines and intents. The domain only
// sends a prompt and reads text back; the claude -p adapter lives in src/adapters/llm/, and
// tests pass a fake.

export interface DraftLlm {
  /** One completion for one prompt. Rejects when the model cannot be reached. */
  complete(prompt: string): Promise<string>;
}
