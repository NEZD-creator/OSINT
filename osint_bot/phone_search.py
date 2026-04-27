import os
import logging
from telethon import TelegramClient
from telethon.tl.functions.contacts import ImportContactsRequest, DeleteContactsRequest
from telethon.tl.types import InputPhoneContact
from aiogram import Router, types
from aiogram.filters import Command

router = Router()
logger = logging.getLogger(__name__)

API_ID = os.getenv("API_ID")
API_HASH = os.getenv("API_HASH")
SESSION_NAME = os.getenv("SESSION_NAME", "osint_session")

# Синглтон-клиент Telethon
client: TelegramClient = None

async def init_telethon():
    """Инициализация и запуск сессии Telethon (используется для OSINT запросов)."""
    global client
    if API_ID and API_HASH:
        client = TelegramClient(SESSION_NAME, int(API_ID), API_HASH)
        await client.start()
        logger.info("Telethon клиент успешно запущен.")
    else:
        logger.warning("API_ID или API_HASH не заданы, модуль phone_search недоступен.")

async def stop_telethon():
    if client:
        await client.disconnect()

WARNING_MSG = (
    "⚠️ Бот использует только открытые источники. Продолжая, вы подтверждаете, что "
    "имеете право искать информацию об этом человеке и не нарушаете закон."
)
DISCLAIMER_MSG = (
    "\n\nℹ️ <i>Данные взяты из открытых источников. Если вы владелец данных и "
    "хотите удалить информацию, измените настройки приватности в Telegram: "
    "Настройки -> Конфиденциальность -> Номер телефона.</i>"
)

@router.message(Command(commands=["search_phone"]))
async def search_phone(message: types.Message):
    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        await message.answer("Использование: `/search_phone +1234567890`", parse_mode="Markdown")
        return
        
    phone = args[1].strip()
    
    if not client or not client.is_connected():
        await message.answer("🤖 Внутренняя ошибка сервиса: Модуль поиска по номеру не настроен (отсутствуют API ключи Telegram).")
        return

    await message.answer(WARNING_MSG)
    status_msg = await message.answer(f"⏳ Проверяю телефон <code>{phone}</code> в Telegram...", parse_mode="HTML")
    
    try:
        # Шаг 1. Пытаемся добавить номер в контакты сессии
        contact = InputPhoneContact(client_id=0, phone=phone, first_name="OSINT", last_name="Check")
        result = await client(ImportContactsRequest([contact]))
        
        # Если пользователь запретил находить себя по номеру, result.users будет пуст
        if getattr(result, "users", None) is None or len(result.users) == 0:
            await status_msg.edit_text(
                f"🤷‍♂️ Пользователь с номером {phone} не зарегистрирован в Telegram, "
                f"либо запретил поиск себя по номеру в настройках приватности." + DISCLAIMER_MSG,
                parse_mode="HTML"
            )
            return
            
        user = result.users[0]
        
        # Шаг 2. Извлекаем публичные данные
        name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        username = f"@{user.username}" if user.username else "<i>Скрыт или отсутствует</i>"
        has_photo = "📸 Имеется (публичная)" if user.photo else "🚫 Отсутствует (или скрыта)"
        
        # Шаг 3. Заметаем следы (чистка контактов, ничего не сохраняем)
        await client(DeleteContactsRequest(id=[user.id]))

        # Формируем отчет
        response = (
            f"✅ <b>Информация из Telegram:</b>\n\n"
            f"👤 <b>Имя:</b> {name}\n"
            f"🔗 <b>Username:</b> {username}\n"
            f"🖼 <b>Аватар:</b> {has_photo}\n"
            f"🆔 <b>ID:</b> <code>{user.id}</code>"
        )
        
        await status_msg.edit_text(response + DISCLAIMER_MSG, parse_mode="HTML")

    except Exception as e:
        logger.error(f"Error checking phone: {e}")
        await status_msg.edit_text(f"❌ Ошибка при проверке номера. Возможно, неверный формат. Попробуйте +79XXXXXXXXX.\n<i>Детали: {str(e)}</i>")
