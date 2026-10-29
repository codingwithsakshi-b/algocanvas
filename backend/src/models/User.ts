import mongoose from "mongoose";

export interface User {
  googleId?: string;
  name: string;
  email: string;
  avatar?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  customAvatarId?: mongoose.Types.ObjectId;
  preferredLanguage?: "cpp" | "c" | "python" | "java";
  learningLevel?: "beginner" | "intermediate" | "advanced";
  editorFontSize?: number;
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
    username: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 24,
      match: /^[a-z0-9_]+$/,
      unique: true,
      sparse: true,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 280,
    },
    customAvatarId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    preferredLanguage: {
      type: String,
      enum: ["cpp", "c", "python", "java"],
      default: "cpp",
    },
    learningLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    editorFontSize: {
      type: Number,
      min: 10,
      max: 24,
      default: 13,
    },
  },
  { timestamps: true },
);

export default mongoose.model<User>("User", userSchema);
