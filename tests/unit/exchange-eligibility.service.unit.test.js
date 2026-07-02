import { jest } from '@jest/globals'

const productModel = {
  findById: jest.fn(),
}

const userModel = {
  find: jest.fn(),
}

const exchangeOfferModel = {
  exists: jest.fn(),
}

jest.unstable_mockModule('../../src/models/product.model.js', () => ({
  default: productModel,
  PRODUCT_OWNER_TYPES: {
    SHOP: 'SHOP',
    SELLER: 'SELLER',
  },
  PRODUCT_TRANSACTION_MODES: {
    SELL: 'sell',
    RENTAL: 'rental',
    EXCHANGE: 'exchange',
  },
}))
jest.unstable_mockModule('../../src/models/user.model.js', () => ({ default: userModel }))
jest.unstable_mockModule('../../src/models/exchange-offer.model.js', () => ({ default: exchangeOfferModel }))

const exchangeEligibilityService = await import('../../src/services/exchange/exchange-eligibility.service.js')

const makePopulateQuery = (value) => ({
  populate: jest.fn().mockResolvedValue(value),
})

const makeSelectQuery = (value) => ({
  select: jest.fn().mockResolvedValue(value),
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('exchange eligibility service', () => {
  it('builds exchange terms from two product values', () => {
    const result = exchangeEligibilityService.buildExchangeTerms(
      { price: 200000, seller: 'seller-a' },
      { price: 300000, seller: 'seller-b' }
    )

    expect(result.requesterProductValue).toBe(200000)
    expect(result.receiverProductValue).toBe(300000)
    expect(result.cashDifferenceAmount).toBe(100000)
    expect(result.cashDifferenceDirection).toBe('requester_to_receiver')
    expect(String(result.cashDifferencePayer)).toBe('seller-a')
    expect(String(result.cashDifferenceReceiver)).toBe('seller-b')
  })

  it('rejects shop product in exchange eligibility', async () => {
    productModel.findById
      .mockReturnValueOnce(makePopulateQuery({
        _id: 'product-a',
        isActive: true,
        status: 'available',
        ownerType: 'SHOP',
        transactionMode: 'exchange',
        shop: 'shop-1',
        seller: null,
      }))
      .mockReturnValueOnce(makePopulateQuery({
        _id: 'product-b',
        isActive: true,
        status: 'available',
        ownerType: 'SELLER',
        transactionMode: 'exchange',
        shop: null,
        seller: 'seller-b',
      }))

    await expect(
      exchangeEligibilityService.getExchangeEligibility({
        requesterProductId: 'product-a',
        receiverProductId: 'product-b',
        currentUserId: 'seller-a',
      })
    ).rejects.toMatchObject({
      errorCode: 'Shop product cannot join exchange',
    })
  })

  it('passes when both seller products are available, unlocked, and kyc approved', async () => {
    productModel.findById
      .mockReturnValueOnce(makePopulateQuery({
        _id: 'product-a',
        isActive: true,
        status: 'available',
        ownerType: 'SELLER',
        transactionMode: 'exchange',
        shop: null,
        seller: 'seller-a',
        price: 150000,
      }))
      .mockReturnValueOnce(makePopulateQuery({
        _id: 'product-b',
        isActive: true,
        status: 'available',
        ownerType: 'SELLER',
        transactionMode: 'exchange',
        shop: null,
        seller: 'seller-b',
        price: 100000,
      }))
    userModel.find.mockReturnValue(makeSelectQuery([
      { _id: 'seller-a', isActive: true, kyc: { status: 'approved' } },
      { _id: 'seller-b', isActive: true, kyc: { status: 'approved' } },
    ]))
    exchangeOfferModel.exists.mockResolvedValue(null)

    const result = await exchangeEligibilityService.getExchangeEligibility({
      requesterProductId: 'product-a',
      receiverProductId: 'product-b',
      currentUserId: 'seller-a',
    })

    expect(result.terms.cashDifferenceAmount).toBe(50000)
    expect(result.terms.cashDifferenceDirection).toBe('receiver_to_requester')
  })

  it('rejects products that are not in exchange mode', async () => {
    productModel.findById
      .mockReturnValueOnce(makePopulateQuery({
        _id: 'product-a',
        isActive: true,
        status: 'available',
        ownerType: 'SELLER',
        transactionMode: 'sell',
        shop: null,
        seller: 'seller-a',
        price: 150000,
      }))
      .mockReturnValueOnce(makePopulateQuery({
        _id: 'product-b',
        isActive: true,
        status: 'available',
        ownerType: 'SELLER',
        transactionMode: 'exchange',
        shop: null,
        seller: 'seller-b',
        price: 100000,
      }))

    await expect(
      exchangeEligibilityService.getExchangeEligibility({
        requesterProductId: 'product-a',
        receiverProductId: 'product-b',
        currentUserId: 'seller-a',
      })
    ).rejects.toMatchObject({
      errorCode: 'Product is not eligible for exchange',
    })
  })
})
