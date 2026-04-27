import asyncio
import os
import logging
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart

# Импортируем роутеры из других модулей
from nick_search import router as nick_router
from phone_search import router as phone_router, init_telethon, stop_telethon
from photo_search import router as photo_router

# Загрузка переменных окружения
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
OWNER_ID = os.getenv("OWNER_ID")

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def main():
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN не найден в переменных окружения!")
        return

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()

    # Подключение модулей
    dp.include_router(nick_router)
    dp.include_router(phone_router)
    dp.include_router(photo_router)

    # Базовый обработчик /start
    @dp.message(CommandStart())
    async def start_handler(message: types.Message):
        welcome_text = (
            "Привет! Я OSINT-бот для исследования цифрового следа.\n\n"
            "Доступные команды:\n"
            "👤 /search_nick <никнейм> — поиск по открытым профилям\n"
            "📱 /search_phone <телефон> — публичная инфо в Telegram\n"
            "🖼 /search_photo — обратный поиск по лицу/фото\n\n"
            "⚠️ Бот работает строго в правовом поле (152-ФЗ РФ, GDPR) и использует "
            "исключительно открытые источники информации."
        )
        await message.answer(welcome_text)

    # Инициализация Telethon (аккаунт-синглтон)
    logger.info("Инициализация Telethon...")
    await init_telethon()

    # Отправка уведомления владельцу
    if OWNER_ID:
        try:
            await bot.send_message(
                chat_id=OWNER_ID,
                text="✅ Бот успешно запущен!\nВсе OSINT-модули готовы к работе."
            )
        except Exception as e:
            logger.error(f"Не удалось отправить уведомление владельцу: {e}")

    # Запуск поллинга
    try:
        logger.info("Бот запущен!")
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
         # Корректное завершение
        await stop_telethon()
        await bot.session.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Бот остановлен.")
