const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = 3000;

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "task3db",
  user: process.env.DB_USER || "task3user",
  password: process.env.DB_PASSWORD || "task3password"
});

async function initializeDatabase() {
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS visits (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      console.log("PostgreSQL connection established.");
      return;
    } catch (error) {
      console.log(`Database connection attempt ${attempt}/20 failed.`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Could not connect to PostgreSQL.");
}

app.get("/", (req, res) => {
  res.json({
    message: "Task 3 Dockerized Node.js application is running!",
    application: "Node.js + Express",
    database: "PostgreSQL",
    containerUser: process.getuid ? process.getuid() : "unknown",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "healthy",
      database: "connected"
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected"
    });
  }
});

app.get("/counter", async (req, res) => {
  try {
    await pool.query("INSERT INTO visits DEFAULT VALUES");

    const result = await pool.query(
      "SELECT COUNT(*)::int AS count FROM visits"
    );

    res.json({
      message: "Persistent visit counter",
      visits: result.rows[0].count
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Database operation failed"
    });
  }
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
