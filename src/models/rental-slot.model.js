import mongoose from 'mongoose'

const rentalSlotSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalListing', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalBooking', required: true },
  date: { type: Date, required: true },
}, { timestamps: true, versionKey: false })

rentalSlotSchema.index({ listing: 1, date: 1 }, { unique: true })
rentalSlotSchema.index({ booking: 1 })

export default mongoose.model('RentalSlot', rentalSlotSchema)
