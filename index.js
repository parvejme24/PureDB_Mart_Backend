import app from "./app.js";
import connectDB from "./src/config/db.js";

const PORT = 5050;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
  });
