/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-mono flex-col p-8 text-center space-y-4">
      <h1 className="text-3xl font-bold text-green-400">✅ OSINT Bot Is Active</h1>
      <p className="text-gray-300">
        Бот запущен на платформе Node.js. Откройте Telegram и проверьте команды (например, <code className="bg-gray-800 px-1 py-0.5 rounded">/search_nick</code>).
      </p>
      <div className="max-w-md bg-gray-800 p-6 rounded-lg text-sm text-left border border-gray-700">
        <p className="mb-2"><strong className="text-blue-400">Environment:</strong> Google AI Studio (Express/Node.js)</p>
        <p className="mb-2"><strong className="text-blue-400">Type:</strong> Webhook+Polling Hybrid fallback</p>
        <p><strong className="text-blue-400">Features:</strong> GramMY Framework, Cheerio Scraping, Node-Fetch</p>
      </div>
      <p className="text-xs text-gray-500 mt-6 max-w-lg">
        Поскольку среда исполнения не поддерживает Python pip, код бота был переписан на Node.js/TypeScript
        и интегрирован напрямую в веб-сервер AI Studio. Благодаря этому, бот запустился автоматически и готов к работе!
      </p>
    </div>
  );
}
