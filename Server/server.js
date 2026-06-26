import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import axios from "axios";
import Razorpay from "razorpay";
import crypto from "crypto";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `
You are AI Chat, a helpful assistant like ChatGPT.

Rules:
- Reply in the same language as the user.
- If user writes in Hindi or Hinglish, reply in simple Hinglish.
- Give clear, complete and practical answers.
- For coding questions, give full working code when user asks "full code".
- Explain exactly where to paste the code.
- Do not give too short answers unless user asks "short".
- Be friendly, direct and helpful.
- If user is confused, guide step-by-step.
`;

function buildGroqMessages(messages = [], currentMessage = "") {
  const history = (messages || [])
    .filter((msg) => msg?.text && msg?.sender)
    .slice(-12)
    .map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text,
    }));

  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: currentMessage },
  ];
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => console.log("MongoDB Error:", err.message));

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true, trim: true },
    password: String,
    messageCount: { type: Number, default: 0 },
    isPremium: { type: Boolean, default: false },
    premiumExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

const messageSchema = new mongoose.Schema(
  {
    id: String,
    sender: String,
    text: String,
    files: Array,
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    userId: String,
    chatId: String,
    title: String,
    messages: [messageSchema],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Chat = mongoose.model("Chat", chatSchema);

app.get("/", (req, res) => {
  res.send("AI Chat Backend Running With Groq + Razorpay + Streaming 🚀");
});

app.post("/signup", async (req, res) => {
  try {
    let { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    email = email.toLowerCase().trim();

    const exist = await User.findOne({ email });
    if (exist) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hash });

    res.json({
      success: true,
      message: "Signup Successful",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        messageCount: newUser.messageCount,
        isPremium: newUser.isPremium,
        premiumExpiry: newUser.premiumExpiry,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    email = email.toLowerCase().trim();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found. Please signup first." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ message: "Wrong password" });
    }

    res.json({
      success: true,
      message: "Login Successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        messageCount: user.messageCount,
        isPremium: user.isPremium,
        premiumExpiry: user.premiumExpiry,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/user/:userId/status", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const premiumActive =
      user.isPremium &&
      user.premiumExpiry &&
      new Date(user.premiumExpiry) > new Date();

    if (user.isPremium && !premiumActive) {
      user.isPremium = false;
      await user.save();
    }

    res.json({
      success: true,
      messageCount: user.messageCount,
      freeMessagesLeft: Math.max(10 - user.messageCount, 0),
      isPremium: premiumActive,
      premiumExpiry: user.premiumExpiry,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/payment/create-order", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const order = await razorpay.orders.create({
      amount: 100 * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId,
        plan: "monthly_premium",
      },
    });

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/payment/verify", async (req, res) => {
  try {
    const {
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isPremium: true,
        premiumExpiry: expiry,
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Premium activated for 1 month",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        messageCount: user.messageCount,
        isPremium: user.isPremium,
        premiumExpiry: user.premiumExpiry,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/chats/:userId", async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.params.userId }).sort({
      updatedAt: -1,
    });

    res.json({
      success: true,
      chats: chats.map((chat) => ({
        id: chat.chatId,
        title: chat.title,
        messages: chat.messages,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/chats/save", async (req, res) => {
  try {
    const { userId, chatId, title, messages } = req.body;

    if (!userId || !chatId) {
      return res.status(400).json({ error: "userId and chatId required" });
    }

    const savedChat = await Chat.findOneAndUpdate(
      { userId, chatId },
      {
        userId,
        chatId,
        title: title || "New Chat",
        messages: messages || [],
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, chat: savedChat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/chats/:userId/:chatId", async (req, res) => {
  try {
    await Chat.findOneAndDelete({
      userId: req.params.userId,
      chatId: req.params.chatId,
    });

    res.json({ success: true, message: "Chat deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function checkUserLimit(userId) {
  if (!userId) {
    return { ok: false, status: 400, error: "userId required" };
  }

  const user = await User.findById(userId);

  if (!user) {
    return { ok: false, status: 400, error: "User not found" };
  }

  const premiumActive =
    user.isPremium &&
    user.premiumExpiry &&
    new Date(user.premiumExpiry) > new Date();

  if (user.isPremium && !premiumActive) {
    user.isPremium = false;
    await user.save();
  }

  if (!premiumActive && user.messageCount >= 10) {
    return {
      ok: false,
      status: 402,
      paymentRequired: true,
      error: "Free 10 messages completed. Pay ₹100 for 1 month unlimited chat.",
    };
  }

  return { ok: true, user, premiumActive };
}

app.post("/chat", async (req, res) => {
  try {
    const { message, userId, chatId, title, messages } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    const limit = await checkUserLimit(userId);

    if (!limit.ok) {
      return res.status(limit.status).json({
        paymentRequired: limit.paymentRequired || false,
        error: limit.error,
      });
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY missing in .env file" });
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: buildGroqMessages(messages, message),
        temperature: 0.4,
        max_tokens: 2048,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = response.data.choices[0].message.content;

    if (!limit.premiumActive) {
      limit.user.messageCount += 1;
      await limit.user.save();
    }

    if (userId && chatId) {
      const aiMessage = {
        id: crypto.randomUUID(),
        sender: "ai",
        text: reply,
        files: [],
      };

      await Chat.findOneAndUpdate(
        { userId, chatId },
        {
          userId,
          chatId,
          title: title || "New Chat",
          messages: [...(messages || []), aiMessage],
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      reply,
      messageCount: limit.user.messageCount,
      freeMessagesLeft: Math.max(10 - limit.user.messageCount, 0),
      isPremium: limit.premiumActive,
    });
  } catch (err) {
    console.log("Groq Error:", err.response?.data || err.message);

    res.status(err.response?.status || 500).json({
      error: err.response?.data?.error?.message || err.message,
    });
  }
});

app.post("/chat-stream", async (req, res) => {
  try {
    const { message, userId, chatId, title, messages } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    const limit = await checkUserLimit(userId);

    if (!limit.ok) {
      return res.status(limit.status).json({
        paymentRequired: limit.paymentRequired || false,
        error: limit.error,
      });
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY missing in .env file" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        stream: true,
        messages: buildGroqMessages(messages, message),
        temperature: 0.4,
        max_tokens: 2048,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "stream",
      }
    );

    let fullReply = "";

    response.data.on("data", (chunk) => {
      const lines = chunk
        .toString()
        .split("\n")
        .filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        const data = line.replace("data:", "").trim();

        if (data === "[DONE]") {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content || "";

          if (token) {
            fullReply += token;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
        } catch (err) {
          console.log("Stream parse error:", err.message);
        }
      }
    });

    response.data.on("end", async () => {
      try {
        if (!limit.premiumActive) {
          limit.user.messageCount += 1;
          await limit.user.save();
        }

        if (userId && chatId) {
          const aiMessage = {
            id: crypto.randomUUID(),
            sender: "ai",
            text: fullReply,
            files: [],
          };

          await Chat.findOneAndUpdate(
            { userId, chatId },
            {
              userId,
              chatId,
              title: title || "New Chat",
              messages: [...(messages || []), aiMessage],
            },
            { upsert: true, new: true }
          );
        }

        res.write(
          `data: ${JSON.stringify({
            done: true,
            fullReply,
            messageCount: limit.user.messageCount,
            freeMessagesLeft: Math.max(10 - limit.user.messageCount, 0),
            isPremium: limit.premiumActive,
          })}\n\n`
        );

        res.end();
      } catch (err) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    });

    response.data.on("error", (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
  } catch (err) {
    console.log("Stream Error:", err.response?.data || err.message);

    if (!res.headersSent) {
      return res.status(err.response?.status || 500).json({
        error: err.response?.data?.error?.message || err.message,
      });
    }

    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server Running On ${PORT}`);
});