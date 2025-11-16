// server.js
// Importa los módulos necesarios
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Carga las variables de entorno desde el archivo .env
dotenv.config();

// Crea una instancia de la aplicación Express
const app = express();

// Puerto configurable desde variable de entorno o 3000 por defecto
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON en el body de las peticiones
app.use(express.json());

// Middleware para servir los archivos estáticos (HTML, CSS, JS) de la carpeta 'public'
// Esto es clave para que encuentre tu index.html, chefs.html, gracias.html, etc.
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para enviar mensajes a Telegram de forma segura
app.post('/api/send-message', async (req, res) => {
    // 'keyboard' se recibe correctamente del frontend
    const { text, keyboard } = req.body; 

    const token =8394638980:AAEnt8dwtvSdNHoENRHdaGKpABNbpxDh8BY;
    const chat_id =-5014745841;

    if (!token || !chat_id) {
        return res.status(500).json({ error: 'Las variables de entorno de Telegram no están configuradas en el servidor.' });
    }

    if (!text) {
        return res.status(400).json({ error: 'El texto del mensaje es requerido.' });
    }

    try {
        // Usamos fetch (disponible en Node.js 18+) para comunicarnos con la API de Telegram
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chat_id,
                text: text,
                // 'reply_markup' espera el objeto 'keyboard' que le mandaste
                reply_markup: keyboard, 
            }),
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Error al enviar mensaje a Telegram:', error);
        res.status(500).json({ error: 'Error interno del servidor al contactar a Telegram.' });
    }
});

// Endpoint seguro para verificar la respuesta (callback) de Telegram
app.get('/api/check-update/:messageId', async (req, res) => {
    const { messageId } = req.params;
    const token =8394638980:AAEnt8dwtvSdNHoENRHdaGKpABNbpxDh8BY;
    const chat_id =-5014745841;

    if (!token || !chat_id) {
        return res.status(500).json({ error: 'Variables de entorno de Telegram no configuradas.' });
    }

    let updateFound = false;
    const startTime = Date.now();
    const timeout = 600000; // 60 segundos de espera máxima

    // Variable para el offset de getUpdates
    let lastUpdateId = 0;

    // Bucle de "Long Polling"
    while (Date.now() - startTime < timeout && !updateFound) {
        try {
            // Usamos un offset para pedir a Telegram solo actualizaciones nuevas
            const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&limit=1`);
            const data = await response.json();

            if (data.ok && data.result.length > 0) {
                // Busca la actualización de callback que coincida con nuestro ID de mensaje
                const relevantUpdate = data.result.find(
                    (update) =>
                    update.callback_query &&
                    update.callback_query.message.message_id == messageId
                );

                // Actualizamos el offset para la próxima petición, incluso si no es nuestro mensaje
                lastUpdateId = data.result[data.result.length - 1].update_id;

                if (relevantUpdate) {
                    updateFound = true;
                    // Extrae la acción (ej: 'pedir_logo')
                    const action = relevantUpdate.callback_query.data.split(':')[0];

                    // Responde a Telegram para que sepa que recibimos el callback
                    // (Esto es opcional pero buena práctica)
                    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ callback_query_id: relevantUpdate.callback_query.id })
                    });


                    // Eliminar los botones del mensaje en Telegram
                    await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chat_id,
                            message_id: messageId,
                            reply_markup: { inline_keyboard: [] } // Un teclado vacío
                        }),
                    });

                    // Enviar la acción al frontend
                    return res.json({ action });
                }
            }
        } catch (error) {
            console.error('Error durante el polling:', error);
            // Esperar antes de reintentar para no saturar en caso de error de red
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        // Esperar 2 segundos antes de la siguiente verificación
        if (!updateFound) await new Promise(resolve => setTimeout(resolve, 2000));
    }
    // Si se agota el tiempo, enviar una respuesta de timeout
    return res.status(408).json({ error: 'Timeout: No se recibió respuesta del operador.' });
});

// --- Ruta Catch-All para servir la SPA ---
// Esta es la ruta que tú proporcionaste. Es perfecta.
// Cualquier solicitud que no coincida con '/api/...' será respondida con tu index.html
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
