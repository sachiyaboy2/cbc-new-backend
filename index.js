import express from 'express';
import dns from "node:dns";
import mongoose from 'mongoose';
import userRouter from './routes/userRouter.js';
import jwt from "jsonwebtoken";
import productRouter from './routes/productRouter.js';


dns.setServers(["1.1.1.1", "8.8.8.8"]);



const app = express();
app.use(express.json());

//------------------------------------------------------------------------------------------------

app.use(
    (req,res,next)=>{
    
        let token = req.header("Authorization")

        if(token != null){
            token = token.replace("Bearer ", ""); 
            jwt.verify(token, "jwt-secret",
                (err, decoded)=>{
                    console.log(decoded);

                    if(decoded == null){
                        res.json({
                            message:"Token is valid, Please LOGIN again",
                        })
                        return;
                    }else{
                        req.user = decoded;  
                    }
                }
            ) 
            
        }
        next();
    }
)

//------------------------------------------------------------------------------------------------

const connectingString = "mongodb+srv://admin:123@cluster0.ghnsl3j.mongodb.net/?appName=Cluster0";
mongoose.connect(connectingString).then(
    () => {
        console.log("Connected to MongoDB");
    }
).catch(
    (err) => {
        console.log("Error connecting to MongoDB ", err.message);
    }   
)

//------------------------------------------------------------------------------------------------

app.delete("/",
    (req, res) => {
        console.log("Delete request received");
        res.json({ message: "Delete request received" });
    }
);  


//------------------------------------------------------------------------------------------------






app.use("/users", userRouter);
app.use("/products", productRouter);


//------------------------------------------------------------------------------------------------
app.listen(5000, () => {
  console.log("Server is running on port 5000");
});  