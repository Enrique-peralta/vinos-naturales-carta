# Carta de vinos naturales

App de solo lectura para el personal de sala: filtra la carta (categoría, región,
etiquetas de cata, uva, precio), busca por nombre o productor con tolerancia a
errores tipográficos, y arma una shortlist con Nombre / Productora / Etiquetas
de cata / Precio para recomendar en mesa.

## Cómo funciona

- `index.html` — la interfaz, sin dependencias externas (un solo archivo).
- `api/wines.js` — función serverless de Vercel que lee la hoja de Google Sheets
  publicada en vivo, la parsea server-side (evita problemas de CORS en el
  cliente) y la devuelve como JSON limpio.

Los datos siempre reflejan la hoja de Google Sheets actual — no hace falta
volver a desplegar para ver cambios en la carta.

## Deploy

Proyecto listo para importar en Vercel (framework: Other / zero-config).
