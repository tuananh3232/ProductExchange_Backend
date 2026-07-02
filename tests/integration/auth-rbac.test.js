import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { ROLES } from '../../src/constants/role.constant.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { createTestUser, loginAdmin, loginMember } from '../setup/auth.js'

const api = env.apiPrefix
const password = '123456'

const uniqueEmail = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

beforeEach(async () => {
  await resetTestDatabase()
})

describe('auth and RBAC integration', () => {
  it('registers a member with a unique email', async () => {
    const email = uniqueEmail('register-member')

    const response = await request(app)
      .post(`${api}/auth/register`)
      .send({
        name: 'Register Member',
        email,
        password,
        confirmPassword: password,
      })

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.user.email).toBe(email)
    expect(response.body.data.user.roles).toContain(ROLES.MEMBER)
    expect(response.body.data.debugOtp).toEqual(expect.any(String))
  })

  it('blocks login for an unverified user', async () => {
    const user = await createTestUser({ isVerified: false })

    const response = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password })

    expect(response.status).toBe(403)
    expect(response.body.success).toBe(false)
  })

  it('logs in a verified user and returns an access token', async () => {
    const user = await createTestUser({ isVerified: true })

    const response = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.accessToken).toEqual(expect.any(String))
    expect(response.body.data.user.email).toBe(user.email)
  })

  it('returns 401 without a token on protected APIs', async () => {
    const response = await request(app).get(`${api}/admin/users`)

    expect(response.status).toBe(401)
    expect(response.body.success).toBe(false)
  })

  it('returns 403 when a member calls an admin API', async () => {
    const { token } = await loginMember()

    const response = await request(app)
      .get(`${api}/admin/users`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body.success).toBe(false)
  })

  it('allows an admin to call an admin API', async () => {
    const { token } = await loginAdmin()

    const response = await request(app)
      .get(`${api}/admin/users`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.data.users)).toBe(true)
  })

  it('does not rate-limit auth endpoints in NODE_ENV=test', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        request(app)
          .post(`${api}/auth/register`)
          .send({
            name: `Rate Limit User ${index}`,
            email: uniqueEmail(`rate-limit-${index}`),
            password,
            confirmPassword: password,
          })
      )
    )

    expect(attempts.some((response) => response.status === 429)).toBe(false)
  })
})
