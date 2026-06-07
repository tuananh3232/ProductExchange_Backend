import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { ROLES } from '../../src/constants/role.constant.js'
import User from '../../src/models/user.model.js'

const DEFAULT_PASSWORD = '123456'

export const createToken = (userId, role = ROLES.MEMBER) =>
  jwt.sign({ userId: userId.toString(), role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn })

export const createTestUser = async (overrides = {}) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return User.create({
    name: overrides.name || `Test User ${unique}`,
    email: overrides.email || `user-${unique}@test.local`,
    password: overrides.password || DEFAULT_PASSWORD,
    roles: overrides.roles || [ROLES.MEMBER],
    isVerified: overrides.isVerified ?? true,
    ...overrides,
  })
}

export const loginUser = async ({ email, password = DEFAULT_PASSWORD }) => {
  const response = await request(app).post(`${env.apiPrefix}/auth/login`).send({ email, password })
  return {
    response,
    token: response.body?.data?.accessToken || response.body?.accessToken || response.body?.token,
  }
}

export const createAndLogin = async (role = ROLES.MEMBER, overrides = {}) => {
  const user = await createTestUser({
    roles: [role],
    ...overrides,
  })
  const login = await loginUser({ email: user.email, password: overrides.password || DEFAULT_PASSWORD })
  const token = login.token || createToken(user._id, role)

  return { user, token, loginResponse: login.response }
}

export const loginAdmin = (overrides = {}) => createAndLogin(ROLES.ADMIN, overrides)
export const loginShopOwner = (overrides = {}) => createAndLogin(ROLES.SHOP_OWNER, overrides)
export const loginSeller = (overrides = {}) => createAndLogin(ROLES.SELLER, overrides)
export const loginMember = (overrides = {}) => createAndLogin(ROLES.MEMBER, overrides)
