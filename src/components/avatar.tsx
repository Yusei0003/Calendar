import type { AccentColor } from "@/lib/types";

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

/** 名前の先頭1文字を、その人のアクセント色の丸で表示する。 */
export function Avatar({
  name,
  color,
  size = "md",
  className = "",
}: {
  name: string;
  color: AccentColor;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`a-${color} ${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{
        background: "var(--accent-soft)",
        color: "var(--accent-ink)",
        boxShadow: "inset 0 0 0 1.5px var(--accent)",
      }}
    >
      {name.slice(0, 1)}
    </span>
  );
}
