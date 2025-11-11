const express = require("express");
const cors = require("cors");
const app = express();

// CORS options
const corsOptions = {
  origin: ["http://localhost:3000", "http://example.com"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Default Route
app.get("/", (req, res) => {
  res.json({ message: "PureDB_Mart Server Working" });
});

module.exports = app;
