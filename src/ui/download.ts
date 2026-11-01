/** The few page abilities a download needs, so it can be tested without a browser. */
export interface DownloadDoc {
  urlFor(text: string): string;
  createLink(href: string, name: string): { click(): void; remove(): void };
  release(url: string): void;
  /** Runs a little later, once the browser has taken the download. */
  later(run: () => void): void;
}

/** Saves text to a file on the player's device, under the given name. */
export function downloadText(doc: DownloadDoc, name: string, text: string): void {
  const url = doc.urlFor(text);
  const link = doc.createLink(url, name);
  link.click();
  // Some phone browsers cancel a download whose address is let go at once, so that waits a moment.
  doc.later(() => {
    link.remove();
    doc.release(url);
  });
}

/** The browser's own way to do it: a text blob behind an `<a download>`. */
export function browserDownloadDoc(page: Document): DownloadDoc {
  return {
    urlFor: text => URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })),
    createLink: (href, name) => {
      const link = page.createElement('a');
      link.href = href;
      link.download = name;
      link.hidden = true;
      // A link in the page downloads on every browser; some ignore a click on one that isn't.
      page.body.append(link);
      return link;
    },
    release: url => URL.revokeObjectURL(url),
    later: run => { window.setTimeout(run, 1000); }
  };
}
