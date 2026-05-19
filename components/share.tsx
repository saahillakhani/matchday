"use client";

import {
  forwardRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { toBlob } from "html-to-image";
import { Share2 } from "lucide-react";

/**
 * Off-screen, branded frame used purely as a screenshot source. Rendered
 * at natural (content) width and away from the viewport, so a wide picks
 * matrix captures in full instead of being clipped by the on-screen
 * horizontal scroll. The forwarded ref points at the styled inner div —
 * that's what ShareButton snapshots.
 */
export const ShareCapture = forwardRef<
  HTMLDivElement,
  { subtitle: string; children: ReactNode }
>(function ShareCapture({ subtitle, children }, ref) {
  return (
    <div
      aria-hidden
      style={{ position: "absolute", left: "-99999px", top: 0 }}
    >
      <div ref={ref} className="bg-background p-6 inline-block">
        <div className="flex items-baseline justify-between gap-8 pb-3 mb-4 border-b border-border">
          <span className="font-serif text-2xl font-semibold leading-none">
            The Matchday
          </span>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
            {subtitle}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
});

/**
 * Renders the ref'd node to a PNG and hands it to the native share sheet
 * (iOS/Android → WhatsApp etc.). Falls back to a file download where the
 * Web Share API can't take files (most desktop browsers).
 */
export function ShareButton({
  targetRef,
  filename,
  shareTitle,
}: {
  targetRef: RefObject<HTMLElement | null>;
  filename: string;
  shareTitle: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onShare() {
    const node = targetRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      await document.fonts.ready;
      const blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: "#F2EDE4",
        cacheBust: true,
      });
      if (!blob) return;
      const file = new File([blob], filename, { type: "image/png" });
      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: shareTitle });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Share sheet dismissed, or capture failed — nothing to surface.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
    >
      <Share2 className="w-3.5 h-3.5" />
      {busy ? "Preparing…" : "Share"}
    </button>
  );
}
