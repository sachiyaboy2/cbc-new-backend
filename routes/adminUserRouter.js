import express from "express";

import {
  createUserAdmin,
  getAllUsersAdmin,
  getUserByIdAdmin,
  updateUserAdmin,
} from "../controller/adminUserController.js";

const adminUserRouter = express.Router();

// GET ALL USERS
adminUserRouter.get("/", getAllUsersAdmin);

// GET ONE USER
adminUserRouter.get("/:userId", getUserByIdAdmin);

// UPDATE USER
adminUserRouter.put("/:userId", updateUserAdmin);

// ADMIN CREATE USER
adminUserRouter.post("/", createUserAdmin); 

export default adminUserRouter;
