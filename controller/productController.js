import Product from "../models/product.js";
import { isAdmin } from "../controller/userController.js";  

export async function createProduct(req, res) {
    if (!isAdmin(req)) {
        res.status(403).json({
            message: "You Not admin"
        });
        return; 
    }

    try {
        const productData = req.body;
        const products = new Product(productData); 
        await products.save();  

        res.json({
            message: "Product created Successfully",
            products: products
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Failed to create product"
        });
    }
}



//------------------------------------------------------------------------------------------

export async function getProducts(req,res){
    try{

        const products = await Product.find()   
        res.json(products); 

    } catch(err){
        console.error(err);
        res.status(500).json({
            message: "Faid to retriwe products"
        });
        

    }
}

//-----------------------------------------------------------------------------------------------


export async function deletProducts(req, res) {
    if (!isAdmin(req)) {
        return res.status(403).json({
            message: "you not admin"
        });
    }

    try {
        const productId = req.params.productId;

        // deleteOne එකේ ප්‍රතිඵලය result variable එකට ගන්න
        const result = await Product.deleteOne({
            productId: productId
        });

        // ඩෙලිට් වුණු ප්‍රමාණය 0 නම් Product එක හමු වී නැත 
        if (result.deletedCount === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        return res.json({
            message: "Product deleted Successfully"
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: "Failed to delete product"
        });
    }
}

//--------------------------------------------------------------------------------------------------

export async function updateProduct(req, res){
    if(!isAdmin(req)){
        res.status(403).json({
            message: "you not admin"
        });
        return;
    }

    try{
        const productId = req.params.productId;
        const productData = req.body;
        await Product.updateOne(
            {productId: productId},productData);  
            
        res.json({
            message: "Product updated Successfully" 
        }); 
    } catch (err) { 
        console.error(err);
        res.status(500).json({
            message: "Failed to update product"
        });
    }
}


//--------------------------------------------------------------------------------------------------


export async function getProduct_Id(req,res){
    try{
        const productId = req.params.productId
        const product = await Product.findOne({productId:productId});
         
        if(product == null){ 
            res.status(404).json({
                message:"Product Not Found"
            }); 
        }else{
            res.json(product); 
        }
    } catch(err){
        console.error(err);
        res.status(500).json({
            message: "Failed to retriwe product"
        });
    }
}




