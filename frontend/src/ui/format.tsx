import { useState } from "react";
import type { AssetKind, StageName, StageState } from "../domain/types";

export const short = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export const KIND_LABEL: Record<AssetKind, string> = { document: "Markdown", html: "HTML page", image: "PNG image" };

export const STAGE_LABEL: Record<StageName, string> = {
  approval: "Token approval",
  purchase: "Purchase",
  admission: "Admission",
  execution: "Execution",
  callback: "Callback",
  binding: "Binding",
  files: "File verification",
  git: "Git",
  publication: "Publication",
};

export const STATE_LABEL: Record<StageState, string> = {
  not_started: "Not started",
  pending: "Pending",
  confirmed: "Confirmed",
  unknown: "Unknown; reconcile",
  refused: "Refused (status 1)",
  failed: "Failed",
  frozen: "Frozen",
  not_applicable: "Not applicable",
};

export function formatUnits(v: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function parseUnits(s: string, decimals: number): bigint | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m || (m[2] && m[2].length > decimals)) return null;
  return BigInt(m[1]) * 10n ** BigInt(decimals) + BigInt((m[2] ?? "").padEnd(decimals, "0") || "0");
}

export const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { hour12: false }) : "Not observed");

/** An identifier shown secondary but whole, with a copy button. Never clipped. */
export function CopyId({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copy-id">
      <code className="mono id-text">{value}</code>
      <button
        type="button"
        className="btn btn-link"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy "}
      </button>
    </span>
  );
}
