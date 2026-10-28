// Grey placeholder bars in the shape of a list while it loads, so the page
// doesn't jump when the rows arrive. Screen readers hear the label instead.
//
//   <Skeleton label={t("Loading expenses...")} />
//   <Skeleton variant="cards" rows={3} />
//   <Skeleton.Inline />   — one bar in place of a number
function Skeleton({ label, rows = 5, columns = 4, variant = "rows" }) {
  return (
    <div className={`skeleton skeleton--${variant}`} role="status">
      {label && <span className="visually-hidden">{label}</span>}
      {Array.from({ length: rows }, (_, row) => (
        <div className="skeleton__row" key={row} aria-hidden="true">
          {Array.from({ length: variant === "cards" ? 2 : columns }, (_, column) => (
            <span className="skeleton__bar" key={column} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonInline({ label }) {
  return (
    <span className="skeleton__bar skeleton__bar--inline" role="status">
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}

Skeleton.Inline = SkeletonInline;

export default Skeleton;
