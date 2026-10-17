import express from "express";

import { getAdminDashboard } from "../controller/dashboardController.js";

const dashboardRouter = express.Router();

dashboardRouter.get("/", getAdminDashboard);

export default dashboardRouter;
