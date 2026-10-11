import express from "express";

import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
} from "../controller/cartController.js";

const cartRouter = express.Router();

// Logged userගේ cart එක ගන්න
cartRouter.get("/", getCart);

// Product එක add / increase / decrease කරන්න
cartRouter.post("/add", addToCart);

// Cart එක සම්පූර්ණයෙන් clear කරන්න
cartRouter.delete("/", clearCart);

// Specific product එක remove කරන්න
cartRouter.delete("/:productId", removeFromCart);

export default cartRouter;
