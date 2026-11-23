// server.js
// Express backend server for the authentication flow

import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Import user model
import User from "./db/userModel.js";
import { readHistory } from "./memory.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "antigravity-super-secret-key-123456";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/auth_db";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Database Connection and Fallback Store Setup
let isDbConnected = false;
const inMemoryDb = {
  users: [],
};

// Check if a backup local user database exists to persist mock users
const MOCK_DB_PATH = path.join(__dirname, "db", "mock_users.json");
if (fs.existsSync(MOCK_DB_PATH)) {
  try {
    const data = fs.readFileSync(MOCK_DB_PATH, "utf8");
    inMemoryDb.users = JSON.parse(data);
    console.log(`[Backup DB] Loaded ${inMemoryDb.users.length} mock users from file.`);
  } catch (err) {
    console.error("[Backup DB] Error reading mock db:", err.message);
  }
}

function saveMockDb() {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(inMemoryDb.users, null, 2));
  } catch (err) {
    console.error("[Backup DB] Error writing mock db:", err.message);
  }
}

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 3000, // Quick timeout so the server doesn't hang
  })
  .then(() => {
    isDbConnected = true;
    console.log("🟢 Connected to MongoDB at", MONGODB_URI);
  })
  .catch((err) => {
    console.log("🟡 MongoDB connection failed:", err.message);
    console.log("⚡ Fallback: Operating in local mock database mode.");
  });

// Authentication Middleware
function authenticateToken(req, res, next) {
  const token = req.cookies.token || req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. Please log in." });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid session token. Please log in again." });
  }
}

// Helper: Find user by email
async function findUserByEmail(email) {
  const normalizedEmail = email.toLowerCase().trim();
  if (isDbConnected) {
    return await User.findOne({ email: normalizedEmail });
  } else {
    return inMemoryDb.users.find((u) => u.email === normalizedEmail);
  }
}

// Helper: Create user
async function createUser(userData) {
  if (isDbConnected) {
    const user = new User({
      email: userData.email,
      passwordHash: userData.passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role || "user",
      status: userData.status || "active",
    });
    return await user.save();
  } else {
    const newUser = {
      _id: new mongoose.Types.ObjectId().toString(),
      email: userData.email.toLowerCase().trim(),
      passwordHash: userData.passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role || "user",
      status: userData.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryDb.users.push(newUser);
    saveMockDb();
    return newUser;
  }
}

// ─── API Routes ──────────────────────────────────────────────────────────────

// Register Endpoint
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user
    const savedUser = await createUser({
      email,
      passwordHash,
      firstName,
      lastName,
      role: "user",
      status: "active",
    });

    console.log(`👤 User registered successfully: ${email}`);

    res.status(201).json({
      message: "Registration successful!",
      user: {
        id: savedUser._id || savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
      },
    });
  } catch (error) {
    console.error("Error in registration:", error);
    res.status(500).json({ error: "Internal server error during registration." });
  }
});

// Login Endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user exists
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "Your account is suspended. Please contact support." });
    }

    // Generate JWT Token
    const token = jwt.sign(
      {
        id: user._id || user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Set HTTP-only Cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "strict",
    });

    console.log(`🔑 User logged in successfully: ${email}`);

    res.json({
      message: "Login successful!",
      user: {
        id: user._id || user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ error: "Internal server error during login." });
  }
});

// Profile Endpoint
app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Logout Endpoint
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

// Get router history log
app.get("/api/router/history", authenticateToken, (req, res) => {
  try {
    const history = readHistory(process.cwd());
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: "Failed to read history logs" });
  }
});

// Catch-all route to serve login page
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 Authentication Server running on http://localhost:${PORT}`);
  console.log(`📂 Serving frontend static files from: ${path.join(__dirname, "public")}\n`);
});
