import express from "express";

import {createOrder,getOrders,updateOrderStatus} from "../controller/orderController.js";


const orderRouter = express.Router();


orderRouter.post("/", createOrder);
orderRouter.get("/", getOrders);
orderRouter.put("/status/:orderId",updateOrderStatus);


export default orderRouter;