import { useEffect, useRef, useState } from "react";
import "./RowMenu.css";

/**
 * A "⋯" button that opens a small menu of less-used row actions, so
 * destructive actions don't sit right next to everyday ones.
 * items: [{ label, onClick, danger? }]
 */
export default function RowMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClick(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div
      className="row-menu"
      ref={wrapperRef}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        className="row-menu__button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        ⋯
      </button>
      {open && (
        <div className="row-menu__list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`row-menu__item ${item.danger ? "is-danger" : ""}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
