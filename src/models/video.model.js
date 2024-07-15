import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";

const videoSchema = new Schema(
  {
    videoFile: {
      type: String, // cloundary url
      required: true,
    },
    thumbnail: {
      type: String, // cloundary url
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number, // cloundary url
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublised: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

videoSchema.plugin(mongooseAggregatePaginate) // it is used to divide a large dataset into smaller, more managebale pieces that can be displayed or processed efficeiently, retrive a subset of data from a collection in a structure manner.  

export const Video = mongoose.model("video", videoSchema);
