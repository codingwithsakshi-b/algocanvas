import mongoose from "mongoose";

export interface User {
  googleId?: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<User>(
  {
    googleId: {
      type: String,
      trim: true,
      minlength: 1,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      unique: true,
    },
    avatar: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model<User>("User", userSchema);
