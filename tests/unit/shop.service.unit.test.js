import { jest } from '@jest/globals'
import { ROLES } from '../../src/constants/role.constant.js'
import { SHOP_STATUS } from '../../src/constants/status.constant.js'

const shopRepo = {
  findBySlug: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  updateById: jest.fn(),
  countMany: jest.fn(),
}

const permissionRepo = {
  findAll: jest.fn(),
  findByKeys: jest.fn(),
}

const userModel = {
  findById: jest.fn(),
  findOne: jest.fn(),
}

const shopModel = {
  find: jest.fn(),
  countDocuments: jest.fn(),
}

const dataScopeUtil = {
  assertShopPermission: jest.fn(),
}

const notifySafely = jest.fn()
const writeAuditLog = jest.fn()

jest.unstable_mockModule('../../src/repositories/shop/shop.repository.js', () => shopRepo)
jest.unstable_mockModule('../../src/repositories/permission/permission.repository.js', () => permissionRepo)
jest.unstable_mockModule('../../src/models/user.model.js', () => ({ default: userModel }))
jest.unstable_mockModule('../../src/models/shop.model.js', () => ({ default: shopModel }))
jest.unstable_mockModule('../../src/utils/data-scope.util.js', () => dataScopeUtil)
jest.unstable_mockModule('../../src/services/notification/notification.service.js', () => ({ notifySafely }))
jest.unstable_mockModule('../../src/services/audit/audit-log.service.js', () => ({ writeAuditLog }))

const shopService = await import('../../src/services/shop/shop.service.js')

const objectId = (suffix) => `665f1f77bcf86cd79943${suffix.padStart(3, '0')}`.slice(0, 24)

const ownerId = objectId('1')
const shopId = objectId('2')
const staffId = objectId('3')

const createShopDoc = (overrides = {}) => ({
  _id: shopId,
  name: 'Test Shop',
  slug: 'test-shop',
  owner: ownerId,
  staff: [],
  staffPermissions: [],
  status: SHOP_STATUS.DRAFT,
  isActive: true,
  phone: '0900000000',
  email: 'shop@example.com',
  address: { province: 'Test Province', district: 'Test District', detail: '' },
  ...overrides,
})

const createUserContext = (overrides = {}) => ({
  _id: ownerId,
  roles: [ROLES.SHOP_OWNER],
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  userModel.findById.mockResolvedValue({
    _id: ownerId,
    roles: [ROLES.SELLER],
    kyc: { status: 'approved' },
    save: jest.fn(),
  })
  shopModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) })
  shopModel.countDocuments.mockResolvedValue(0)
  dataScopeUtil.assertShopPermission.mockResolvedValue()
})

describe('shop service unit', () => {
  it('creates a shop draft without calling MongoDB directly from the test', async () => {
    const createdShop = createShopDoc()
    shopRepo.findBySlug.mockResolvedValue(null)
    shopRepo.create.mockResolvedValue({ _id: shopId })
    shopRepo.findById.mockResolvedValue(createdShop)

    const result = await shopService.createShop(ownerId, {
      name: 'Test Shop',
      phone: '0900000000',
      email: 'shop@example.com',
    })

    expect(userModel.findById).toHaveBeenCalledWith(ownerId)
    expect(shopRepo.findBySlug).toHaveBeenCalledWith('test-shop')
    expect(shopRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Shop',
        slug: 'test-shop',
        owner: ownerId,
        staff: [],
        status: SHOP_STATUS.DRAFT,
      })
    )
    expect(result).toBe(createdShop)
  })

  it('submits a complete draft shop for review', async () => {
    const shop = createShopDoc()
    shopRepo.findById.mockResolvedValue(shop)
    userModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ kyc: { status: 'pending' } }),
    })
    shopRepo.updateById.mockResolvedValue({ ...shop, status: SHOP_STATUS.PENDING_REVIEW })

    const result = await shopService.submitForReview(shopId, createUserContext())

    expect(dataScopeUtil.assertShopPermission).toHaveBeenCalledWith(
      expect.objectContaining({ permissionKey: 'shop:profile:submit_review' })
    )
    expect(shopRepo.updateById).toHaveBeenCalledWith(shopId, { status: SHOP_STATUS.PENDING_REVIEW })
    expect(result.status).toBe(SHOP_STATUS.PENDING_REVIEW)
  })

  it('approves a pending shop and grants shop_owner role when needed', async () => {
    const shop = createShopDoc({ status: SHOP_STATUS.PENDING_REVIEW })
    const save = jest.fn()
    shopRepo.findById.mockResolvedValue(shop)
    userModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ kyc: { status: 'approved' }, roles: [ROLES.MEMBER], save }),
    })
    shopRepo.updateById.mockResolvedValue({ ...shop, status: SHOP_STATUS.ACTIVE })

    const result = await shopService.approveShop(shopId)

    expect(save).toHaveBeenCalled()
    expect(shopRepo.updateById).toHaveBeenCalledWith(shopId, expect.objectContaining({
      status: SHOP_STATUS.ACTIVE,
      rejectionReason: '',
      reviewMeta: expect.objectContaining({ reviewedBy: null, adminNote: '' }),
      approvalMeta: expect.objectContaining({ approvedBy: null, adminNote: '' }),
    }))
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SHOP_APPROVED',
      targetType: 'shop',
      targetId: shopId,
    }))
    expect(notifySafely).toHaveBeenCalled()
    expect(result.status).toBe(SHOP_STATUS.ACTIVE)
  })

  it('rejects a pending shop with a reason', async () => {
    const shop = createShopDoc({ status: SHOP_STATUS.PENDING_REVIEW })
    shopRepo.findById.mockResolvedValue(shop)
    shopRepo.updateById.mockResolvedValue({ ...shop, status: SHOP_STATUS.REJECTED, rejectionReason: 'Missing documents' })

    const result = await shopService.rejectShop(shopId, 'Missing documents')

    expect(shopRepo.updateById).toHaveBeenCalledWith(shopId, expect.objectContaining({
      status: SHOP_STATUS.REJECTED,
      rejectionReason: 'Missing documents',
      reviewMeta: expect.objectContaining({ reviewedBy: null, adminNote: '' }),
      rejectionMeta: expect.objectContaining({ rejectedBy: null, reason: 'Missing documents', adminNote: '' }),
    }))
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SHOP_REJECTED',
      targetType: 'shop',
      targetId: shopId,
      reason: 'Missing documents',
    }))
    expect(result.status).toBe(SHOP_STATUS.REJECTED)
  })

  it('transfers shop ownership by email and updates owner roles', async () => {
    const shop = createShopDoc()
    const newOwnerSave = jest.fn()
    const oldOwnerSave = jest.fn()
    const newOwner = {
      _id: staffId,
      name: 'New Owner',
      email: 'new-owner@example.com',
      roles: [ROLES.MEMBER],
      isActive: true,
      save: newOwnerSave,
    }

    shopRepo.findById.mockResolvedValue(shop)
    userModel.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(newOwner),
    })
    shopRepo.updateById.mockResolvedValue({ ...shop, owner: staffId })
    shopRepo.countMany.mockResolvedValue(0)
    userModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ roles: [ROLES.SHOP_OWNER], save: oldOwnerSave }),
    })

    const result = await shopService.transferOwner(shopId, createUserContext(), 'new-owner@example.com')

    expect(newOwner.roles).toContain(ROLES.SHOP_OWNER)
    expect(newOwnerSave).toHaveBeenCalled()
    expect(shopRepo.updateById).toHaveBeenCalledWith(
      shopId,
      expect.objectContaining({
        owner: staffId,
        staff: [],
      })
    )
    expect(oldOwnerSave).toHaveBeenCalled()
    expect(result.owner).toBe(staffId)
  })

  it('documents that email invitation behavior belongs to shop-invitation integration tests', () => {
    expect(typeof shopService.createShop).toBe('function')
    expect(shopService.inviteStaffByEmail).toBeUndefined()
  })
})
