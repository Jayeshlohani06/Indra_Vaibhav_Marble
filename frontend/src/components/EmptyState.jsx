// What a list shows when there is nothing in it: a short title, one line on
// what to do, and the button that does it.
//
//   <EmptyState icon="money" text={t("No expenses yet. Tap + Add expense to record tea, fuel, salary or any other spending.")}
//     actionLabel={t("+ Add expense")} onAction={openCreate} />

const ICONS = {
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  search: <path d="m20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z" />,
  money: <path d="M3 7h18v10H3zM7 7v10M17 7v10M12 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />,
  check: <path d="M20 6 9 17l-5-5" />,
};

function EmptyState({ title, text, actionLabel, onAction, icon = "list" }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">{ICONS[icon] || ICONS.list}</svg>
      </span>
      {title && <p className="empty-state__title">{title}</p>}
      {text && <p className="empty-state__text">{text}</p>}
      {actionLabel && onAction && (
        <button type="button" className="empty-state__action erp-primary-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
