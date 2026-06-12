# Prompt: `tests/integration/notification-chat.test.js`

Ban la Senior Backend Engineer. Hay viet hoac hoan thien test cho dung mot file:

`tests/integration/notification-chat.test.js`

## Pham vi bat buoc

- Chi sua file `tests/integration/notification-chat.test.js`.
- Khong sua file test khac.
- Khong import, copy, hoac phu thuoc vao `tests/_legacy`.
- Khong phu thuoc du lieu legacy hoac du lieu co san trong DB chinh.
- Dung helper san co trong `tests/setup`.
- Neu helper thieu, chi bo sung toi thieu trong `tests/setup` va giai thich ro.
- Khong sua business logic trong `src` de lam test pass.

## Noi dung can test

- User xem danh sach notification cua minh.
- User xem unread count.
- Mark one notification as read.
- Mark all as read neu endpoint hien co.
- Delete notification neu endpoint hien co.
- Tao conversation direct/shop neu endpoint hien co.
- Gui message text.
- User khong thuoc conversation khong duoc doc message.
- Khong test socket realtime phuc tap o giai doan dau, tru khi helper da co san.

## Huong dan thuc hien

- Doc notification va conversation routes/controllers/services hien tai.
- Tao notification/conversation/message fixture toi thieu bang model/helper hien co.
- Test authorization theo user ownership cua notification/conversation.
- Neu endpoint socket realtime can setup phuc tap, khong test realtime trong file nay tru khi helper da co san.
- Khong tao dependency vao data cua chat/notification legacy.

## Kiem tra sau khi sua

Chay rieng file:

```bash
npm test -- tests/integration/notification-chat.test.js --runInBand
```

Chay full test:

```bash
npm test -- --runInBand
```
