/** How long a message has the line to itself before a new one replaces it rather than joining it. */
export const MESSAGE_MERGE_MS = 300;

/**
 * What the message line shows. Messages said close together are shown together, so a journal line noticed on the
 * first tick of a morning joins the morning's notes instead of wiping them out before they can be read.
 */
export class MessageLine {
  private last: { text: string; at: number } | null = null;

  /** The text to show now that `text` has been said at `nowMs`. */
  say(text: string, nowMs: number): string {
    const last = this.last;
    if (last && nowMs - last.at <= MESSAGE_MERGE_MS) {
      const joined = last.text.endsWith(text) ? last.text : `${last.text} ${text}`;
      this.last = { text: joined, at: last.at };
      return joined;
    }
    this.last = { text, at: nowMs };
    return text;
  }
}
