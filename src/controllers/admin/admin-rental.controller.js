import { asyncHandler } from '../../utils/async-handler.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import * as rentalService from '../../services/rental/rental.service.js'

export const getAdminRentalBookings = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await rentalService.listAdminRentalBookings(req.query, pagination)

  sendSuccess(res, {
    message: 'Lấy danh sách booking cho thuê thành công',
    data: { rentalBookings: result.rentalBookings },
    meta: result.meta,
  })
})

export const getAdminRentalClaims = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await rentalService.listAdminRentalClaims(req.query, pagination)

  sendSuccess(res, {
    message: 'Lấy danh sách claim cho thuê thành công',
    data: { rentalClaims: result.rentalClaims },
    meta: result.meta,
  })
})

export const getAdminRentalClaimById = asyncHandler(async (req, res) => {
  const rentalClaim = await rentalService.getAdminRentalClaimById(req.params.rentalClaimId)

  sendSuccess(res, {
    message: 'Lấy chi tiết claim cho thuê thành công',
    data: { rentalClaim },
  })
})

export const resolveAdminRentalClaim = asyncHandler(async (req, res) => {
  const rentalClaim = await rentalService.resolveAdminRentalClaim(req.params.rentalClaimId, req.body, req.user)

  sendSuccess(res, {
    message: 'Xử lý claim cho thuê thành công',
    data: { rentalClaim },
  })
})
