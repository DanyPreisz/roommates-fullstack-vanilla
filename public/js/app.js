import { api, setSession, clearSession, getToken } from "./api.js";
const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const authForm = document.querySelector("#auth-form");
const authError = document.querySelector("#auth-error");
const authSubmit = document.querySelector("#auth-submit");
const tasksEl = document.querySelector("#tasks");
const expensesEl = document.querySelector("#expenses");
const taskForm = document.querySelector("#task-form");
const expenseForm = document.querySelector("#expense-form");
const formError = document.querySelector("#form-error");
let mode = "login";
const showError = (el, message) => { el.hidden = !message; el.textContent = message || ""; };

function setMode(next) {
  mode = next;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  authSubmit.textContent = mode === "login" ? "Entrar" : "Crear cuenta";
}
async function refresh() {
  const tData = await api("/api/tasks");
  tasksEl.innerHTML = "<h3>Tareas</h3>";
  tData.tasks.forEach((t) => {
    const box = document.createElement("div");
    box.className = "item";
    box.innerHTML = `<strong>${t.title}</strong> \u00b7 ${t.assignee || "sin asignar"}`;
    const del = document.createElement("button");
    del.className = "ghost";
    del.textContent = "Borrar";
    del.addEventListener("click", async () => { await api(`/api/tasks/${t.id}`, { method: "DELETE" }); await refresh(); });
    box.append(del);
    tasksEl.append(box);
  });
  const eData = await api("/api/expenses");
  expensesEl.innerHTML = "<h3>Gastos</h3>";
  eData.expenses.forEach((e) => {
    const box = document.createElement("div");
    box.className = "item";
    box.innerHTML = `<strong>${e.desc}</strong> \u00b7 $${e.amount} \u00b7 pagado por ${e.paidBy || "?"}`;
    const del = document.createElement("button");
    del.className = "ghost";
    del.textContent = "Borrar";
    del.addEventListener("click", async () => { await api(`/api/expenses/${e.id}`, { method: "DELETE" }); await refresh(); });
    box.append(del);
    expensesEl.append(box);
  });
}
async function boot() {
  if (!getToken()) return;
  try {
    const { user } = await api("/api/auth/me");
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    document.querySelector("#user-name").textContent = user.username;
    await refresh();
  } catch { clearSession(); }
}
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(authError, "");
  const fd = new FormData(authForm);
  try {
    const data = await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }) });
    setSession(data.token);
    authForm.reset();
    await boot();
  } catch (err) { showError(authError, err.message); }
});
document.querySelector("#logout").addEventListener("click", () => { clearSession(); appView.classList.add("hidden"); authView.classList.remove("hidden"); });
taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(formError, "");
  try {
    await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: document.querySelector("#task-title").value.trim(), assignee: document.querySelector("#task-assignee").value.trim() }) });
    taskForm.reset();
    await refresh();
  } catch (err) { showError(formError, err.message); }
});
expenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(formError, "");
  try {
    await api("/api/expenses", { method: "POST", body: JSON.stringify({ desc: document.querySelector("#exp-desc").value.trim(), amount: document.querySelector("#exp-amount").value, paidBy: document.querySelector("#exp-paid").value.trim() }) });
    expenseForm.reset();
    await refresh();
  } catch (err) { showError(formError, err.message); }
});
boot();
