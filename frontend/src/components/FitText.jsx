// A summary-box amount. Its length goes to CSS as --fit-chars so the text can
// size itself to fit on one line: short amounts stay large, crore amounts
// shrink instead of overflowing (see styles/mobile.css).
function FitText({ as: Tag = "strong", children }) {
  const text = typeof children === "string" || typeof children === "number" ? String(children) : null;
  return <Tag style={text ? { "--fit-chars": text.length } : undefined}>{children}</Tag>;
}

export default FitText;
