import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true
        },
        
        firstName: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            required: true,
            default: "user"
        },
        isBlocked: {
            type: Boolean,
            default: false
        },
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        Image: {
            type: String,
            default: "https://i.pinimg.com/originals/7c/23/5f/7c235ff76c9ff0509172c6dad506e81a.jpg?nii=t"
        }

    }
); 

const User = mongoose.model("user", userSchema);
export default User;