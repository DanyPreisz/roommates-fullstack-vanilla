import { URL } from "node:url";
import { connect, expenses, isReady, mapExpense, mapTask, tasks, toId, users } from "./db.js";
import { createApp, readJson, sendEmpty, sendJson, serveStatic } from "./http.js";
import { getUserFromRequest, hashPassword, signToken, verifyPassword } from "./middleware/auth.js";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
function usernameQuery(username) { return new RegExp("^" + username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"); }
function requireUser(req, res) { const user = getUserFromRequest(req); if (!user) { sendJson(res, 401, { error: "No autenticado" }); return null; } return user; }

const server = createApp(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;
  const method = req.method || "GET";
  if (pathname === "/health") return sendJson(res, 200, { ok: true, db: isReady() });
  if (pathname.startsWith("/api/") && !isReady()) return sendJson(res, 503, { error: "Base no lista" });
  if (!pathname.startsWith("/api/")) return serveStatic(req, res);

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!USERNAME_RE.test(username)) return sendJson(res, 400, { error: "Usuario: 3-20 caracteres, letras, numeros y _" });
    if (password.length < 6) return sendJson(res, 400, { error: "La contrasena debe tener al menos 6 caracteres" });
    if (await users().findOne({ username: usernameQuery(username) })) return sendJson(res, 409, { error: "Ese usuario ya existe" });
    const result = await users().insertOne({ username, passwordHash: hashPassword(password), createdAt: new Date() });
    const user = { id: String(result.insertedId), username };
    return sendJson(res, 201, { user, token: signToken(user) });
  }
  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const row = await users().findOne({ username: usernameQuery(username) });
    if (!row || !verifyPassword(String(body.password || ""), row.passwordHash)) return sendJson(res, 401, { error: "Usuario o contrasena incorrectos" });
    const user = { id: String(row._id), username: row.username };
    return sendJson(res, 200, { user, token: signToken(user) });
  }
  if (method === "GET" && pathname === "/api/auth/me") {
    const user = requireUser(req, res);
    if (!user) return;
    return sendJson(res, 200, { user });
  }

  const user = requireUser(req, res);
  if (!user) return;
  const userId = user.id;

  if (method === "GET" && pathname === "/api/tasks") {
    const rows = await tasks().find({ userId }).sort({ createdAt: -1 }).limit(20).toArray();
    return sendJson(res, 200, { tasks: rows.map(mapTask) });
  }
  if (method === "POST" && pathname === "/api/tasks") {
    const body = await readJson(req);
    const title = String(body.title || "").trim();
    if (!title) return sendJson(res, 400, { error: "El titulo es obligatorio" });
    const result = await tasks().insertOne({ userId, title: title.slice(0, 60), assignee: String(body.assignee || "").slice(0, 20), createdAt: new Date() });
    return sendJson(res, 201, { task: mapTask(await tasks().findOne({ _id: result.insertedId })) });
  }
  const delTask = pathname.match(/^\/api\/tasks\/([a-fA-F0-9]{24})$/);
  if (delTask && method === "DELETE") {
    const result = await tasks().deleteOne({ _id: toId(delTask[1]), userId });
    if (!result.deletedCount) return sendJson(res, 404, { error: "Tarea no encontrada" });
    return sendEmpty(res, 204);
  }

  if (method === "GET" && pathname === "/api/expenses") {
    const rows = await expenses().find({ userId }).sort({ createdAt: -1 }).limit(20).toArray();
    return sendJson(res, 200, { expenses: rows.map(mapExpense) });
  }
  if (method === "POST" && pathname === "/api/expenses") {
    const body = await readJson(req);
    const desc = String(body.desc || "").trim();
    if (!desc) return sendJson(res, 400, { error: "La descripcion es obligatoria" });
    const result = await expenses().insertOne({ userId, desc: desc.slice(0, 60), amount: Number(body.amount) || 0, paidBy: String(body.paidBy || "").slice(0, 20), createdAt: new Date() });
    return sendJson(res, 201, { expense: mapExpense(await expenses().findOne({ _id: result.insertedId })) });
  }
  const delExp = pathname.match(/^\/api\/expenses\/([a-fA-F0-9]{24})$/);
  if (delExp && method === "DELETE") {
    const result = await expenses().deleteOne({ _id: toId(delExp[1]), userId });
    if (!result.deletedCount) return sendJson(res, 404, { error: "Gasto no encontrado" });
    return sendEmpty(res, 204);
  }
  sendJson(res, 404, { error: "Ruta no encontrada" });
});

server.listen(PORT, HOST, () => console.log(`Roommates en http://${HOST}:${PORT}`));
async function bootDb() { for (;;) { try { await connect(); return; } catch (err) { console.error("Mongo no disponible:", err.message); await new Promise((resolve) => setTimeout(resolve, 5000)); } } }
bootDb();
