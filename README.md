# Smart Folder Organizer 🗂️

> Aplicación de escritorio inteligente que organiza varias carpetas a la vez, detecta archivos duplicados, organiza por fecha, aplica reglas personalizadas, crea respaldos .zip y más. **100% local, 100% privado y sin conexión a internet.**

[![Electron](https://img.shields.io/badge/Electron-31-blue.svg)](https://www.electronjs.org/)
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

- **🗂️ Multi-Carpeta (Cola de Análisis)**: Añade tantas carpetas como quieras (Descargas, Escritorio, Documentos...) y escanea todas en lote con barra de progreso y estado por carpeta.
- **📁 Organizador Inteligente por Categorías**: Clasifica y mueve archivos a subcarpetas por tipo: **Imágenes, Vídeos, Audios, Documentos, Instaladores, Comprimidos, Código y Otros**. Con **vista previa antes de aplicar** y resolución automática de conflictos de nombres.
- **📅 Organización por Fecha**: Detecta la fecha del nombre del archivo (ej. `2024-05-12_factura.pdf`) o la fecha de modificación y organiza en `Año/Mes` automáticamente.
- **⚙️ Reglas Personalizadas**: Crea tus propias reglas (carpeta destino + extensiones) directamente desde la interfaz. Se guardan y se aplican en todos los análisis.
- **🖼️ Vista Previa de Imágenes**: Las miniaturas de fotos y capturas se generan en tiempo real dentro del plan de organización para que veas qué vas a mover.
- **🔄 Detector de Duplicados por Hash MD5**: Compara el contenido real de los archivos y agrupa las copias idénticas. Elimina las copias extra conservando la original, **con opción de moverlas a la papelera o borrarlas de forma segura**.
- **🔙 Deshacer (Cuarentena)**: Cada movimiento o eliminación puede revertirse desde el historial. Los archivos eliminados viajan a una **cuarentena** de la que puedes restaurarlos.
- **🗜️ Respaldo .zip Automático**: Antes de organizar o eliminar, crea un respaldo comprimido de los archivos afectados para total tranquilidad.
- **📊 Gráfico de Distribución de Espacio**: Visualiza en un gráfico circular cuánto espacio ocupa cada categoría y la suma total del análisis.
- **🧹 Modo Limpieza Seguro**: Elimina carpetas vacías y archivos temporales (`.tmp`, `.bak`, `.log`, `.old`, `.crdownload`...) con confirmación previa.
- **🛡️ Seguridad Total**: Todo el análisis se ejecuta **localmente en tu equipo**. Ningún archivo sale de tu ordenador. Sin cuentas, sin nubes, sin anuncios.
- **🌓 Tema Dual (Claro / Oscuro)**: Conmutador instantáneo en la barra superior con persistencia de preferencia.
- **🖥️ Ventana Maximizada y Limpia**: Se abre a pantalla completa por defecto, libre de menús nativos (`File`, `Edit`, `View`...).

---

## 🚀 Formas de Ejecución (¡1-Solo Clic!)

### 🪟 Opción 1: Instalador y Ejecutable Portable (.exe) — RECOMENDADA

Compila la aplicación como ejecutables nativos de Windows (sin necesidad de Node.js instalado):

```bash
npm install
npm run dist
```

Se generarán en la carpeta `dist/`:
- `SmartFolderOrganizer_2.0.0_portable.exe` → **versión portable**, sin instalación, lista para usar o llevar en un USB.
- `SmartFolderOrganizer_Setup_2.0.0.exe` → **instalador** que instala la app con acceso directo en el menú Inicio.

> ⚠️ Nota de compilación: en Windows, la extracción del empaquetador requiere **Modo Desarrollador** o permisos de administrador para crear enlaces simbólicos. Si tu máquina no lo permite, usa la Opción 2 (100% funcional).

### 🌟 Opción 2: Ejecución con 1-Solo Clic en Windows (`run-organizer.bat`)

1. Descarga o clona este repositorio.
2. Haz **doble clic** en el archivo [`run-organizer.bat`](run-organizer.bat).
3. El script verificará que Node.js esté instalado, ejecutará `npm install` automáticamente la primera vez y abrirá la aplicación.

### 🖥️ Opción 3: Inicio manual mediante terminal

```bash
npm install
npm start
```

---

## 🛠️ Guía de Uso Rápida

1. **Inicia la aplicación** con el `.exe` instalado o con `run-organizer.bat` (1 clic).
2. Pulsa **"Añadir Carpeta"** para elegir las carpetas que quieres analizar (puedes añadir varias).
3. Espera a que termine el análisis (verás el progreso y el gráfico de espacio en tiempo real).
4. En **Organizar**: elige categorías, reglas personalizadas y si quieres organizar por fecha o auto-renombrar. Genera la vista previa (con miniaturas de imágenes) y aplica.
5. En **Duplicados**: revisa los grupos de archivos idénticos y elimina las copias extra (a papelera o borrado seguro).
6. En **Limpieza**: borra carpetas vacías y archivos temporales.
7. En **Historial**: consulta todas las acciones, **deshaz** cualquier movimiento o restaura archivos desde la cuarentena.
8. Activa la casilla **"Crear respaldo .zip"** para generar un comprimido de seguridad antes de cada acción destructiva.

> ⚠️ **Consejo de seguridad**: la aplicación siempre te pide confirmación antes de mover o eliminar archivos. Revisa las vistas previas antes de aplicar cualquier acción.

---

## 🧪 Pruebas

El proyecto incluye pruebas de la lógica de escaneo, categorización, planificación y un test de interfaz completo (E2E):

```bash
# Pruebas unitarias (escáner y planificador)
npm test

# Prueba de interfaz completa (E2E) que lanza la app y verifica tema, escaneo,
# organización, deshacer, miniaturas, reglas, borrado seguro y respaldo .zip
npm run test:e2e
```

---

## 📁 Estructura del Proyecto

```
smart-folder-organizer/
├── main.js               # Proceso principal de Electron (IPC, cuarentena, respaldos, miniaturas)
├── preload.js            # Puente seguro entre el frontend y Electron
├── renderer.js           # Lógica de la interfaz de usuario
├── index.html            # Estructura de la interfaz
├── styles.css            # Estilos con tema claro/oscuro
├── lib/scanner.js        # Motor de escaneo, categorización y detección de duplicados
├── lib/planner.js        # Planificador de organización (categorías, fechas, renombrado)
├── test/scanner.test.js  # Pruebas del escáner
├── test/planner.test.js  # Pruebas del planificador
├── test/e2e.smoke.js     # Prueba de interfaz completa (E2E)
├── build/icon.ico        # Icono de la aplicación para los ejecutables
├── scripts/make-icon.js  # Generador del icono (PNG + ICO multi-tamaño)
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