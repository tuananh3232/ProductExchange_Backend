import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { ROLES } from '../../src/constants/role.constant.js'
import User from '../../src/models/user.model.js'

const DEFAULT_PASSWORD = '123456'

export const createToken = (userId, roles = [ROLES.MEMBER]) =>
  jwt.sign({ userId: userId.toString(), roles }, env.jwt.secret, { expiresIn: env.jwt.expiresIn })

export const createTestUser = async (overrides = {}) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return User.create({
    name: overrides.name || `Test User ${unique}`,
    email: overrides.email || `user-${unique}@example.com`,
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

  if (login.response.status !== 200) {
    throw new Error(`Login failed for ${user.email}: ${login.response.status} ${JSON.stringify(login.response.body)}`)
  }

  if (!login.token) {
    throw new Error(`Login succeeded for ${user.email} but did not return an access token`)
  }

  return { user, token: login.token, loginResponse: login.response }
}

// Use this only when the test does not need to exercise the real login flow.
// Auth/login tests should use createAndLogin or call the login endpoint directly.
export const createUserWithToken = async (role = ROLES.MEMBER, overrides = {}) => {
  const user = await createTestUser({
    roles: [role],
    ...overrides,
  })

  return { user, token: createToken(user._id, user.roles || [role]) }
}

export const loginAdmin = (overrides = {}) => createAndLogin(ROLES.ADMIN, overrides)
export const loginShopOwner = (overrides = {}) => createAndLogin(ROLES.SHOP_OWNER, overrides)
export const loginSeller = (overrides = {}) => createAndLogin(ROLES.SELLER, overrides)
export const loginMember = (overrides = {}) => createAndLogin(ROLES.MEMBER, overrides)
