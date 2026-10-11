import { MongoClient, ObjectId } from "mongodb";
const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "roommates";
let db;
export function isReady() { return Boolean(db); }
export async function connect() {
  if (!uri) throw new Error("Falta MONGODB_URI");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(dbName);
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await db.collection("tasks").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("expenses").createIndex({ userId: 1, createdAt: -1 });
  console.log(`MongoDB conectado (${dbName})`);
  return db;
}
export const users = () => db.collection("users");
export const tasks = () => db.collection("tasks");
export const expenses = () => db.collection("expenses");
export function toId(value) { return ObjectId.isValid(value) ? new ObjectId(String(value)) : null; }
export function mapTask(doc) { return { id: String(doc._id), title: doc.title, assignee: doc.assignee || "" }; }
export function mapExpense(doc) { return { id: String(doc._id), desc: doc.desc, amount: doc.amount || 0, paidBy: doc.paidBy || "" }; }
