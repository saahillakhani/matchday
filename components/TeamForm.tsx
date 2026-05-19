type FormResult = {
  gw: number;
  home: boolean;
  result: "W" | "L" | "D";
};

// Green win / red loss / grey draw, with H or A inside each circle.
const RESULT_BG: Record<FormResult["result"], string> = {
  W: "#2D6A4F",
  L: "#CC0000",
  D: "#888888",
};

export function TeamForm({
  form,
  align = "left",
}: {
  form: FormResult[];
  align?: "left" | "right";
}) {
  if (form.length === 0) return null;

  return (
    <div
      className={[
        "flex gap-1",
        align === "right" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      {form.map((r, i) => (
        // Index key: a team can play twice in one GW (double gameweek),
        // so r.gw isn't unique. The list never reorders, so index is safe.
        <span
          key={i}
          title={`GW ${r.gw} · ${r.home ? "Home" : "Away"} · ${
            r.result === "W" ? "Win" : r.result === "L" ? "Loss" : "Draw"
          }`}
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-mono font-semibold text-white"
          style={{ backgroundColor: RESULT_BG[r.result] }}
        >
          {r.home ? "H" : "A"}
        </span>
      ))}
    </div>
  );
}
