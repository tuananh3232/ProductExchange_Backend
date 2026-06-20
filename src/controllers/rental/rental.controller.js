import { asyncHandler } from '../../utils/async-handler.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import * as rentalService from '../../services/rental/rental.service.js'

export const createRentalListing = asyncHandler(async (req, res) => {
  const rentalListing = await rentalService.createRentalListing(req.body, req.user)

  sendSuccess(res, {
    message: 'Tạo tin cho thuê thành công',
    statusCode: 201,
    data: { rentalListing },
  })
})

export const listRentalListings = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await rentalService.listRentalListings(req.query, pagination)

  sendSuccess(res, {
    message: 'Lấy danh sách tin cho thuê thành công',
    data: { rentalListings: result.rentalListings },
    meta: result.meta,
  })
})

export const getRentalListingById = asyncHandler(async (req, res) => {
  const rentalListing = await rentalService.getRentalListingById(req.params.rentalListingId)

  sendSuccess(res, {
    message: 'Lấy chi tiết tin cho thuê thành công',
    data: { rentalListing },
  })
})

export const createRentalBooking = asyncHandler(async (req, res) => {
  const rentalBooking = await rentalService.createRentalBooking(req.body, req.user)

  sendSuccess(res, {
    message: 'Tạo booking thuê thành công',
    statusCode: 201,
    data: { rentalBooking },
  })
})

export const listRentalBookings = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await rentalService.listRentalBookings(req.user, req.query, pagination)

  sendSuccess(res, {
    message: 'Lấy danh sách booking thuê thành công',
    data: { rentalBookings: result.rentalBookings },
    meta: result.meta,
  })
})

export const getRentalBookingById = asyncHandler(async (req, res) => {
  const rentalBooking = await rentalService.getRentalBookingById(req.params.rentalBookingId, req.user)

  sendSuccess(res, {
    message: 'Lấy chi tiết booking thuê thành công',
    data: { rentalBooking },
  })
})

export const payRentalBooking = asyncHandler(async (req, res) => {
  const rentalBooking = await rentalService.payRentalBooking(req.params.rentalBookingId, req.user)

  sendSuccess(res, {
    message: 'Thanh toán booking thuê thành công',
    data: { rentalBooking },
  })
})

export const handoverRentalBooking = asyncHandler(async (req, res) => {
  const rentalBooking = await rentalService.handoverRentalBooking(req.params.rentalBookingId, req.body, req.user)

  sendSuccess(res, {
    message: 'Xác nhận bàn giao sản phẩm thuê thành công',
    data: { rentalBooking },
  })
})

export const returnRentalBooking = asyncHandler(async (req, res) => {
  const rentalBooking = await rentalService.returnRentalBooking(req.params.rentalBookingId, req.body, req.user)

  sendSuccess(res, {
    message: 'Xác nhận trả sản phẩm thuê thành công',
    data: { rentalBooking },
  })
})

export const confirmRentalReturn = asyncHandler(async (req, res) => {
  const rentalBooking = await rentalService.confirmRentalReturn(req.params.rentalBookingId, req.body, req.user)

  sendSuccess(res, {
    message: 'Xác nhận hoàn trả booking thuê thành công',
    data: { rentalBooking },
  })
})

export const createRentalClaim = asyncHandler(async (req, res) => {
  const rentalClaim = await rentalService.createRentalClaim(req.params.rentalBookingId, req.body, req.user)

  sendSuccess(res, {
    message: 'Tạo claim cho thuê thành công',
    statusCode: 201,
    data: { rentalClaim },
  })
})
