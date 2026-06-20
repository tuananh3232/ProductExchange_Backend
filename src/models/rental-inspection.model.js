import mongoose from 'mongoose'

const rentalInspectionSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RentalBooking',
      required: true,
      index: true,
    },
    inspectionType: {
      type: String,
      enum: ['handover', 'return'],
      required: true,
      index: true,
    },
    conditionNote: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    images: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

export default mongoose.model('RentalInspection', rentalInspectionSchema)
