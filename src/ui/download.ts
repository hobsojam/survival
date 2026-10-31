/** The few page abilities a download needs, so it can be tested without a browser. */
export interface DownloadDoc {
  urlFor(text: string): string;
  createLink(href: string, name: string): { click(): void };
  release(url: string): void;
}

/** Saves text to a file on the player's device, under the given name. */
export function downloadText(doc: DownloadDoc, name: string, text: string): void {
  const url = doc.urlFor(text);
  doc.createLink(url, name).click();
  doc.release(url);
}

/** The browser's own way to do it: a text blob behind an `<a download>`. */
export function browserDownloadDoc(page: Document): DownloadDoc {
  return {
    urlFor: text => URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })),
    createLink: (href, name) => {
      const link = page.createElement('a');
      link.href = href;
      link.download = name;
      return link;
    },
    release: url => URL.revokeObjectURL(url)
  };
}
