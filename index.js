import express from "express";
import dns from "node:dns";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";

import userRouter from "./routes/userRouter.js";
import productRouter from "./routes/productRouter.js";
import orderRouter from "./routes/orderRouter.js";
import cartRouter from "./routes/cartRouter.js";


dns.setServers(["1.1.1.1", "8.8.8.8"]);


dotenv.config();

const app = express();

app.use(express.json());

// ------------------------------------------------------------------------------------------------
// CORS
// ------------------------------------------------------------------------------------------------

app.use(cors());

// ------------------------------------------------------------------------------------------------
// AUTH MIDDLEWARE
// Bearer token එකක් තිබුණොත් verify කරලා req.user එකට decoded user data දානවා.
// Public routes වල token එකක් නැත්නම් request එක continue වෙනවා.
// ------------------------------------------------------------------------------------------------

app.use((req, res, next) => {
  let token = req.header("Authorization");

  if (token == null) {
    next();
    return;
  }

  token = token.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    res.status(401).json({
      message: "Invalid or expired token. Please login again",
    });
  }
});

// ------------------------------------------------------------------------------------------------
// MONGODB
// ------------------------------------------------------------------------------------------------

const connectingString = process.env.MONGO_URI;

mongoose
  .connect(connectingString)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB ", err.message);
  });

// ------------------------------------------------------------------------------------------------
// TEST DELETE ROUTE
// ------------------------------------------------------------------------------------------------

app.delete("/", (req, res) => {
  console.log("Delete request received");

  res.json({
    message: "Delete request received",
  });
});

// ------------------------------------------------------------------------------------------------
// API ROUTES
// ------------------------------------------------------------------------------------------------

app.use("/api/users", userRouter);
app.use("/api/products", productRouter);
app.use("/api/orders", orderRouter);
app.use("/api/cart", cartRouter);

// ------------------------------------------------------------------------------------------------
// SERVER
// ------------------------------------------------------------------------------------------------

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});
