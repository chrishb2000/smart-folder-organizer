# Smart Folder Organizer 🗂️

> Aplicación de escritorio inteligente que organiza varias carpetas a la vez, detecta archivos duplicados e **imágenes casi-duplicadas**, verifica la integridad de los archivos, renombra en lote, genera informes profesionales y más. **100% local, 100% privado y sin conexión a internet.**

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

- **🖼️ Imágenes Casi-Duplicadas (hash perceptual)**: Detecta fotos redimensionadas, re-saved o recortadas que los buscadores de duplicados clásicos (por hash MD5) no ven. Como Czkawka o dupeGuru, pero con una interfaz más moderna. Incluye sensibilidad ajustable (0 = exactas, 10 = muy parecidas).
- **✏️ Renombrado Masivo por Lotes**: Renombra cientos de archivos con patrones profesionales: `{fecha}`, `{nombre_limpio}`, `{sec}`, `{sec2}`, `{anio}`, `{mes}`, `{dia}`, `{carpeta}`, `{mtime}`, `{tamano}`... con vista previa antes de aplicar y deshacer desde el historial.
- **🔍 Verificación de Integridad**: Detecta **extensiones incorrectas** (el contenido real no coincide con la extensión, ej. un PDF renombrado a .png) y **archivos rotos/corruptos** (PNG/JPEG/PDF/GIF truncados) usando firma de bytes (magic numbers).
- **📊 Dashboard de Estadísticas**: Gráfico circular de categorías, top extensiones, carpetas más pesadas, distribución por tamaño, histograma de archivos por mes y **buscador/filtros en vivo** (nombre, tamaño mínimo, categoría) sobre todos los archivos analizados.
- **📄 Informes Profesionales (CSV/HTML)**: Exporta un inventario completo de los archivos analizados más la auditoría de acciones de la sesión. El informe HTML es visual y listo para imprimir o compartir.
- **🏃 Caché de Hashes Inteligente**: Los hashes MD5 se guardan entre análisis. Re-escanea la misma carpeta y la detección de duplicados es mucho más rápida.
- **📸 Metadatos EXIF**: La vista previa de imágenes muestra dimensiones, fecha de captura y cámara (modelo) extraídas localmente.
- **🗂️ Multi-Carpeta (Cola de Análisis)**: Añade tantas carpetas como quieras y escanea todas en lote con barra de progreso.
- **📁 Organizador Inteligente por Categorías**: Clasifica y mueve archivos a subcarpetas por tipo: **Imágenes, Vídeos, Audios, Documentos, Instaladores, Comprimidos, Código y Otros**, con **vista previa con miniaturas y metadatos** antes de aplicar.
- **📅 Organización por Fecha**: Organiza en `Año/Mes` usando la fecha del nombre o la fecha de modificación.
- **⚙️ Reglas Personalizadas**: Crea tus propias reglas (carpeta destino + extensiones) desde la interfaz. Se guardan y se aplican en todos los análisis.
- **🔄 Detector de Duplicados por Hash MD5**: Compara el contenido real de los archivos y agrupa las copias idénticas, con opción de **papelera o borrado seguro**.
- **🔙 Deshacer (Cuarentena)**: Cada movimiento, renombrado o eliminación puede revertirse desde el historial.
- **🗜️ Respaldo .zip Automático**: Antes de organizar o eliminar, crea un respaldo comprimido de los archivos afectados.
- **🧹 Modo Limpieza Seguro**: Elimina carpetas vacías y archivos temporales (`.tmp`, `.bak`, `.log`, `.old`, `.crdownload`...).
- **🛡️ Seguridad Total**: Todo el análisis se ejecuta **localmente en tu equipo**. Sin cuentas, sin nubes, sin anuncios.
- **🌓 Tema Dual (Claro / Oscuro)**: Conmutador instantáneo con persistencia de preferencia.
- **🖥️ Ventana Maximizada y Limpia**: Libre de menús nativos (`File`, `Edit`, `View`...).

---

## 🚀 Formas de Ejecución (¡1-Solo Clic!)

### 🪟 Opción 1: Instalador y Ejecutable Portable (.exe) — RECOMENDADA

Compila la aplicación como ejecutables nativos de Windows (sin necesidad de Node.js instalado):

```bash
npm install
npm run dist
```

Se generarán en la carpeta `dist/`:
- `SmartFolderOrganizer_3.0.0_portable.exe` → **versión portable**, sin instalación, lista para usar o llevar en un USB.
- `SmartFolderOrganizer_Setup_3.0.0.exe` → **instalador** que instala la app con acceso directo en el menú Inicio.

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
4. En **Organizar**: elige categorías, reglas personalizadas y si quieres organizar por fecha o auto-renombrar. Genera la vista previa (con miniaturas y metadatos EXIF) y aplica.
5. En **Imagenes Similares**: ajusta la sensibilidad y busca fotos casi-duplicadas (redimensionadas, re-saved, recortadas).
6. En **Renombrar**: escribe un patrón con tokens (ej. `{fecha}_{nombre_limpio}_{sec}`), genera la vista previa y aplica.
7. En **Duplicados**: revisa los grupos de archivos idénticos y elimina las copias extra (a papelera o borrado seguro).
8. En **Limpieza**: borra carpetas vacías, archivos temporales, **extensiones incorrectas** y **archivos rotos**.
9. En **Dashboard**: explora las estadísticas avanzadas y busca/filtra archivos en vivo.
10. En **Informes**: exporta el inventario completo en CSV o HTML.
11. En **Historial**: consulta todas las acciones, **deshaz** movimientos/renombrados o restaura archivos desde la cuarentena.
12. Activa la casilla **"Crear respaldo .zip"** para generar un comprimido de seguridad antes de cada acción destructiva.

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
├── main.js               # Proceso principal de Electron (IPC, cuarentena, respaldos, miniaturas, informes)
├── preload.js            # Puente seguro entre el frontend y Electron
├── renderer.js           # Lógica de la interfaz de usuario
├── index.html            # Estructura de la interfaz
├── styles.css            # Estilos con tema claro/oscuro
├── lib/scanner.js        # Motor de escaneo, categorías, duplicados (con caché) y verificación de integridad
├── lib/planner.js        # Planificador de organización (categorías, fechas, renombrado)
├── lib/imghash.js        # Hash perceptual (dHash) para imágenes casi-duplicadas
├── lib/renamer.js        # Renombrado masivo con tokens y vista previa
├── lib/signatures.js     # Magic bytes: extensiones incorrectas y archivos rotos
├── lib/stats.js          # Estadísticas avanzadas del dashboard
├── lib/reporter.js       # Informes CSV/HTML profesionales
├── lib/exif.js           # Metadatos EXIF de imágenes
├── test/                 # Tests unitarios de cada módulo + test de interfaz (E2E)
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