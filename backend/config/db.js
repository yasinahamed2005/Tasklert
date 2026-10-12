import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoUri) {
      throw new Error("MongoDB connection string missing: please set MONGO_URI or MONGODB_URI");
    }

    // Connect with Mongoose (preserving SSL/TLS settings for secure cloud databases)
    const isSrv = mongoUri.startsWith("mongodb+srv://");
    const connectionOptions = isSrv
      ? {}
      : {
          ssl: process.env.MONGO_SSL === "true" || process.env.NODE_ENV === "production",
          tls: process.env.MONGO_SSL === "true" || process.env.NODE_ENV === "production",
          tlsAllowInvalidCertificates: false,
        };

    await mongoose.connect(mongoUri, connectionOptions);
    console.log("✅ DB CONNECTED");
  } catch (err) {
    console.error("❌ DB CONNECTION ERROR:", err.message);
    process.exit(1);
  }
};
