const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const shopStaffInvitationEmailTemplate = ({
  memberName = 'bạn',
  shopName = 'shop',
  ownerName = 'Chủ shop',
  invitationLink = '',
}) => {
  const safeMemberName = escapeHtml(memberName || 'bạn')
  const safeShopName = escapeHtml(shopName || 'shop')
  const safeOwnerName = escapeHtml(ownerName || 'Chu shop')
  const safeInvitationLink = escapeHtml(invitationLink || '')
  const hasInvitationLink = Boolean(invitationLink)

  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loi moi nhan su shop</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: Arial, Helvetica, sans-serif; color: #0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 36px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 620px; background-color: #ffffff; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 28px 28px 12px;">
                    <div style="display: inline-block; padding: 9px 10px; background-color: #0f172a; color: #ffffff; font-size: 16px; font-weight: 700;">
                      PE
                    </div>
                    <h1 style="margin: 22px 0 0; color: #0f172a; font-size: 26px; line-height: 1.3; font-weight: 700;">
                      Bạn được mời làm nhân sự shop
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 28px 28px;">
                    <p style="margin: 0 0 16px; color: #334155; font-size: 16px; line-height: 1.7;">
                      Xin chào ${safeMemberName},
                    </p>
                    <p style="margin: 0 0 16px; color: #334155; font-size: 16px; line-height: 1.7;">
                      <strong>${safeOwnerName}</strong> đã mời bạn tham gia quản lý shop <strong>${safeShopName}</strong> với vai trò <strong>Staff của shop</strong>.
                    </p>
                    <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.7;">
                      Lời mời này cho phép bạn hỗ trợ quản lý hoạt động của shop trên ProductExchange.
                    </p>
                    ${
                      hasInvitationLink
                        ? `
                          <p style="margin: 24px 0;">
                            <a href="${safeInvitationLink}" style="display: inline-block; padding: 12px 18px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700;">
                              Xem lời mời
                            </a>
                          </p>
                          <p style="margin: 0 0 16px; color: #64748b; font-size: 14px; line-height: 1.7;">
                            Hoặc mở liên kết này: <a href="${safeInvitationLink}" style="color: #2563eb;">${safeInvitationLink}</a>
                          </p>
                        `
                        : `
                          <p style="margin: 24px 0 16px; padding: 14px 16px; background-color: #eff6ff; color: #1e3a8a; font-size: 15px; line-height: 1.7;">
                            Vui lòng đăng nhập vào hệ thống để kiểm tra lời mời.
                          </p>
                        `
                    }
                    <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.7;">
                      Nếu bạn không mong đợi lời mời này, vui lòng bỏ qua email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}
