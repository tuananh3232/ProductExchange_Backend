const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const otpEmailTemplate = ({ userName = 'bạn', otpCode = '' }) => {
  const safeUserName = escapeHtml(userName || 'bạn')
  const safeOtpCode = escapeHtml(otpCode)

  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác thực tài khoản</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, Helvetica, sans-serif; color: #070B1F;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; background-color: #ffffff;">
          <tr>
            <td align="center" style="padding: 40px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 620px;">
                <tr>
                  <td align="center" style="padding-bottom: 22px;">
                    <div style="display: inline-block; padding: 12px 11px; background-color: #06215F; border-radius: 12px; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 1px;">
                      PE
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; color: #070B1F; font-size: 32px; line-height: 1.25; font-weight: 700;">
                      Xác thực tài khoản
                    </h1>
                    <p style="margin: 14px 0 30px; color: #334155; font-size: 16px; line-height: 1.7;">
                      Xin chào ${safeUserName}, vui lòng sử dụng mã bên dưới để xác thực tài khoản.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 32px 24px; background-color: #EAF8FF; border-radius: 20px;">
                    <h2 style="margin: 0; color: #070B1F; font-size: 22px; line-height: 1.35; font-weight: 700;">
                      Mã xác thực của bạn
                    </h2>
                    <p style="margin: 10px 0 22px; color: #334155; font-size: 15px; line-height: 1.7;">
                      Nhập mã OTP này trong ứng dụng để hoàn tất quá trình xác thực email.
                    </p>
                    <div style="padding: 18px 14px; background-color: #ffffff; border-radius: 12px; color: #070B1F; font-size: 36px; line-height: 1.2; font-weight: 700; letter-spacing: 10px;">
                      ${safeOtpCode}
                    </div>
                    <p style="margin: 20px 0 0; color: #64748B; font-size: 13px; line-height: 1.7;">
                      Mã này chỉ có hiệu lực trong vài phút. Không chia sẻ mã này với bất kỳ ai.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 24px;">
                    <p style="margin: 0; color: #64748B; font-size: 13px; line-height: 1.7;">
                      Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.
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
