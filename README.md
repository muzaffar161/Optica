# Админ-панель оптики

Два уровня доступа:

- **Платформа** (`admin` из `.env`) — салоны, статистика, сброс паролей, счётчики SMS
- **Салон** — заказы, клиенты, уведомления только своей оптики

## Запуск

```bash
npm run setup
npm run dev:backend
npm run dev:frontend
```

Админка салона: http://localhost:5173/login  
Платформа (ваш админ): http://localhost:5173/platform/login — **admin** / **admin123**

## Telegram

Токен бота — `TELEGRAM_BOT_TOKEN` в `backend/.env`. Клиент пишет `/start` и делится номером.

## SMS

Пока заглушка: лог сервера + журнал. Подключение шлюза — `backend/src/notifications/sms.service.ts`.
