"use client";

import { useRef } from "react";

type Props = {
  home: number | null;
  away: number | null;
  onChange: (home: number | null, away: number | null) => void;
  disabled?: boolean;
};

export function ScoreInput({ home, away, onChange, disabled }: Props) {
  const awayRef = useRef<HTMLInputElement>(null);

  function parse(value: string): number | null {
    if (value === "") return null;
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 0 || n > 20) return null;
    return n;
  }

  function handleHome(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = parse(e.target.value);
    onChange(parsed, away);
    // Auto-advance focus once a single digit is in.
    if (parsed !== null && e.target.value.length >= 1) {
      awayRef.current?.focus();
      awayRef.current?.select();
    }
  }

  function handleAway(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = parse(e.target.value);
    onChange(home, parsed);
  }

  return (
    <div className="flex items-center gap-2">
      <Box
        value={home}
        onChange={handleHome}
        disabled={disabled}
        ariaLabel="Home score"
      />
      <span className="text-muted-foreground font-mono">—</span>
      <Box
        value={away}
        onChange={handleAway}
        disabled={disabled}
        inputRef={awayRef}
        ariaLabel="Away score"
      />
    </div>
  );
}

function Box({
  value,
  onChange,
  disabled,
  inputRef,
  ariaLabel,
}: {
  value: number | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  ariaLabel: string;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={value === null ? "" : String(value)}
      onChange={onChange}
      onFocus={(e) => e.target.select()}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder="·"
      className="w-12 h-12 text-center text-lg font-mono border border-border rounded-md bg-white focus:border-foreground focus:outline-none disabled:opacity-50 disabled:bg-muted"
    />
  );
}
