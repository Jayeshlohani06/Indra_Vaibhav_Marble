import { useEffect, useId, useMemo, useRef, useState } from "react";
import "./SearchSelect.css";
import { t } from "../i18n";

/**
 * A select box you can type into to filter long lists.
 * options: [{ value, label, hint? }]
 */
export default function SearchSelect({
  id,
  options,
  value,
  onChange,
  placeholder = t("Type to search"),
  required = false,
  disabled = false,
  emptyText = t("No matches"),
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listId = `${inputId}-list`;
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((option) => String(option.value) === String(value));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) =>
      `${option.label} ${option.hint || ""}`.toLowerCase().includes(term)
    );
  }, [options, query]);

  // Tell the browser's form validation when a required choice is missing.
  useEffect(() => {
    inputRef.current?.setCustomValidity(
      required && !selected ? t("Please choose an option from the list.") : ""
    );
  }, [required, selected]);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function choose(option) {
    onChange(String(option.value));
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (filtered[activeIndex]) choose(filtered[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="search-select" ref={wrapperRef}>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : selected?.label || ""}
        onFocus={() => {
          setOpen(true);
          setActiveIndex(0);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
      />
      {selected?.hint && !open && <small className="search-select__hint">{selected.hint}</small>}
      {open && (
        <ul className="search-select__list" id={listId} role="listbox">
          {filtered.length === 0 ? (
            <li className="search-select__empty">{emptyText}</li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={String(option.value) === String(value)}
                className={`search-select__option ${index === activeIndex ? "is-active" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span>{option.label}</span>
                {option.hint && <small>{option.hint}</small>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
