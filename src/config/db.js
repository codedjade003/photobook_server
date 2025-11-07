import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: process.env.DB_NAME || "photobook", // fallback to "photobook"
    });

    console.log("✅ MongoDB connected successfully (Photobook)");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);

    // Optional: keep server alive but warn if you’d rather not crash it
    console.log("⚠️  Server running without database connection");
    // process.exit(1); // Uncomment this if you want to stop the app on DB failure
  }
};

export default connectDB;
