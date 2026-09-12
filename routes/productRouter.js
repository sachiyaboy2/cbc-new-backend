import express from "express";
import { getProducts, createProduct, deletProducts, updateProduct, getProduct_Id } from "../controller/productController.js";  
 
const productRouter = express.Router();

productRouter.get("/" , getProducts);
productRouter.post("/" , createProduct);



// ID Routers
productRouter.delete("/:productId" , deletProducts);
productRouter.put("/:productId" , updateProduct);
productRouter.get("/:productId" , getProduct_Id);

export default productRouter; 

  