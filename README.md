# Integrated App - AIOps Configuration Management

## Descripción
Aplicación web integrada para gestión de configuraciones AIOps. Incluye:
- **Backend Python**: API REST con FastAPI para manejo de configuraciones
- **Frontend React**: Interfaz web moderna con Tailwind CSS

## 📋 Prerequisitos del Sistema

### Para Ubuntu/Linux:
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Python 3.11+ y pip
sudo apt install python3 python3-pip python3-venv -y

# Instalar Node.js 18+ y npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalaciones
python3 --version  # Debe ser 3.11+
node --version     # Debe ser 18+
npm --version
```

## 🚀 Instalación y Configuración

### Paso 1: Preparar el entorno Python (Backend)

```bash
# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
source venv/bin/activate

# Instalar dependencias Python
pip install -r requirements.txt
```

### Paso 2: Preparar el entorno Node.js (Frontend)

```bash
# Instalar dependencias de Node.js
npm install

# Construir el frontend para producción
npm run build
```

### Paso 3: Ejecutar el Backend

```bash
# Ejecutar el servidor Python en background
nohup python3 main_advanced.py > backend.log 2>&1 &

# Verificar que esté ejecutando
ps aux | grep main_advanced.py
tail -f backend.log
```

### Paso 4: Ejecutar el Frontend (Desarrollo)

```bash
# Ejecutar el servidor de desarrollo de React en background
nohup npm run dev > frontend.log 2>&1 &

# Verificar que esté ejecutando
ps aux | grep "npm run dev"
tail -f frontend.log
```

## 🔧 Configuración Inicial

1. **Acceder a la aplicación**: `http://localhost:5173` (frontend) o `http://localhost:8000` (backend API)
2. **Configurar Backend URL**: En la primera pantalla, configurar la URL del backend
3. **Crear usuario administrador**: Seguir el wizard de configuración inicial
4. **Configurar seguridad**: Deshabilitar usuario admin por defecto y habilitar autenticación

## 📊 Verificación de Estado

```bash
# Ver logs del backend
tail -f backend.log

# Ver logs del frontend
tail -f frontend.log

# Verificar puertos en uso
netstat -tlnp | grep -E ':(5173|8000)'

# Test de conectividad del backend
curl http://localhost:8000/health
```

## 🛑 Detener los Servicios

```bash
# Encontrar y detener procesos
pkill -f main_advanced.py
pkill -f "npm run dev"

# O usando PID específicos
ps aux | grep -E "(main_advanced|npm run dev)"
kill <PID>
```

## 📁 Estructura del Proyecto

```
integrated_app/
├── main_advanced.py          # Servidor backend principal
├── config.py                 # Configuraciones Python
├── config_handler.py         # Manejador de configuraciones
├── user_server.py            # Servidor de usuarios
├── user_encryption.py        # Encriptación de usuarios
├── utils.py                  # Utilidades Python
├── requirements.txt          # Dependencias Python
├── package.json              # Configuración Node.js
├── vite.config.js            # Configuración Vite
├── tailwind.config.js        # Configuración Tailwind
├── src/                      # Código fuente React
│   ├── App.jsx              # Componente principal
│   ├── main.jsx             # Punto de entrada
│   ├── components/          # Componentes React
│   ├── pages/               # Páginas React
│   ├── hooks/               # Hooks personalizados
│   └── services/            # Servicios API
├── app_data/                 # Datos de la aplicación
│   ├── config/              # Archivos de configuración
│   └── logs/                # Archivos de log
└── dist/                     # Build de producción
```

## 🔍 Solución de Problemas

### Error: Puerto ya en uso
```bash
# Liberar puerto 8000 (backend)
sudo lsof -ti:8000 | xargs kill -9

# Liberar puerto 5173 (frontend)
sudo lsof -ti:5173 | xargs kill -9
```

### Error: Dependencias faltantes
```bash
# Reinstalar dependencias Python
pip install -r requirements.txt --force-reinstall

# Reinstalar dependencias Node.js
rm -rf node_modules package-lock.json
npm install
```

### Error: Permisos
```bash
# Dar permisos de ejecución
chmod +x main_advanced.py

# Verificar permisos de carpetas
chmod -R 755 app_data/
```

---

## 📝 Log de Instalación y Correcciones

### Instalación Inicial - 16/07/2025

#### Problema 1: Error en postcss.config.js
**Error**: `SyntaxError: Unexpected token 'export'`
**Causa**: El archivo postcss.config.js usaba sintaxis ES modules pero package.json no tenía `"type": "module"`
**Solución**: Cambió el archivo de ES modules a CommonJS:
```javascript
// Antes:
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};

// Después:
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

#### Problema 2: Error ENOSPC - File watchers limit
**Error**: `Error: ENOSPC: System limit for number of file watchers reached`
**Causa**: Vite intentaba monitorear archivos del entorno virtual Python que no necesita
**Solución**: 
1. Aumentar límite del sistema:
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```
2. Crear `vite.config.js` para excluir carpetas innecesarias del watching:
   ```javascript
   // Configuración para ignorar venv, node_modules, etc.
   watch: {
     ignored: ['**/venv/**', '**/node_modules/**', ...]
   }
   ```

#### Problema 3: Configuración de Proxy para mayor seguridad
**Necesidad**: Las llamadas HTTP del frontend se ejecutaban desde el navegador del cliente
**Solución**: Configurar proxy en Vite para que las llamadas API se hagan desde el servidor frontend
**Beneficios**: 
- Solo el puerto 5173 expuesto (backend 8000 solo accesible internamente)
- Sin problemas de CORS
- Mejor seguridad
- Single point of entry

**Configuración aplicada en vite.config.js:**
```javascript
server: {
  proxy: {
    '/api': { target: 'http://localhost:8000' },
    '/config': { target: 'http://localhost:8000' },
    '/health': { target: 'http://localhost:8000' },
    '/git': { target: 'http://localhost:8000' },
    '/auth': { target: 'http://localhost:8000' },
    '/users': { target: 'http://localhost:8000' }
  }
}
```

**Flujo resultante:**
```
[Cliente] --> [Frontend :5173] --> [Backend :8000 (interno)]
```

#### Problema 4: URLs hardcodeadas en el frontend
**Problema**: El código JavaScript usaba URLs absolutas (http://localhost:8000) que no pasaban por el proxy
**Solución**: Modificar todas las llamadas fetch para usar URLs relativas
**Archivos modificados:**
- `configStorage.js`: Nueva función `getBackendUrlForConfig()` para configuración
- `ConfigurationPage.jsx`: Cambio de URLs absolutas a relativas
- `vite.config.js`: Agregado proxy para `/logs`

**Ejemplo de cambio:**
```javascript
// Antes:
fetch(`${getBackendUrl()}/users/login`, ...)

// Después:
fetch('/users/login', ...) // Pasa por el proxy de Vite
```
