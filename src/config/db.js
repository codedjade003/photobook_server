import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected ✅");
  } catch (err) {
    console.error("MongoDB Connection Error ❌", err.message);
    console.log("⚠️  Server running without database connection");
  }
};

export default connectDB;
