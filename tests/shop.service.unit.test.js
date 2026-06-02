import { jest } from '@jest/globals'

const mockShopRepo = {
  create: jest.fn(),
  findBySlug: jest.fn(),
  findById: jest.fn(),
  updateById: jest.fn(),
  addStaff: jest.fn(),
  countMany: jest.fn(),
}

const mockShopInvitationRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn(),
}

const mockUserFindById = jest.fn()
const mockUserFindOne = jest.fn()
const mockSendStaffInvitationEmail = jest.fn()

jest.unstable_mockModule('../src/repositories/shop/shop.repository.js', () => mockShopRepo)
jest.unstable_mockModule('../src/repositories/shop-invitation/shop-invitation.repository.js', () => mockShopInvitationRepo)
jest.unstable_mockModule('../src/utils/mail.util.js', () => ({
  sendStaffInvitationEmail: mockSendStaffInvitationEmail,
}))
jest.unstable_mockModule('../src/repositories/permission/permission.repository.js', () => ({
  findAll: jest.fn(),
  findByKeys: jest.fn(),
}))
jest.unstable_mockModule('../src/models/user.model.js', () => ({
  default: {
    findById: mockUserFindById,
    findOne: mockUserFindOne,
  },
}))

const { createShop, approveShop } = await import('../src/services/shop/shop.service.js')
const { acceptInvitation, sendInvitation } = await import('../src/services/shop/shop-invitation.service.js')
const { ROLES } = await import('../src/constants/role.constant.js')
const { INVITATION_STATUS, SHOP_STATUS } = await import('../src/constants/status.constant.js')

describe('shop.service shop_owner role logic', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('createShop', () => {
    it('creates a pending review shop without assigning shop_owner to the user', async () => {
      const owner = {
        _id: 'owner-id',
        roles: [ROLES.MEMBER],
        save: jest.fn(),
      }
      const createdShop = {
        _id: 'shop-id',
        name: 'Anh Decor Shop',
        slug: 'anh-decor-shop',
        owner: owner._id,
        status: SHOP_STATUS.DRAFT,
      }

      mockUserFindById.mockResolvedValue(owner)
      mockShopRepo.findBySlug.mockResolvedValue(null)
      mockShopRepo.create.mockResolvedValue(createdShop)
      mockShopRepo.findById.mockResolvedValue(createdShop)

      const result = await createShop(owner._id, { name: 'Anh Decor Shop' })

      expect(mockShopRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: owner._id,
          staff: [],
          slug: 'anh-decor-shop',
          status: SHOP_STATUS.DRAFT,
        })
      )
      expect(result.status).toBe(SHOP_STATUS.DRAFT)
      expect(owner.roles).toEqual([ROLES.MEMBER])
      expect(owner.roles).not.toContain(ROLES.SHOP_OWNER)
      expect(owner.save).not.toHaveBeenCalled()
    })
  })

  describe('approveShop', () => {
    it('adds shop_owner to the owner when approving a pending review shop', async () => {
      const shop = {
        _id: 'shop-id',
        owner: 'owner-id',
        isActive: true,
        status: SHOP_STATUS.PENDING_REVIEW,
      }
      const owner = {
        _id: 'owner-id',
        kyc: { status: 'approved' },
        roles: [ROLES.MEMBER],
        save: jest.fn().mockResolvedValue(undefined),
      }
      const approvedShop = {
        ...shop,
        status: SHOP_STATUS.ACTIVE,
        rejectionReason: '',
      }

      mockShopRepo.findById.mockResolvedValue(shop)
      mockUserFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(owner),
      })
      mockShopRepo.updateById.mockResolvedValue(approvedShop)

      const result = await approveShop(shop._id)

      expect(owner.roles).toEqual(expect.arrayContaining([ROLES.MEMBER, ROLES.SHOP_OWNER]))
      expect(owner.save).toHaveBeenCalledTimes(1)
      expect(mockShopRepo.updateById).toHaveBeenCalledWith(shop._id, {
        status: SHOP_STATUS.ACTIVE,
        rejectionReason: '',
      })
      expect(result).toBe(approvedShop)
    })

    it('does not duplicate shop_owner when the owner already has it', async () => {
      const shop = {
        _id: 'shop-id',
        owner: { _id: 'owner-id' },
        isActive: true,
        status: SHOP_STATUS.PENDING_REVIEW,
      }
      const owner = {
        _id: 'owner-id',
        kyc: { status: 'approved' },
        roles: [ROLES.MEMBER, ROLES.SHOP_OWNER],
        save: jest.fn().mockResolvedValue(undefined),
      }
      const approvedShop = {
        ...shop,
        status: SHOP_STATUS.ACTIVE,
        rejectionReason: '',
      }

      mockShopRepo.findById.mockResolvedValue(shop)
      mockUserFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(owner),
      })
      mockShopRepo.updateById.mockResolvedValue(approvedShop)

      await approveShop(shop._id)

      expect(owner.roles.filter((role) => role === ROLES.SHOP_OWNER)).toHaveLength(1)
      expect(owner.save).not.toHaveBeenCalled()
      expect(mockShopRepo.updateById).toHaveBeenCalledWith(shop._id, {
        status: SHOP_STATUS.ACTIVE,
        rejectionReason: '',
      })
    })
  })

  describe('staff invitation rules', () => {
    const ownerContext = { _id: 'owner-id', roles: [ROLES.MEMBER, ROLES.SHOP_OWNER] }

    const makeShop = (overrides = {}) => ({
      _id: 'shop-id',
      name: 'Anh Decor Shop',
      owner: { _id: 'owner-id', name: 'Owner Name' },
      staff: [],
      staffPermissions: [],
      isActive: true,
      ...overrides,
    })

    const makeUser = (id, roles) => ({
      _id: id,
      email: `${id}@example.com`,
      name: 'Invitee Name',
      isActive: true,
      roles,
      save: jest.fn().mockResolvedValue(undefined),
    })

    const mockPendingInvitationCreate = () => {
      const invitation = { _id: 'invitation-id' }
      mockShopInvitationRepo.create.mockResolvedValue(invitation)
      mockShopInvitationRepo.findById.mockResolvedValue({
        ...invitation,
        shop: 'shop-id',
        invitee: 'invitee-id',
        inviter: 'owner-id',
        status: INVITATION_STATUS.PENDING,
      })
    }

    it('allows inviting a regular member as staff', async () => {
      mockShopRepo.findById.mockResolvedValue(makeShop())
      mockUserFindOne.mockResolvedValue(makeUser('invitee-id', [ROLES.MEMBER]))
      mockShopInvitationRepo.findOne.mockResolvedValue(null)
      mockSendStaffInvitationEmail.mockResolvedValue(true)
      mockPendingInvitationCreate()

      const result = await sendInvitation('shop-id', ownerContext, 'invitee-id@example.com')

      expect(mockShopInvitationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shop: 'shop-id',
          invitee: 'invitee-id',
          inviter: 'owner-id',
          status: INVITATION_STATUS.PENDING,
        })
      )
      expect(mockSendStaffInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'invitee-id@example.com',
          name: 'Invitee Name',
          shopName: 'Anh Decor Shop',
          inviterName: 'Owner Name',
          invitationUrl: expect.stringContaining('invitationId=invitation-id'),
        })
      )
      expect(result._id).toBe('invitation-id')
    })

    it('allows inviting a member who is shop_owner of another shop', async () => {
      mockShopRepo.findById.mockResolvedValue(makeShop())
      mockUserFindOne.mockResolvedValue(makeUser('invitee-id', [ROLES.MEMBER, ROLES.SHOP_OWNER]))
      mockShopInvitationRepo.findOne.mockResolvedValue(null)
      mockPendingInvitationCreate()

      await expect(sendInvitation('shop-id', ownerContext, 'invitee-id@example.com')).resolves.toMatchObject({
        _id: 'invitation-id',
      })
    })

    it('rejects inviting an admin as staff', async () => {
      mockShopRepo.findById.mockResolvedValue(makeShop())
      mockUserFindOne.mockResolvedValue(makeUser('invitee-id', [ROLES.MEMBER, ROLES.ADMIN]))

      await expect(sendInvitation('shop-id', ownerContext, 'invitee-id@example.com')).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'Invalid shop staff',
      })
      expect(mockShopInvitationRepo.create).not.toHaveBeenCalled()
    })

    it('rejects inviting a user without member role as staff', async () => {
      mockShopRepo.findById.mockResolvedValue(makeShop())
      mockUserFindOne.mockResolvedValue(makeUser('invitee-id', [ROLES.SELLER]))

      await expect(sendInvitation('shop-id', ownerContext, 'invitee-id@example.com')).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'Invalid shop staff',
      })
      expect(mockShopInvitationRepo.create).not.toHaveBeenCalled()
    })

    it('rejects inviting the owner of the current shop as staff', async () => {
      mockShopRepo.findById.mockResolvedValue(makeShop())
      mockUserFindOne.mockResolvedValue(makeUser('owner-id', [ROLES.MEMBER, ROLES.SHOP_OWNER]))

      await expect(sendInvitation('shop-id', { _id: 'admin-id', roles: [ROLES.ADMIN] }, 'owner-id@example.com')).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'Cannot invite the shop owner as staff',
      })
      expect(mockShopInvitationRepo.create).not.toHaveBeenCalled()
    })

    it('rejects inviting a user already staff of the current shop', async () => {
      mockShopRepo.findById.mockResolvedValue(makeShop({ staff: ['invitee-id'] }))
      mockUserFindOne.mockResolvedValue(makeUser('invitee-id', [ROLES.MEMBER, ROLES.STAFF]))

      await expect(sendInvitation('shop-id', ownerContext, 'invitee-id@example.com')).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'User is already a staff member of this shop',
      })
      expect(mockShopInvitationRepo.create).not.toHaveBeenCalled()
    })

    it('keeps existing roles and does not duplicate staff when accepting invitation', async () => {
      const user = makeUser('invitee-id', [ROLES.MEMBER, ROLES.SHOP_OWNER, ROLES.STAFF])
      const invitation = {
        _id: 'invitation-id',
        shop: 'shop-id',
        invitee: 'invitee-id',
        inviter: 'owner-id',
        status: INVITATION_STATUS.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
        permissions: [],
      }
      const shop = makeShop()
      const acceptedInvitation = { ...invitation, status: INVITATION_STATUS.ACCEPTED }

      mockShopInvitationRepo.findById.mockResolvedValue(invitation)
      mockShopRepo.findById.mockResolvedValue(shop)
      mockUserFindById.mockResolvedValue(user)
      mockShopRepo.addStaff.mockResolvedValue({ ...shop, staff: ['invitee-id'] })
      mockShopInvitationRepo.findByIdAndUpdate.mockResolvedValue(acceptedInvitation)

      const result = await acceptInvitation('invitation-id', { _id: 'invitee-id' })

      expect(user.roles).toEqual([ROLES.MEMBER, ROLES.SHOP_OWNER, ROLES.STAFF])
      expect(user.roles.filter((role) => role === ROLES.STAFF)).toHaveLength(1)
      expect(user.save).toHaveBeenCalledTimes(1)
      expect(mockShopRepo.addStaff).toHaveBeenCalledWith('shop-id', 'invitee-id')
      expect(result).toBe(acceptedInvitation)
    })
  })
})
