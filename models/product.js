import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        productId: {
            type: String,
            required: true,
            unique: true
        },

        name: {
            type: String,
            required: true
        },

        altNames: {
            type: [String],
            default: []
        },

        description: {
            type: String,
            required: true
        },

        images: {
            type: [String],
            default: [],
            required: true
        },

        price: {
            type: Number,
            required: true
        },

        labelNo: {
            type: Number,
            required: true
        },

        category: {
            type: String,
            required: true
        }
    }
);

const Product = mongoose.model(
    "product",
    productSchema
);

export default Product;
