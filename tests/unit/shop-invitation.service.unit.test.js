import { jest } from '@jest/globals'

const mockShopRepo = {
  findById: jest.fn(),
}

const mockShopInvitationRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
}

const mockUserFindOne = jest.fn()
const mockAssertShopPermission = jest.fn()
const mockSendStaffInvitationEmail = jest.fn()
const mockNotifySafely = jest.fn()

jest.unstable_mockModule('../../src/repositories/shop/shop.repository.js', () => mockShopRepo)
jest.unstable_mockModule('../../src/repositories/shop-invitation/shop-invitation.repository.js', () => mockShopInvitationRepo)
jest.unstable_mockModule('../../src/models/user.model.js', () => ({
  default: {
    findOne: mockUserFindOne,
  },
}))
jest.unstable_mockModule('../../src/utils/data-scope.util.js', () => ({
  assertShopPermission: mockAssertShopPermission,
}))
jest.unstable_mockModule('../../src/utils/mail.util.js', () => ({
  sendStaffInvitationEmail: mockSendStaffInvitationEmail,
}))
jest.unstable_mockModule('../../src/services/notification/notification.service.js', () => ({
  notifySafely: mockNotifySafely,
}))

const { sendInvitation } = await import('../../src/services/shop/shop-invitation.service.js')
const { ROLES } = await import('../../src/constants/role.constant.js')
const { INVITATION_STATUS } = await import('../../src/constants/status.constant.js')

describe('shop invitation service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not wait for the email promise before returning the invitation', async () => {
    const shop = {
      _id: 'shop-id',
      name: 'Test Shop',
      owner: { _id: 'owner-id', name: 'Owner Name' },
      staff: [],
      isActive: true,
    }
    const invitee = {
      _id: 'invitee-id',
      email: 'invitee@example.com',
      name: 'Invitee Name',
      isActive: true,
      roles: [ROLES.MEMBER],
    }
    const invitation = {
      _id: 'invitation-id',
      shop: shop._id,
      invitee: invitee._id,
      inviter: 'owner-id',
      status: INVITATION_STATUS.PENDING,
    }

    mockShopRepo.findById.mockResolvedValue(shop)
    mockAssertShopPermission.mockResolvedValue(undefined)
    mockUserFindOne.mockResolvedValue(invitee)
    mockShopInvitationRepo.findOne.mockResolvedValue(null)
    mockShopInvitationRepo.create.mockResolvedValue(invitation)
    mockShopInvitationRepo.findById.mockResolvedValue({
      ...invitation,
      invitee: { email: invitee.email, name: invitee.name },
    })
    mockNotifySafely.mockResolvedValue(null)
    mockSendStaffInvitationEmail.mockImplementation(() => new Promise(() => {}))

    const result = await Promise.race([
      sendInvitation(shop._id, { _id: 'owner-id', name: 'Owner Name' }, invitee.email, []),
      new Promise((_, reject) => setTimeout(() => reject(new Error('sendInvitation timed out')), 250)),
    ])

    expect(result).toMatchObject({
      _id: invitation._id,
    })
    expect(mockShopInvitationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shop: shop._id,
        invitee: invitee._id,
        inviter: 'owner-id',
      })
    )
    expect(mockSendStaffInvitationEmail).toHaveBeenCalledTimes(1)
    expect(mockNotifySafely).toHaveBeenCalledTimes(1)
  })
})
