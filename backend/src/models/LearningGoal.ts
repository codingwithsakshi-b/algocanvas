import mongoose from "mongoose";

export interface LearningGoal {
  userId: mongoose.Types.ObjectId;
  targetTopics: number;
  durationDays: number;
  startedAt: Date;
  deadlineAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const learningGoalSchema = new mongoose.Schema<LearningGoal>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    targetTopics: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      validate: Number.isInteger,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
      max: 365,
      validate: Number.isInteger,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    deadlineAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model<LearningGoal>("LearningGoal", learningGoalSchema);
