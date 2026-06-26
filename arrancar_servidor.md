# Arrancar Servidores — OpenConstructionERP

Ruta base del proyecto:
```
D:\1-NUBE\ALMACENAMIENTO CENTRAL\CM\1-3-CMPROYECTOS\2-INSTALACIÓN-CMPROYECTOS-ERP\ERP-main\ERP-DEEP
```

---

## 1. Backend (FastAPI + PostgreSQL 16 embebido)

**Puerto:** `8000`  
**Directorio:** `backend\`

```powershell
cd "D:\1-NUBE\ALMACENAMIENTO CENTRAL\CM\1-3-CMPROYECTOS\2-INSTALACIÓN-CMPROYECTOS-ERP\ERP-main\ERP-DEEP\backend"

openconstructionerp serve --port 8000
```

**Primera ejecución:** tarda hasta 30 segundos (crea la BD, aplica migraciones, carga datos demo).  
**Ejecuciones siguientes:** arranca en ~5-10 segundos.

**Verificar:**
```
http://127.0.0.1:8000/api/health     ← Health check (JSON)
http://127.0.0.1:8000/api/docs       ← Documentación Swagger
```

---

## 2. Frontend (React + Vite)

**Puerto:** `5173`  
**Directorio:** `frontend\`

```powershell
cd "D:\1-NUBE\ALMACENAMIENTO CENTRAL\CM\1-3-CMPROYECTOS\2-INSTALACIÓN-CMPROYECTOS-ERP\ERP-main\ERP-DEEP\frontend"

npm run dev
```

El frontend hace proxy de `/api/*` → `http://127.0.0.1:8000` automáticamente.

**Abrir en navegador:**
```
http://127.0.0.1:5173
```

---

## 3. Credenciales demo

| Campo | Valor |
|---|---|
| Email | `demo@openconstructionerp.com` |
| Contraseña | `DemoPass1234!` |

---

## 4. Detener los servidores

- Backend: `Ctrl+C` en la terminal donde corre `openconstructionerp`
- Frontend: `Ctrl+C` en la terminal donde corre `npm run dev`

O forzar desde otra terminal:

```powershell
# Matar backend (buscar proceso openconstructionerp o python)
taskkill /F /IM python.exe   # (si solo corre el backend)

# Matar frontend (buscar proceso node de vite)
taskkill /F /IM node.exe     # (si solo corre el frontend)
```

---

## 5. Resumen rápido (copiar y pegar)

```powershell
# Terminal 1 — Backend
cd "D:\1-NUBE\ALMACENAMIENTO CENTRAL\CM\1-3-CMPROYECTOS\2-INSTALACIÓN-CMPROYECTOS-ERP\ERP-main\ERP-DEEP\backend"
openconstructionerp serve --port 8000

# Terminal 2 — Frontend
cd "D:\1-NUBE\ALMACENAMIENTO CENTRAL\CM\1-3-CMPROYECTOS\2-INSTALACIÓN-CMPROYECTOS-ERP\ERP-main\ERP-DEEP\frontend"
npm run dev
```

Abrir: **http://127.0.0.1:5173**
