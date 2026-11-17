// Cambia este valor temporalmente para probar vencimientos más cortos.
// Se comparte entre el JWT y la cookie para que ambos expiren al mismo tiempo.
// ⏰ TESTING: Cambiar a 2 minutos para verificar timers
// 📌 PRODUCCIÓN: Cambiar de vuelta a 15 minutos
export const AUTH_TOKEN_TTL_MINUTES = 2;
