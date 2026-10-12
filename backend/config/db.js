import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoUri) {
      throw new Error("MongoDB connection string missing: please set MONGO_URI or MONGODB_URI");
    }

    // Connect with Mongoose (automatically handles mongodb+srv:// and URI parameters)
    const connectionOptions = {};
    if (process.env.MONGO_SSL === "true") {
      connectionOptions.ssl = true;
      connectionOptions.tls = true;
      connectionOptions.tlsAllowInvalidCertificates = false;
    }

    await mongoose.connect(mongoUri, connectionOptions);
    console.log("✅ DB CONNECTED");
  } catch (err) {
    console.error("❌ DB CONNECTION ERROR:", err.message);
    process.exit(1);
  }
};
