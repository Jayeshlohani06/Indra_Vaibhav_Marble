import { useEffect, useState } from "react";
import {
  createUser,
  getUsers,
  resetBusinessData,
  setUserStatus,
  updateUser,
} from "../../services/api/userApi";
import "./UserManagementPage.css";
import RowMenu from "../../components/RowMenu";
import { label } from "../../utils/format";
import { t } from "../../i18n";

const ROLES = ["ADMIN", "OWNER", "ACCOUNTANT", "SALESPERSON", "INVENTORY_MANAGER", "VIEWER"];
const blank = { fullName: "", email: "", password: "", roles: ["VIEWER"] };

export default function UserManagementPage({ isAdmin }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetForm, setResetForm] = useState({
    password: "",
    confirmation: "",
    acknowledged: false,
  });
  const [resetting, setResetting] = useState(false);

  async function load() {
    try { setUsers(await getUsers()); setError(""); }
    catch (err) { setError(err.message || t("Unable to load users.")); }
  }
  useEffect(() => { load(); }, []);

  function openForm(user) {
    setEditing(user?.id || null);
    setForm(user ? { fullName: user.fullName, email: user.email, password: "", roles: user.roles } : { ...blank });
    setShowForm(true); setError("");
  }

  function toggleRole(role) {
    setForm((previous) => ({
      ...previous,
      roles: previous.roles.includes(role)
        ? previous.roles.filter((item) => item !== role)
        : [...previous.roles, role],
    }));
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      if (editing) await updateUser(editing, form); else await createUser(form);
      setShowForm(false); await load();
    } catch (err) { setError(err.message || t("Unable to save user.")); }
    finally { setSaving(false); }
  }

  async function changeStatus(user) {
    try { await setUserStatus(user.id, !user.active); await load(); }
    catch (err) { setError(err.message || t("Unable to update user status.")); }
  }

  async function submitReset(event) {
    event.preventDefault();
    if (!resetForm.acknowledged) {
      setError(t("Acknowledge both warnings before continuing."));
      return;
    }
    setResetting(true);
    setError("");
    try {
      await resetBusinessData({
        password: resetForm.password,
        confirmation: resetForm.confirmation,
      });
      setResetForm({ password: "", confirmation: "", acknowledged: false });
      setShowReset(false);
      await load();
    } catch (err) {
      setError(err.message || t("Unable to remove business data."));
    } finally {
      setResetting(false);
    }
  }

  return <section className="users-page">
    <div className="users-header"><span>{t("Staff who can log in, and what each of them is allowed to do.")}</span><div className="users-header-actions"><button type="button" className="users-primary-button" onClick={() => openForm()}>{t("+ Add user")}</button></div></div>
    {error && <div className="users-error" role="alert">{error}</div>}
    <div className="users-summary"><strong>{users.length}</strong><span>{t("Total accounts")}</span><strong>{users.filter((user) => user.active).length}</strong><span>{t("Active accounts")}</span></div>
    <div className="users-table-wrap"><table className="stack-on-phone"><thead><tr><th>{t("Name")}</th><th>{t("Email")}</th><th>{t("Role")}</th><th>{t("Status")}</th><th><span className="visually-hidden">{t("Actions")}</span></th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td data-label={t("Name")}><strong>{user.fullName}</strong></td><td data-label={t("Email")}>{user.email}</td><td data-label={t("Role")}><div className="users-roles">{user.roles.map((role) => <span key={role}>{label(role)}</span>)}</div></td><td data-label={t("Status")}><span className={user.active ? "users-active" : "users-inactive"}>{user.active ? t("Active") : t("Inactive")}</span></td><td><div className="users-row-actions"><button onClick={() => openForm(user)}>{t("Edit")}</button><RowMenu label={t("More actions for {name}", { name: user.fullName })} items={[{ label: user.active ? t("Deactivate user") : t("Reactivate user"), onClick: () => changeStatus(user), danger: user.active }]} /></div></td></tr>)}</tbody></table></div>
    {showForm && <div className="users-modal-bg"><form className="users-modal" onSubmit={submit}><h3>{editing ? t("Edit user") : t("Create user")}</h3><label>{t("Full name")}<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label><label>{t("Email")}<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>{t("Password")} {editing && t("(leave blank to keep current)")}<input required={!editing} minLength="8" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><fieldset><legend>{t("Roles")}</legend>{ROLES.map((role) => <label key={role} className="users-role-option"><input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />{label(role)}</label>)}</fieldset><div className="users-modal-actions"><button type="button" onClick={() => setShowForm(false)}>{t("Cancel")}</button><button disabled={saving} type="submit">{saving ? t("Saving...") : t("Save user")}</button></div></form></div>}
    {isAdmin && <section className="users-danger-zone" aria-labelledby="users-danger-heading"><div><h3 id="users-danger-heading">{t("Danger zone")}</h3><p>{t("Permanently delete all products, bills, purchases and customers. Only use this when starting fresh.")}</p></div><button className="users-danger-button" type="button" onClick={() => { setShowReset(true); setError(""); }}>{t("Remove business data")}</button></section>}
    {showReset && <div className="users-modal-bg"><form className="users-modal users-danger-modal" onSubmit={submitReset}><h3>{t("Remove all business data")}</h3><p className="users-danger-intro">{t("This permanently removes business records while preserving users, roles, permissions, settings, and the database structure.")}</p><div className="users-warning"><strong>{t("Warning 1: This cannot be undone.")}</strong><span>{t("Products, customers, suppliers, sales, purchases, expenses, stock movements, payments, categories, and units will be deleted.")}</span></div><div className="users-warning"><strong>{t("Warning 2: Stop and verify the environment.")}</strong><span>{t("Do not use this on production unless you intentionally want to empty the business database.")}</span></div><label className="users-checkbox"><input type="checkbox" checked={resetForm.acknowledged} onChange={(event) => setResetForm({ ...resetForm, acknowledged: event.target.checked })} />{t("I understand both warnings and want to permanently remove business data.")}</label><label>{t("Current Admin password")}<input required type="password" autoComplete="current-password" value={resetForm.password} onChange={(event) => setResetForm({ ...resetForm, password: event.target.value })} /></label><label>{t("Type {phrase} to confirm").split("{phrase}")[0]}<strong>DELETE ALL BUSINESS DATA</strong>{t("Type {phrase} to confirm").split("{phrase}")[1]}<input required value={resetForm.confirmation} onChange={(event) => setResetForm({ ...resetForm, confirmation: event.target.value })} /></label><div className="users-modal-actions"><button type="button" onClick={() => setShowReset(false)} disabled={resetting}>{t("Cancel")}</button><button className="users-danger-submit" disabled={resetting || !resetForm.acknowledged} type="submit">{resetting ? t("Removing data...") : t("Remove all business data")}</button></div></form></div>}
  </section>;
}
