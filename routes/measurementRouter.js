import express from "express";

import {
  getMyMeasurements,
  saveMyMeasurements,
} from "../controller/measurementController.js";

const measurementRouter = express.Router();

measurementRouter.get("/me", getMyMeasurements);

measurementRouter.put("/me", saveMyMeasurements);

export default measurementRouter;
