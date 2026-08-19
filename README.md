# Админ-панель оптики

Два уровня доступа:

- **Платформа** (`ADMIN_USERNAME` из `.env`) — салоны, статистика, сброс паролей, счётчики SMS
- **Салон** — заказы, клиенты, уведомления только своей оптики

## Запуск

```bash
npm run setup
npm run dev:backend
npm run dev:frontend
```

Админка салона: http://localhost:5173/login  
Платформа: http://localhost:5173/platform/login — логин и пароль из `ADMIN_USERNAME` / `ADMIN_PASSWORD` в `backend/.env`. На сервере не оставляйте значения по умолчанию.

## Telegram

Токен бота — `TELEGRAM_BOT_TOKEN` в `backend/.env`. Клиент пишет `/start` и делится номером.

## SMS

Пока заглушка: лог сервера + журнал. Подключение шлюза — `backend/src/notifications/sms.service.ts`.
