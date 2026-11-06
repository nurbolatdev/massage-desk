// The mark and wordmark in the light-on-dark variant used on the dark panels.
type BrandLogoProps = {
  mark: 44 | 34 | 28;
  text: "title-s" | "subtitle";
};

const GAP: Record<BrandLogoProps["mark"], string> = {
  44: "gap-12",
  34: "gap-10",
  28: "gap-10",
};

const TEXT: Record<BrandLogoProps["text"], string> = {
  "title-s": "text-title-s",
  subtitle: "text-subtitle",
};

export function BrandLogo({ mark, text }: BrandLogoProps) {
  return (
    <div className={`flex items-center ${GAP[mark]}`}>
      <svg width={mark} height={mark} viewBox="0 0 1024 1024" aria-hidden="true">
        <ellipse cx="512" cy="732" rx="292" ry="104" className="fill-primary-mid" />
        <ellipse cx="512" cy="556" rx="214" ry="86" className="fill-brand-mid" />
        <ellipse cx="512" cy="404" rx="140" ry="64" className="fill-stone-light" />
        <circle cx="512" cy="272" r="58" className="fill-accent" />
      </svg>
      <span className={`${TEXT[text]} font-extrabold text-surface`}>
        massage<span className="font-medium text-stone-light"> desk</span>
      </span>
    </div>
  );
}
