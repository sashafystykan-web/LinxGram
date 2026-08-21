import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();

app.use(cors({
  origin: [
    "https://unixgram.com",
    "https://www.unixgram.com"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

await client.connect();

const db = client.db("linxgram");
const users = db.collection("users");

await users.createIndex(
  { username: 1 },
  { unique: true }
);

// Проверка сервера
app.get("/", (_, res) => {
  res.json({
    ok: true,
    service: "LinxGram API"
  });
});

// Авто-регистрация / обновление ника
app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body.username || "")
      .trim()
      .replace(/^@/, "");

    if (!username) {
      return res.status(400).json({
        error: "username"
      });
    }

    await users.updateOne(
      { username },
      {
        $set: {
          username,
          lastSeenAt: new Date(),
          badge: {
            name: "LinxGram",
            imageUrl: "https://i.postimg.cc/MTpLFWKr/image.png"
          }
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    res.json({
      ok: true
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      error: "server"
    });
  }
});

// Список пользователей с бейджем
app.get("/api/badges", async (_, res) => {
  try {
    const list = await users.find(
      { "badge.name": "LinxGram" },
      {
        projection: {
          _id: 0,
          username: 1,
          badge: 1
        }
      }
    ).toArray();

    res.json(list);

  } catch (error) {
    console.error("BADGES ERROR:", error);

    res.status(500).json({
      error: "server"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LinxGram API running on port ${PORT}`);
});
