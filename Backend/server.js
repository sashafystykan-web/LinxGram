import express from "express";
import { MongoClient } from "mongodb";

const app = express();
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

const users = client.db("linxgram").collection("users");
await users.createIndex({ username: 1 }, { unique: true });

// Авто-регистрация / обновление ника
app.post("/api/register", async (req, res) => {
  const username = String(req.body.username || "")
    .trim()
    .replace(/^@/, "");

  if (!username) return res.status(400).json({ error: "username" });

  await users.updateOne(
    { username },
    {
      $set: {
        username,
        lastSeenAt: new Date(),
        badge: {
          name: "LinxGram",
          imageUrl: "" // ← сюда вставишь ссылку на картинку
        }
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );

  res.json({ ok: true });
});

// Список пользователей с бейджем
app.get("/api/badges", async (_, res) => {
  const list = await users.find(
    { "badge.name": "LinxGram" },
    { projection: { _id: 0, username: 1, badge: 1 } }
  ).toArray();

  res.json(list);
});

app.listen(process.env.PORT || 3000);