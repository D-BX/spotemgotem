// Ambient types for the Document Picture-in-Picture API, which isn't yet in the
// standard DOM lib. Chromium-only; feature-detected at runtime via
// `window.documentPictureInPicture`. See:
// https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API

interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
  preferInitialWindowPlacement?: boolean;
}

interface DocumentPictureInPicture extends EventTarget {
  readonly window: Window | null;
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  onenter: ((this: DocumentPictureInPicture, ev: Event) => unknown) | null;
}

interface Window {
  readonly documentPictureInPicture?: DocumentPictureInPicture;
}
