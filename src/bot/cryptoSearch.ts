import { Bot } from "grammy";

export function setupCryptoSearch(bot: Bot) {
  bot.command("crypto", async (ctx) => {
    const args = (ctx.message?.text || "").split(/\s+/);
    if (args.length < 2) {
      await ctx.reply("Использование: `/crypto <адрес>` - анализ кошелька BTC/ETH", { parse_mode: "Markdown" });
      return;
    }

    const address = args[1].trim();
    const statusMsg = await ctx.reply(`⏳ Проверяю блокчейн: <code>${address}</code>...`, { parse_mode: "HTML" });

    try {
        let isBTC = address.startsWith("1") || address.startsWith("3") || address.startsWith("bc1");
        let isETH = address.startsWith("0x");

        let report = `💰 <b>OSINT Крипто-кошелька:</b>\n<code>${address}</code>\n\n`;

        if (isBTC) {
            const res = await fetch(`https://blockchain.info/rawaddr/${address}`);
            if (res.status === 200) {
                const data: any = await res.json();
                report += `🪙 <b>Сеть:</b> Bitcoin (BTC)\n`;
                report += `💵 <b>Текущий баланс:</b> ${(data.final_balance / 100000000).toFixed(6)} BTC\n`;
                report += `↓ <b>Получено всего:</b> ${(data.total_received / 100000000).toFixed(6)} BTC\n`;
                report += `↑ <b>Отправлено всего:</b> ${(data.total_sent / 100000000).toFixed(6)} BTC\n`;
                report += `📊 <b>Количество транзакций:</b> ${data.n_tx}\n\n`;
            } else {
                report += `❌ Не удалось получить баланс (возможно слишком много транзакций или неверный адрес).\n\n`;
            }
        } else if (isETH) {
             report += `🪙 <b>Сеть предполагается:</b> Ethereum / EVM (ETH, BSC, Polygon)\n\n`;
        } else {
             report += `❓ Формат не похож на стандартные сети BTC или ETH.\n\n`;
        }

        report += `🔍 <b>Связи, графы и AML Анализ:</b>\n`;
        report += `└ <a href="https://blockchair.com/search?q=${address}">Глубокий поиск по Blockchair</a>\n`;
        report += `└ <a href="https://breadcrumbs.app/search/${address}">Построение графа транзакций (Breadcrumbs)</a>\n`;
        if (isETH) report += `└ <a href="https://etherscan.io/address/${address}">Анализ токенов и контрактов (Etherscan)</a>\n`;
        
        report += `\nℹ️ <i>Блокчейн открыт по умолчанию. Проверка связи данного адреса с даркнетом доступна по ссылкам выше через AML-сервисы.</i>`;

        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, report, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true }
        });
    } catch (e) {
        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Ошибка доступа к API блокчейна.`, { parse_mode: "HTML" });
    }
  });
}
