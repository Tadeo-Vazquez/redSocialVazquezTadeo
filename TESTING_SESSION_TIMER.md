# 🧪 Testing del Temporizador de Sesión y JWT

## ⚠️ Estado Actual
✅ **El código está configurado en TESTING MODE (2 minutos)**

```
Cambios realizados:
- ✅ backend/src/auth/auth.constants.ts: AUTH_TOKEN_TTL_MINUTES = 2 (en lugar de 15)
- ✅ frontend/src/app/services/session-timer.ts: TOTAL_SESSION_TIME_MS = 2 minutos
```

---

## 🎯 Cómo Testear

### **Paso 1: Iniciar Backend**
```bash
cd backend
npm run dev
```

### **Paso 2: Iniciar Frontend**
```bash
cd frontend
npm run start
```

### **Paso 3: Hacer Login**
1. Ir a `http://localhost:4200`
2. Click en "Iniciar sesión"
3. Usar credenciales de demo:
   - **Email:** tadeo@gmail.com
   - **Contraseña:** Tadeo@123

---

## ✅ Test 1: Verificar que aparece el Modal

**Objetivo:** Confirmar que el modal aparece cuando quedan 60 segundos

**Pasos:**
1. Haz login
2. **Espera 60 segundos** (1 minuto)
3. Verás que aparece un modal: **"Tu sesión está por expirar"**
4. El modal muestra: **"Quedan 60 segundos"**

**Resultado esperado:**
- ✅ Modal aparece automáticamente
- ✅ Muestra botones: "Extender sesión" y "Cerrar sesión"
- ✅ Countdown cuenta hacia atrás

---

## ✅ Test 2: Verificar que Expira Automáticamente

**Objetivo:** Confirmar que la sesión expira después de 2 minutos

**Pasos:**
1. Haz login (esto inicia el timer de 2 minutos)
2. **Espera 1 minuto 10 segundos** (aparece modal)
3. **NO hagas nada** (no clicks el modal)
4. **Espera otros 50 segundos** (total 2 minutos)

**Resultado esperado:**
- ✅ Sesión expira automáticamente
- ✅ Se te redirige a `/login`
- ✅ Ves mensaje: **"Tu sesión ha expirado"** (SnackBar)
- ✅ Debes volver a hacer login

**Qué está pasando:**
- Backend: JWT expira después de 2 minutos
- Frontend: `UnauthorizedInterceptor` captura 401
- Interceptor: Borra sesión y redirige a login

---

## ✅ Test 3: Extender la Sesión (Botón "Extender")

**Objetivo:** Verificar que POST /refrescar funciona

**Pasos:**
1. Haz login
2. **Espera ~60 segundos**
3. Aparece el modal
4. **Click en "Extender sesión"**
5. El modal desaparece
6. **Espera otros ~60 segundos**
7. El modal vuelve a aparecer

**Resultado esperado:**
- ✅ Al hacer click en "Extender", se llama POST `/auth/refrescar`
- ✅ Backend devuelve nuevo JWT
- ✅ Nueva Cookie HttpOnly se establece
- ✅ Timer reinicia (otros 2 minutos)
- ✅ Modal se cierra
- ✅ 60 segundos después, el modal reaparece

**En la consola del navegador verás:**
```
[SessionTimer] Timer iniciado...
[SessionTimer] Modal de advertencia mostrado
[Auth] Solicitud de refresco...
[Auth] JWT refrescado exitosamente
[SessionTimer] Timer reiniciado
```

---

## ✅ Test 4: Cerrar la Sesión Manualmente

**Objetivo:** Verificar que el botón "Cerrar sesión" funciona

**Pasos:**
1. Haz login
2. **Espera ~60 segundos** (aparece modal)
3. **Click en "Cerrar sesión"**

**Resultado esperado:**
- ✅ Se cierra el modal
- ✅ La sesión se cierra
- ✅ Se te redirige a `/login`
- ✅ sessionStorage se limpia
- ✅ Cookie HttpOnly se expira

---

## ✅ Test 5: Verificar Reinicio por Actividad

**Objetivo:** Comprobar que el timer se reinicia cuando haces clic/escribes

**Pasos:**
1. Haz login (timer inicia)
2. **Espera 50 segundos**
3. **Haz clic en cualquier lugar** de la página (simula actividad)
4. El timer debe reiniciarse
5. **Espera 60 segundos más** (desde el nuevo inicio)
6. El modal debería aparecer

**Resultado esperado:**
- ✅ Cada clic/keystroke reinicia el timer
- ✅ Usuario activo nunca experimenta timeout
- ✅ Solo expira si está inactivo

---

## 🔒 Test 6: Verificar Seguridad

**Objetivo:** Comprobar que el JWT está protegido

**Pasos:**
1. Haz login
2. Abre **DevTools** (F12)
3. Ir a **Application** → **Cookies**
4. Buscar cookie named `auth_token` o similar

**Resultado esperado:**
- ✅ La cookie existe
- ✅ Tiene flag `HttpOnly` (no puedes verla)
- ✅ Tiene flag `Secure` (solo en HTTPS en producción)
- ✅ Tiene flag `SameSite=Lax`

**En DevTools, en la consola, intenta:**
```javascript
// Esto debería retornar undefined (la cookie está oculta)
document.cookie
```

**Resultado:** `""` o contenido que NO incluye el JWT (es seguro)

---

## 🔄 Volver a Producción (15 minutos)

Cuando termines de testear, **revierte los cambios:**

### **Backend:**
```bash
# Editar: backend/src/auth/auth.constants.ts
export const AUTH_TOKEN_TTL_MINUTES = 15;  // Vuelvo a 15 minutos
```

### **Frontend:**
```bash
# Editar: frontend/src/app/services/session-timer.ts
private readonly TOTAL_SESSION_TIME_MS = 15 * 60 * 1000;    // 15 minutos
private readonly WARNING_TIME_MS = 10 * 60 * 1000;          // 10 minutos
private readonly REMAINING_TIME_MS = 5 * 60 * 1000;         // 5 minutos
```

Luego reinicia ambos servidores.

---

## 📊 Detalles Técnicos

### Backend (NestJS)
```typescript
// auth.constants.ts
export const AUTH_TOKEN_TTL_MINUTES = 2;  // ← Controla exp claim del JWT

// auth.module.ts
JwtModule.register({
  secret: process.env.JWT_SECRET,
  signOptions: { expiresIn: `${AUTH_TOKEN_TTL_MINUTES}m` },  // ← 2m
})

// auth.controller.ts
res.cookie('auth_token', token, {
  maxAge: AUTH_TOKEN_TTL_MINUTES * 60 * 1000,  // ← 2 min en ms
  httpOnly: true,
  secure: false,  // true en producción con HTTPS
  sameSite: 'lax',
})
```

### Frontend (Angular)
```typescript
// session-timer.ts
private readonly TOTAL_SESSION_TIME_MS = 2 * 60 * 1000;    // ← 2 min
private readonly WARNING_TIME_MS = 1 * 60 * 1000;          // ← 1 min
private readonly REMAINING_TIME_MS = 1 * 60 * 1000;        // ← 1 min

startTimer() {
  // Modal aparece a los WARNING_TIME_MS (60 seg)
  setTimeout(() => this.showWarningDialog(), this.WARNING_TIME_MS);
  
  // Sesión expira a los TOTAL_SESSION_TIME_MS (2 min)
  setTimeout(() => this.expireSession(), this.TOTAL_SESSION_TIME_MS);
}
```

---

## 🐛 Troubleshooting

### "El modal no aparece"
- Verifica que esperaste 60 segundos exactos
- Revisa la consola (F12) por errores
- Asegúrate de estar logged in

### "La sesión expira muy rápido"
- Verifica que `AUTH_TOKEN_TTL_MINUTES = 2` en backend
- Reconstruye el backend: `npm run build`
- Reinicia: `npm run dev`

### "El botón 'Extender' no funciona"
- Revisa que `/auth/refrescar` está en backend
- Verifica que `auth.refresh()` está en frontend
- Mira la consola por errores HTTP (401, 500, etc)

### "No se cierra la sesión automáticamente"
- El timer podría estar reiniciándose por actividad
- Intenta sin mover el mouse ni tocar el teclado
- Verifica la consola: `[SessionTimer]` logs

---

## ✅ Checklist de Testing

```
Sesión de 2 minutos:
☐ Login exitoso
☐ Modal aparece a 60 segundos
☐ Sesión expira a 120 segundos (sin extender)
☐ Botón "Extender" funciona
☐ POST /refrescar devuelve nuevo JWT
☐ Timer reinicia después de extender
☐ Actividad del usuario reinicia el timer
☐ Logout manual funciona
☐ Cookie HttpOnly está protegida
☐ 401 Unauthorized redirige a login

Backend:
☐ /auth/refrescar funciona
☐ JWT tiene exp claim correcto
☐ Cookie expira a los 2 minutos

Frontend:
☐ SessionTimer inicia en login/register
☐ UnauthorizedInterceptor captura 401
☐ SessionWarningDialog abre a tiempo
☐ Router navega a /login en error
☐ sessionStorage se limpia en logout
```

---

## 📝 Notas

- Estos cambios son **TEMPORALES** solo para testing
- **NO commitear** con estos valores en producción
- Una vez terminado el testing, **revierte a 15 minutos**
- El código está bien comentado para entender el flujo

¡Happy testing! 🚀
