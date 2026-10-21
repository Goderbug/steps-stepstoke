import { useState } from "react";
import type { AssetKind, StageName, StageState } from "../domain/types";

export const short = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export const KIND_LABEL: Record<AssetKind, string> = { document: "文档", html: "单页网站", image: "图片" };

export const STAGE_LABEL: Record<StageName, string> = {
  approval: "授权额度",
  purchase: "购买交易",
  admission: "IMD 受理",
  execution: "IMD 执行",
  callback: "回调",
  binding: "绑定",
  files: "文件校验",
  git: "Git",
  publication: "网站发布",
};

export const STATE_LABEL: Record<StageState, string> = {
  not_started: "未开始",
  pending: "等待中",
  confirmed: "已确认",
  unknown: "未知，待对账",
  refused: "已拒绝（状态 1）",
  failed: "失败",
  frozen: "已冻结",
  not_applicable: "不适用",
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

export const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("zh-CN", { hour12: false }) : "未观察到");

/** An identifier shown secondary but whole, with a copy button. Never clipped. */
export function CopyId({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copy-id">
      <code className="mono id-text">{value}</code>
      <button
        type="button"
        className="btn btn-link"
        aria-label={`复制${label}`}
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
        {copied ? "已复制" : "复制"}
      </button>
    </span>
  );
}
