import mongoose from "mongoose";

export type LearningProgressCategory =
  | "sorting"
  | "data-structures"
  | "graphs";

export type LearningProgressStatus =
  | "not-started"
  | "in-progress"
  | "completed";

export interface LearningProgress {
  userId: mongoose.Types.ObjectId;
  topicId: string;
  topicName: string;
  category: LearningProgressCategory;
  status: LearningProgressStatus;
  lastVisitedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const learningProgressSchema = new mongoose.Schema<LearningProgress>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    topicId: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    topicName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    category: {
      type: String,
      enum: ["sorting", "data-structures", "graphs"],
      required: true,
    },
    status: {
      type: String,
      enum: ["not-started", "in-progress", "completed"],
      default: "not-started",
    },
    lastVisitedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

learningProgressSchema.index({ userId: 1, topicId: 1 }, { unique: true });

export default mongoose.model<LearningProgress>(
  "LearningProgress",
  learningProgressSchema,
);
