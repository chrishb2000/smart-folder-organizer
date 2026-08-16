# Smart Folder Organizer 🗂️

> Aplicación de escritorio inteligente que organiza tus carpetas automáticamente, detecta archivos duplicados, encuentra archivos grandes y limpia basura. **100% local, 100% privado y sin conexión a internet.**

[![TypeScript](https://img.shields.io/badge/Electron-31-blue.svg)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Prerrequisitos de Sistema

Para utilizar **Smart Folder Organizer** en tu ordenador, únicamente necesitas:

| Requisito | Versión Mínima | Enlace Oficial de Descarga Gratuita |
| :--- | :--- | :--- |
| **Node.js** | **v18.0.0** o superior | 🌐 [Descargar Node.js LTS (nodejs.org)](https://nodejs.org/) |

> 💡 **Nota**: No necesitas instalar paquetes ni librerías adicionales. El ejecutable [`run-organizer.bat`](run-organizer.bat) detectará si tienes Node.js, instalará las dependencias automáticamente en su primer inicio y abrirá la aplicación.

---

## 🖥️ Características de la Aplicación de Escritorio

- **🔍 Análisis Profundo por Carpeta**: Selecciona cualquier carpeta (Descargas, Escritorio, Documentos, un proyecto completo) y el sistema escanea de forma recursiva todos los archivos y subcarpetas con barra de progreso en tiempo real.
- **📁 Organizador Inteligente por Categorías**: Clasifica y mueve automáticamente los archivos a subcarpetas por tipo: **Imágenes, Vídeos, Audios, Documentos, Instaladores, Comprimidos, Código y Otros**. Con **vista previa** antes de aplicar y resolución automática de conflictos de nombres.
- **🔄 Detector de Duplicados por Hash MD5**: Compara el contenido real de los archivos (no solo el nombre) y agrupa las copias idénticas. Elimina las copias extra conservando una versión original.
- **📊 Archivos Grandes**: Identifica los 30 archivos de mayor tamaño para que liberes espacio rápidamente.
- **🧹 Modo Limpieza Seguro**: Elimina carpetas vacías y archivos temporales (`.tmp`, `.bak`, `.log`, `.old`, `.crdownload`...) con confirmación previa.
- **📜 Historial de Acciones**: Cada movimiento o eliminación queda registrado en el panel de historial de la sesión.
- **🛡️ Seguridad Total**: Todo el análisis se ejecuta **localmente en tu equipo**. Ningún archivo sale de tu ordenador. Sin cuentas, sin nubes, sin anuncios.
- **🌓 Tema Dual (Claro / Oscuro)**: Conmutador instantáneo en la barra superior con persistencia de preferencia.
- **🖥️ Ventana Maximizada y Limpia**: Se abre en pantalla completa por defecto, libre de menús nativos (`File`, `Edit`, `View`...).

---

## 🚀 Formas de Ejecución (¡1-Solo Clic!)

### 🌟 Opción 1: Ejecución con 1-Solo Clic en Windows (`run-organizer.bat`)

1. Descarga o clona este repositorio.
2. Haz **doble clic** en el archivo [`run-organizer.bat`](run-organizer.bat).
3. El script verificará que Node.js esté instalado, ejecutará `npm install` automáticamente la primera vez y abrirá la aplicación.

### 🖥️ Opción 2: Inicio manual mediante terminal

```bash
npm install
npm start
```

---

## 🛠️ Guía de Uso Rápida

1. **Inicia la aplicación** con `run-organizer.bat` (1 clic).
2. Pulsa **"Seleccionar Carpeta"** y elige la carpeta que quieres analizar.
3. Espera a que termine el análisis (verás el progreso en tiempo real).
4. Explora las pestañas:
   - **Organizar**: marca las categorías, genera la vista previa y aplica el orden automático.
   - **Duplicados**: revisa los grupos de archivos idénticos y elimina las copias extra.
   - **Archivos Grandes**: localiza qué ocupa más espacio.
   - **Limpieza**: borra carpetas vacías y archivos temporales.
   - **Historial**: consulta todas las acciones realizadas.

> ⚠️ **Consejo de seguridad**: la aplicación siempre te pide confirmación antes de mover o eliminar archivos. Revisa las vistas previas antes de aplicar cualquier acción.

---

## 🧪 Pruebas

El proyecto incluye pruebas de la lógica de escaneo, categorización y detección de duplicados:

```bash
node test/scanner.test.js
```

---

## 📁 Estructura del Proyecto

```
smart-folder-organizer/
├── main.js               # Proceso principal de Electron (IPC y acciones de archivos)
├── preload.js            # Puente seguro entre el frontend y Electron
├── renderer.js           # Lógica de la interfaz de usuario
├── index.html            # Estructura de la interfaz
├── styles.css            # Estilos con tema claro/oscuro
├── lib/scanner.js        # Motor de escaneo, categorización y detección de duplicados
├── test/scanner.test.js  # Pruebas automáticas
├── run-organizer.bat     # Ejecutable de 1-clic para Windows
└── package.json          # Configuración del proyecto
```

---

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Consulta el archivo [`LICENSE`](LICENSE).

---

## Autor y apoyo

Desarrollado por [Christian Freelance](https://christian-freelance.us/).

Si el proyecto te resulta útil, puedes
[invitarme a un café mediante PayPal](https://www.paypal.com/donate/?hosted_button_id=YC6YAWBQ7HNSS).