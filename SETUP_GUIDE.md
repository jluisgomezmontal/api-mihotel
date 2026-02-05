# 🚀 Guía de Configuración - Local y Producción

## ✅ Fix Aplicado

El bug de autenticación ha sido corregido en `auth.controller.js`:
- Ahora la contraseña se hashea correctamente durante el registro
- El login funcionará para todas las cuentas creadas **después** del fix

---

## 🗑️ PASO 1: Limpiar Base de Datos

### **Eliminar usuarios y tenants con contraseñas sin hashear:**

**Opción A: MongoDB Atlas UI**
1. Ve a [MongoDB Atlas](https://cloud.mongodb.com/)
2. Conecta a tu cluster `ejido`
3. Selecciona la base de datos `mihotel`
4. Elimina todos los documentos de las colecciones:
   - `users`
   - `tenants`

**Opción B: MongoDB Compass**
1. Conecta con: `mongodb+srv://luis:220690@ejido.lpplq.mongodb.net/mihotel`
2. Elimina documentos de `users` y `tenants`

**Opción C: Comando MongoDB**
```javascript
// En MongoDB Shell
use mihotel
db.users.deleteMany({})
db.tenants.deleteMany({})
```

---

## 💻 PASO 2: Configuración LOCAL

### **Tu archivo `.env` actual (CORRECTO):**

```bash
# Database
MONGODB_URI=mongodb+srv://luis:220690@ejido.lpplq.mongodb.net/mihotel

# JWT
JWT_SECRET=cloud220690
JWT_EXPIRE=7d

# Server
PORT=3000
NODE_ENV=development

# Security
BCRYPT_SALT_ROUNDS=12

# CORS - Allowed origins (comma separated)
ALLOWED_ORIGINS=http://localhost:3001,https://web-mihotel.vercel.app
```

### **Verificar que funciona:**

1. **Inicia el servidor local:**
```bash
cd api-mihotel
npm run dev
```

2. **Deberías ver:**
```
🚀 Server running on port 3000
✅ MongoDB connected successfully
```

3. **Registra un tenant (Postman/Thunder Client/curl):**
```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "tenant": {
    "name": "Hotel Local Test",
    "type": "hotel",
    "plan": "basic"
  },
  "admin": {
    "name": "Admin Local",
    "email": "admin@local.com",
    "password": "password123"
  }
}
```

4. **Haz login:**
```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "admin@local.com",
  "password": "password123"
}
```

5. **Deberías recibir:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "tenant": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 🌐 PASO 3: Configuración PRODUCCIÓN (Render)

### **Variables de Entorno en Render:**

Ve a tu servicio en Render → **Environment** → Agrega/Actualiza:

```bash
# 🔴 CRÍTICO - Modo producción
NODE_ENV=production

# 🔴 CRÍTICO - Base de datos (LA MISMA que local o una diferente)
MONGODB_URI=mongodb+srv://luis:220690@ejido.lpplq.mongodb.net/mihotel

# 🔴 CRÍTICO - JWT Secret (DEBE ser diferente y más seguro en producción)
JWT_SECRET=8f3a9b2c7e1d4f6a8b9c2e5d7f1a3b6c9e2d5f8a1b4c7e9f2a5d8b1c4e7f9a2b5d8e1f4a7b

# JWT Expiración
JWT_EXPIRE=7d

# Puerto (Render lo asigna automáticamente, pero puedes dejarlo)
PORT=10000

# Seguridad
BCRYPT_SALT_ROUNDS=12

# 🔴 CRÍTICO - CORS (tus dominios de frontend)
ALLOWED_ORIGINS=https://web-mihotel.vercel.app,https://tu-dominio-custom.com
```

### **Generar JWT_SECRET seguro:**

En tu terminal local ejecuta:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copia el resultado y úsalo como `JWT_SECRET` en Render.

---

## 🔐 MongoDB Atlas - Configuración de Red

### **Para que Render pueda conectarse:**

1. Ve a [MongoDB Atlas](https://cloud.mongodb.com/)
2. Cluster `ejido` → **Network Access**
3. **Add IP Address**
4. Selecciona: **ALLOW ACCESS FROM ANYWHERE** (0.0.0.0/0)
5. Guarda

**⚠️ Nota:** Esto es seguro porque MongoDB requiere usuario/contraseña de todas formas.

---

## 🚀 PASO 4: Desplegar en Render

### **1. Commit y Push del Fix:**
```bash
git add .
git commit -m "fix: ensure password is properly hashed during registration"
git push origin main
```

### **2. Render Redesplegará Automáticamente**
- Ve a tu dashboard de Render
- Espera a que el deploy termine (2-5 minutos)
- Verifica que el estado sea "Live"

### **3. Verificar Logs en Render:**
- Haz clic en tu servicio
- Ve a **Logs**
- Deberías ver:
```
🚀 Server running on port 10000
✅ MongoDB connected successfully
```

---

## ✅ PASO 5: Probar en Producción

### **1. Registra un tenant en producción:**
```bash
POST https://tu-api.onrender.com/api/auth/register
Content-Type: application/json

{
  "tenant": {
    "name": "Hotel Producción",
    "type": "hotel",
    "plan": "basic"
  },
  "admin": {
    "name": "Admin Prod",
    "email": "admin@prod.com",
    "password": "password123"
  }
}
```

### **2. Haz login en producción:**
```bash
POST https://tu-api.onrender.com/api/auth/login
Content-Type: application/json

{
  "email": "admin@prod.com",
  "password": "password123"
}
```

### **3. Deberías recibir el token:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "..."
  }
}
```

---

## 🔍 Diferencias Clave: Local vs Producción

| Configuración | Local | Producción (Render) |
|---------------|-------|---------------------|
| **NODE_ENV** | `development` | `production` |
| **PORT** | `3000` | `10000` (o el que Render asigne) |
| **JWT_SECRET** | Simple (dev) | Complejo y seguro |
| **MONGODB_URI** | Puede ser la misma o diferente | Misma o cluster separado |
| **ALLOWED_ORIGINS** | `http://localhost:3001` | `https://web-mihotel.vercel.app` |
| **Logs** | Detallados | Mínimos |
| **Rate Limiting** | 50 intentos/15min | 5 intentos/15min |

---

## 🐛 Troubleshooting

### **Problema: "Invalid email or password" después del fix**

**Causa:** Usuarios creados ANTES del fix tienen contraseñas sin hashear.

**Solución:**
1. Elimina esos usuarios de la base de datos
2. Registra nuevos usuarios DESPUÉS del fix

---

### **Problema: "Tenant subscription has expired"**

**Causa:** El tenant tiene fecha de expiración vencida.

**Solución:**
```javascript
// En MongoDB, actualiza el tenant:
db.tenants.updateOne(
  { _id: ObjectId("tu_tenant_id") },
  { $set: { "subscription.endDate": new Date("2026-12-31") } }
)
```

---

### **Problema: "Cannot connect to MongoDB" en Render**

**Causa:** IP no está en whitelist.

**Solución:**
1. MongoDB Atlas → Network Access
2. Add IP: `0.0.0.0/0`

---

### **Problema: CORS error en frontend**

**Causa:** El dominio del frontend no está en `ALLOWED_ORIGINS`.

**Solución:**
1. En Render, actualiza `ALLOWED_ORIGINS`
2. Incluye: `https://web-mihotel.vercel.app`

---

## ✅ Checklist Final

### **Local:**
- [ ] Archivo `.env` configurado correctamente
- [ ] Base de datos limpia (usuarios/tenants eliminados)
- [ ] Servidor corriendo (`npm run dev`)
- [ ] Registro de tenant exitoso
- [ ] Login exitoso
- [ ] Token recibido

### **Producción (Render):**
- [ ] Variables de entorno configuradas
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` seguro (64+ caracteres)
- [ ] `ALLOWED_ORIGINS` con dominio correcto
- [ ] MongoDB Atlas IP whitelist: `0.0.0.0/0`
- [ ] Código con fix pusheado
- [ ] Deploy exitoso en Render
- [ ] Registro de tenant exitoso
- [ ] Login exitoso
- [ ] Token recibido

---

## 🎯 Resumen

### **El Fix:**
✅ Contraseña ahora se hashea correctamente en el registro

### **Para que funcione:**
1. ✅ Limpia la base de datos (elimina usuarios/tenants viejos)
2. ✅ Configura variables de entorno en local (ya está)
3. ✅ Configura variables de entorno en Render
4. ✅ Push del código con el fix
5. ✅ Espera el deploy en Render
6. ✅ Registra nuevos usuarios
7. ✅ Haz login sin problemas

### **Diferencias importantes:**
- **Local:** `NODE_ENV=development` (logs detallados, rate limiting relajado)
- **Producción:** `NODE_ENV=production` (logs mínimos, rate limiting estricto, JWT_SECRET seguro)

---

## 📞 Soporte

Si después de seguir estos pasos aún tienes problemas:

1. **Verifica logs en Render:**
   - Dashboard → Tu servicio → Logs
   - Busca errores de conexión o autenticación

2. **Verifica MongoDB Atlas:**
   - Cluster activo
   - IP whitelist configurada
   - Credenciales correctas

3. **Verifica variables de entorno:**
   - Render → Environment
   - Sin espacios extras
   - Sin comillas en los valores

---

**¡Listo! Ahora podrás iniciar sesión en local y producción sin problemas** 🎉
